# apps/api/Dockerfile — multi-stage, dev target used by docker-compose.local.yml,
# prod target used by docker-compose.prod.yml (ADR-008)

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# --- dev: source bind-mounted by compose, this stage just provides the runtime + deps ---
FROM base AS dev
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# --- build: compile/prepare production artifacts (if a build step is added later) ---
FROM base AS build
COPY . .
RUN npm run build || true

# --- prod: minimal runtime image, no dev dependencies, no bind mounts ---
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app .
EXPOSE 4000
CMD ["node", "src/server.js"]
