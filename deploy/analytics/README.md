# avalia-analytics

Self-hosted [Umami](https://umami.is/) for the Avalia site — privacy-friendly
analytics (no cookies, no PII, no consent banner needed under GDPR).

## What's in here

| Container        | Image                                                | Port (LAN)                    |
|------------------|------------------------------------------------------|-------------------------------|
| `avalia-umami`   | `ghcr.io/umami-software/umami:postgresql-latest`     | `192.168.178.29:8088 → 3000`  |
| `avalia-umami-db`| `postgres:16-alpine`                                 | internal only                 |

The tracker script is served at `/avalia-stats.js` (renamed from the default
`/script.js` so adblock filters that target "umami" leave it alone). The
filename includes the `.js` because Umami 3.x does literal pathname matching
against `TRACKER_SCRIPT_NAME`.

## Deploy

```powershell
# from the repo root on your workstation
scp -r deploy/analytics vectra-user@192.168.178.29:/opt/sites/avalia-analytics/
ssh vectra-user@192.168.178.29
```

On the mini-pc:

```sh
cd /opt/sites/avalia-analytics
# generate secrets + write .env (mode 600)
sudo tee .env > /dev/null <<EOF
APP_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 32)
TRACKER_SCRIPT_NAME=avalia-stats
EOF
sudo chmod 600 .env

sudo docker compose up -d
sudo docker compose logs -f umami    # wait for "ready - started server"
```

## First login

1. Open <http://192.168.178.29:8088/>
2. Default credentials: `admin` / `umami` — **change immediately** under
   *Settings → Profile*.
3. *Settings → Websites → Add website*:
   - Name: `Ava's Lewd`
   - Domain: `192.168.178.29:8084` (or your future public domain)
4. After saving, click the **Edit** icon next to the website → copy the
   **Website ID** (UUID). Hand this to the site code so the tracker tag
   can be embedded (see `src/layouts/BaseLayout.astro`).

## Tracker tag

The site's `BaseLayout.astro` includes the tracker script:

```html
<script defer
        src="http://192.168.178.29:8088/avalia-stats.js"
        data-website-id="<UUID-from-Umami>"></script>
```

Once the site goes public, swap the host for the public Umami URL.

## Going public later

LAN-only for now. To expose Umami publicly behind a reverse proxy:
- Route `stats.avalia.rocks` → `http://192.168.178.29:8088`
- Update the script `src` in `BaseLayout.astro` to the public URL
- Add the public site domain to the website settings in Umami
