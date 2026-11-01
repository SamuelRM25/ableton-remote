"""DAW Remote product namespaces: licence, updates and system info.

These stay reachable while the app is unlicensed so it can show the
activation screen, connect devices and install updates.
"""

import socket
import sys

import Live

from ..Config import APP_VERSION, WEBSOCKET_PORT
from ..Licensing import license as lic
from ..Licensing import updater
from ..version import version as protocol_version
from .Interface import Interface


class _Self(Interface):
    def get_ns(self, nsid):
        return self


class License(_Self):
    def get_status(self, ns):
        return lic.status()

    def get_machine(self, ns):
        return lic.machine()

    def get_token(self, ns):
        # Bound to this computer; the app sends it to the server to renew.
        return lic.read_token()

    def install_token(self, ns, token):
        try:
            lic.save_token(token)
        except lic.LicenseError as e:
            raise Exception(str(e))
        return lic.status()

    def remove(self, ns):
        lic.remove_token()
        return lic.status()


class Update(_Self):
    def get_info(self, ns):
        return {"version": APP_VERSION, "pending": updater.pending_version()}

    def begin(self, ns, version, size, sha256):
        return updater.begin(version, size, sha256)

    def chunk(self, ns, index, data):
        return updater.chunk(index, data)

    def finish(self, ns, signature):
        try:
            return updater.finish(signature)
        except updater.UpdateError as e:
            raise Exception(str(e))

    def cancel(self, ns):
        return updater.cancel()


def _lan_ips():
    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        s.connect(("10.255.255.255", 1))  # no packet is sent
        ips.append(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except Exception:
        pass
    return ips


def _live_version():
    try:
        app = Live.Application.get_application()
        return "%d.%d.%d" % (app.get_major_version(), app.get_minor_version(), app.get_bugfix_version())
    except Exception:
        return None


class System(_Self):
    def get_info(self, ns):
        m = lic.machine()
        return {
            "app_version": APP_VERSION,
            "protocol": protocol_version,
            "live_version": _live_version(),
            "machine_name": m["name"],
            "platform": m["platform"],
            "python": "%d.%d" % sys.version_info[:2],
            "ips": _lan_ips(),
            "port": WEBSOCKET_PORT,
        }
