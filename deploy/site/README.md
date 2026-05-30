# Avalia site — deploy

Static Astro build, served by nginx, deployed to the mini-pc at
`/opt/sites/avalia/`. Live URL: http://192.168.178.29:8084

## One-shot deploy

```powershell
.\deploy\site\deploy.ps1            # build + upload + swap + verify
.\deploy\site\deploy.ps1 -SkipBuild # just re-upload an existing dist/
```

The script:
1. Runs `npm run build` (Astro fetches the latest content from Directus at this
   moment — that snapshot is baked into the static HTML).
2. Uploads `dist/` to `/opt/sites/avalia/html.new/`.
3. Atomically swaps `html.new/` into the live `html/` directory — nginx never
   serves a half-finished tree.
4. Hits a few live routes to confirm 200.

## What is on the host

```
/opt/sites/avalia/
├── docker-compose.yml   ← from this folder
├── nginx.conf            ← from this folder
└── html/                 ← deployed via deploy.ps1
```

The nginx config does the things the Astro output expects:
- `try_files $uri $uri/index.html =404` — maps `/about` → `/about/index.html`
- long-term caching on hashed `_astro/` bundles, 30-day on images, no-cache on HTML
- gzip on text payloads
- correct content-type on `/feed.json`

## When content changes in Directus

There's no rebuild trigger yet — Directus changes only show on the live site
after the next `deploy.ps1`. Next step is wiring up a webhook from Directus
that pings a build endpoint (later phase).

## When code changes in the repo

Same flow: `.\deploy\site\deploy.ps1` from your dev box. The build pulls from
Directus and embeds the current content.

## URL caveat (LAN-only for now)

`DIRECTUS_URL` in the local `.env` points at `http://192.168.178.29:8085`
(LAN IP). The build bakes image URLs against that host, so the deployed site
only renders correctly from inside the LAN. When a real domain (e.g.
`cms.avalia.rocks` behind a reverse proxy) is live, update `.env` and rebuild.
