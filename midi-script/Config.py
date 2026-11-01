DEBUG = False

PLUGIN_NAME = "DAW Remote"
APP_VERSION = "1.0.0"

WEBSOCKET_HOST = "0.0.0.0"
WEBSOCKET_PORT = 39031

# Default password for first-time setup. CHANGE THIS in production.
# An empty string ("") or None disables auth (not recommended on a shared network).
PASSWORD = "ableton"

# Static file server: serve whatever is in ./static/ at http://<host>:<port>/
# Drop your built SPA into ./static/ and the iPad can open the same URL.
# Static file server is always on. Drop your built SPA into ./static/ and the
# iPad can open the same URL (port 39031) to load the UI.
