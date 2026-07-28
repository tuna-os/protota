# Multi-stage build: Node for build, nginx for serve
FROM docker.io/library/node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM docker.io/library/nginx:alpine

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
