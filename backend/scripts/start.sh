#!/usr/bin/env bash
# Wrapper: run bootstrap, then exec the Node.js server.
# Bootstrap failures are logged but non-fatal so the backend can still start
# if the DB is already in a good state (which is the common case).
set -e
APP_DIR="${APP_DIR:-/app/backend}"
cd "$APP_DIR"
bash "$APP_DIR/scripts/bootstrap.sh" || echo "[start] bootstrap reported an error but starting server anyway"
exec /usr/bin/node "$APP_DIR/dist/server.js"
