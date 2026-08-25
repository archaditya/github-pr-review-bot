# apps/web/Dockerfile — multi-stage, dev target used by docker-compose.local.yml,
# prod target used by docker-compose.prod.yml (ADR-008)

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# --- dev: source bind-mounted by compose, next dev ---
FROM base AS dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# --- build: production Next.js build (next.config.mjs sets output: 'standalone') ---
FROM base AS build
COPY . .
RUN mkdir -p /app/public
RUN npm run build

# --- prod: minimal runtime — just the standalone server bundle, no node_modules copy,
# no bind mounts, non-root user ---
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
