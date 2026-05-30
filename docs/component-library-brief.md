# Component Library Brief — Fase 1

> **Doel:** Dit document beschrijft de component library die als eerste stap ontworpen moet worden. Alle pagina's worden later opgebouwd uit deze componenten. Ontwerp elk component als een standalone, herbruikbaar element met alle states (default, hover, active, disabled waar relevant) in desktop + mobiel.

---

## Context & Sfeer

### Het Merk
Een premium Second Life content creator die mesh wearables, HUDs, en scripted accessories maakt en verkoopt. De site is de etalage — het moet bezoekers (ook zonder SL-kennis) nieuwsgierig maken via sterke beelden en een intrigerende sfeer.

### Design DNA
- **Latex & fetish meets neon-retro** — glossy materialen, strakke vormen, neon-verlichte duisternis
- **Premium & provocatief** — verleidelijk en intrigerend, niet goedkoop of schreeuwerig
- **Beelden zijn koning** — productfoto's en renders zijn het belangrijkste element
- **Dark mode only** — donkere achtergronden, lichtgevende accenten

---

## Design Tokens

### Kleurpalet

**Achtergrond**
- `--bg-deep`: deep navy (#0a0e1a of vergelijkbaar)
- `--bg-black`: near-black (#050508)
- `--bg-gradient`: linear-gradient van `--bg-deep` naar `--bg-black`
- `--bg-surface`: subtiel lichter (rgba(255,255,255,0.03-0.06)) — voor cards en panels

**Accent gradient (signature merkkleur)**
- `--accent-blue`: startpunt (bijv. #4466ff)
- `--accent-purple`: middenpunt (bijv. #8844ee)
- `--accent-pink`: eindpunt (bijv. #ee44aa)
- `--accent-gradient`: linear-gradient van blue → purple → pink
- Claude Design mag de exacte hex-waarden verfijnen zodat het palet harmonisch werkt. De richting blauw→paars→roze is vastgesteld.

**Tekst**
- `--text-primary`: lichtgrijs / off-white (#e0e0e8)
- `--text-secondary`: gedimde tekst (#8888a0 of vergelijkbaar)
- `--text-accent`: accent gradient als text-fill (voor speciale headlines)

**Borders & Glow**
- `--border-subtle`: rgba(255,255,255,0.08)
- `--border-hover`: accent gradient border (via border-image of outline)
- `--glow-sm`: 0 0 8px rgba(accent, 0.3) — subtiele glow
- `--glow-md`: 0 0 16px rgba(accent, 0.4) — medium glow
- `--glow-lg`: 0 0 32px rgba(accent, 0.5) — sterke glow (hero, highlights)

### Typografie

**Kopteksten (h1–h6): Lobster** (Google Fonts)
- Dit is het merk-font, ook gebruikt in het logo
- Vloeiend, expressief, past bij de latex/fashion sfeer
- h1: 48px / h2: 36px / h3: 28px / h4: 22px / h5: 18px / h6: 16px
- Kleur: `--text-primary` of `--text-accent` (gradient fill) voor speciale koppen
- Letter-spacing: normaal (Lobster heeft van nature al goede spacing)

**Body tekst: modern sans-serif**
- Kies een van: Outfit, Satoshi, General Sans, of Manrope
- Moet goed contrasteren met de expressiviteit van Lobster
- Body: 16px / line-height 1.6 / weight 400
- Small: 14px / Tiny: 12px
- Kleur: `--text-primary` (body) of `--text-secondary` (meta, labels)

**UI tekst (buttons, labels, nav)**
- Zelfde sans-serif als body
- Buttons: 14px / weight 500-600
- Nav items: 14px / weight 500 / uppercase tracking optioneel
- Badges: 12px / weight 600

### Spacing & Layout

- Container max-width: 1200px, centered
- Section padding: 80px verticaal (desktop), 48px (mobiel)
- Card padding: 16-24px
- Grid gap: 24px (desktop), 16px (mobiel)
- Border radius: 8px (cards), 4px (badges, inputs), 12px (grote containers)

### Breakpoints

| Naam | Viewport | Grid kolommen |
|---|---|---|
| Desktop | ≥1024px | 3-4 kolommen |
| Tablet | 768px – 1023px | 2 kolommen |
| Mobiel | < 768px | 1 kolom |

---

## Componenten

Ontwerp elk component hieronder met alle relevante states. Lever op als werkende HTML/CSS (of React) zodat de visuele richting en interactie 1:1 zichtbaar zijn.

### 1. Navigatie

**Desktop Navbar**
- Semi-transparante achtergrond (glassmorphism of rgba overlay) — bedoeld om over hero-beelden heen te liggen
- Logo links (placeholder)
- Nav items: Products, Updates, About, Contact
- Social icons rechts (SL Marketplace, Instagram, Bluesky)
- States: default, scroll (compacter + meer opaque), active page indicator
- Active indicator: accent gradient underline of glow

**Mobile Navbar**
- Logo links, hamburger icon rechts
- Slide-out menu of full-screen overlay
- Menu items + social links
- Smooth open/close animatie

### 2. Cards

**Product Card**
- Afbeelding: dominant, neemt ~70% van de card in (vierkant of 4:3)
- Onder de afbeelding: productnaam (Lobster, h4) + categorie badge + korte beschrijving (1-2 regels, afgekapt)
- Optioneel: "Nieuw" of "Updated" badge linksboven op de afbeelding
- Achtergrond: `--bg-surface` met `--border-subtle`
- States:
  - Default: rustig, subtiele border
  - Hover: glow border (accent gradient), subtiele scale(1.02), afbeelding licht zoom-in, optioneel "Bekijk" overlay op afbeelding
- Klikbaar: hele card is een link

**Update Card**
- Compacter dan product card
- Datum (klein, `--text-secondary`) + titel (sans-serif, bold) + excerpt (2 regels max)
- Optioneel: small thumbnail links
- Achtergrond: `--bg-surface`
- Hover: glow border, subtiele lift

**Promo Card / Hero Slide**
- Full-width beeld als achtergrond
- Overlay gradient (van transparant naar donker) aan onderkant
- Daarop: headline (Lobster), korte tekst, CTA button
- Bedoeld voor de hero sectie op de homepage

**Top Taak Blok**
- 3 naast elkaar op homepage
- Elk blok: icoon of small visual + label (Lobster) + korte beschrijving + link
- Accent gradient border of glow
- Hover: glow versterkt, subtiele lift
- Mobiel: gestapeld of horizontaal scrollbaar

### 3. Age Gate Overlay

- Full-screen overlay die de hele viewport bedekt
- Achtergrond: donker met optionele blur van de content erachter
- Centraal gepositioneerde modal/card:
  - Logo/merknaam bovenaan
  - Waarschuwingstekst: "Deze site bevat beelden waarop mogelijk semi-naaktheid zichtbaar is"
  - Primaire button: "Ik ben 18+" (accent gradient, prominent)
  - Secundaire button/link: "Verlaat de site" (ghost/outline, minder prominent)
- Sfeer: past bij de site — donker, neon accenten, niet klinisch of juridisch
- Animatie: fade-in bij load, smooth fade-out + reveal bij bevestiging

### 4. Buttons

**Primair (CTA)**
- Accent gradient achtergrond (blauw→paars→roze)
- Witte tekst, sans-serif, 14px weight 600
- Padding: 12px 28px
- Border-radius: 4-6px
- States: default, hover (glow + lichte brightness), active (scale 0.98), disabled (desaturated, opacity 0.5)

**Secundair (Outline / Ghost)**
- Transparante achtergrond
- Accent gradient border (1-2px)
- Tekst in `--text-primary`
- States: default, hover (subtle fill + glow), active, disabled

**Text Link / Ghost**
- Geen achtergrond of border
- Tekst met accent kleur of `--text-primary`
- Hover: underline of glow

**Marketplace Button (extern)**
- Variant van primair, maar met een "externe link" icoon
- Duidelijk herkenbaar als "dit brengt je naar de SL Marketplace"

### 5. Badges & Labels

**Categorie Badge**
- Pill shape (border-radius: 50px)
- Achtergrond: `--bg-surface` of subtiele accent kleur
- Tekst: 12px, weight 600, uppercase
- Gebruikt op product cards en product detail

**Status Badge**
- "Nieuw" — accent gradient achtergrond
- "Updated" — subtielere variant
- "Featured" — met ster of highlight icoon
- Gepositioneerd linksboven op card afbeeldingen

### 6. Formulier Elementen

**Text Input**
- Donkere achtergrond (`--bg-surface`)
- Subtiele border (`--border-subtle`)
- Placeholder tekst in `--text-secondary`
- Focus state: accent glow border
- Label boven het veld in `--text-secondary`, 14px

**Textarea**
- Zelfde styling als text input, maar groter (min-height: 120px)
- Resize: vertical

**Dropdown/Select**
- Zelfde basis-styling als text input
- Custom dropdown arrow (accent kleur)

**Submit Button**
- Primaire CTA button styling
- Loading state: spinner of pulse animatie
- Success state: check icoon + kleur-shift

### 7. Filter UI

**Categorie Filter (Pills)**
- Horizontale rij van pills
- Default: ghost/outline style
- Active/selected: accent gradient fill
- Hover: subtiele glow
- Mobiel: horizontaal scrollbaar met fade-edges

### 8. Image Gallery / Lightbox

**Thumbnail Grid**
- Kleine thumbnails onder de hoofd-afbeelding op product detail
- Active thumbnail: accent border
- Hover: glow

**Lightbox Overlay**
- Donkere overlay (90% opacity)
- Grote afbeelding centraal
- Navigatie pijlen links/rechts
- Sluit-knop rechtsboven
- Smooth open/close animatie
- Swipe support op mobiel

### 9. Accordion

- Voor FAQ en eventueel product features
- Header: klikbaar, met expand/collapse icoon (+ / − of chevron)
- Content: smooth height animatie bij open/close
- Accent indicator op open item (bijv. linkerborder in gradient)

### 10. Toast / Melding

- Floating melding (bottom-right of top-center)
- Succes variant: groene tint met check icoon
- Info variant: accent kleur
- Auto-dismiss na ~5 seconden
- Slide-in animatie

### 11. Footer

- Donkere achtergrond (donkerder dan de content area)
- Logo / merknaam
- Social links als iconen (SL Marketplace, Instagram, Bluesky)
- Copyright tekst
- Optioneel: korte nav links
- Compact, niet te hoog

### 12. Section Container

- Max-width: 1200px, centered
- Padding: 80px top/bottom (desktop), 48px (mobiel)
- Optioneel: section header met Lobster heading + accent underline/divider

### 13. Typography Specimen

- Toon alle heading levels (h1–h6) in Lobster
- Toon body text, small text, tiny text in het gekozen sans-serif
- Toon bold, regular, en light weights
- Toon tekst op donkere achtergrond met correcte kleuren
- Toon een voorbeeld van accent gradient tekst

---

## Animatie & Interactie Richtlijnen

Alle componenten moeten de volgende animatieprincipes volgen:

- **Transitions**: 200-300ms ease-out voor hover/focus states
- **Glow effecten**: CSS box-shadow en/of filter: drop-shadow, nooit overdreven — subtiel maar merkbaar
- **Scale**: max scale(1.02-1.03) op hover, scale(0.98) op active/click
- **Scroll reveals**: intersection observer, fade-up + slight translate, staggered per element
- **Reduced motion**: respecteer `prefers-reduced-motion` — schakel animaties uit voor gebruikers die dit instellen

---

## Deliverable

Lever een **werkende HTML/CSS pagina** (of React component set) op die alle bovenstaande componenten toont als een visuele catalogus / component sheet. Elk component met:
- Alle visuele states naast elkaar (default, hover, active, disabled)
- Desktop en mobiel variant waar relevant
- Werkende hover/click interacties
- Het volledige kleurpalet en typografie specimen

Dit wordt de basis waarop alle pagina's gebouwd worden.

---

*De merknaam, logo, en productafbeeldingen worden apart aangeleverd. Gebruik placeholder content die past bij de Second Life digital fashion/latex accessories context.*
