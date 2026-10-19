# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Shared base
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# ---------------------------------------------------------------------------
# Dependencies
# Build tools are only present in this stage; they cover the case where a
# native dependency (e.g. bcrypt) has no prebuilt binary for linux/amd64.
# ---------------------------------------------------------------------------
FROM base AS deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Development image: includes dev dependencies (drizzle-kit) and runs
# `node --watch`. Used by docker-compose.dev.yml for app + migrations.
# ---------------------------------------------------------------------------
FROM deps AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# Production dependencies only
# ---------------------------------------------------------------------------
FROM base AS production-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------------------------------------------------------------------------
# Production runtime: no dev dependencies, runs as the unprivileged `node` user
# ---------------------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production \
    PORT=3000
COPY --from=production-deps /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node . .
RUN mkdir -p /app/logs && chown -R node:node /app/logs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/index.js"]
