#!/usr/bin/env sh
set -eu

export GDK_BACKEND=broadway
export BROADWAY_DISPLAY=:5
export XDG_RUNTIME_DIR=/tmp/xdg-runtime
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

gtk4-broadwayd :5 --address 0.0.0.0 --port 8085 &

# Runtime probe (#58): armed only when the host opts in by mounting a /probe
# volume (exported after broadwayd starts so only the app is instrumented).
# Without the mount (or without the compiled shim) the capture runs exactly
# as before — a missing probe must never break an existing capture.
if [ -d /probe ] && [ -f /opt/probe.so ]; then
  export LD_PRELOAD=/opt/probe.so
  export PROBE_OUTPUT=/probe/probe.json
fi
exec dbus-run-session -- sh -c "$APP_COMMAND"
