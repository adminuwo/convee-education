#!/bin/sh
set -e

# Default PORT to 8080 if not supplied by Cloud Run
export PORT="${PORT:-8080}"

echo "Starting Nginx frontend container on port ${PORT}..."

# Substitute $PORT into default.conf
envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Execute CMD (nginx -g 'daemon off;')
exec "$@"
