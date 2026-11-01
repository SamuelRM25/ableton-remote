DEBUG = False

PLUGIN_NAME = "DAW Remote"
APP_VERSION = "1.1.0"

WEBSOCKET_HOST = "0.0.0.0"
WEBSOCKET_PORT = 39031

# Password the app uses to connect. An empty string ("") or None disables auth
# (not recommended on a shared network). Change it in config.json (below), not
# here: this file is replaced by every update.
PASSWORD = "ableton"

# Whether a licence is needed to control Live. Public release builds are
# packaged with True by scripts/release.mjs; development copies stay False.
LICENSE_REQUIRED = False

# Static file server: Live serves the app from ./static/ on the same port as
# the WebSocket, so the iPad just opens http://<computer-ip>:39031/.


# ---------------------------------------------------------------------------
# Per-user overrides that survive updates and reinstalls:
#   macOS:   ~/Library/Application Support/DAW Remote/config.json
#   Windows: %APPDATA%\DAW Remote\config.json
# e.g. {"password": "mi-clave", "port": 39031}
# ---------------------------------------------------------------------------
def _load_user_config():
    import json
    import os

    try:
        from .Licensing.paths import data_dir

        with open(os.path.join(data_dir(), "config.json"), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


_user = _load_user_config()
if "password" in _user:
    PASSWORD = _user["password"]
if isinstance(_user.get("port"), int):
    WEBSOCKET_PORT = _user["port"]
if _user.get("debug") is True:
    DEBUG = True
