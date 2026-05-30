/**
 * Directus data layer for the Avalia frontend.
 *
 * Exports mirror src/data/mock.ts so a page only swaps the import line:
 *   import { ... } from '../data/mock';   ← static / offline
 *   import { ... } from '../lib/directus'; ← live CMS
 *
 * All helpers are async (return Promises) since they fetch over HTTP.
 */

import type {
  Categorie, Product, Update, Promo, FAQItem, SiteInstellingen
} from '../data/mock';

const DIRECTUS_URL = (import.meta.env.DIRECTUS_URL || 'http://192.168.178.29:8085').replace(/\/$/, '');

// Mirror manifest written by scripts/sync-cms-assets.mjs (runs as `prebuild`).
// Maps Directus file UUID -> { path: '/img/cms/<uuid>.<ext>', ext, size, name }.
// Empty when no mirror has run yet — directusAsset() falls back to live URLs.
import cmsAssets from '../generated/cms-assets.json';
const ASSET_MANIFEST = cmsAssets as Record<string, { path: string; ext: string; size: number; name: string }>;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
async function api<T = any>(path: string): Promise<T> {
  const res = await fetch(`${DIRECTUS_URL}${path}`);
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
    throw new Error(`Directus ${res.status} on ${path} :: ${detail}`);
  }
  const json = await res.json();
  return json.data as T;
}

/** Resolve a Directus file id to a public asset URL.
 *
 *  - If the file was mirrored locally by `npm run prebuild`, returns the
 *    local same-origin path (`/img/cms/<uuid>.<ext>`) so the built HTML never
 *    references the CMS host directly.
 *  - Otherwise falls back to the live Directus URL (handy in `npm run dev`
 *    when you haven't synced yet, or for transforms via `params`).
 */
export function directusAsset(
  file?: string | { id: string } | null,
  params?: Record<string, string | number>
): string | undefined {
  if (!file) return undefined;
  const id = typeof file === 'string' ? file : file.id;
  if (!id) return undefined;
  // Mirrored copy wins when present and we aren't asking for a transform.
  if (!params && ASSET_MANIFEST[id]) return ASSET_MANIFEST[id].path;
  const q = params
    ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  return `${DIRECTUS_URL}/assets/${id}${q}`;
}

// ---------------------------------------------------------------------------
// Raw Directus row shapes (just the fields we read)
// ---------------------------------------------------------------------------
interface RawCategorie { id: number; naam: string; slug: string; icoon: string | null }

interface RawProduct {
  id: number;
  status: string;
  naam: string;
  slug: string;
  categorie: RawCategorie;
  korte_beschrijving: string | null;
  uitgebreide_beschrijving: string | null;
  features: { item: string }[] | null;
  compatibiliteit: string[] | null;
  marketplace_url: string | null;
  is_featured: boolean;
  is_nieuw: boolean;
  publicatiedatum: string | null;
  afbeelding: string | null;
}

interface RawUpdate {
  id: number;
  status: string;
  titel: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  tags: string[] | null;
  publicatiedatum: string | null;
  afbeelding: string | null;
}

interface RawPromo {
  id: number;
  titel: string;
  beschrijving: string | null;
  cta_tekst: string | null;
  cta_url: string | null;
  actief: boolean;
  sortering: number | null;
  afbeelding: string | null;
}

interface RawFaq { id: number; sort: number; question: string; answer: string }

interface RawSite {
  site_naam: string | null;
  tagline: string | null;
  contact_email: string | null;
  over_tekst: string | null;
  social_links: { marketplace?: string; instagram?: string; bluesky?: string } | null;
  logo: string | null;
}

// ---------------------------------------------------------------------------
// Transforms — Directus row → mock.ts-shaped value
// ---------------------------------------------------------------------------
function toCategorie(r: RawCategorie): Categorie {
  return { id: r.id, naam: r.naam, slug: r.slug, icoon: r.icoon || undefined };
}

function toProduct(r: RawProduct): Product {
  const coverUrl = directusAsset(r.afbeelding);
  return {
    id: r.id,
    naam: r.naam,
    slug: r.slug,
    categorie: r.categorie ? toCategorie(r.categorie) : { id: 0, naam: '', slug: '' },
    korte_beschrijving: r.korte_beschrijving || '',
    uitgebreide_beschrijving: r.uitgebreide_beschrijving || '',
    afbeeldingen: coverUrl ? [coverUrl] : [],
    features: (r.features || []).map((f) => f.item),
    compatibiliteit: r.compatibiliteit || [],
    marketplace_url: r.marketplace_url || '',
    is_featured: r.is_featured,
    is_nieuw: r.is_nieuw,
    publicatiedatum: r.publicatiedatum || '',
    status: r.status as Product['status']
  };
}

function toUpdate(r: RawUpdate): Update {
  return {
    id: r.id,
    titel: r.titel,
    slug: r.slug,
    content: r.content || '',
    excerpt: r.excerpt || '',
    afbeelding: directusAsset(r.afbeelding),
    tags: r.tags || [],
    publicatiedatum: r.publicatiedatum || '',
    status: r.status as Update['status']
  };
}

function toPromo(r: RawPromo): Promo {
  return {
    id: r.id,
    titel: r.titel,
    beschrijving: r.beschrijving || '',
    afbeelding: directusAsset(r.afbeelding),
    cta_tekst: r.cta_tekst || '',
    cta_url: r.cta_url || '',
    actief: r.actief,
    sortering: r.sortering || 0
  };
}

// ---------------------------------------------------------------------------
// Public API — same names as src/data/mock.ts but async
// ---------------------------------------------------------------------------
export async function getCategorieen(): Promise<Categorie[]> {
  const raw = await api<RawCategorie[]>('/items/categorieen?sort=naam');
  return raw.map(toCategorie);
}

const PRODUCT_FIELDS = '*,categorie.id,categorie.naam,categorie.slug,categorie.icoon';

export async function getProducten(): Promise<Product[]> {
  const raw = await api<RawProduct[]>(
    `/items/producten?fields=${PRODUCT_FIELDS}&sort=-publicatiedatum&limit=-1`
  );
  return raw.map(toProduct);
}

export async function featuredProducts(): Promise<Product[]> {
  const raw = await api<RawProduct[]>(
    `/items/producten?fields=${PRODUCT_FIELDS}&filter[is_featured][_eq]=true&sort=-publicatiedatum`
  );
  return raw.map(toProduct);
}

export async function productsByCategory(slug: string): Promise<Product[]> {
  const raw = await api<RawProduct[]>(
    `/items/producten?fields=${PRODUCT_FIELDS}&filter[categorie][slug][_eq]=${encodeURIComponent(slug)}&sort=-publicatiedatum&limit=-1`
  );
  return raw.map(toProduct);
}

export async function productBySlug(slug: string): Promise<Product | undefined> {
  const raw = await api<RawProduct[]>(
    `/items/producten?fields=${PRODUCT_FIELDS}&filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1`
  );
  return raw[0] ? toProduct(raw[0]) : undefined;
}

export async function relatedProducts(p: Product, n = 3): Promise<Product[]> {
  const raw = await api<RawProduct[]>(
    `/items/producten?fields=${PRODUCT_FIELDS}` +
    `&filter[categorie][id][_eq]=${p.categorie.id}` +
    `&filter[id][_neq]=${p.id}` +
    `&sort=-publicatiedatum&limit=${n}`
  );
  return raw.map(toProduct);
}

export async function getUpdates(): Promise<Update[]> {
  return publishedUpdates();
}

export async function publishedUpdates(): Promise<Update[]> {
  const raw = await api<RawUpdate[]>(
    '/items/updates?sort=-publicatiedatum&limit=-1'
  );
  return raw.map(toUpdate);
}

export async function updateBySlug(slug: string): Promise<Update | undefined> {
  const raw = await api<RawUpdate[]>(
    `/items/updates?filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1`
  );
  return raw[0] ? toUpdate(raw[0]) : undefined;
}

export async function adjacentUpdates(slug: string): Promise<{ prev?: Update; next?: Update }> {
  const list = await publishedUpdates();
  const i = list.findIndex((u) => u.slug === slug);
  return {
    prev: i > 0 ? list[i - 1] : undefined,
    next: i >= 0 && i < list.length - 1 ? list[i + 1] : undefined
  };
}

export async function getPromos(): Promise<Promo[]> {
  const raw = await api<RawPromo[]>('/items/promos?sort=sortering&limit=-1');
  return raw.map(toPromo);
}

export async function activePromo(): Promise<Promo | undefined> {
  const raw = await api<RawPromo[]>(
    '/items/promos?filter[actief][_eq]=true&sort=sortering&limit=1'
  );
  return raw[0] ? toPromo(raw[0]) : undefined;
}

export async function promoBySlug(slug: string): Promise<Promo | undefined> {
  const all = await getPromos();
  return all.find((p) => p.cta_url === `/promo/${slug}`);
}

export async function getFaq(): Promise<FAQItem[]> {
  const raw = await api<RawFaq[]>('/items/faq?sort=sort&limit=-1');
  return raw.map((r) => ({ question: r.question, answer: r.answer }));
}

export async function getSite(): Promise<SiteInstellingen> {
  const r = await api<RawSite>('/items/site_instellingen');
  return {
    site_naam: r.site_naam || 'Avalia',
    tagline: r.tagline || '',
    contact_email: r.contact_email || '',
    over_tekst: r.over_tekst || '',
    social_links: {
      marketplace: r.social_links?.marketplace || '',
      instagram: r.social_links?.instagram || '',
      bluesky: r.social_links?.bluesky || ''
    }
  };
}

// ---------------------------------------------------------------------------
// Re-export the types so pages can `import type { Product } from '../lib/directus'`
// without needing the mock file at all.
// ---------------------------------------------------------------------------
export type { Categorie, Product, Update, Promo, FAQItem, SiteInstellingen };
