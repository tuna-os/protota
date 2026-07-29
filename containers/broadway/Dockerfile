FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

ARG APP_PACKAGE=gnome-calculator
ARG APP_COMMAND=gnome-calculator

# Keep the reference runner intentionally narrow. Each app gets its own pinned
# package image so a GNOME upgrade cannot silently change the visual oracle.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    dbus-x11 \
    ${APP_PACKAGE} \
    libgtk-4-bin \
  && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV APP_COMMAND=${APP_COMMAND}

EXPOSE 8085
ENTRYPOINT ["/entrypoint.sh"]
