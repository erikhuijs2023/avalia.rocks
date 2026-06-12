#!/usr/bin/env node
/**
 * add-product.mjs — create a product in Directus from a poster image.
 * Part of the /add-products workflow (see .claude/skills/add-products/).
 *
 *   node scripts/add-product.mjs \
 *     --file "inbox/Ava's-Lewd---Caprice-Thong.jpg" \
 *     --name "Caprice Thong" \
 *     --category "Thong / Panties" \
 *     --merk avas-lewd \
 *     --short "One-line teaser." \
 *     --desc "<p>Rich HTML description.</p>" \
 *     --features "Copy / Mod|Materials: classic & PBR" \
 *     --compat "Reborn,Kupra,Legacy,Maitreya LaraX" \
 *     [--publish]                         # default: draft
 *
 * Auth: DIRECTUS_URL + DIRECTUS_CONTENT_TOKEN from the repo .env
 * (content-bot user — create/read on producten, categorieen, files only).
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

// ---- inputs -----------------------------------------------------------------
const file = arg('file');
const name = arg('name');
if (!file || !name) { console.error('--file and --name are required'); process.exit(1); }
const categoryName = arg('category', '');
const merk = arg('merk', 'avas-lewd');
const short = arg('short', '');
const desc = arg('desc', '');
const features = String(arg('features', '')).split('|').map((s) => s.trim()).filter(Boolean);
const compat = String(arg('compat', '')).split(',').map((s) => s.trim()).filter(Boolean);
const publish = arg('publish', false) === true;

// ---- 1. upload the poster ---------------------------------------------------
const buf = await readFile(file);
const fd = new FormData();
fd.append('title', name);
fd.append('file', new Blob([buf], { type: MIME[extname(file).toLowerCase()] || 'image/jpeg' }), basename(file));
const uploaded = await api('/files', { method: 'POST', body: fd });
const fileId = uploaded.data.id;
console.log(`uploaded ${basename(file)} -> ${fileId}`);

// ---- 2. ensure the category -------------------------------------------------
let categorieId = null;
if (categoryName) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const cats = await api('/items/categorieen?limit=-1');
  const hit = cats.data.find((c) => norm(c.naam) === norm(categoryName) || c.slug === slugify(categoryName));
  if (hit) {
    categorieId = hit.id;
    console.log(`category: ${hit.naam} (#${hit.id})`);
  } else if (arg('create-category', false) === true) {
    // Only with the explicit flag — policy is to ask the user before
    // growing the taxonomy (every category becomes a filter pill +
    // collections page).
    const made = await api('/items/categorieen', {
      method: 'POST',
      body: JSON.stringify({ naam: categoryName, slug: slugify(categoryName), icoon: 'star' })
    });
    categorieId = made.data.id;
    console.log(`category CREATED: ${categoryName} (#${categorieId})`);
  } else {
    const cats2 = await api('/items/categorieen?fields=naam&limit=-1');
    console.error(`No category matches "${categoryName}". Existing: ${cats2.data.map((c) => c.naam).join(', ')}.`);
    console.error('Ask the user, then re-run with an existing category or add --create-category.');
    process.exit(1);
  }
}

// ---- 3. unique slug ----------------------------------------------------------
let slug = slugify(name);
const taken = await api(`/items/producten?filter[slug][_starts_with]=${slug}&fields=slug&limit=-1`);
const existing = new Set(taken.data.map((p) => p.slug));
for (let i = 2; existing.has(slug); i++) slug = `${slugify(name)}-${i}`;

// ---- 4. create the product ----------------------------------------------------
const product = await api('/items/producten', {
  method: 'POST',
  body: JSON.stringify({
    status: publish ? 'published' : 'draft',
    naam: name,
    slug,
    merk,
    ...(categorieId ? { categorie: categorieId } : {}),
    korte_beschrijving: short,
    uitgebreide_beschrijving: desc,
    features: features.map((item) => ({ item })),
    compatibiliteit: compat,
    marketplace_url: '',
    is_featured: false,
    is_nieuw: true,
    publicatiedatum: new Date().toISOString(),
    afbeelding: fileId
  })
});
console.log(`product #${product.data.id} "${name}" (${slug}) — ${publish ? 'PUBLISHED' : 'draft'}`);
