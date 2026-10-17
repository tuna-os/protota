#!/usr/bin/env sh
set -eu

export GDK_BACKEND=broadway
export BROADWAY_DISPLAY=:5
export XDG_RUNTIME_DIR=/tmp/xdg-runtime
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

gtk4-broadwayd :5 --address 0.0.0.0 --port 8085 &
broadway_pid=$!

# Some applications initialize GTK quickly enough to race broadwayd and exit
# with "cannot open display". The :5 display is ready when broadway6.socket
# appears; do not start the application before then.
attempts=0
while [ ! -S "$XDG_RUNTIME_DIR/broadway6.socket" ]; do
  if ! kill -0 "$broadway_pid" 2>/dev/null; then
    echo "gtk4-broadwayd exited before display :5 became ready" >&2
    wait "$broadway_pid"
    exit 1
  fi
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 100 ]; then
    echo "gtk4-broadwayd did not make display :5 ready within 10 seconds" >&2
    kill "$broadway_pid" 2>/dev/null || true
    wait "$broadway_pid" 2>/dev/null || true
    exit 1
  fi
  sleep 0.1
done

# Runtime probe (#58): armed only when the host opts in by mounting a /probe
# volume (exported after broadwayd starts so only the app is instrumented).
# Without the mount (or without the compiled shim) the capture runs exactly
# as before — a missing probe must never break an existing capture.
if [ -d /probe ] && [ -f /opt/probe.so ]; then
  export LD_PRELOAD=/opt/probe.so
  export PROBE_OUTPUT=/probe/probe.json
fi
exec dbus-run-session -- sh -c "$APP_COMMAND"
