---
name: add-products
description: Process product poster images from inbox/ into Directus products. Use when the user says "voeg de producten toe", "verwerk de inbox", "/add-products", or drops poster images and asks to add them as products.
---

# Add products from poster images

The user drops product poster images (portrait 1536×2048) in `inbox/`.
For each image: read it, extract product data from the artwork, then create
the product in Directus via `scripts/add-product.mjs`. Products are created
as **draft** — the user reviews in Directus, adds the marketplace URL, and
publishes (publishing triggers the site rebuild automatically).

## Procedure

1. List images: `inbox/*.{jpg,jpeg,png,webp}`. If empty, tell the user and stop.
2. **Read each image with the Read tool** and extract:
   - **name** — the product title on the poster (e.g. "CAPRICE THONG" → "Caprice Thong").
   - **merk** — look for the brand logo: the HDM / HDM2 logo → `hdm`; otherwise → `avas-lewd`.
   - **collection** (`--collection`) — brand-line grouping. Defaults to the
     brand's main collection (HDM products → "HDM", else "Ava's Lewd"), so
     usually you can omit it. Override only for the special lines: a LewdX
     logo → `--collection LewdX`; a "Lewd vs. HDM" collab poster →
     `--collection "Lewd vs. HDM"`. The collection must already exist (like
     categories, never auto-created) — fetch the live list from
     `/items/collecties` if unsure.
   - **category** — derive from the product type on the poster and match it to
     an EXISTING category (fetch the live list: `/items/categorieen`; at the
     time of writing: Heels, Boots, Jackets, Tops, Belt and garters,
     Thong / Panties). If nothing fits, ASK THE USER first (new category, or
     file it under an existing one?) — never invent categories silently. Only
     after the user approves a new one, pass `--create-category`. The script
     enforces this: an unknown category without that flag is an error.
   - **compat** — body names listed on the poster. Map to the site's canonical labels:
     `Reborn`, `Reborn Waifu's`, `Reborn Bimbo Boobs`, `Kupra`, `Legacy`,
     "LaraX"/"Maitreya" → `Maitreya LaraX`.
   - **features** — facts printed on the poster: perms (e.g. "Copy / Mod"),
     materials ("Materials: classic & PBR"), color HUD info, included sizes.
     One feature per fact, separated with `|` on the CLI.
   - **short** — write one teaser sentence (English, brand voice: premium &
     provocative, no explicit language).
   - **desc** — 1–2 short HTML paragraphs (`<p>…</p>`) in the same voice:
     what it is, what makes it good, who it fits.
3. Per image, run (Bash, repo root):
   ```sh
   node scripts/add-product.mjs --file "inbox/<file>" --name "<Name>" \
     --category "<Category>" --merk <avas-lewd|hdm> \
     --short "<teaser>" --desc "<html>" \
     --features "<f1>|<f2>" --compat "<c1>,<c2>"
   ```
   (`--publish` only when the user explicitly asked to publish directly.
   The release date is taken from the poster file's modified time
   automatically; pass `--date <ISO>` only to override it.)
4. Move processed images to `inbox/done/` so a re-run can't duplicate them.
5. Report a table: image → product name, category, merk, compat, draft/published.
   Remind the user: add the **marketplace URL** in Directus and flip status to
   Published. Mention any category the script CREATED (check its output).

## Auth & plumbing

- The script reads `DIRECTUS_URL` + `DIRECTUS_CONTENT_TOKEN` from the repo
  `.env` (content-bot user, create/read on producten/categorieen/galerij/files
  only). If the token is missing, regenerate via `deploy/cms/build-schema.mjs`
  with `CONTENT_TOKEN` set (see deploy/cms/README.md pattern).
- Slug uniqueness and category matching/creation are handled by the script —
  don't pre-check those by hand.
- Posters are mirrored to the site automatically at build time
  (`scripts/sync-cms-assets.mjs` runs as prebuild).
