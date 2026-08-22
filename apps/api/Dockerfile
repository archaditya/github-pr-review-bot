# apps/api/Dockerfile — multi-stage, dev target used by docker-compose.local.yml,
# prod target used by docker-compose.prod.yml (ADR-008)

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# --- dev: source bind-mounted by compose, this stage just provides the runtime + deps ---
FROM base AS dev
RUN apk add --no-cache curl
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# --- build: install only prod deps for the final image ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# --- prod: minimal runtime image, no dev dependencies, no bind mounts, non-root user ---
FROM node:20-alpine AS prod
RUN apk add --no-cache curl && \
    addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY . .
USER app
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:4000/health || exit 1
CMD ["node", "src/server.js"]
