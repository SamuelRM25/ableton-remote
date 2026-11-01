"""Where DAW Remote keeps data that must survive updates and reinstalls."""

import os
import sys

APP_DIR_NAME = "DAW Remote"


def data_dir():
    """~/Library/Application Support/DAW Remote on macOS,
    %APPDATA%\\DAW Remote on Windows. DAWREMOTE_DATA_DIR overrides it."""
    override = os.environ.get("DAWREMOTE_DATA_DIR")
    if override:
        base = override
    elif sys.platform == "darwin":
        base = os.path.join(os.path.expanduser("~/Library/Application Support"), APP_DIR_NAME)
    elif os.name == "nt":
        base = os.path.join(os.environ.get("APPDATA") or os.path.expanduser("~"), APP_DIR_NAME)
    else:
        base = os.path.join(os.path.expanduser("~/.config"), APP_DIR_NAME)
    try:
        os.makedirs(base, exist_ok=True)
    except OSError:
        pass
    return base


def script_dir():
    """The installed Remote Script folder (…/Remote Scripts/DAWRemote)."""
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
