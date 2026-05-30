# Website Design Blueprint — Second Life Brand Site

> **Doel van dit document:** Dit is het complete bouwplan voor de website. Het ontwerp- en bouwproces verloopt in fasen: (1) Component Library, (2) Homepage, (3) Overige pagina's. De component library brief is een apart document (component-library-brief.md) dat als eerste aan Claude Design gegeven wordt.

---

## 1. Project Overview

| Item | Detail |
|---|---|
| **Type** | Portfolio / showcase / productpresentatie website |
| **Branche** | Second Life digital content creation (mesh wearables, HUDs, scripted accessories) |
| **Doelgroep** | Second Life gebruikers, content creators, potentiële klanten |
| **Eigenaar** | Solo creator / eigen merk |
| **Tech stack** | Astro (frontend) + Directus (headless CMS) |
| **Hosting** | Self-hosted op Linode (Docker) |
| **Talen** | Primair Engels (SL community is internationaal) |

### Kernboodschap
De site moet het merk positioneren als een professionele, creatieve maker van hoogwaardige Second Life producten. De uitstraling moet modern, visueel sterk, en vertrouwenwekkend zijn — het is de etalage van het merk.

---

## 2. Sitemap & Pagina's

```
Homepagina
├── Age Gate (18+ verificatie overlay)
├── Hero visual (full-viewport)
├── Top Taken (Products, Support, Nieuws)
├── Uitgelichte producten (3-4 items)
├── Laatste updates (feed preview)
└── Footer

Landing Page: Product Lijn
└── Gerichte presentatie van een specifieke productcategorie

Landing Page: Promotie / Campagne
└── Tijdelijke promo of nieuwe release highlight

Producten
├── Overzichtspagina met filtering (categorie, type)
└── Product detailpagina

Updates (Blog / News)
├── Overzicht (cards, chronologisch)
└── Enkele update pagina
    → Genereert RSS/JSON feed voor OpenClaw

Over / About
├── Merkinfo & creator story
└── FAQ (optioneel)

Contact
└── Contactformulier
```

---

## 3. Pagina Specificaties

### 3.1 Homepagina

**⚠️ Age Gate / Startscherm (verplicht, vóór de content)**
- Overlay of full-screen startscherm dat verschijnt bij eerste bezoek
- Waarschuwingstekst: de site bevat beelden waarop mogelijk semi-naaktheid zichtbaar is
- Leeftijdsverificatie: bezoeker moet bevestigen dat hij/zij 18 jaar of ouder is
- Twee knoppen: "Ik ben 18+" (ga door) en "Verlaat de site" (redirect naar bijv. Google)
- Keuze wordt onthouden via cookie/localStorage zodat het bij terugkeer niet opnieuw verschijnt
- Design: moet passen bij de donkere sfeer van de site, niet klinisch of juridisch aanvoelen. Merknaam/logo zichtbaar. Kan een subtiele achtergrond-blur over de homepage hebben.

**Hero Visual (full-width, dominant)**
- Grote, impactvolle visual die de volledige viewport-breedte inneemt
- Dit is het eerste wat de bezoeker ziet na de age gate — het moet direct de sfeer neerzetten
- Achterliggend: een high-quality render/foto die het merk en de producten representeert
- Optioneel: subtiele parallax of ken-burns animatie voor dynamiek
- Overlay met merknaam/tagline (in Lobster font)
- Beheerd vanuit Directus (Promo content type) zodat de visual gewisseld kan worden

**Top Taken (direct onder of over de hero)**
- 3 prominente navigatie-blokken die de bezoeker direct naar de belangrijkste secties leiden:
  1. **Producten** — icoon of visual + korte tekst + link
  2. **Support / Contact** — icoon of visual + korte tekst + link
  3. **Nieuws / Updates** — icoon of visual + korte tekst + link
- Deze top taken moeten visueel opvallend zijn (cards met glow-border, of icon-blocks met neon accent)
- Op mobiel: horizontaal scrollbaar of gestapeld

**Uitgelichte Producten**
- Grid van 3-4 product cards
- Elke card: productafbeelding (groot, dominant), naam, categorie-label, korte omschrijving
- "Bekijk alle producten" link naar producten overzicht
- Selectie via een "featured" toggle in Directus

**Laatste Updates**
- 2-3 meest recente updates als compacte cards
- Elke card: datum, titel, korte teaser, optioneel thumbnail
- "Alle updates" link naar updates overzicht

**Footer**
- Merknaam + tagline
- Social links (Second Life Marketplace, Instagram, Bluesky)
- Copyright

### 3.2 Landing Page: Product Lijn

Een template-pagina voor het uitlichten van een specifieke productcategorie (bijv. "Latex Wearables Collection" of "HUD Systems").

**Layout**
- Hero banner met categorie-beeld (full-width, minder hoog dan homepage hero)
- Categorie titel (Lobster) + introductie tekst
- Productgrid gefilterd op die categorie (hergebruik product cards)
- Optioneel: USP-blokken of features van de categorie
- CTA naar marketplace of contact

### 3.3 Landing Page: Promotie / Campagne

Een template-pagina voor tijdelijke promoties, nieuwe releases, of speciale campagnes.

**Layout**
- Grote hero visual (het promotiebeeld)
- Headline + beschrijving van de actie/release
- Product spotlight: 1-3 producten die centraal staan
- Countdown timer (optioneel, voor tijdelijke acties)
- CTA buttons (marketplace, social share)
- Kan ook dienen als "nieuwe release" aankondiging

### 3.4 Producten — Overzicht

**Layout**
- Grid-based overzicht (responsive: 3 kolommen desktop → 2 tablet → 1 mobiel)
- Filtering op categorie (bijv. Wearables, HUDs, Accessories, Mesh Bodies/Parts)
- Optioneel: zoekfunctie

**Product Card**
- Hoofdafbeelding (vierkant of 4:3)
- Productnaam
- Categorie badge/label
- Korte beschrijving (1-2 regels, afgekapt)
- Optioneel: "Nieuw" of "Update" badge

### 3.5 Producten — Detailpagina

**Content Structuur**
- Productgallerij (meerdere afbeeldingen, lightbox/slider)
- Productnaam + categorie
- Uitgebreide beschrijving (rich text vanuit Directus)
- Features lijst
- Compatibiliteit info (bijv. mesh body compatibility: LaraX, Legacy, Kupra, etc.)
- Marketplace link(s) — externe CTA button ("Koop op SL Marketplace")
- Gerelateerde producten (2-3 items onderaan)

### 3.6 Updates (Blog/News)

**Overzicht**
- Chronologische lijst van updates
- Elke entry: datum, titel, excerpt, optioneel afbeelding
- Paginering of infinite scroll
- Categorie/tag filtering optioneel

**Enkele Update Pagina**
- Titel + publicatiedatum
- Rich text content (afbeeldingen, video embeds, tekst)
- Tags/categorieën
- Social share buttons (optioneel)
- Vorige/volgende navigatie

**Feed Output (cruciaal)**
- Elke update genereert automatisch entries in:
  - `/feed.xml` (RSS 2.0)
  - `/feed.json` (JSON Feed)
- Feed bevat: titel, content (plain text of excerpt), publicatiedatum, URL, afbeelding
- OpenClaw pollt deze feed en post door naar Instagram en Bluesky

### 3.7 Over / About

- Creator/merk verhaal (rich text)
- Optioneel: een hero afbeelding of in-world screenshot
- FAQ sectie (accordion/collapsible, optioneel voor v1)

### 3.8 Contact

- Contactformulier met velden:
  - Naam
  - E-mail
  - Onderwerp (dropdown: Algemeen, Samenwerking, Support, Anders)
  - Bericht (textarea)
  - Submit button
- Formulier verstuurt via een simpele API route (Astro server endpoint) of externe service (Formspree/Resend)
- Bevestigingsmelding na verzenden
- Optioneel: direct e-mailadres tonen

---

## 4. Content Types (Directus Schema)

Dit is het datamodel dat in Directus wordt ingericht. Claude Design hoeft hier niet de technische implementatie van te ontwerpen, maar moet weten welke velden er per content type zijn om de UI goed te vormgeven.

### Promos
```
- id
- titel (string)
- beschrijving (text, kort)
- afbeelding (image)
- cta_tekst (string, bijv. "Bekijk nu")
- cta_url (string)
- actief (boolean)
- sortering (integer)
```

### Producten
```
- id
- naam (string)
- slug (string, auto)
- categorie (relatie → Categorieën)
- korte_beschrijving (text)
- uitgebreide_beschrijving (rich text / WYSIWYG)
- afbeeldingen (gallery / meerdere images)
- features (JSON of repeater)
- compatibiliteit (tags of multi-select)
- marketplace_url (string)
- is_featured (boolean)
- is_nieuw (boolean)
- publicatiedatum (datetime)
- status (published/draft)
```

### Categorieën
```
- id
- naam (string)
- slug (string)
- icoon (optioneel, image of icon-class)
```

### Updates
```
- id
- titel (string)
- slug (string, auto)
- content (rich text / WYSIWYG)
- excerpt (text, kort — voor feed en overzicht)
- afbeelding (image, optioneel)
- tags (tags / multi-select)
- publicatiedatum (datetime)
- status (published/draft)
```

### Site Instellingen (singleton)
```
- site_naam (string)
- tagline (string)
- logo (image)
- social_links (JSON: marketplace, instagram, bluesky URLs)
- over_tekst (rich text)
- contact_email (string)
```

---

## 5. Design Richting & Moodboard Instructies

### Sfeer & Toon
- **Latex & fetish meets neon-retro** — de site ademt een wereld van glossy materialen, strakke vormen, en neon-verlichte duisternis. Denk aan een high-end club of een futuristische showroom.
- **Premium & provocatief** — dit zijn handgemaakte digitale producten van hoge kwaliteit. De presentatie moet verleidelijk en intrigerend zijn, niet goedkoop of schreeuwerig.
- **Beelden zijn koning** — de productafbeeldingen en renders zijn het belangrijkste element van de site. Ze moeten de bezoeker nieuwsgierig maken en triggeren om verder te klikken, ook als diegene niets van Second Life af weet. Elk beeld vertelt een verhaal.
- **Dark mode** — donkere achtergronden laten de beelden en neon-accenten maximaal uitkomen
- Subtiele maar impactvolle animaties: glow-effecten, neon-pulsen, hover-reveals

### Kleurpalet (vastgesteld)
- **Achtergrond**: donkerblauw verlopend naar zwart (deep navy → true black gradient). Referentie productposters worden aangeleverd ter inspiratie.
- **Accentkleuren**: een gradient-spectrum van blauw → paars → roze. Dit is de signature kleurlijn van het merk. Gebruik dit voor:
  - CTA buttons en hover states
  - Neon glow effecten en borders
  - Accent lijnen, dividers, en highlights
  - Badge kleuren en active states
- **Tekst**: lichtgrijs / off-white (#e0e0e8 of vergelijkbaar) op donkere achtergrond
- **Cards/panels**: subtiel lichter dan de achtergrond (bijv. rgba(255,255,255,0.03-0.06)) met een zachte blauw-paarse border-glow bij hover

### Typografie (vastgesteld)
- **Kopteksten (h1–h6)**: **Lobster** (Google Fonts) — dit is het merk-font, ook gebruikt in het logo. Geeft een vloeiende, expressieve uitstraling die past bij de latex/fashion sfeer.
- **Body tekst**: modern schreefloos (sans-serif) lettertype — leesbaar, clean, en neutraal. Suggesties: Outfit, Satoshi, General Sans, of Manrope. Moet goed contrasteren met de expressiviteit van Lobster.
- **UI elementen** (buttons, labels, nav): hetzelfde sans-serif als body, eventueel in medium/semibold weight

### Visuele Elementen
- **Achtergrond texturen**: subtiele noise overlays, donkere mesh gradients, of diep-blauwe nebula-achtige texturen. Geen platte vlakken — er moet diepte voelbaar zijn.
- **Neon glow effecten**: subtiele maar herkenbare glow op hover states, active elementen, en accent borders. Blauw-paars-roze spectrum. CSS box-shadow en filter: drop-shadow.
- **Product cards**: hover-effect met glow border, subtiele schaal-vergroting, en een lichte overlay met "Bekijk" CTA
- **Afbeeldingen**: grote, dominante presentatie. Geen kleine thumbnails op de homepage — beelden moeten impact maken. Subtiele rounded corners of juist scherpe hoeken passend bij de latex-esthetiek.
- **Smooth page transitions** en scroll-triggered reveals
- **Glossy/reflectie effecten**: subtiele latex-achtige glans op UI elementen waar passend (buttons, cards)

---

## 6. Component Bibliotheek

Claude Design moet de volgende herbruikbare componenten ontwerpen:

### Navigatie
- **Desktop navbar**: logo links, nav items midden of rechts, compact
- **Mobile navbar**: hamburger menu met slide-out of overlay
- **Actieve pagina indicator**

### Cards
- **Product Card**: afbeelding + naam + categorie + korte omschrijving
- **Update Card**: datum + titel + excerpt + optioneel thumbnail
- **Promo Card / Hero Slide**: groot, visueel dominant, met CTA overlay
- **Top Taak Blok**: icoon/visual + label + link — voor de 3 hoofdnavigatie-blokken op home

### Overlays
- **Age Gate**: full-screen overlay met leeftijdsbevestiging, merknaam/logo, twee actieknoppen, optionele background blur. Moet bij de donkere neon-sfeer van de site passen.

### UI Elementen
- **Buttons**: primair (CTA, filled) en secundair (outline/ghost)
- **Badges/Labels**: categorie labels, "Nieuw" badge, "Featured" badge
- **Filter UI**: categorie filter (pills of dropdown)
- **Formulier elementen**: text input, textarea, dropdown, submit button
- **Lightbox / Image gallery**: voor product detailpagina
- **Accordion**: voor FAQ sectie
- **Toast/melding**: bevestiging na formulier submit

### Layout
- **Section container**: consistent padding/max-width
- **Grid system**: responsive product grid
- **Footer**: compact, met social links en copyright

---

## 7. Responsive Breakpoints

| Breakpoint | Viewport | Aanpassing |
|---|---|---|
| Desktop | ≥1024px | Volledige layout, 3-4 kolom grids |
| Tablet | 768px – 1023px | 2 kolom grids, aangepaste spacing |
| Mobiel | < 768px | 1 kolom, hamburger menu, gestapelde content |

---

## 8. Interactie & Animatie

- **Age gate**: fade-in bij eerste bezoek, smooth fade-out bij bevestiging met reveal van de homepage erachter
- **Page load**: subtiele fade-in / stagger van content blokken
- **Scroll**: elementen animeren in beeld (intersection observer)
- **Hover**: product cards krijgen een subtle lift/glow effect
- **Navigation**: smooth scroll naar secties op homepage
- **Promo slider**: auto-rotate met handmatige controls (dots/arrows)
- **Lightbox**: smooth open/close met overlay
- **Formulier**: inline validatie, loading state op submit, success melding

---

## 9. Feed & API Requirements

### RSS/JSON Feed (`/feed.xml` en `/feed.json`)
De updates sectie moet een machine-readable feed genereren die door OpenClaw (AI agent) geparsed wordt om door te posten naar Instagram en Bluesky.

**Feed inhoud per item:**
- `title` — update titel
- `content` of `content_text` — plain text versie van de content (max ~500 tekens voor social posts)
- `url` — permalink naar de update
- `image` — URL van de afbeelding (als aanwezig, voor Instagram)
- `date_published` — ISO 8601 publicatiedatum
- `tags` — array van tags

Dit is puur een data-output; er is geen UI design voor nodig, maar de updates content type moet zo ingericht zijn dat het een goede feed kan genereren.

---

## 10. Fasering & Deliverables

### Fase 1: Component Library (apart briefing document)
De component library wordt als eerste ontworpen. Zie: **component-library-brief.md** voor het volledige overzicht. Dit levert het design systeem op: kleurpalet, typografie, alle herbruikbare componenten met states en responsive varianten.

### Fase 2: Homepage
Op basis van de component library en het wireframe (zie hieronder) wordt de homepage gebouwd.

### Fase 3: Overige Pagina's
Met de component library en homepage als basis worden de overige pagina's ontworpen en gebouwd:
1. **Producten overzicht** — desktop + mobiel
2. **Product detailpagina** — desktop + mobiel
3. **Updates / Nieuws overzicht** — desktop + mobiel
4. **Enkele update pagina** — desktop
5. **Landing page: Product Lijn** — desktop + mobiel
6. **Landing page: Promotie / Campagne** — desktop + mobiel
7. **Contact pagina** — desktop + mobiel

---

## 11. Homepage Wireframe

Referentie: ELLE.com homepage-stijl. Grote full-viewport hero visual met navigatie er semi-transparant bovenop.

### Wireframe Beschrijving

```
┌─────────────────────────────────────────────────┐
│  AGE GATE OVERLAY (bij eerste bezoek)           │
│                                                  │
│  ┌───────────────────────────┐                  │
│  │  [Logo]                   │                  │
│  │                           │                  │
│  │  ⚠ Deze site bevat        │  Achtergrond:   │
│  │  beelden waarop mogelijk  │  blurred        │
│  │  semi-naaktheid zichtbaar │  homepage       │
│  │  kan zijn.                │                  │
│  │                           │                  │
│  │  [ Ik ben 18+ ]  (CTA)   │                  │
│  │  [ Verlaat site ] (ghost) │                  │
│  └───────────────────────────┘                  │
│                                                  │
│  Cookie onthoudt keuze                          │
└─────────────────────────────────────────────────┘

Na bevestiging:

┌─────────────────────────────────────────────────┐
│ [Logo]   Products  Updates  About  Contact  [♡] │  ← Semi-transparante navbar
├─────────────────────────────────────────────────┤
│                                                  │
│           FULL-VIEWPORT HERO VISUAL              │
│         (beheerd vanuit Directus Promo)          │
│                                                  │
│              Merknaam / Tagline                   │
│           (Lobster font, overlay)                │
│                                                  │
│             [ Ontdek meer ]                      │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│   │Products │  │ Support │  │ Nieuws  │        │  ← Top Taken
│   │Bekijk   │  │Contact  │  │Updates  │        │    (glow-border cards)
│   │collectie│  │opnemen  │  │bekijken │        │
│   └─────────┘  └─────────┘  └─────────┘        │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  Uitgelichte producten                           │
│                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ IMG  │ │ IMG  │ │ IMG  │ │ IMG  │           │  ← Product Cards
│  │      │ │      │ │      │ │      │           │    (hover: glow + zoom)
│  │Naam  │ │Naam  │ │Naam  │ │Naam  │           │
│  │Cat.  │ │Cat.  │ │Cat.  │ │Cat.  │           │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
│                          Bekijk alle producten → │
│                                                  │
├─────────────────────────────────────────────────┤
│                                                  │
│  Laatste updates                                 │
│                                                  │
│  ┌──────────────────┐ ┌──────────────────┐      │
│  │ 27 mei 2026      │ │ 25 mei 2026      │     │  ← Update Cards
│  │ Update titel     │ │ Update titel     │      │
│  └──────────────────┘ └──────────────────┘      │
│                              Alle updates →      │
│                                                  │
├─────────────────────────────────────────────────┤
│  Footer: merknaam · social links · copyright     │
└─────────────────────────────────────────────────┘
```

### Visuele Referentie
De homepage layout is geïnspireerd op ELLE.com: een full-viewport hero visual die alles domineert, met de navigatie semi-transparant er bovenop. Het verschil: de navbar zit bovenaan (niet onderaan zoals bij ELLE). De hero vult het volledige scherm bij binnenkomst, met een merknaam/tagline overlay en een CTA.

---

## 12. Technische Notities (voor latere implementatie)

- **Frontend**: Astro (SSG/SSR) met eventueel React islands voor interactieve componenten
- **CMS**: Directus (Docker, self-hosted op Linode) — REST API voor content
- **Formulier**: Astro API route → e-mail via Resend of SMTP
- **Feed**: Astro genereert statisch RSS/JSON bij elke build, of via SSR endpoint
- **Deployment**: Docker Compose op Linode (Directus + eventueel reverse proxy)
- **Afbeeldingen**: Directus asset transformaties voor responsive images, WebP
- **Performance target**: Lighthouse score 90+ op alle categorieën

---

*Dit document is het complete bouwplan. De component library wordt als eerste ontworpen via een apart briefing document (component-library-brief.md). De merknaam, exacte producten, en definitieve afbeeldingen worden later toegevoegd. Placeholder content in de Second Life digital fashion/latex accessories context mag gebruikt worden.*

**Nog aan te leveren door de opdrachtgever:**
- Productposters / referentiebeelden (voor kleurgebruik en sfeer)
- Merknaam en logo
- Teksten (over, FAQ, productbeschrijvingen)

