/**
 * Minimal Directus helpers. Replace DIRECTUS_URL with your instance.
 * These are just enough to resolve asset URLs and fetch collections —
 * swap in the official @directus/sdk if you prefer.
 */
const DIRECTUS_URL = import.meta.env.DIRECTUS_URL || 'https://cms.example.com';

/** Resolve a Directus file id (or file object) to a public asset URL. */
export function directusAsset(
  file?: string | { id: string } | null,
  params?: Record<string, string | number>
): string | undefined {
  if (!file) return undefined;
  const id = typeof file === 'string' ? file : file.id;
  if (!id) return undefined;
  const q = params
    ? '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  return `${DIRECTUS_URL}/assets/${id}${q}`;
}

/** Fetch published items from a collection. */
export async function getItems<T = any>(
  collection: string,
  query: Record<string, string> = {}
): Promise<T[]> {
  const params = new URLSearchParams({ 'filter[status][_eq]': 'published', ...query });
  const res = await fetch(`${DIRECTUS_URL}/items/${collection}?${params}`);
  if (!res.ok) throw new Error(`Directus ${collection}: ${res.status}`);
  const json = await res.json();
  return json.data as T[];
}

/** Fetch a singleton (e.g. Site Instellingen). */
export async function getSingleton<T = any>(collection: string): Promise<T> {
  const res = await fetch(`${DIRECTUS_URL}/items/${collection}`);
  if (!res.ok) throw new Error(`Directus ${collection}: ${res.status}`);
  const json = await res.json();
  return json.data as T;
}

/* Example usage in a page's frontmatter:

   import { getItems, directusAsset } from '../lib/directus';
   const products = await getItems('producten', {
     'filter[is_featured][_eq]': 'true',
     'fields': 'naam,slug,korte_beschrijving,is_nieuw,categorie.naam,afbeeldingen.directus_files_id',
     'limit': '3'
   });
*/
