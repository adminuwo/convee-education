#!/usr/bin/env bash
#
# Idempotent DB bootstrap.
# 1) Creates the `app_user` role and `collab_platform` database if they don't exist.
# 2) Applies Prisma migrations (safe if already applied).
# 3) Optionally seeds demo data if the User table is empty.
#
# Safe to run on every backend startup.
set -euo pipefail

APP_DIR="${APP_DIR:-/app/backend}"
cd "$APP_DIR"

# Load env vars for DATABASE_URL etc
if [ -f .env ]; then set -a; . ./.env; set +a; fi

DB_ROLE="app_user"
DB_PASSWORD="app_password_secure"
DB_NAME="collab_platform"
ADMIN_CMD="su - postgres -c"

log(){ echo "[bootstrap] $*"; }

# Wait for PostgreSQL to be reachable (retry ~30s)
log "waiting for postgres..."
for i in $(seq 1 30); do
  if $ADMIN_CMD "psql -tc 'SELECT 1' postgres" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! $ADMIN_CMD "psql -tc 'SELECT 1' postgres" >/dev/null 2>&1; then
  log "ERROR: postgres not reachable"
  exit 1
fi

# --- Role: create if missing, always ensure it can login + CREATEDB ---
ROLE_EXISTS=$($ADMIN_CMD "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_ROLE}'\"" 2>/dev/null | tr -d '[:space:]' || true)
if [ "$ROLE_EXISTS" != "1" ]; then
  log "creating role ${DB_ROLE}"
  $ADMIN_CMD "psql -c \"CREATE ROLE ${DB_ROLE} WITH LOGIN PASSWORD '${DB_PASSWORD}';\""
else
  log "role ${DB_ROLE} already exists"
fi
# Ensure attributes each boot (safe)
$ADMIN_CMD "psql -c \"ALTER ROLE ${DB_ROLE} WITH LOGIN PASSWORD '${DB_PASSWORD}' CREATEDB;\"" >/dev/null

# --- Database: create if missing ---
DB_EXISTS=$($ADMIN_CMD "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" 2>/dev/null | tr -d '[:space:]' || true)
if [ "$DB_EXISTS" != "1" ]; then
  log "creating database ${DB_NAME}"
  $ADMIN_CMD "psql -c \"CREATE DATABASE ${DB_NAME} OWNER ${DB_ROLE};\""
  $ADMIN_CMD "psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_ROLE};\""
else
  log "database ${DB_NAME} already exists"
fi

# --- Apply Prisma migrations (idempotent) ---
log "applying prisma migrations"
npx prisma migrate deploy

# --- Optional: seed only if User table is empty ---
USER_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_ROLE" -d "$DB_NAME" -tAc 'SELECT COUNT(*) FROM "User";' 2>/dev/null | tr -d '[:space:]' || echo "0")
if [ "${USER_COUNT:-0}" = "0" ]; then
  log "seeding demo data (User table empty)"
  npx ts-node src/scripts/seed.ts || log "seed skipped (non-fatal)"
else
  log "User table has ${USER_COUNT} rows, skipping seed"
fi

log "bootstrap complete"
