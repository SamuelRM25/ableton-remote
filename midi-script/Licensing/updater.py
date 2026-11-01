"""Receives a signed update package from the app and stages it.

Flow (driven by the app, which has internet; Live's Python may not):
    begin(version, size, sha256) → chunk(i, base64)… → finish(signature)

The signature is Ed25519 over  b"dawremote-update:<version>:<sha256 hex>"
so it binds the exact bytes to the version number. The zip must contain a
single top folder "DAWRemote/". It is unpacked into <script>/_pending and
applied by apply_pending() the next time Live loads the script, so nothing
changes under a running show.
"""

import base64
import hashlib
import io
import json
import os
import re
import shutil
import zipfile

from . import ed25519
from .keys import PUBLIC_KEY_HEX
from .paths import script_dir

MAX_SIZE = 60 * 1024 * 1024
PENDING = "_pending"
MARKER = ".ready"
TOP = "DAWRemote/"
_VERSION_RE = re.compile(r"^\d+\.\d+\.\d+([-.][0-9A-Za-z.]+)?$")

_job = None


class UpdateError(Exception):
    pass


def pending_version(root=None):
    marker = os.path.join(root or script_dir(), PENDING, MARKER)
    try:
        with open(marker, "r", encoding="utf-8") as f:
            return json.load(f).get("version")
    except (OSError, ValueError):
        return None


def begin(version, size, sha256):
    global _job
    if not isinstance(version, str) or not _VERSION_RE.match(version):
        raise UpdateError("Versión inválida")
    if not isinstance(size, int) or size <= 0 or size > MAX_SIZE:
        raise UpdateError("Tamaño de actualización inválido")
    if not isinstance(sha256, str) or not re.match(r"^[0-9a-f]{64}$", sha256):
        raise UpdateError("Hash inválido")
    _job = {"version": version, "size": size, "sha256": sha256, "buf": bytearray(), "next": 0}
    return True


def chunk(index, data):
    if _job is None:
        raise UpdateError("No hay una actualización en curso")
    if index != _job["next"]:
        raise UpdateError("Parte fuera de orden")
    _job["buf"] += base64.b64decode(data)
    _job["next"] += 1
    if len(_job["buf"]) > _job["size"]:
        cancel()
        raise UpdateError("La descarga es más grande de lo esperado")
    return len(_job["buf"])


def cancel():
    global _job
    _job = None
    return True


def finish(signature, root=None):
    global _job
    job, _job = _job, None
    if job is None:
        raise UpdateError("No hay una actualización en curso")
    data = bytes(job["buf"])
    if len(data) != job["size"] or hashlib.sha256(data).hexdigest() != job["sha256"]:
        raise UpdateError("La descarga llegó incompleta o dañada")
    message = ("dawremote-update:%s:%s" % (job["version"], job["sha256"])).encode()
    try:
        sig = bytes.fromhex(signature)
    except (TypeError, ValueError):
        raise UpdateError("Firma inválida")
    if not ed25519.verify(bytes.fromhex(PUBLIC_KEY_HEX), message, sig):
        raise UpdateError("La actualización no está firmada por DAW Remote")

    root = root or script_dir()
    pend = os.path.join(root, PENDING)
    shutil.rmtree(pend, ignore_errors=True)
    os.makedirs(pend)
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names = [n for n in z.namelist() if not n.endswith("/")]
            if not names or not all(n.startswith(TOP) for n in names):
                raise UpdateError("Paquete con estructura inesperada")
            if TOP + "__init__.py" not in names:
                raise UpdateError("Paquete incompleto")
            for name in names:
                rel = name[len(TOP):]
                parts = rel.replace("\\", "/").split("/")
                if not rel or rel.startswith("/") or ".." in parts or parts[0] == PENDING:
                    raise UpdateError("Ruta no permitida en el paquete")
                dest = os.path.join(pend, *parts)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with z.open(name) as src, open(dest, "wb") as out:
                    shutil.copyfileobj(src, out)
        with open(os.path.join(pend, MARKER), "w", encoding="utf-8") as f:
            json.dump({"version": job["version"], "sha256": job["sha256"]}, f)
    except UpdateError:
        shutil.rmtree(pend, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(pend, ignore_errors=True)
        raise UpdateError("No se pudo descomprimir la actualización: %s" % e)
    return job["version"]


def apply_pending(root):
    """Called from __init__.py before the script modules are imported.
    Returns the applied version, or None."""
    pend = os.path.join(root, PENDING)
    version = pending_version(root)
    if version is None:
        return None
    try:
        if os.path.isdir(os.path.join(pend, "static")):
            shutil.rmtree(os.path.join(root, "static"), ignore_errors=True)
        for cur, _dirs, files in os.walk(pend):
            rel = os.path.relpath(cur, pend)
            dst = root if rel == "." else os.path.join(root, rel)
            os.makedirs(dst, exist_ok=True)
            for f in files:
                if rel == "." and f == MARKER:
                    continue
                shutil.copyfile(os.path.join(cur, f), os.path.join(dst, f))
        # Old bytecode could shadow the new sources.
        for cur, dirs, _files in os.walk(root):
            for d in list(dirs):
                if d == "__pycache__":
                    shutil.rmtree(os.path.join(cur, d), ignore_errors=True)
                    dirs.remove(d)
    finally:
        shutil.rmtree(pend, ignore_errors=True)
    return version
