# avalia-builder

Tiny Node service that listens for a webhook and rebuilds the Avalia static
site in place, so Directus content changes appear on http://192.168.178.29:8084
without anyone running `deploy.ps1` from a workstation.

## What it does

```
POST /hook  ──▶  debounce 10s  ──▶  git fetch+reset  ──▶  npm ci
                                       │
                                       ▼
                                   npm run build  ──▶  rsync dist/ → /srv/dist/
                                                            (host: ./html/)
```

The `html/` bind mount is the *same* one nginx serves — when rsync finishes,
the new build is live. The bind mount's inode is preserved (rsync writes into
the directory in place), so `avalia-web` doesn't need a restart.

If a second `POST /hook` arrives while a build is already running, the builder
sets a `queued` flag and runs exactly one extra build when the current one
finishes (no matter how many hooks pile up in the meantime).

## Endpoints

| Method | Path     | Auth                           | Notes                                 |
|--------|----------|--------------------------------|---------------------------------------|
| GET    | /health  | none                           | JSON: build state + last build tail   |
| POST   | /hook    | `X-Avalia-Token: $HOOK_TOKEN`  | Schedules a debounced rebuild         |

LAN-only — port `8087` is bound to `192.168.178.29` so it isn't reachable from
outside the home network.

## Env vars (set in `/opt/sites/avalia/.env`)

| Var            | Required | Default                                                         |
|----------------|----------|-----------------------------------------------------------------|
| `HOOK_TOKEN`   | yes      | —                                                               |
| `REPO_URL`     | yes      | `https://github.com/erikhuijs2023/avalia.rocks.git`             |
| `GIT_BRANCH`   | no       | `main`                                                          |
| `DIRECTUS_URL` | no       | `http://192.168.178.29:8085`                                    |
| `DEBOUNCE_MS`  | no       | `10000`                                                         |

## Wiring Directus

In the Directus admin (http://192.168.178.29:8085/admin) → **Settings →
Flows** → **Create Flow**:

- **Trigger:** Event Hook → Action(s): `items.create`, `items.update`,
  `items.delete` → Collections: `Producten`, `Categorieen`, `Updates`,
  `Promos`, `SiteInstellingen`
- **Operation 1:** Webhook (Request URL):
  - Method: `POST`
  - URL: `http://192.168.178.29:8087/hook`
  - Headers: `X-Avalia-Token: <same value as HOOK_TOKEN>`
  - Body: leave empty (the builder ignores it)

## Manual test

```sh
# health
curl http://192.168.178.29:8087/health

# trigger a build
curl -X POST -H "X-Avalia-Token: <token>" http://192.168.178.29:8087/hook
# wait ~10s for debounce, then build runs; tail in /health
```
