# syntax=docker/dockerfile:1
# Kalaai Code web - build the Vite SPA, serve it with unprivileged nginx

# ---------------------------------------------------------------------------
# Stage 1: build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Vite inlines VITE_* variables at build time, so the API URL is a build arg.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# Inject the API origin into the CSP connect-src of the nginx config.
RUN sed "s|__API_ORIGIN__|${VITE_API_URL}|g" nginx.conf > /tmp/default.conf

# ---------------------------------------------------------------------------
# Stage 2: runtime (non-root nginx, listens on 8080)
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:alpine AS runtime

COPY --from=build /tmp/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
