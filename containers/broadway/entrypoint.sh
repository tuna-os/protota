#!/usr/bin/env sh
set -eu

export GDK_BACKEND=broadway
export BROADWAY_DISPLAY=:5
export XDG_RUNTIME_DIR=/tmp/xdg-runtime
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

gtk4-broadwayd :5 --address 0.0.0.0 --port 8085 &
exec dbus-run-session -- sh -c "$APP_COMMAND"
