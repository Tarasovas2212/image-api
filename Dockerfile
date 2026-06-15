# ---- Build stage ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Install dependencies (sharp ships prebuilt binaries for linux/glibc).
# Use `npm ci` when a lockfile is present, otherwise fall back to `npm install`.
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Prune dev dependencies for the runtime image
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Storage directory (mounted as a volume in docker-compose)
RUN mkdir -p /app/uploads
ENV STORAGE_DIR=/app/uploads

EXPOSE 3000
CMD ["node", "dist/main.js"]
