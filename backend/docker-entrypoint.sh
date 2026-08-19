#!/bin/sh
set -e

# Automatically push/deploy schema to PostgreSQL on startup if AUTO_MIGRATE is true
if [ "${AUTO_MIGRATE:-true}" = "true" ]; then
  echo "🚀 [Cloud Run Startup] Ensuring Prisma schema is synced with PostgreSQL database..."
  npx prisma db push --skip-generate || echo "⚠️ Prisma db push encountered an issue, proceeding with server startup..."
fi

# Execute main container process (node dist/server.js)
exec "$@"
