"""Minimal stub of PyGObject's `gi` module for the browser sandbox.

blueprintcompiler/gir.py does `import gi` and binds a number of
GIRepository attributes at module import time. There is no GObject
introspection under Pyodide, so this stub only has to satisfy those
import-time attribute lookups; actually *calling* any GIRepository
function raises, which is fine because the browser tier deliberately
never resolves namespaces (no typelibs are shipped). GIR-backed
validation stays on the host (blueprint-export CI job).
"""

import sys
import types


def require_version(namespace, version):  # noqa: ARG001 - signature parity
    return None


class _AnyAttr:
    """Answers any attribute chain at import time; explodes if called."""

    def __getattr__(self, name):
        return _AnyAttr()

    def __call__(self, *args, **kwargs):
        raise RuntimeError(
            "GObject introspection is not available in the browser sandbox"
        )


class GError(Exception):
    pass


class _ParamFlags:
    # Numeric values match GObject.ParamFlags; only used in bit tests.
    READABLE = 1 << 0
    WRITABLE = 1 << 1
    CONSTRUCT = 1 << 2
    CONSTRUCT_ONLY = 1 << 3


_glib = types.ModuleType("gi.repository.GLib")
_glib.GError = GError
_glib.get_user_data_dir = lambda: ""
_glib.get_system_data_dirs = lambda: []

_gobject = types.ModuleType("gi.repository.GObject")
_gobject.ParamFlags = _ParamFlags

_girepository = types.ModuleType("gi.repository.GIRepository")
_girepository.__getattr__ = lambda name: _AnyAttr()

repository = types.ModuleType("gi.repository")
repository.GLib = _glib
repository.GObject = _gobject
repository.GIRepository = _girepository

sys.modules["gi.repository"] = repository
sys.modules["gi.repository.GLib"] = _glib
sys.modules["gi.repository.GObject"] = _gobject
sys.modules["gi.repository.GIRepository"] = _girepository
