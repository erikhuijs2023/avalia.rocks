/**
 * JSON Feed 1.1 for /updates — consumed by OpenClaw alongside the RSS feed.
 */
import type { APIContext } from 'astro';
import { publishedUpdates, getSite } from '../lib/directus';

const truncate = (s: string, n = 500) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

export async function GET({ site }: APIContext) {
  const base = (site?.toString() || 'https://avalia.rocks').replace(/\/$/, '');
  const [items, siteMeta] = await Promise.all([publishedUpdates(), getSite()]);

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: `${siteMeta.site_naam} — Updates`,
    home_page_url: `${base}/updates`,
    feed_url: `${base}/feed.json`,
    description: siteMeta.tagline,
    language: 'en',
    items: items.map((u) => ({
      id: `${base}/updates/${u.slug}`,
      url: `${base}/updates/${u.slug}`,
      title: u.titel,
      content_text: truncate(u.excerpt),
      content_html: u.content,
      date_published: new Date(u.publicatiedatum).toISOString(),
      tags: u.tags,
      ...(u.afbeelding ? { image: u.afbeelding } : {})
    }))
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: { 'Content-Type': 'application/feed+json; charset=utf-8' }
  });
}
