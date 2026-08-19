# Multi-stage Dockerfile for Convee Frontend on Google Cloud Run
# =============================================================

# Stage 1: Build React SPA
FROM node:20-slim AS builder

WORKDIR /app

# Build arguments for environment variables
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_JITSI_DOMAIN=meet.element.io
ARG ENABLE_HEALTH_CHECK=false

ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL} \
    REACT_APP_JITSI_DOMAIN=${REACT_APP_JITSI_DOMAIN} \
    ENABLE_HEALTH_CHECK=${ENABLE_HEALTH_CHECK} \
    NODE_ENV=production \
    GENERATE_SOURCEMAP=false \
    CI=false

# Copy package manifests
COPY package*.json ./
COPY craco.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY jsconfig.json ./
COPY components.json ./

# Install dependencies (using --legacy-peer-deps for React 19 compatibility)
RUN npm install --legacy-peer-deps

# Copy frontend source code and public assets
COPY public ./public
COPY src ./src
COPY plugins ./plugins

# Build optimized production bundle to /app/build
RUN npm run build

# =============================================================
# Stage 2: Serve via Hardened Nginx on Cloud Run
FROM nginx:1.27-alpine AS runner

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Remove default static files & default configuration
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/*

# Copy built React files from builder
COPY --from=builder /app/build /usr/share/nginx/html

# Copy Nginx template and entrypoint script
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Cloud Run dynamic port
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
