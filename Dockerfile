# Multi-stage Dockerfile for Convee Platform (Full-Stack single container) on Google Cloud Run
# Built from monorepo root
# ============================================================

# Stage 1: Build React Frontend SPA
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

ARG REACT_APP_BACKEND_URL=""
ARG REACT_APP_JITSI_DOMAIN=meet.element.io
ARG ENABLE_HEALTH_CHECK=false

ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL} \
    REACT_APP_JITSI_DOMAIN=${REACT_APP_JITSI_DOMAIN} \
    ENABLE_HEALTH_CHECK=${ENABLE_HEALTH_CHECK} \
    NODE_ENV=production \
    GENERATE_SOURCEMAP=false \
    CI=false

# Copy package manifests & configs
COPY frontend/package*.json ./
COPY frontend/craco.config.js ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/jsconfig.json ./
COPY frontend/components.json ./

# Install frontend dependencies
RUN npm install --legacy-peer-deps

# Copy frontend source code and assets
COPY frontend/public ./public
COPY frontend/src ./src
COPY frontend/plugins ./plugins

# Build optimized production bundle to /app/frontend/build
RUN npm run build

# ============================================================
# Stage 2: Build & Compile Backend TypeScript
FROM node:20-slim AS backend-builder

WORKDIR /app/backend

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files from backend/
COPY backend/package*.json ./
COPY backend/tsconfig.json ./
COPY backend/prisma ./prisma/

# Install all dependencies (including devDependencies for TypeScript & Prisma)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy application source code from backend/
COPY backend/src ./src

# Build TypeScript to dist/
RUN npm run build

# Prune devDependencies to keep image lean
RUN npm prune --production

# ============================================================
# Stage 3: Minimal Production Runtime
FROM node:20-slim AS runner

WORKDIR /app

# Install OpenSSL, ca-certificates, and dumb-init for proper signal handling
RUN apt-get update -y && apt-get install -y openssl ca-certificates dumb-init && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user for security
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Copy backend runtime assets and built artifacts
COPY --from=backend-builder /app/backend/package*.json ./
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=backend-builder /app/backend/src/generated ./dist/generated

# Copy frontend built assets into container
COPY --from=frontend-builder /app/frontend/build ./frontend-build

# Copy entrypoint script
COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Assign ownership to non-root user
RUN chown -R nodejs:nodejs /app

USER nodejs

# Expose port (Cloud Run sets $PORT dynamically, default 8080)
EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--", "./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
