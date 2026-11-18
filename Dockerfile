# Multi-stage build: Node for build, nginx for serve
FROM docker.io/library/node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM docker.io/library/nginx:alpine@sha256:1bb9390209f866c8c0bf76ba89d3f33a3f6cd6a0e6c1b457af7ee763b9579f41

# Create writable temp dirs for nginx running as non-root (uid 101)
RUN mkdir -p /var/cache/nginx/client_temp /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp /var/run/nginx \
    && chown -R 101:101 /var/cache/nginx /var/run/nginx \
    && sed -i 's|pid .*|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
