#!/usr/bin/env bash
# Generate /opt/sites/avalia-cms/.env with strong secrets.
# Refuses to overwrite an existing .env — delete it first if you really want to rotate.
set -e

cd "$(dirname "$0")"

if [ -f .env ]; then
  echo "ERROR: .env already exists — refusing to overwrite."
  echo "Delete it first if you really want to regenerate (this will invalidate any existing data tied to KEY/SECRET)."
  exit 1
fi

cat > .env <<EOF
BIND_IP=192.168.178.29
HOST_PORT=8085
DIRECTUS_KEY=$(openssl rand -hex 32)
DIRECTUS_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=e.huijs@gmail.com
ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/' | head -c 24)
DB_PASSWORD=$(openssl rand -hex 32)
PUBLIC_URL=http://192.168.178.29:8085
CORS_ORIGIN=http://localhost:4321,http://192.168.178.29:8084
EOF
chmod 600 .env

echo "=== .env written (perms 600) ==="
ls -la .env
echo
echo "=== ADMIN credentials — save these now ==="
grep -E "^ADMIN_EMAIL|^ADMIN_PASSWORD" .env
