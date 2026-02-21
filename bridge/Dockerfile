# Bridge Service — Fly.io deployment
# Multi-stage build for minimal image size
# Build context: repo root (set via fly.toml [build] context)

# --- Build stage ---
FROM node:22-slim AS builder

WORKDIR /app

COPY bridge/package.json bridge/package-lock.json ./
RUN npm ci

COPY bridge/tsconfig.json ./
COPY bridge/src/ ./src/

RUN npx tsc

# --- Production stage ---
FROM node:22-slim

WORKDIR /app

COPY bridge/package.json bridge/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Sprite source files — read by bootstrap.ts to push to Sprite VMs via FS API
COPY sprite/src/ ./sprite/src/
COPY sprite/memory/ ./sprite/memory/
COPY sprite/requirements.txt ./sprite/requirements.txt

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
