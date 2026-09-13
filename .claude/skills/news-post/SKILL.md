---
name: news-post
description: Write a news post (Directus "updates") announcing an in-world event Ava's Lewd / HDM takes part in, featuring the newest products. Use when the user says "maak een nieuwspost", "nieuwsbericht voor het event", "/news-post", or asks to announce an event on the site.
---

# News post for an event

Creates one item in the Directus `updates` collection (the site's News
section) announcing an event — typically a shopping event / fair where the
newest products debut. Posts are created as **draft**: the user reviews in
Directus and publishes (publishing triggers the site rebuild; the SL group
notice is a separate manual button, see deploy/notifier/README.md).

## Procedure

1. **Gather context** (Bash, repo root):
   ```sh
   node scripts/add-update.mjs --context --days 21
   ```
   Returns JSON with `events` (tags of earlier posts + the last SLURL used for
   each) and `recent_products` (released in the last 21 days, drafts
   included). Widen `--days` if nothing recent shows up.

2. **Ask the user** (AskUserQuestion, Dutch, one call with these questions):
   - **Welk event?** — offer the known event tags from step 1 as options
     (most recent first); the user can type a new one via "Other".
   - **Wanneer start het event?** — options like the coming Friday/Saturday
     written as real dates (e.g. "Vr 18 sep"), plus "Other" for free input.
   - **Welke producten?** (multiSelect) — the recent products from step 1,
     all pre-listed; skip this question if there are none.
   Only ask a follow-up when something is really missing:
   - The SLURL, if the event is new or its last `link_url` is empty (the user
     may say there's none — then post without a link).
   - The end date is optional: include it only if the user mentions it.
   Resolve relative answers ("zaterdag") to an absolute date using today's
   date, and state the weekday + date in the post.

3. **Write the copy** — English, brand voice (premium & provocative, warm,
   no explicit language), matching earlier posts (read a recent one via the
   context output's `last_post` for tone):
   - **title** — short, e.g. "Ava's Lewd at <Event>" or
     "New drops at <Event> — from <Sat 19 Sep>". ASCII-friendly (the SL
     notice subject is ASCII-folded and capped at 63 chars).
   - **excerpt** — one sentence: what, where, from when.
   - **content** — 2–3 `<p>` paragraphs: the event + start date (and end date
     if known); the featured products, each linked as
     `<a href="/products/<slug>">Name</a>` with a one-line hook; an invitation
     to come by. Don't invent facts (prices, discounts, booth numbers) that
     the user didn't give.
   - **notice** — group-notice text: 1–2 sentences, what + when + where,
     **≤ 350 bytes**, plain ASCII (no emoji/curly quotes/accents — they cost
     bytes and can break SL). The link is appended by the notifier; don't
     repeat it.
   - **tags** — the event name exactly as the existing tag (reuse spelling
     from step 1 so posts group together).
   - **link** — the event SLURL; `--link-label` e.g. "Teleport to the event".
   - **image** — the `afbeelding` UUID of the lead featured product (reuses
     its poster). If the user dropped an event banner in `inbox/`, pass it
     with `--image-file` instead.

4. **Create the draft** (Bash, repo root):
   ```sh
   node scripts/add-update.mjs --title "<title>" --excerpt "<excerpt>" \
     --content "<html>" --tags "<Event>" \
     --link "<slurl>" --link-label "Teleport to the event" \
     --notice "<notice text>" --image <file-uuid>
   ```
   `--date <ISO>` sets `publicatiedatum` (default: now — the announcement
   date, not the event date). `--publish` only when the user explicitly
   asked to publish directly.

5. **Report**: title, slug, update id, event + start date, featured products,
   draft/published, and show the excerpt + notice text so the user can judge
   them without opening Directus. Remind the user:
   - review + publish in Directus (Content → Updates);
   - featured products that are still **draft** or lack a
     `marketplace_url` (see context output) should be published too, or their
     links on the post will 404;
   - the group notice is sent separately via the Directus flow button
     (preview with "Preview notice" first).

## Auth & plumbing

- Uses the same `DIRECTUS_URL` + `DIRECTUS_CONTENT_TOKEN` as /add-products.
  The content-bot needs create/read on `updates` (granted in
  `deploy/cms/build-schema.mjs`). A `403` on create means that permission
  hasn't been applied to the live CMS yet — re-run build-schema.
- Slug uniqueness is handled by the script.
