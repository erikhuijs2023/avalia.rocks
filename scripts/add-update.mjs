#!/usr/bin/env node
/**
 * add-update.mjs — create a news post (Directus `updates`) for an event.
 * Part of the /news-post workflow (see .claude/skills/news-post/).
 *
 * Context mode — what the skill needs before writing the post:
 *
 *   node scripts/add-update.mjs --context [--days 21]
 *
 *   Prints known events (tags of earlier updates + their last SLURL) and the
 *   products released in the last --days days (drafts included), as JSON.
 *
 * Create mode:
 *
 *   node scripts/add-update.mjs \
 *     --title "Ava's Lewd at Fetish Fair" \
 *     --excerpt "One-sentence summary for cards and feeds." \
 *     --content "<p>HTML body.</p>" \
 *     --tags "Fetish Fair" \
 *     [--link "https://maps.secondlife.com/secondlife/..."] [--link-label "Teleport to the booth"] \
 *     [--notice "Group-notice text, max ~350 bytes."] \
 *     [--image <directus-file-uuid> | --image-file "inbox/banner.jpg"] \
 *     [--date <ISO>]                      # publicatiedatum, default: now
 *     [--publish]                         # default: draft
 *
 * Auth: DIRECTUS_URL + DIRECTUS_CONTENT_TOKEN from the repo .env
 * (content-bot user — needs create/read on updates, see build-schema.mjs).
 */
import { readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

// ---- tiny .env loader (no dependency, tolerant of BOM/quotes) --------------
async function loadEnv() {
  try {
    const txt = await readFile(resolve(import.meta.dirname, '..', '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.replace(/^﻿/, '').match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env — rely on real env vars */ }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

await loadEnv();
const URL_ = (process.env.DIRECTUS_URL || 'http://192.168.178.29:8085').replace(/\/$/, '');
const TOKEN = process.env.DIRECTUS_CONTENT_TOKEN;
if (!TOKEN) { console.error('DIRECTUS_CONTENT_TOKEN missing (set it in .env)'); process.exit(1); }
const H = { Authorization: `Bearer ${TOKEN}` };

async function api(path, init = {}) {
  const res = await fetch(`${URL_}${path}`, {
    ...init,
    headers: { ...H, ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) }
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status} ${path}: ${JSON.stringify(body?.errors?.[0]?.message || body).slice(0, 300)}`);
  return body;
}

// ---- context mode -------------------------------------------------------------
if (arg('context', false) === true) {
  const days = Number(arg('days', 21)) || 21;
  const since = new Date(Date.now() - days * 864e5).toISOString();

  // Events are the tags of earlier updates; the newest update per tag carries
  // the SLURL worth reusing (booths tend to stay put between rounds).
  const ups = await api('/items/updates?limit=50&sort=-publicatiedatum&fields=titel,tags,link_url,publicatiedatum');
  const events = new Map();
  for (const u of ups.data) {
    for (const t of u.tags || []) {
      if (!events.has(t)) events.set(t, { tag: t, last_post: u.titel, last_date: u.publicatiedatum?.slice(0, 10), link_url: null });
      if (u.link_url && !events.get(t).link_url) events.get(t).link_url = u.link_url;
    }
  }

  const prods = await api(
    `/items/producten?limit=-1&sort=-publicatiedatum&filter[publicatiedatum][_gte]=${since}` +
    '&fields=id,naam,slug,status,merk,publicatiedatum,afbeelding,marketplace_url,categorie.naam'
  );
  console.log(JSON.stringify({
    events: [...events.values()],
    recent_products: prods.data.map((p) => ({
      id: p.id, naam: p.naam, slug: p.slug, status: p.status, merk: p.merk,
      categorie: p.categorie?.naam ?? null, released: p.publicatiedatum?.slice(0, 10),
      afbeelding: p.afbeelding, has_marketplace_url: Boolean(p.marketplace_url)
    }))
  }, null, 2));
  process.exit(0);
}

// ---- inputs -----------------------------------------------------------------
const title = arg('title');
if (!title || title === true) { console.error('--title is required (or use --context)'); process.exit(1); }
const excerpt = arg('excerpt', '');
const content = arg('content', '');
const tags = String(arg('tags', '')).split(',').map((s) => s.trim()).filter(Boolean);
const link = arg('link', null);
const linkLabel = arg('link-label', null);
const notice = arg('notice', null);
const publish = arg('publish', false) === true;
const dateArg = arg('date', null);
const publicatiedatum = dateArg ? new Date(dateArg).toISOString() : new Date().toISOString();

// SL cuts the notice body at 512 BYTES and the link is reserved out of that
// budget, so warn well before the notifier has to truncate the prose.
if (notice && Buffer.byteLength(notice, 'utf8') > 350) {
  console.warn(`warning: notice is ${Buffer.byteLength(notice, 'utf8')} bytes — aim for <=350, SL cuts at 512 incl. the link`);
}

// ---- 1. image: reuse an existing file, or upload one ------------------------
let fileId = arg('image', null);
const imageFile = arg('image-file', null);
if (imageFile) {
  const buf = await readFile(imageFile);
  const fd = new FormData();
  fd.append('title', title);
  fd.append('file', new Blob([buf], { type: MIME[extname(imageFile).toLowerCase()] || 'image/jpeg' }), basename(imageFile));
  const uploaded = await api('/files', { method: 'POST', body: fd });
  fileId = uploaded.data.id;
  console.log(`uploaded ${basename(imageFile)} -> ${fileId}`);
}

// ---- 2. unique slug ----------------------------------------------------------
let slug = slugify(title);
const taken = await api(`/items/updates?filter[slug][_starts_with]=${slug}&fields=slug&limit=-1`);
const existing = new Set(taken.data.map((u) => u.slug));
for (let i = 2; existing.has(slug); i++) slug = `${slugify(title)}-${i}`;

// ---- 3. create the update ------------------------------------------------------
const update = await api('/items/updates', {
  method: 'POST',
  body: JSON.stringify({
    status: publish ? 'published' : 'draft',
    titel: title,
    slug,
    excerpt,
    content,
    tags,
    publicatiedatum,
    ...(fileId ? { afbeelding: fileId } : {}),
    ...(link ? { link_url: link } : {}),
    ...(linkLabel ? { link_label: linkLabel } : {}),
    ...(notice ? { notice_text: notice } : {})
  })
});
console.log(`update #${update.data.id} "${title}" (${slug}) — ${publish ? 'PUBLISHED' : 'draft'}, dated ${publicatiedatum.slice(0, 10)}`);
