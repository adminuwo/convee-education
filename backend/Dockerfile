# Multi-stage Dockerfile for Convee Backend on Google Cloud Run
# ============================================================

# Stage 1: Build & Compile TypeScript
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for TypeScript & Prisma)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy application source code
COPY src ./src

# Build TypeScript to dist/
RUN npm run build

# Prune devDependencies to keep image lean
RUN npm prune --production

# ============================================================
# Stage 2: Minimal Production Runtime
FROM node:20-slim AS runner

WORKDIR /app

# Install OpenSSL, ca-certificates, and dumb-init for proper signal handling
RUN apt-get update -y && apt-get install -y openssl ca-certificates dumb-init && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user for security
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Copy runtime assets and built artifacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./dist/generated

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Assign ownership to non-root user
RUN chown -R nodejs:nodejs /app

USER nodejs

# Expose port (Cloud Run sets $PORT dynamically, default 8080)
EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--", "./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
