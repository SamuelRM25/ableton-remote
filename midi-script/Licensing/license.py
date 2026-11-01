"""Licence state for this computer.

The DAW Remote server hands out a signed token:

    base64url(json payload) + "." + base64url(Ed25519 signature of the first part)

Payload fields:
    v      format version (1)
    plan   "trial" | "monthly" | "annual" | "lifetime" | "founder" | "owner"
    key    last characters of the licence key (for display only)
    email  buyer e-mail
    mid    machine id this token is bound to
    iat    issued at (unix seconds)
    exp    offline deadline: the app must reach the server again before this
           (normally iat + 30 days)
    until  end of the paid period / trial, or null for lifetime

Stage rule: the result of the check is latched when Live loads the script.
A licence that runs out, or a deactivation, never stops a running show; it
takes effect the next time Live starts.
"""

import base64
import hashlib
import json
import math
import os
import socket
import subprocess
import sys
import time
import uuid

from . import ed25519
from .keys import PUBLIC_KEY_HEX
from .paths import data_dir

WARN_DAYS = 7
_PUBLIC_KEY = bytes.fromhex(PUBLIC_KEY_HEX)
_TOKEN_FILE = "license.token"

_machine_cache = None
_session_allowed = None


def _b64d(s):
    s = s.strip()
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


# ------------------------------------------------------------------ machine


def _raw_machine_id():
    try:
        if sys.platform == "darwin":
            out = subprocess.run(
                ["/usr/sbin/ioreg", "-rd1", "-c", "IOPlatformExpertDevice"],
                capture_output=True,
                text=True,
                timeout=3,
            ).stdout
            for line in out.splitlines():
                if "IOPlatformUUID" in line:
                    return line.split("=")[-1].strip().strip('"')
        elif os.name == "nt":
            import winreg

            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"SOFTWARE\Microsoft\Cryptography",
                0,
                winreg.KEY_READ | winreg.KEY_WOW64_64KEY,
            )
            return winreg.QueryValueEx(key, "MachineGuid")[0]
    except Exception:
        pass
    return "node-%012x" % uuid.getnode()


def machine():
    """{id, name, platform}. The id is a salted hash: the server never sees
    the raw hardware UUID."""
    global _machine_cache
    if _machine_cache is None:
        override = os.environ.get("DAWREMOTE_MACHINE_ID")
        raw = override or _raw_machine_id()
        name = socket.gethostname() or "Computadora"
        if name.endswith(".local"):
            name = name[: -len(".local")]
        _machine_cache = {
            "id": hashlib.sha256(("dawremote:" + raw).encode()).hexdigest()[:32],
            "name": name,
            "platform": "mac" if sys.platform == "darwin" else "windows" if os.name == "nt" else sys.platform,
        }
    return dict(_machine_cache)


# ------------------------------------------------------------------ token


class LicenseError(Exception):
    pass


def decode_token(token):
    """Verifies the signature and returns the payload dict."""
    try:
        head, sig = token.strip().split(".")
        signature = _b64d(sig)
    except Exception:
        raise LicenseError("Licencia con formato inválido")
    if not ed25519.verify(_PUBLIC_KEY, head.encode("ascii"), signature):
        raise LicenseError("La firma de la licencia no es válida")
    try:
        payload = json.loads(_b64d(head).decode("utf-8"))
    except Exception:
        raise LicenseError("Licencia ilegible")
    if payload.get("v") != 1:
        raise LicenseError("Versión de licencia no soportada")
    return payload


def _token_path():
    return os.path.join(data_dir(), _TOKEN_FILE)


def read_token():
    try:
        with open(_token_path(), "r", encoding="utf-8") as f:
            return f.read().strip() or None
    except OSError:
        return None


def evaluate(token, now=None):
    """Turns a token (or None) into the status dict the app shows."""
    now = time.time() if now is None else now
    m = machine()
    base = {"state": "none", "valid": False, "machine": m, "warn": False}
    if not token:
        return base
    try:
        p = decode_token(token)
    except LicenseError as e:
        return dict(base, state="invalid", message=str(e))

    info = dict(
        base,
        plan=p.get("plan"),
        email=p.get("email"),
        key=p.get("key"),
        issued=p.get("iat"),
        refresh_by=p.get("exp"),
        until=p.get("until"),
    )
    if p.get("mid") not in (m["id"],):
        return dict(info, state="other_machine", message="Esta licencia es de otra computadora")

    until = p.get("until")
    exp = p.get("exp") or 0
    if until is not None and now > until:
        return dict(info, state="expired", message="La prueba o la suscripción terminó")
    if now > exp:
        return dict(info, state="offline_expired", message="Conéctate a internet para renovar la licencia")

    deadline = min(exp, until) if until is not None else exp
    days_left = max(0, int(math.ceil((deadline - now) / 86400)))
    return dict(
        info,
        state="trial" if p.get("plan") == "trial" else "active",
        valid=True,
        days_left=days_left,
        warn=days_left < WARN_DAYS,
    )


def save_token(token):
    """Validates and stores a token from the server. Returns the new status."""
    status = evaluate(token)
    if status["state"] in ("invalid", "other_machine"):
        raise LicenseError(status.get("message") or "Licencia no válida")
    path = _token_path()
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(token.strip())
    os.replace(tmp, path)
    _relatch()
    return status


def remove_token():
    try:
        os.remove(_token_path())
    except OSError:
        pass


# ------------------------------------------------------------------ session latch


def required():
    from ..Config import LICENSE_REQUIRED

    return bool(LICENSE_REQUIRED)


def _relatch():
    global _session_allowed
    ok = evaluate(read_token())["valid"]
    # Only ever upgrades during a session: never lock a running show.
    _session_allowed = bool(_session_allowed) or ok


def session_allowed():
    """Whether the remote can control Live in this Live session."""
    if not required():
        return True
    if _session_allowed is None:
        _relatch()
    return bool(_session_allowed)


def status():
    s = evaluate(read_token())
    s["required"] = required()
    s["allowed"] = session_allowed()
    return s
