/**
 * RSS 2.0 feed for /updates — consumed by OpenClaw to syndicate to Instagram + Bluesky.
 * Static endpoint, regenerated at build time.
 */
import type { APIContext } from 'astro';
import { publishedUpdates, getSite } from '../lib/directus';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

const truncate = (s: string, n = 500) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

export async function GET({ site }: APIContext) {
  const base = (site?.toString() || 'https://avalia.rocks').replace(/\/$/, '');
  const [items, siteMeta] = await Promise.all([publishedUpdates(), getSite()]);
  const lastBuild = items[0]?.publicatiedatum
    ? new Date(items[0].publicatiedatum).toUTCString()
    : new Date(0).toUTCString();

  const itemsXml = items.map((u) => `
    <item>
      <title>${escape(u.titel)}</title>
      <link>${base}/updates/${u.slug}</link>
      <guid isPermaLink="true">${base}/updates/${u.slug}</guid>
      <pubDate>${new Date(u.publicatiedatum).toUTCString()}</pubDate>
      <description>${cdata(truncate(u.excerpt))}</description>
      ${u.afbeelding ? `<enclosure url="${u.afbeelding}" type="image/jpeg" />` : ''}
      ${u.tags.map((t) => `<category>${escape(t)}</category>`).join('')}
    </item>`).join('');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(siteMeta.site_naam)} — Updates</title>
    <link>${base}/updates</link>
    <description>${escape(siteMeta.tagline)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />${itemsXml}
  </channel>
</rss>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
  });
}
