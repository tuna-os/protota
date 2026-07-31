FROM ubuntu:26.04

ENV DEBIAN_FRONTEND=noninteractive

ARG APP_PACKAGE=gnome-calculator
ARG APP_COMMAND=gnome-calculator

# Keep the reference runner intentionally narrow. Each app gets its own pinned
# package image so a GNOME upgrade cannot silently change the visual oracle.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    dbus-x11 \
    gcc \
    libgtk-4-dev \
    pkg-config \
    ${APP_PACKAGE} \
    libgtk-4-bin \
  && rm -rf /var/lib/apt/lists/*

# Read-only runtime probe shim (#58): LD_PRELOADed into the app by
# entrypoint.sh only when a /probe volume is mounted. Built here so the shim
# always matches the image's GTK; the web app never ships it.
COPY probe.c /probe.c
RUN gcc -shared -fPIC -O2 -Wall -o /opt/probe.so /probe.c \
      $(pkg-config --cflags --libs gtk4) -pthread \
  && rm /probe.c

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV APP_COMMAND=${APP_COMMAND}

EXPOSE 8085
ENTRYPOINT ["/entrypoint.sh"]
