#!/usr/bin/env node
/**
 * feature-products.mjs — put products in a brand's Featured spotlight and
 * rotate the oldest out, so the spotlight always holds exactly --keep items.
 * Part of the /add-products workflow (see .claude/skills/add-products/).
 *
 *   node scripts/feature-products.mjs --ids 73,74 [--keep 3] [--dry]
 *
 * Featured is per brand: Ava's Lewd featured show on the homepage, HDM
 * featured on /hdm (see src/lib/directus.ts featuredProducts). So the rotation
 * runs per merk of the given products. The new ones always stay; the rest of
 * the slots go to the previously featured products with the newest
 * publicatiedatum, and anything beyond that is un-featured.
 *
 * Auth: DIRECTUS_URL + DIRECTUS_CONTENT_TOKEN from the repo .env
 * (content-bot user — needs update on producten.is_featured).
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

await loadEnv();
const URL_ = (process.env.DIRECTUS_URL || 'http://192.168.178.29:8085').replace(/\/$/, '');
const TOKEN = process.env.DIRECTUS_CONTENT_TOKEN;
if (!TOKEN) { console.error('DIRECTUS_CONTENT_TOKEN missing (set it in .env)'); process.exit(1); }

async function api(path, init = {}) {
  const res = await fetch(`${URL_}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) }
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status} ${path}: ${JSON.stringify(body?.errors?.[0]?.message || body).slice(0, 300)}`);
  return body;
}

const ids = String(arg('ids', '')).split(',').map((s) => Number(s.trim())).filter(Boolean);
if (!ids.length) { console.error('--ids is required, e.g. --ids 73,74'); process.exit(1); }
const keep = Number(arg('keep', 3)) || 3;
const dry = arg('dry', false) === true;
const FIELDS = 'id,naam,merk,status,is_featured,publicatiedatum';

const picked = (await api(`/items/producten?filter[id][_in]=${ids.join(',')}&fields=${FIELDS}&limit=-1`)).data;
const missing = ids.filter((id) => !picked.some((p) => p.id === id));
if (missing.length) { console.error(`No product with id ${missing.join(', ')}`); process.exit(1); }

const setFeatured = async (p, on) => {
  if (!dry) await api(`/items/producten/${p.id}`, { method: 'PATCH', body: JSON.stringify({ is_featured: on }) });
};

for (const merk of [...new Set(picked.map((p) => p.merk))]) {
  const fresh = picked.filter((p) => p.merk === merk);
  if (fresh.length > keep) {
    console.error(`${merk}: ${fresh.length} products picked but the spotlight holds ${keep} — pick fewer.`);
    process.exit(1);
  }
  const current = (await api(
    `/items/producten?filter[merk][_eq]=${merk}&filter[is_featured][_eq]=true&sort=-publicatiedatum&fields=${FIELDS}&limit=-1`
  )).data.filter((p) => !ids.includes(p.id));
  const stays = current.slice(0, keep - fresh.length);
  const goes = current.slice(keep - fresh.length);

  for (const p of fresh) await setFeatured(p, true);
  for (const p of goes) await setFeatured(p, false);

  console.log(`${merk}${dry ? ' (dry run)' : ''}:`);
  for (const p of fresh) console.log(`  + featured  #${p.id} ${p.naam}${p.status !== 'published' ? ` [${p.status}]` : ''}`);
  for (const p of stays) console.log(`  = stays     #${p.id} ${p.naam}`);
  for (const p of goes) console.log(`  - removed   #${p.id} ${p.naam}`);
  const total = fresh.length + stays.length;
  if (total < keep) console.log(`  ! only ${total} featured — fewer than ${keep}`);
}
