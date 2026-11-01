# This is needed to import the Unsupported class in Live 10
from __future__ import absolute_import  # noqa: UP010

import sys


def create_instance(c_instance):
    if sys.version_info[0] < 3:  # noqa: UP036
        from .Unsupported import Unsupported

        return Unsupported(c_instance)

    _apply_pending_update()

    from .DAWRemote import DAWRemote

    return DAWRemote(c_instance)


def _apply_pending_update():
    """Installs an update the app downloaded during the last session."""
    try:
        import os

        from .Licensing.updater import apply_pending

        applied = apply_pending(os.path.dirname(os.path.abspath(__file__)))
        if applied:
            import logging

            logging.getLogger("DAW Remote").info("Applied update %s", applied)
    except Exception as e:  # never keep Live from loading the script
        import logging

        logging.getLogger("DAW Remote").exception(e)
