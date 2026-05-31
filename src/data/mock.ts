/**
 * Mock content for development. Field names mirror the Directus schema in
 * docs/website-design-blueprint.md so the swap to live Directus is minimal.
 *
 * When wiring Directus: replace these arrays with `getItems(...)` calls from
 * src/lib/directus.ts and resolve image fields via `directusAsset(...)`.
 */

export interface Categorie {
  id: number;
  naam: string;
  slug: string;
  icoon?: string;
}

export interface Product {
  id: number;
  naam: string;
  slug: string;
  categorie: Categorie;
  korte_beschrijving: string;
  uitgebreide_beschrijving: string;       // accepts HTML
  afbeeldingen: string[];                  // resolved URLs (Directus -> directusAsset)
  features: string[];
  compatibiliteit: string[];
  marketplace_url: string;
  is_featured: boolean;
  is_nieuw: boolean;
  publicatiedatum: string;                 // ISO 8601
  status: 'published' | 'draft';
}

export interface Update {
  id: number;
  titel: string;
  slug: string;
  content: string;                         // HTML
  excerpt: string;                         // plain text, ≤500 chars (feed-safe)
  afbeelding?: string;
  tags: string[];
  publicatiedatum: string;
  status: 'published' | 'draft';
}

export interface Promo {
  id: number;
  titel: string;
  beschrijving: string;
  afbeelding?: string;
  /** CSS object-position from the Directus focal point, e.g. "47% 22%". */
  afbeelding_focal?: string;
  cta_tekst: string;
  cta_url: string;
  actief: boolean;
  sortering: number;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface SiteInstellingen {
  site_naam: string;
  tagline: string;
  social_links: { marketplace: string; instagram: string; bluesky: string };
  over_tekst: string;                      // HTML
  contact_email: string;
}

// ---------------------------------------------------------------------------
// Categorieën
// ---------------------------------------------------------------------------
export const categorieen: Categorie[] = [
  { id: 1, naam: 'Wearables', slug: 'wearables', icoon: 'box' },
  { id: 2, naam: 'HUDs', slug: 'huds', icoon: 'sparkle' },
  { id: 3, naam: 'Accessories', slug: 'accessories', icoon: 'star' },
  { id: 4, naam: 'Mesh Bodies', slug: 'mesh-bodies', icoon: 'box' }
];

const catBySlug = (s: string) => categorieen.find((c) => c.slug === s)!;

// ---------------------------------------------------------------------------
// Producten
// ---------------------------------------------------------------------------
export const producten: Product[] = [
  {
    id: 1,
    naam: 'Neon Harness',
    slug: 'neon-harness',
    categorie: catBySlug('wearables'),
    korte_beschrijving: 'Glossy latex harness with a color-change HUD.',
    uitgebreide_beschrijving:
      '<p>A fully rigged latex harness with reactive neon piping. Includes a HUD with 16 colour presets, save-your-own slots, and a one-tap "pulse" mode for clubbing.</p>' +
      '<p>Materials enabled, four roughness textures, and tinting on every strap. Demo available in-world.</p>',
    afbeeldingen: ['/img/placeholder-1.svg', '/img/placeholder-2.svg', '/img/placeholder-3.svg', '/img/placeholder-4.svg'],
    features: [
      'Materials-enabled, four roughness textures',
      'Color-change HUD with 16 presets + save slots',
      'Pulse mode for clubbing (synced to local music)',
      'Modifiable / copy / no-trans'
    ],
    compatibiliteit: ['Maitreya LaraX', 'Reborn', 'Legacy', 'Kupra'],
    marketplace_url: 'https://marketplace.secondlife.com/p/example-neon-harness',
    is_featured: true,
    is_nieuw: true,
    publicatiedatum: '2026-05-20',
    status: 'published'
  },
  {
    id: 2,
    naam: 'Glow Collar',
    slug: 'glow-collar',
    categorie: catBySlug('accessories'),
    korte_beschrijving: 'Emissive collar with adjustable neon glow.',
    uitgebreide_beschrijving:
      '<p>A statement collar with a soft inner glow. Adjustable intensity, three pendant variants, and an optional D-ring attachment point.</p>',
    afbeeldingen: ['/img/placeholder-2.svg', '/img/placeholder-3.svg'],
    features: ['Adjustable emission intensity', 'Three pendant styles', 'Optional D-ring', 'Single-mesh, low LI'],
    compatibiliteit: ['Universal (rigged to neck)'],
    marketplace_url: 'https://marketplace.secondlife.com/p/example-glow-collar',
    is_featured: true,
    is_nieuw: false,
    publicatiedatum: '2026-04-12',
    status: 'published'
  },
  {
    id: 3,
    naam: 'Latex Bodysuit',
    slug: 'latex-bodysuit',
    categorie: catBySlug('wearables'),
    korte_beschrijving: 'Fully rigged, with materials and four textures.',
    uitgebreide_beschrijving:
      '<p>A second-skin latex bodysuit rigged for the major mesh bodies. Four base colours, a tinting HUD, and a separate glove + hood pack.</p>',
    afbeeldingen: ['/img/placeholder-3.svg', '/img/placeholder-1.svg', '/img/placeholder-4.svg'],
    features: ['Rigged for all major mesh bodies', 'Tinting HUD included', 'Glove + hood pack as add-on'],
    compatibiliteit: ['Maitreya LaraX', 'Reborn', 'Legacy', 'Kupra', 'eBody Reborn'],
    marketplace_url: 'https://marketplace.secondlife.com/p/example-latex-bodysuit',
    is_featured: true,
    is_nieuw: false,
    publicatiedatum: '2026-03-02',
    status: 'published'
  },
  {
    id: 4,
    naam: 'Color-Change HUD',
    slug: 'color-change-hud',
    categorie: catBySlug('huds'),
    korte_beschrijving: 'Universal colour HUD with favourites and presets.',
    uitgebreide_beschrijving:
      '<p>The same HUD that ships with every Avalia product, sold standalone for creators. Compatible with anything that exposes a colour link channel.</p>',
    afbeeldingen: ['/img/placeholder-4.svg', '/img/placeholder-2.svg'],
    features: ['Save 8 personal presets', 'Quick-tap recent colours', 'Per-prim or per-face targeting', 'Creator-friendly script'],
    compatibiliteit: ['Any product with a colour link channel'],
    marketplace_url: 'https://marketplace.secondlife.com/p/example-color-change-hud',
    is_featured: false,
    is_nieuw: true,
    publicatiedatum: '2026-05-10',
    status: 'published'
  },
  {
    id: 5,
    naam: 'Eclipse Choker',
    slug: 'eclipse-choker',
    categorie: catBySlug('accessories'),
    korte_beschrijving: 'A minimal choker from the Eclipse drop.',
    uitgebreide_beschrijving:
      '<p>Part of the limited Eclipse Collection. A single-band choker with a tiny crescent pendant that picks up your harness HUD colour automatically.</p>',
    afbeeldingen: ['/img/placeholder-1.svg', '/img/placeholder-4.svg'],
    features: ['Auto-syncs colour with Eclipse harness', 'Two pendant sizes', 'Universal rig'],
    compatibiliteit: ['Universal'],
    marketplace_url: 'https://marketplace.secondlife.com/p/example-eclipse-choker',
    is_featured: false,
    is_nieuw: true,
    publicatiedatum: '2026-05-22',
    status: 'published'
  },
  {
    id: 6,
    naam: 'Reactive Mesh Body Add-on',
    slug: 'reactive-mesh-addon',
    categorie: catBySlug('mesh-bodies'),
    korte_beschrijving: 'Latex appliers + glow layer for major mesh bodies.',
    uitgebreide_beschrijving:
      '<p>BOM-friendly latex appliers in four sheens, plus an optional emissive overlay layer that picks up your harness or collar colour.</p>',
    afbeeldingen: ['/img/placeholder-2.svg', '/img/placeholder-3.svg'],
    features: ['BOM appliers, four sheen levels', 'Optional emissive overlay', 'Tinted by your active HUD'],
    compatibiliteit: ['Maitreya LaraX', 'Reborn', 'Legacy'],
    marketplace_url: 'https://marketplace.secondlife.com/p/example-reactive-mesh-addon',
    is_featured: false,
    is_nieuw: false,
    publicatiedatum: '2026-02-18',
    status: 'published'
  },
  {
    id: 7,
    naam: 'Pulse Cuffs',
    slug: 'pulse-cuffs',
    categorie: catBySlug('accessories'),
    korte_beschrijving: 'Wrist + ankle cuffs that pulse to local music.',
    uitgebreide_beschrijving:
      '<p>Pair of cuffs (wrists + ankles) that listen for local music and pulse in sync. Falls back to a slow breathing animation when there is no audio.</p>',
    afbeeldingen: ['/img/placeholder-3.svg', '/img/placeholder-1.svg'],
    features: ['Local-music sync', 'Idle breathing animation', 'HUD-tintable, three sheen options'],
    compatibiliteit: ['Universal (rigged to wrists + ankles)'],
    marketplace_url: 'https://marketplace.secondlife.com/p/example-pulse-cuffs',
    is_featured: false,
    is_nieuw: false,
    publicatiedatum: '2026-01-30',
    status: 'published'
  },
  {
    id: 8,
    naam: 'Showroom HUD',
    slug: 'showroom-hud',
    categorie: catBySlug('huds'),
    korte_beschrijving: 'A creator HUD for in-world product showrooms.',
    uitgebreide_beschrijving:
      '<p>Built for fellow creators: a configurable showroom HUD that handles demos, redeliveries, and Marketplace deep-links from a single panel.</p>',
    afbeeldingen: ['/img/placeholder-4.svg', '/img/placeholder-2.svg'],
    features: ['Demo + redelivery flow', 'Deep-link to Marketplace', 'Per-product analytics'],
    compatibiliteit: ['Any creator vendor'],
    marketplace_url: 'https://marketplace.secondlife.com/p/example-showroom-hud',
    is_featured: false,
    is_nieuw: false,
    publicatiedatum: '2026-01-10',
    status: 'published'
  }
];

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------
export const updates: Update[] = [
  {
    id: 1,
    titel: 'Neon Harness v2.1 — new glow modes',
    slug: 'neon-harness-v21',
    excerpt: 'Three new pulsing glow presets, better LOD, and a fix for the rim-light flicker some of you reported.',
    content:
      '<p>v2.1 ships today. Three new pulse presets ("Slow Burn", "Rave", "Heartbeat"), tighter LOD on the rim piping, and the rim-light flicker some of you saw on ALM-off viewers is fixed.</p>' +
      '<h3>Redelivery</h3><p>Auto-redelivered to all owners. If you don\'t see it within 30 minutes, hit the redeliver terminal in the showroom.</p>',
    tags: ['neon-harness', 'release', 'fix'],
    publicatiedatum: '2026-05-24',
    status: 'published'
  },
  {
    id: 2,
    titel: 'Color-change HUD gets favourites',
    slug: 'hud-favourites',
    excerpt: 'Save your own colour combos and swap them in one tap. Free update for everyone with the standalone HUD.',
    content:
      '<p>The HUD now has 8 favourite slots. Long-press any colour to save it; tap a favourite to load. Combos sync across all your Avalia products.</p>',
    tags: ['hud', 'feature'],
    publicatiedatum: '2026-05-18',
    status: 'published'
  },
  {
    id: 3,
    titel: 'Eclipse Collection drops May 30',
    slug: 'eclipse-drop',
    excerpt: 'A limited run of latex wearables with reactive neon glow. 200 numbered sets — first come, first served.',
    content:
      '<p>The Eclipse Collection launches Friday May 30. 200 numbered sets, each with the Eclipse Harness, Choker, and a matching pair of Pulse Cuffs.</p>' +
      '<p>Set yourself a reminder — once they\'re gone, they\'re gone.</p>',
    tags: ['eclipse', 'drop', 'limited'],
    publicatiedatum: '2026-05-15',
    status: 'published'
  },
  {
    id: 4,
    titel: 'Showroom HUD goes public for creators',
    slug: 'showroom-hud-public',
    excerpt: 'The same HUD I use in my own store is now on Marketplace — pay what you want during launch week.',
    content:
      '<p>I\'ve quietly used my Showroom HUD for the last year — demos, redeliveries, deep-links to Marketplace, all from one panel. It\'s now publicly available for other creators.</p>' +
      '<p>Pay what you want for the first week (L$1 minimum), then it goes to a fixed price.</p>',
    tags: ['hud', 'creators'],
    publicatiedatum: '2026-05-05',
    status: 'published'
  },
  {
    id: 5,
    titel: 'New mesh body support: eBody Reborn',
    slug: 'ebody-reborn-support',
    excerpt: 'All current latex wearables now ship with an eBody Reborn rig. Redelivery is automatic.',
    content:
      '<p>eBody Reborn support has landed in every current Avalia wearable. Existing owners have been auto-redelivered.</p>',
    tags: ['compatibility', 'mesh-bodies'],
    publicatiedatum: '2026-04-22',
    status: 'published'
  }
];

// ---------------------------------------------------------------------------
// Promos (active hero / campaigns)
// ---------------------------------------------------------------------------
export const promos: Promo[] = [
  {
    id: 1,
    titel: 'Eclipse Collection',
    beschrijving: 'A limited run of latex wearables with reactive neon glow. 200 numbered sets, then it\'s gone.',
    afbeelding: '/img/hero-eclipse.svg',
    cta_tekst: 'Discover the drop',
    cta_url: '/promo/eclipse',
    actief: true,
    sortering: 1
  }
];

// ---------------------------------------------------------------------------
// FAQ (about page)
// ---------------------------------------------------------------------------
export const faq: FAQItem[] = [
  {
    question: 'Do your wearables come with the major mesh body rigs?',
    answer: 'Yes — Maitreya LaraX, Reborn, Legacy, and Kupra are standard. eBody Reborn was added in April 2026. Compatibility is listed on every product page.'
  },
  {
    question: 'Are updates free?',
    answer: 'Yes. All in-version updates are pushed via auto-redelivery. Major next-version overhauls (e.g. a full mesh refit) get a loyalty discount for existing owners.'
  },
  {
    question: 'Can I demo before buying?',
    answer: 'Every product has a demo on the in-world showroom. Marketplace listings link directly to the demo SLurl.'
  },
  {
    question: 'How do I get support?',
    answer: 'Use the contact form on this site, or message me in-world (same SL name as the store). I aim to reply within 48 hours.'
  },
  {
    question: 'Do you accept custom requests?',
    answer: 'Occasionally — message me with what you have in mind and I\'ll let you know if I can fit it in.'
  }
];

// ---------------------------------------------------------------------------
// Site settings (singleton)
// ---------------------------------------------------------------------------
export const site: SiteInstellingen = {
  site_naam: 'Avalia',
  tagline: 'Latex, neon, and mesh — handmade for Second Life.',
  social_links: {
    marketplace: 'https://marketplace.secondlife.com/stores/example',
    instagram: 'https://instagram.com/avalia.example',
    bluesky: 'https://bsky.app/profile/avalia.example'
  },
  over_tekst:
    '<p>Avalia is a small Second Life studio making latex wearables, HUDs, and scripted accessories. ' +
    'Everything is designed in-world, prototyped on real avatars, and tested across the major mesh bodies before it ships.</p>' +
    '<p>I make what I want to wear myself. If you find something you love, that means a lot.</p>',
  contact_email: 'contact@avalia.example'
};

// ---------------------------------------------------------------------------
// Query helpers — small layer that mirrors what the Directus version will do.
// ---------------------------------------------------------------------------
export const featuredProducts = () => producten.filter((p) => p.is_featured && p.status === 'published');
export const productsByCategory = (slug: string) =>
  producten.filter((p) => p.categorie.slug === slug && p.status === 'published');
export const productBySlug = (slug: string) => producten.find((p) => p.slug === slug && p.status === 'published');
export const relatedProducts = (p: Product, n = 3) =>
  producten.filter((x) => x.id !== p.id && x.categorie.id === p.categorie.id && x.status === 'published').slice(0, n);

export const publishedUpdates = () =>
  [...updates].filter((u) => u.status === 'published').sort((a, b) => +new Date(b.publicatiedatum) - +new Date(a.publicatiedatum));
export const updateBySlug = (slug: string) => publishedUpdates().find((u) => u.slug === slug);
export const adjacentUpdates = (slug: string) => {
  const list = publishedUpdates();
  const i = list.findIndex((u) => u.slug === slug);
  return { prev: i > 0 ? list[i - 1] : undefined, next: i >= 0 && i < list.length - 1 ? list[i + 1] : undefined };
};

export const activePromo = () => promos.find((p) => p.actief);
export const promoBySlug = (slug: string) => promos.find((p) => p.cta_url === `/promo/${slug}`);
