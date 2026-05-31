# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Install only production deps, then prune the npm cache.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from the builder stage.
COPY --from=builder /app/dist ./dist

# Non-root user for least-privilege runtime.
RUN addgroup -S dops && adduser -S dops -G dops
USER dops

EXPOSE 3000

# Runs migrations (TypeORM migrationsRun:true) then starts the server.
CMD ["node", "dist/main.js"]
