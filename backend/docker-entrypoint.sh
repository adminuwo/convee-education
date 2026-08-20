#!/bin/sh

# Automatically push/deploy schema to PostgreSQL on startup if AUTO_MIGRATE is true and DATABASE_URL is set
if [ "${AUTO_MIGRATE:-true}" = "true" ] && [ -n "${DATABASE_URL}" ]; then
  echo "🚀 [Cloud Run Startup] Ensuring Prisma schema is synced with PostgreSQL database..."
  ./node_modules/.bin/prisma db push --skip-generate || npx prisma db push --skip-generate || echo "⚠️ Prisma db push encountered an issue, proceeding with server startup..."
fi

# Execute main container process (node dist/server.js)
exec "$@"
