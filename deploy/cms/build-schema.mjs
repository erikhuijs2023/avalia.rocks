#!/usr/bin/env node
/**
 * build-schema.mjs — idempotently create the Avalia collections in Directus.
 *
 *   node deploy/cms/build-schema.mjs
 *
 * Reads connection from env vars (with defaults):
 *   DIRECTUS_URL     default http://192.168.178.29:8085
 *   ADMIN_EMAIL      required
 *   ADMIN_PASSWORD   required
 *
 * Collections created (field names match src/data/mock.ts):
 *   categorieen, producten, updates, promos, site_instellingen (singleton), faq
 *
 * Public role gets read access on published items.
 */

const URL = process.env.DIRECTUS_URL || 'http://192.168.178.29:8085';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL + ADMIN_PASSWORD env vars.');
  process.exit(1);
}

// ---- HTTP helpers ----------------------------------------------------------
let token = null;

async function api(path, init = {}) {
  const res = await fetch(`${URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const err = body?.errors?.[0];
    const code = err?.extensions?.code;
    const message = err?.message || res.statusText;
    const e = new Error(`${res.status} ${message}`);
    e.code = code; e.body = body;
    throw e;
  }
  return body;
}

async function login() {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  token = r.data.access_token;
}

// ---- Idempotency helpers ---------------------------------------------------
async function ensureCollection(collection, options) {
  try {
    await api(`/collections/${collection}`);
    console.log(`  ✓ collection ${collection} already exists`);
    return false;
  } catch (e) {
    if (!String(e.message).includes('404') && e.code !== 'FORBIDDEN') throw e;
    await api('/collections', { method: 'POST', body: JSON.stringify({ collection, ...options }) });
    console.log(`  + created collection ${collection}`);
    return true;
  }
}

async function ensureField(collection, field, definition) {
  // Directus returns 403 (FORBIDDEN) on non-existent fields too — list and check locally.
  const list = await api(`/fields/${collection}`);
  if (list.data.some((f) => f.field === field)) return false;
  await api(`/fields/${collection}`, { method: 'POST', body: JSON.stringify({ field, ...definition }) });
  console.log(`  + ${collection}.${field}`);
  return true;
}

async function ensureRelation(payload) {
  // No clean "get by name" — list and match on collection+field.
  const all = await api('/relations');
  const exists = all.data.some(
    (r) => r.collection === payload.collection && r.field === payload.field
  );
  if (exists) return false;
  await api('/relations', { method: 'POST', body: JSON.stringify(payload) });
  console.log(`  + relation ${payload.collection}.${payload.field} → ${payload.related_collection}`);
  return true;
}

// ---- Field definitions -----------------------------------------------------
// Directus field "definition" = { type, schema, meta } per the SDK reference.
const f = {
  string: (opts = {}) => ({
    type: 'string',
    meta: { interface: 'input', width: 'full', ...(opts.meta || {}) },
    schema: { is_nullable: !opts.required, ...(opts.unique ? { is_unique: true } : {}), ...(opts.schema || {}) }
  }),
  text: (opts = {}) => ({
    type: 'text',
    meta: { interface: 'input-multiline', width: 'full', ...(opts.meta || {}) },
    schema: { is_nullable: !opts.required }
  }),
  richText: () => ({
    type: 'text',
    meta: { interface: 'input-rich-text-html', width: 'full' },
    schema: { is_nullable: true }
  }),
  bool: (defaultValue = false) => ({
    type: 'boolean',
    meta: { interface: 'boolean', width: 'half', special: ['cast-boolean'] },
    schema: { default_value: defaultValue, is_nullable: false }
  }),
  int: (defaultValue = 0) => ({
    type: 'integer',
    meta: { interface: 'input', width: 'half' },
    schema: { default_value: defaultValue, is_nullable: false }
  }),
  datetime: () => ({
    type: 'timestamp',
    meta: { interface: 'datetime', width: 'half' },
    schema: { is_nullable: true }
  }),
  slug: () => ({
    type: 'string',
    meta: { interface: 'input', width: 'half', options: { slug: true, trim: true } },
    schema: { is_nullable: false, is_unique: true }
  }),
  csvTags: () => ({
    type: 'csv',
    meta: { interface: 'tags', width: 'full', special: ['cast-csv'] },
    schema: { is_nullable: true }
  }),
  jsonList: () => ({
    type: 'json',
    meta: { interface: 'list', width: 'full', special: ['cast-json'],
            options: { fields: [{ field: 'item', name: 'Item', type: 'string', meta: { interface: 'input', width: 'full' } }] } },
    schema: { is_nullable: true }
  }),
  jsonObject: () => ({
    type: 'json',
    meta: { interface: 'input-code', width: 'full', special: ['cast-json'], options: { language: 'json' } },
    schema: { is_nullable: true }
  }),
  imageRef: () => ({
    type: 'uuid',
    meta: { interface: 'file-image', width: 'half', special: ['file'] },
    schema: { is_nullable: true }
  }),
  m2o: () => ({
    type: 'integer',
    meta: { interface: 'select-dropdown-m2o', width: 'half', special: ['m2o'] },
    schema: { is_nullable: true }
  })
};

// ---- 1. Categorieen --------------------------------------------------------
async function buildCategorieen() {
  console.log('\n[1/6] categorieen');
  await ensureCollection('categorieen', {
    meta: { icon: 'category', display_template: '{{naam}}', sort_field: 'naam', collection: 'categorieen' },
    schema: {}
  });
  await ensureField('categorieen', 'naam', f.string({ required: true }));
  await ensureField('categorieen', 'slug', f.slug());
  await ensureField('categorieen', 'icoon', f.string());
}

// ---- 2. Producten ----------------------------------------------------------
async function buildProducten() {
  console.log('\n[2/6] producten');
  await ensureCollection('producten', {
    meta: {
      icon: 'shopping_bag',
      display_template: '{{naam}}',
      archive_field: 'status', archive_value: 'archived', unarchive_value: 'published',
      sort_field: 'publicatiedatum',
      collection: 'producten'
    },
    schema: {}
  });
  await ensureField('producten', 'status', {
    type: 'string',
    meta: {
      interface: 'select-dropdown', width: 'half', special: [],
      options: { choices: [
        { text: 'Published', value: 'published' },
        { text: 'Draft', value: 'draft' },
        { text: 'Archived', value: 'archived' }
      ]}
    },
    schema: { default_value: 'draft', is_nullable: false }
  });
  await ensureField('producten', 'naam', f.string({ required: true }));
  await ensureField('producten', 'slug', f.slug());
  // Sub-brand the product belongs to. Not rendered on the product page —
  // used to split the catalog (e.g. the HDM landing page).
  await ensureField('producten', 'merk', {
    type: 'string',
    meta: {
      interface: 'select-dropdown', width: 'half', special: [],
      options: { choices: [
        { text: "Ava's Lewd", value: 'avas-lewd' },
        { text: 'HDM', value: 'hdm' }
      ]}
    },
    schema: { default_value: 'avas-lewd', is_nullable: false }
  });
  await ensureField('producten', 'categorie', f.m2o());
  await ensureRelation({
    collection: 'producten', field: 'categorie', related_collection: 'categorieen',
    meta: { sort_field: null }, schema: { on_delete: 'SET NULL' }
  });
  await ensureField('producten', 'korte_beschrijving', f.text());
  await ensureField('producten', 'uitgebreide_beschrijving', f.richText());
  await ensureField('producten', 'features', f.jsonList());
  await ensureField('producten', 'compatibiliteit', f.csvTags());
  await ensureField('producten', 'marketplace_url', f.string());
  await ensureField('producten', 'is_featured', f.bool(false));
  await ensureField('producten', 'is_nieuw', f.bool(false));
  await ensureField('producten', 'publicatiedatum', f.datetime());
  // Single-image cover (we keep a multi-image M2M for later if needed)
  await ensureField('producten', 'afbeelding', f.imageRef());
  await ensureRelation({
    collection: 'producten', field: 'afbeelding', related_collection: 'directus_files',
    meta: { sort_field: null }, schema: { on_delete: 'SET NULL' }
  });
}

// ---- 3. Updates ------------------------------------------------------------
async function buildUpdates() {
  console.log('\n[3/6] updates');
  await ensureCollection('updates', {
    meta: {
      icon: 'newspaper',
      display_template: '{{titel}}',
      archive_field: 'status', archive_value: 'archived', unarchive_value: 'published',
      sort_field: 'publicatiedatum',
      collection: 'updates'
    },
    schema: {}
  });
  await ensureField('updates', 'status', {
    type: 'string',
    meta: {
      interface: 'select-dropdown', width: 'half', special: [],
      options: { choices: [
        { text: 'Published', value: 'published' },
        { text: 'Draft', value: 'draft' },
        { text: 'Archived', value: 'archived' }
      ]}
    },
    schema: { default_value: 'draft', is_nullable: false }
  });
  await ensureField('updates', 'titel', f.string({ required: true }));
  await ensureField('updates', 'slug', f.slug());
  await ensureField('updates', 'excerpt', f.text());
  await ensureField('updates', 'content', f.richText());
  await ensureField('updates', 'tags', f.csvTags());
  await ensureField('updates', 'publicatiedatum', f.datetime());
  await ensureField('updates', 'afbeelding', f.imageRef());
  await ensureRelation({
    collection: 'updates', field: 'afbeelding', related_collection: 'directus_files',
    meta: { sort_field: null }, schema: { on_delete: 'SET NULL' }
  });
}

// ---- 4. Promos -------------------------------------------------------------
async function buildPromos() {
  console.log('\n[4/6] promos');
  await ensureCollection('promos', {
    meta: { icon: 'campaign', display_template: '{{titel}}', sort_field: 'sortering', collection: 'promos' },
    schema: {}
  });
  await ensureField('promos', 'titel', f.string({ required: true }));
  await ensureField('promos', 'beschrijving', f.text());
  await ensureField('promos', 'cta_tekst', f.string());
  await ensureField('promos', 'cta_url', f.string());
  await ensureField('promos', 'actief', f.bool(false));
  await ensureField('promos', 'sortering', f.int(0));
  await ensureField('promos', 'afbeelding', f.imageRef());
  await ensureRelation({
    collection: 'promos', field: 'afbeelding', related_collection: 'directus_files',
    meta: { sort_field: null }, schema: { on_delete: 'SET NULL' }
  });
}

// ---- 5. SiteInstellingen (singleton) --------------------------------------
async function buildSiteInstellingen() {
  console.log('\n[5/6] site_instellingen (singleton)');
  await ensureCollection('site_instellingen', {
    meta: { icon: 'settings', singleton: true, collection: 'site_instellingen' },
    schema: {}
  });
  await ensureField('site_instellingen', 'site_naam', f.string());
  await ensureField('site_instellingen', 'tagline', f.string());
  await ensureField('site_instellingen', 'contact_email', f.string());
  await ensureField('site_instellingen', 'over_tekst', f.richText());
  await ensureField('site_instellingen', 'social_links', f.jsonObject());
  await ensureField('site_instellingen', 'logo', f.imageRef());
  await ensureRelation({
    collection: 'site_instellingen', field: 'logo', related_collection: 'directus_files',
    meta: { sort_field: null }, schema: { on_delete: 'SET NULL' }
  });
}

// ---- 6. FAQ ----------------------------------------------------------------
async function buildFaq() {
  console.log('\n[6/6] faq');
  await ensureCollection('faq', {
    meta: { icon: 'help', display_template: '{{question}}', sort_field: 'sort', collection: 'faq' },
    schema: {}
  });
  await ensureField('faq', 'sort', f.int(0));
  await ensureField('faq', 'question', f.string({ required: true }));
  await ensureField('faq', 'answer', f.text({ required: true }));
}

// ---- 7. Public read permissions -------------------------------------------
async function setPublicPermissions() {
  console.log('\n[+] public read permissions');
  // Directus 11: permissions attach to a POLICY (not a role directly). The
  // built-in "Public" policy applies to all anonymous requests.
  const policies = await api('/policies');
  const publicPolicy = policies.data.find(
    (p) => p.name === '$t:public_label' || /public/i.test(p.name)
  );
  if (!publicPolicy) {
    console.log('  ! could not find Public policy — skipping');
    return;
  }
  const policyId = publicPolicy.id;

  const wanted = [
    { collection: 'categorieen', action: 'read', fields: '*' },
    { collection: 'producten', action: 'read', fields: '*', permissions: { status: { _eq: 'published' } } },
    { collection: 'updates', action: 'read', fields: '*', permissions: { status: { _eq: 'published' } } },
    { collection: 'promos', action: 'read', fields: '*', permissions: { actief: { _eq: true } } },
    { collection: 'site_instellingen', action: 'read', fields: '*' },
    { collection: 'faq', action: 'read', fields: '*' },
    { collection: 'directus_files', action: 'read', fields: '*' }
  ];

  const existing = await api(`/permissions?filter[policy][_eq]=${policyId}&limit=-1`);
  const have = new Map(existing.data.map((p) => [`${p.collection}|${p.action}`, p]));

  for (const w of wanted) {
    const key = `${w.collection}|${w.action}`;
    const payload = { policy: policyId, ...w };
    const cur = have.get(key);
    if (cur) {
      await api(`/permissions/${cur.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      console.log(`  ~ updated ${key}`);
    } else {
      await api('/permissions', { method: 'POST', body: JSON.stringify(payload) });
      console.log(`  + ${key}`);
    }
  }
}

// ---- main ------------------------------------------------------------------
(async () => {
  console.log(`→ Directus: ${URL}`);
  await login();
  console.log('  ✓ logged in');

  await buildCategorieen();
  await buildProducten();
  await buildUpdates();
  await buildPromos();
  await buildSiteInstellingen();
  await buildFaq();
  await setPublicPermissions();

  console.log('\n✓ schema build complete');
})().catch((err) => {
  console.error('\n✗ FAILED');
  console.error(err.message);
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  process.exit(1);
});
