#!/usr/bin/env node
/**
 * seed-content.mjs — seed Directus with the mock content.
 *
 *   node deploy/cms/seed-content.mjs
 *
 * Reads connection from env vars:
 *   DIRECTUS_URL, ADMIN_EMAIL, ADMIN_PASSWORD
 *
 * Strategy: idempotent by slug — items that already exist (matched by slug,
 * filename, etc.) are skipped. Re-run safely as many times as you like.
 *
 * What gets uploaded:
 *   - 5 SVG placeholders from public/img/ → directus_files (folder "Placeholders")
 *   - Categorieën, Producten, Updates, Promos, FAQ rows
 *   - Site instellingen singleton populated
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Load mock data — we import it directly so the seed always matches the source of truth.
import {
  categorieen, producten, updates, promos, faq, site
} from '../../src/data/mock.ts';

const URL = process.env.DIRECTUS_URL || 'http://192.168.178.29:8085';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error('Set ADMIN_EMAIL + ADMIN_PASSWORD'); process.exit(1); }

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

// ---- HTTP -----------------------------------------------------------------
let token = null;

async function api(path, init = {}, isJson = true) {
  const res = await fetch(`${URL}${path}`, {
    ...init,
    headers: {
      ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  let body; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const err = body?.errors?.[0];
    const e = new Error(`${res.status} ${err?.message || res.statusText}`);
    e.body = body;
    throw e;
  }
  return body;
}

async function login() {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  token = r.data.access_token;
}

// ---- File upload ----------------------------------------------------------
const fileIdByName = new Map();

async function uploadPlaceholder(filename) {
  if (fileIdByName.has(filename)) return fileIdByName.get(filename);

  // Skip if file with same name already exists in Directus.
  const existing = await api(`/files?filter[filename_download][_eq]=${encodeURIComponent(filename)}&limit=1`);
  if (existing.data.length > 0) {
    const id = existing.data[0].id;
    fileIdByName.set(filename, id);
    console.log(`  ✓ file ${filename} already uploaded`);
    return id;
  }

  const path = resolve(repoRoot, 'public', 'img', filename);
  const buffer = readFileSync(path);

  const form = new FormData();
  form.append('title', filename.replace(/\.svg$/, ''));
  form.append('file', new Blob([buffer], { type: 'image/svg+xml' }), filename);

  const res = await fetch(`${URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`upload ${filename}: ${JSON.stringify(json)}`);
  const id = json.data.id;
  fileIdByName.set(filename, id);
  console.log(`  + uploaded ${filename}`);
  return id;
}

function fileIdForUrl(url) {
  // Mock URLs look like /img/placeholder-1.svg → upload returns a UUID.
  if (!url) return null;
  const name = url.split('/').pop();
  return fileIdByName.get(name) ?? null;
}

// ---- Per-collection seed --------------------------------------------------
const catIdBySlug = new Map();

async function existingBy(collection, field, value) {
  const r = await api(`/items/${collection}?filter[${field}][_eq]=${encodeURIComponent(value)}&limit=1`);
  return r.data[0] || null;
}

async function seedCategorieen() {
  console.log('\n[1/6] categorieen');
  for (const c of categorieen) {
    const existing = await existingBy('categorieen', 'slug', c.slug);
    if (existing) {
      catIdBySlug.set(c.slug, existing.id);
      console.log(`  ✓ ${c.slug} already present`);
      continue;
    }
    const r = await api('/items/categorieen', {
      method: 'POST',
      body: JSON.stringify({ naam: c.naam, slug: c.slug, icoon: c.icoon || null })
    });
    catIdBySlug.set(c.slug, r.data.id);
    console.log(`  + ${c.slug}`);
  }
}

async function seedProducten() {
  console.log('\n[2/6] producten');
  for (const p of producten) {
    const existing = await existingBy('producten', 'slug', p.slug);
    if (existing) { console.log(`  ✓ ${p.slug} already present`); continue; }
    const coverName = p.afbeeldingen?.[0]?.split('/').pop();
    const coverId = coverName ? fileIdByName.get(coverName) : null;
    await api('/items/producten', {
      method: 'POST',
      body: JSON.stringify({
        status: p.status,
        naam: p.naam,
        slug: p.slug,
        categorie: catIdBySlug.get(p.categorie.slug),
        korte_beschrijving: p.korte_beschrijving,
        uitgebreide_beschrijving: p.uitgebreide_beschrijving,
        features: (p.features || []).map((item) => ({ item })),
        compatibiliteit: p.compatibiliteit || [],
        marketplace_url: p.marketplace_url,
        is_featured: p.is_featured,
        is_nieuw: p.is_nieuw,
        publicatiedatum: p.publicatiedatum,
        afbeelding: coverId
      })
    });
    console.log(`  + ${p.slug}`);
  }
}

async function seedUpdates() {
  console.log('\n[3/6] updates');
  for (const u of updates) {
    const existing = await existingBy('updates', 'slug', u.slug);
    if (existing) { console.log(`  ✓ ${u.slug} already present`); continue; }
    await api('/items/updates', {
      method: 'POST',
      body: JSON.stringify({
        status: u.status,
        titel: u.titel,
        slug: u.slug,
        content: u.content,
        excerpt: u.excerpt,
        tags: u.tags || [],
        publicatiedatum: u.publicatiedatum,
        afbeelding: u.afbeelding ? fileIdForUrl(u.afbeelding) : null
      })
    });
    console.log(`  + ${u.slug}`);
  }
}

async function seedPromos() {
  console.log('\n[4/6] promos');
  for (const p of promos) {
    const existing = await existingBy('promos', 'cta_url', p.cta_url);
    if (existing) { console.log(`  ✓ promo "${p.titel}" already present`); continue; }
    await api('/items/promos', {
      method: 'POST',
      body: JSON.stringify({
        titel: p.titel,
        beschrijving: p.beschrijving,
        cta_tekst: p.cta_tekst,
        cta_url: p.cta_url,
        actief: p.actief,
        sortering: p.sortering,
        afbeelding: p.afbeelding ? fileIdForUrl(p.afbeelding) : null
      })
    });
    console.log(`  + ${p.titel}`);
  }
}

async function seedSiteInstellingen() {
  console.log('\n[5/6] site_instellingen (singleton)');
  // Singletons in Directus are read/written via PATCH /items/<collection>
  // The row exists implicitly; PATCH upserts fields.
  await api('/items/site_instellingen', {
    method: 'PATCH',
    body: JSON.stringify({
      site_naam: site.site_naam,
      tagline: site.tagline,
      contact_email: site.contact_email,
      over_tekst: site.over_tekst,
      social_links: site.social_links
    })
  });
  console.log('  + populated');
}

async function seedFaq() {
  console.log('\n[6/6] faq');
  let i = 0;
  for (const item of faq) {
    const existing = await existingBy('faq', 'question', item.question);
    if (existing) { console.log(`  ✓ "${item.question.slice(0, 40)}…" already present`); i++; continue; }
    await api('/items/faq', {
      method: 'POST',
      body: JSON.stringify({ sort: i, question: item.question, answer: item.answer })
    });
    console.log(`  + ${item.question.slice(0, 50)}…`);
    i++;
  }
}

// ---- main -----------------------------------------------------------------
(async () => {
  console.log(`→ Directus: ${URL}`);
  await login();
  console.log('  ✓ logged in');

  console.log('\n[0/6] file uploads');
  for (const f of ['placeholder-1.svg', 'placeholder-2.svg', 'placeholder-3.svg', 'placeholder-4.svg', 'hero-eclipse.svg']) {
    await uploadPlaceholder(f);
  }

  await seedCategorieen();
  await seedProducten();
  await seedUpdates();
  await seedPromos();
  await seedSiteInstellingen();
  await seedFaq();

  console.log('\n✓ seed complete');
})().catch((e) => {
  console.error('\n✗ FAILED');
  console.error(e.message);
  if (e.body) console.error(JSON.stringify(e.body, null, 2));
  process.exit(1);
});
