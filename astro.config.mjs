// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Public site URL — used to generate absolute links in feeds, sitemaps, og: tags.
  // Update once the production domain is live.
  site: 'https://avalia.rocks',
  integrations: [
    sitemap({
      // Keep the machine feeds (consumed by Hermes) out of the sitemap —
      // they're data endpoints, not indexable pages.
      filter: (page) => !page.includes('/feed.'),
    }),
  ],
});
