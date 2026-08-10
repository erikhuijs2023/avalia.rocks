/**
 * Avalia notifier — turns a published Update into a Second Life group notice
 * via the SmartBots HTTP API (https://api.mysmartbots.com/api/bot.html).
 *
 * Deliberately NOT wired to items.create/items.update: a group notice is
 * outward-facing and cannot be recalled, so sending is triggered by hand from
 * a "Send group notice" button on the Update item in Directus. See README.
 *
 * Flow:
 *   1. Directus manual flow fires POST /notice {id} with X-Avalia-Token.
 *   2. We read the update back from Directus (never trust the hook payload).
 *   3. Subject + body are built to SL's taste: ASCII subject, <=512-byte body,
 *      always ending in a link.
 *   4. Optional attachment: an inventory UUID from the bot, or a notecard we
 *      create on the fly from the update's long text.
 *   5. On success we stamp notice_sent_at / notice_status back on the item.
 *
 * Env vars (required):
 *   NOTICE_TOKEN     shared secret, required in X-Avalia-Token on /notice
 *   SB_APIKEY        SmartBots developer API key
 *   SB_BOTNAME       bot's SL login name, e.g. "Avalia Bot"
 *   SB_SECRET        bot access code from the SmartBots panel
 *   SB_GROUP_UUID    UUID of the target SL group
 *   NOTIFIER_TOKEN   static token of the notice-bot Directus user
 * Optional:
 *   PORT             listen port (default 8088)
 *   DIRECTUS_URL     default http://192.168.178.29:8085
 *   SITE_URL         default https://avalia.rocks (fallback link + CTA)
 *   SUBJECT_MAX      default 63 (see sanitizeSubject)
 *   TEXT_MAX         default 512 (SmartBots hard limit, in BYTES)
 *   SB_GROUP_TEST    UUID of a throwaway group; `{"test":true}` sends there
 *                    instead, without stamping the update as notified
 *   SB_ATTACHMENT    fallback inventory UUID attached when the item has none
 *   SB_FOLDER_UUID   inventory folder for uploaded textures/notecards
 *   IMAGE_MAX        longest edge of an uploaded texture (default 1024 — SL
 *                    scales anything bigger down anyway)
 *   SB_TIMEOUT_MS    default 20000 — SmartBots can be slow when the bot is
 *                    offline (the notice is queued server-side regardless)
 *   SB_UPLOAD_MS     default 120000 — a texture upload is a multi-MB POST
 *
 * Endpoints:
 *   GET  /health   — config sanity, no secrets
 *   POST /notice   — {id, dry?, force?} → sends (or previews) one notice
 */
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const required = ['NOTICE_TOKEN', 'SB_APIKEY', 'SB_BOTNAME', 'SB_SECRET', 'SB_GROUP_UUID', 'NOTIFIER_TOKEN'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const PORT           = Number(process.env.PORT || 8088);
const NOTICE_TOKEN   = process.env.NOTICE_TOKEN;
const DIRECTUS_URL   = (process.env.DIRECTUS_URL || 'http://192.168.178.29:8085').replace(/\/$/, '');
const NOTIFIER_TOKEN = process.env.NOTIFIER_TOKEN;
const SITE_URL       = (process.env.SITE_URL || 'https://avalia.rocks').replace(/\/$/, '');
const SUBJECT_MAX    = Number(process.env.SUBJECT_MAX || 63);
const TEXT_MAX       = Number(process.env.TEXT_MAX || 512);
const SB_GROUP_TEST  = process.env.SB_GROUP_TEST || '';
const SB_ATTACHMENT  = process.env.SB_ATTACHMENT || '';
const SB_FOLDER_UUID = process.env.SB_FOLDER_UUID || '';
const IMAGE_MAX      = Number(process.env.IMAGE_MAX || 1024);
const SB_TIMEOUT_MS  = Number(process.env.SB_TIMEOUT_MS || 20_000);
const SB_UPLOAD_MS   = Number(process.env.SB_UPLOAD_MS || 120_000);
// Overridable so the whole path can be exercised against a stub — see the
// smoke test in README ("Manual test").
const SB_API         = process.env.SB_API || 'https://api.mysmartbots.com/api/bot.html';

// ---- helpers ---------------------------------------------------------------
function constantEq(a, b) {
  const aBuf = Buffer.from(a || '');
  const bBuf = Buffer.from(b || '');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let len = 0;
    const chunks = [];
    req.on('data', (c) => {
      len += c.length;
      if (len > limit) { req.destroy(); reject(new Error('payload too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

/**
 * SmartBots drops a notice whose SUBJECT contains international characters —
 * silently, with result=OK. So fold diacritics away (é → e) and keep a
 * conservative ASCII set rather than trusting anything exotic to survive.
 *
 * The length cap is ours, not SmartBots' (they allow 254): the SL viewer's own
 * notice-subject field is short, and a notice header that wraps reads badly in
 * the notification toast. Raise SUBJECT_MAX if you disagree.
 */
function sanitizeSubject(s) {
  const ascii = String(s || '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/…/g, '...')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // e-acute -> e
    .replace(/[^A-Za-z0-9 .,!?'"()\-:&+%\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ascii.length > SUBJECT_MAX ? ascii.slice(0, SUBJECT_MAX - 1).trimEnd() + '.' : ascii;
}

/** Directus rich text is HTML; a notice is plain text. */
function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ').replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const byteLen = (s) => Buffer.byteLength(s, 'utf8');

/** Truncate to `max` BYTES (not chars — accents and emoji cost 2-4 each). */
function truncBytes(s, max) {
  if (byteLen(s) <= max) return s;
  const ELLIPSIS = '...';
  const budget = max - ELLIPSIS.length;
  let out = s;
  while (byteLen(out) > budget) out = out.slice(0, -1);
  // Prefer a word boundary, but only if we're not throwing away half the text.
  const cut = out.lastIndexOf(' ');
  if (cut > budget * 0.6) out = out.slice(0, cut);
  return out.trimEnd().replace(/[,.;:!-]$/, '') + ELLIPSIS;
}

/**
 * Build the notice. The link is reserved FIRST and never truncated — it is the
 * whole point of the notice; the prose is what gives way.
 */
function buildNotice(u) {
  const subject = sanitizeSubject(u.titel);
  const link = (u.link_url || `${SITE_URL}/updates/${u.slug || ''}`).trim();
  const body = (u.notice_text || u.excerpt || htmlToText(u.content) || '').replace(/\s+\n/g, '\n').trim();

  const tail = `\n${link}`;
  const room = TEXT_MAX - byteLen(tail);
  const text = (room > 0 ? truncBytes(body, room) : '') + tail;
  return { subject, text, link, bytes: byteLen(text) };
}

// ---- Directus --------------------------------------------------------------
const UPDATE_FIELDS = [
  'id', 'status', 'titel', 'slug', 'excerpt', 'content', 'link_url', 'afbeelding',
  'notice_text', 'notice_attachment_uuid', 'notice_sent_at'
].join(',');

/**
 * Fetch the update's image, resized by Directus. SL caps textures at 1024 and
 * scales anything larger itself — doing it here keeps the base64 POST small.
 * PNG because SL re-encodes to JPEG2000 anyway; no point stacking two lossy
 * passes on top of each other.
 */
async function fetchImageBase64(fileId) {
  const url = `${DIRECTUS_URL}/assets/${encodeURIComponent(fileId)}` +
              `?width=${IMAGE_MAX}&height=${IMAGE_MAX}&fit=inside&withoutEnlargement=true&format=png`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${NOTIFIER_TOKEN}` },
    signal: AbortSignal.timeout(30_000)
  });
  if (!res.ok) throw new Error(`Directus asset ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { base64: buf.toString('base64'), bytes: buf.length };
}

async function getUpdate(id) {
  const res = await fetch(`${DIRECTUS_URL}/items/updates/${encodeURIComponent(id)}?fields=${UPDATE_FIELDS}`, {
    headers: { Authorization: `Bearer ${NOTIFIER_TOKEN}` },
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`Directus ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).data;
}

/** Best-effort — a failed stamp must not make a sent notice look unsent. */
async function stampUpdate(id, patch) {
  try {
    const res = await fetch(`${DIRECTUS_URL}/items/updates/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${NOTIFIER_TOKEN}` },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) console.error(`[stamp] Directus ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } catch (e) {
    console.error(`[stamp] ${e.message}`);
  }
}

// ---- SmartBots -------------------------------------------------------------
async function smartbots(action, params, timeoutMs = SB_TIMEOUT_MS) {
  const body = new URLSearchParams({
    action,
    apikey: process.env.SB_APIKEY,
    botname: process.env.SB_BOTNAME,
    secret: process.env.SB_SECRET,
    dataType: 'json',
    ...(SB_FOLDER_UUID && action !== 'send_notice' ? { folder: SB_FOLDER_UUID } : {}),
    ...params
  });
  const res = await fetch(SB_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { result: 'FAIL', resulttext: raw.slice(0, 300) }; }
  if (!res.ok) throw new Error(`SmartBots HTTP ${res.status}: ${raw.slice(0, 200)}`);
  if (String(data.result).toUpperCase() !== 'OK') {
    throw new Error(`SmartBots ${action} failed: ${data.resulttext || 'unknown error'}`);
  }
  return data;
}

/** Create a notecard in the bot's inventory; returns its inventory UUID. */
async function createNotecard(name, text) {
  const data = await smartbots('notecard_create', { name: sanitizeSubject(name) || 'Avalia update', text });
  if (!data.uuid) throw new Error('notecard_create returned no uuid');
  return data.uuid;
}

/**
 * Upload an image as an SL texture; returns its INVENTORY uuid (that's what a
 * notice attachment wants — `asset_uuid` is the global asset id, used for
 * texture references in scripts/notecards instead).
 *
 * Same call the SL production daemon uses for product textures. Free on a Pro
 * bot; on a plain account SL charges L$10 an upload, so don't wire this to
 * anything that loops.
 */
async function uploadTexture(name, fileId) {
  const img = await fetchImageBase64(fileId);
  console.log(`[texture] uploading ${name} (${Math.round(img.bytes / 1024)} KB)`);
  const data = await smartbots(
    'texture_upload',
    { name: sanitizeSubject(name) || 'Avalia update', data: img.base64 },
    SB_UPLOAD_MS
  );
  if (!data.uuid) throw new Error('texture_upload returned no uuid');
  return data.uuid;
}

// ---- HTTP ------------------------------------------------------------------
let lastSend = { at: null, id: null, ok: null, subject: null, error: null };

async function handleNotice(req, res) {
  if (!constantEq(String(req.headers['x-avalia-token'] || ''), NOTICE_TOKEN)) {
    return json(res, 401, { ok: false, error: 'unauthorized' });
  }

  let body;
  try { body = await readJson(req); }
  catch { return json(res, 400, { ok: false, error: 'invalid json' }); }

  const id = String(body.id ?? '').trim();
  if (!id) return json(res, 400, { ok: false, error: 'id required' });
  const dry = Boolean(body.dry);
  const force = Boolean(body.force);

  // Test sends go to a throwaway group and leave no trace on the item: no
  // notice_sent_at stamp, so the real send later still works, and no guards,
  // so you can rehearse a draft as often as you like.
  const test = Boolean(body.test);
  if (test && !SB_GROUP_TEST) {
    return json(res, 400, { ok: false, error: 'test send requested but SB_GROUP_TEST is not configured' });
  }
  const groupuuid = test ? SB_GROUP_TEST : process.env.SB_GROUP_UUID;

  let u;
  try { u = await getUpdate(id); }
  catch (e) { return json(res, 502, { ok: false, error: `could not read update: ${e.message}` }); }
  if (!u) return json(res, 404, { ok: false, error: 'update not found' });

  if (!test && !force && u.status !== 'published') {
    return json(res, 409, { ok: false, error: `update is ${u.status}, not published (use force to override)` });
  }
  if (!test && !force && u.notice_sent_at) {
    return json(res, 409, { ok: false, error: `notice already sent at ${u.notice_sent_at} (use force to resend)` });
  }

  const notice = buildNotice(u);
  if (!notice.subject) return json(res, 422, { ok: false, error: 'subject empty after ASCII sanitising — retitle the update' });

  // An SL notice carries exactly ONE attachment, so this is a choice, not a
  // set of flags:
  //   auto     — the item's own UUID, else SB_ATTACHMENT (usually a landmark)
  //   image    — upload the update's afbeelding as a texture, attach that
  //   notecard — the full body text as a notecard, for long-form updates
  //   none     — text-only notice
  const attach = String(body.attach || 'auto').toLowerCase();
  if (!['auto', 'image', 'notecard', 'none'].includes(attach)) {
    return json(res, 400, { ok: false, error: `attach must be auto|image|notecard|none` });
  }
  if (attach === 'image' && !u.afbeelding) {
    return json(res, 422, { ok: false, error: 'attach=image but the update has no afbeelding' });
  }

  // An explicit UUID on the item always wins — that's someone deliberately
  // picking a specific inventory item.
  let attachment = attach === 'none' ? '' : String(u.notice_attachment_uuid || '').trim();
  if (!attachment && attach === 'auto') attachment = SB_ATTACHMENT;
  let uploaded = null;

  if (dry) {
    const pending = !attachment && (attach === 'image' || attach === 'notecard');
    return json(res, 200, {
      ok: true, dry: true, test, groupuuid, ...notice,
      attach, attachment: pending ? `<${attach} — created on send>` : (attachment || null)
    });
  }

  try {
    if (!attachment && attach === 'image') {
      uploaded = await uploadTexture(`${u.titel} (notice)`, u.afbeelding);
      attachment = uploaded;
    } else if (!attachment && attach === 'notecard') {
      const full = htmlToText(u.content) || u.excerpt || '';
      if (!full) return json(res, 422, { ok: false, error: 'attach=notecard but the update has no body text' });
      uploaded = await createNotecard(u.titel, `${u.titel}\n\n${full}\n\n${notice.link}\n`);
      attachment = uploaded;
    }

    await smartbots('send_notice', {
      groupuuid,
      subject: notice.subject,
      text: notice.text,
      autodelay: '1',
      ...(attachment ? { attachment } : {})
    });
  } catch (e) {
    lastSend = { at: new Date().toISOString(), id, test, ok: false, subject: notice.subject, error: e.message };
    console.error(`[notice] FAIL ${id}${test ? ' (test)' : ''}: ${e.message}`);
    if (!test) await stampUpdate(id, { notice_status: `failed: ${e.message}`.slice(0, 255) });
    return json(res, 502, { ok: false, test, error: e.message });
  }

  const at = new Date().toISOString();
  lastSend = { at, id, test, ok: true, subject: notice.subject, error: null };
  console.log(`[notice] sent${test ? ' TEST' : ''} ${id} "${notice.subject}" (${notice.bytes}b, attach=${attach}${attachment ? ` ${attachment}` : ' none'}) -> ${groupuuid}`);
  if (!test) {
    await stampUpdate(id, {
      notice_sent_at: at,
      // SmartBots answers OK even when the bot lacks the "Send Notices" ability,
      // so this says "accepted", not "delivered". Verify in-world after wiring.
      notice_status: `accepted by SmartBots (attach=${attach}${attachment ? '' : ', none'})`.slice(0, 255),
      // Remember what we made, so a resend reuses the texture/notecard instead
      // of uploading a second copy into the bot's inventory.
      ...(uploaded ? { notice_attachment_uuid: uploaded } : {})
    });
  }

  return json(res, 200, { ok: true, test, groupuuid, ...notice, attach, attachment: attachment || null, uploaded });
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {
      ok: true,
      group: process.env.SB_GROUP_UUID,
      testGroup: SB_GROUP_TEST || null,
      bot: process.env.SB_BOTNAME,
      limits: { subjectMax: SUBJECT_MAX, textMaxBytes: TEXT_MAX, imageMaxPx: IMAGE_MAX },
      defaultAttachment: SB_ATTACHMENT || null,
      uploadFolder: SB_FOLDER_UUID || null,
      lastSend
    });
  }
  if (req.method === 'POST' && req.url === '/notice') return handleNotice(req, res);
  return json(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () =>
  console.log(`Avalia notifier listening on :${PORT} (group ${process.env.SB_GROUP_UUID}, bot ${process.env.SB_BOTNAME})`)
);

function shutdown(sig) {
  console.log(`[shutdown] ${sig}`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
