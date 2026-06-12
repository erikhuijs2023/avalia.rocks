/**
 * JSON Feed 1.1 for /gallery — consumed by the Hermes agent, which
 * cross-posts new images to Ava's socials.
 *
 * Per item, the `_avalia` extension carries the machine instructions:
 *   channels  where the agent may post ('bluesky', 'instagram', …);
 *             an empty array means: do not cross-post.
 *   labels    Bluesky self-label vocabulary (sexual / nudity / porn /
 *             graphic-media) — pass through 1:1 as post self-labels, and
 *             use them to skip platforms that don't allow the content.
 *   alt       alt text for the image (falls back to the title).
 *
 * Dedupe on `id` (stable per gallery item) + `date_published`.
 */
import type { APIContext } from 'astro';
import { getGalerij, getSite } from '../../lib/directus';

export async function GET({ site }: APIContext) {
  const base = (site?.toString() || 'https://avalia.rocks').replace(/\/$/, '');
  const [items, siteMeta] = await Promise.all([getGalerij(), getSite()]);

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: `${siteMeta.site_naam} — Gallery`,
    home_page_url: `${base}/gallery`,
    feed_url: `${base}/gallery/feed.json`,
    description: 'Promo images, newest first.',
    language: 'en',
    items: items.map((g) => ({
      id: `${base}/gallery#${g.id}`,
      url: `${base}/gallery`,
      title: g.titel,
      content_text: g.beschrijving || g.titel,
      ...(g.afbeelding ? { image: `${base}${g.afbeelding}` } : {}),
      date_published: g.publicatiedatum ? new Date(g.publicatiedatum).toISOString() : undefined,
      tags: g.content_labels,
      _avalia: {
        channels: g.kanalen,
        labels: g.content_labels,
        alt: g.alt_tekst || g.titel
      }
    }))
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: { 'Content-Type': 'application/feed+json; charset=utf-8' }
  });
}
