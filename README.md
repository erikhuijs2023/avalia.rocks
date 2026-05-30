# Avalia.rocks

Second Life digital fashion brand site — *latex & fetish meets neon-retro*, dark-mode only.

**Stack:** Astro · TypeScript · Directus (CMS, later phase) · Docker on self-hosted mini-pc

## Project layout

```
.
├── docs/                          ← briefing & original deliveries
│   ├── website-design-blueprint.md
│   ├── component-library-brief.md
│   └── avalia-ui-original-delivery.zip
├── public/
│   └── avalia-ui.js               ← client interactions (age gate, lightbox, toasts)
├── src/
│   ├── components/                ← avalia-ui library (Claude.design Phase 1)
│   ├── layouts/BaseLayout.astro
│   ├── lib/directus.ts
│   ├── pages/
│   └── styles/{tokens,components}.css
└── astro.config.mjs
```

## Develop

```sh
npm install
npm run dev          # http://localhost:4321
npm run build        # static build → dist/
```

## Phase tracker

- [x] Phase 1 — Component library (Claude.design delivery)
- [ ] Phase 2 — Homepage wired to mock content
- [ ] Phase 3 — Other pages: products, product detail, updates, landing pages, contact
- [ ] Directus integration
- [ ] RSS + JSON feed at `/feed.xml`, `/feed.json`
- [ ] Deploy to mini-pc (`/opt/sites/avalia/`)
