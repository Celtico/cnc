# Mobles CNC: PWA estàtica. Es construeix amb Node i se serveix amb nginx.

# --- Construcció ---------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
# git llegeix el número de versió (commits) en construir, com a rack.
RUN corepack enable && apk add --no-cache git
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
# Si alguna dependència té una vulnerabilitat alta o crítica coneguda, la build s'atura.
RUN pnpm audit --audit-level high
COPY . .
# tsc + vite build (el test d'anada i tornada amb el taller queda fora del tsc).
RUN pnpm build

# --- Servidor ------------------------------------------------------------------
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
