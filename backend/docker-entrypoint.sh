#!/bin/sh

# Launch Python LLM Bridge (Vertex AI + OpenAI proxy) in background on port 8002 if present
if [ -f "/app/llm_bridge/main.py" ]; then
  echo "🧠 [Cloud Run Startup] Starting Python LLM Bridge on port 8002..."
  python3 /app/llm_bridge/main.py &
fi

# Automatically push/deploy schema to PostgreSQL on startup if AUTO_MIGRATE is true and DATABASE_URL is set
if [ "${AUTO_MIGRATE:-true}" = "true" ] && [ -n "${DATABASE_URL}" ]; then
  echo "🚀 [Cloud Run Startup] Ensuring Prisma schema is synced with PostgreSQL database..."
  ./node_modules/.bin/prisma db push --skip-generate || npx prisma db push --skip-generate || echo "⚠️ Prisma db push encountered an issue, proceeding with server startup..."
fi

# Automatically ensure core institutional demo accounts exist if AUTO_SEED is true
if [ "${AUTO_SEED:-true}" = "true" ] && [ -n "${DATABASE_URL}" ]; then
  echo "🌱 [Cloud Run Startup] Ensuring core organization and demo accounts are initialized..."
  node dist/seed.js || echo "⚠️ Seed execution completed or skipped."
fi

# Execute main container process (node dist/server.js)
exec "$@"
