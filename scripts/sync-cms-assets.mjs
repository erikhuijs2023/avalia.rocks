#!/usr/bin/env node
/**
 * sync-cms-assets.mjs — mirror Directus files into the static build.
 *
 * Runs as `npm run prebuild`. Downloads every file from Directus into
 * `public/img/cms/<uuid>.<ext>` and writes `src/generated/cms-assets.json`
 * mapping each UUID to its local path. directusAsset() reads that manifest
 * and returns the local path, so the built HTML never refers to the LAN IP
 * of the CMS — no Chrome Private Network Access prompt for visitors on
 * the public domain.
 *
 * Anonymous read: relies on the public-read permission on directus_files
 * that build-schema.mjs set up.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// .env loader (no dotenv dep — we just parse the file ourselves)
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const envPath = join(repoRoot, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const URL = (process.env.DIRECTUS_URL || 'http://192.168.178.29:8085').replace(/\/$/, '');
const OUT_DIR = join(repoRoot, 'public', 'img', 'cms');
const MANIFEST_PATH = join(repoRoot, 'src', 'generated', 'cms-assets.json');

const extByMime = {
  'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg',
  'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif'
};

function extFor(file) {
  // Prefer the original extension from filename_download, fall back to MIME map.
  const fromName = file.filename_download?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  return extByMime[file.type] || 'bin';
}

async function main() {
  console.log(`==> Sync CMS assets from ${URL}`);

  // 1. Wipe the mirror directory so removed files don't linger.
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  // 2. List all files (anon read).
  const res = await fetch(`${URL}/files?limit=-1&fields=id,filename_download,type,filesize,modified_on`);
  if (!res.ok) throw new Error(`list files: ${res.status} ${await res.text()}`);
  const { data: files } = await res.json();
  console.log(`  found ${files.length} file(s)`);

  // 3. Download each in parallel (limit to 4 at a time).
  const manifest = {};
  let totalBytes = 0;
  const queue = [...files];
  const workers = Array(Math.min(4, files.length)).fill(0).map(async () => {
    while (queue.length) {
      const f = queue.shift();
      const ext = extFor(f);
      const localName = `${f.id}.${ext}`;
      const localPath = `/img/cms/${localName}`;
      const dest = join(OUT_DIR, localName);

      const r = await fetch(`${URL}/assets/${f.id}`);
      if (!r.ok) {
        console.log(`  ! skip ${f.id} (${f.filename_download}): ${r.status}`);
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      await writeFile(dest, buf);
      manifest[f.id] = { path: localPath, ext, size: buf.length, name: f.filename_download };
      totalBytes += buf.length;
      console.log(`  + ${f.filename_download} -> ${localPath} (${(buf.length/1024).toFixed(1)} KB)`);
    }
  });
  await Promise.all(workers);

  // 4. Write the manifest.
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`==> ${Object.keys(manifest).length} files mirrored, ${(totalBytes/1024).toFixed(1)} KB total`);
  console.log(`==> manifest: ${MANIFEST_PATH}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
