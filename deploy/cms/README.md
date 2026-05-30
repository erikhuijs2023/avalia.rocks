# Avalia CMS — Directus deploy

Directus 11 + Postgres 16, deployed to the mini-pc at `/opt/sites/avalia-cms/`.

## First-time deploy

```sh
# on the mini-pc, as vectra-user
mkdir -p /opt/sites/avalia-cms
cd /opt/sites/avalia-cms

# (1) drop docker-compose.yml + .env.example from this folder

# (2) generate the .env with strong secrets
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

# (3) launch
docker compose up -d

# (4) tail logs until "Server started at..."
docker compose logs -f directus
```

Admin login lands at `http://192.168.178.29:8085/admin` — the email + password come from `.env`.

## Update Directus version

```sh
cd /opt/sites/avalia-cms
docker compose pull
docker compose up -d
```

## Backup

The Postgres data and uploads live in named Docker volumes. To back them up,
add an entry in `/opt/sites/backups/sites-backup.sh` that runs:

```sh
docker exec avalia-cms-db pg_dump -U directus directus > /opt/sites/backups/avalia-cms-$(date +%F).sql
```

## Notes

- `BIND_IP=192.168.178.29` exposes the admin UI on the LAN. Set it to
  `127.0.0.1` to keep the API behind a future reverse proxy only.
- `PUBLIC_URL` must match whatever clients (browser + Astro build) hit. Update
  it when a real domain (e.g. `https://cms.avalia.rocks`) is in front.
- `CORS_ORIGIN` is comma-separated. Add the production frontend URL when ready.
