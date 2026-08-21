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

# --- build: production Next.js build ---
FROM base AS build
COPY . .
RUN npm run build

# --- prod: minimal runtime, next start ---
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npm", "run", "start"]
