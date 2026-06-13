/**
 * Avalia mailer — accepts POST /contact, validates, sends via SMTP.
 *
 * Env vars (required):
 *   SMTP_HOST       e.g. smtp.gmail.com
 *   SMTP_PORT       465 (SSL) or 587 (STARTTLS)
 *   SMTP_USER       gmail address
 *   SMTP_PASS       gmail app password
 *   MAIL_TO         destination (often == SMTP_USER)
 *   MAIL_FROM       'Avalia Contact <addr>'
 * Optional:
 *   PORT            listen port (default 8086)
 *   RATE_PER_HOUR   max submits per IP per hour (default 5)
 *   DIRECTUS_URL    Directus instance for ticket storage (default mini-pc CMS)
 *   TICKETS_TOKEN   static token of the mailer-bot Directus user; when set,
 *                   every submission is also stored as a ticket (status=new).
 *                   The request succeeds if storing OR mailing worked.
 */
import { createServer } from 'node:http';
import nodemailer from 'nodemailer';

const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_TO', 'MAIL_FROM'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const PORT = Number(process.env.PORT || 8086);
const RATE_PER_HOUR = Number(process.env.RATE_PER_HOUR || 5);
const DIRECTUS_URL = (process.env.DIRECTUS_URL || 'http://192.168.178.29:8085').replace(/\/$/, '');
const TICKETS_TOKEN = process.env.TICKETS_TOKEN || '';
if (!TICKETS_TOKEN) console.warn('TICKETS_TOKEN not set — submissions will be mailed but not stored as tickets');

/** Store the submission as a Directus ticket. Returns true on success. */
async function storeTicket({ name, email, brand, subject, message, ip }) {
  if (!TICKETS_TOKEN) return false;
  try {
    const res = await fetch(`${DIRECTUS_URL}/items/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TICKETS_TOKEN}` },
      body: JSON.stringify({ name, email, brand, subject, message, ip }),
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) {
      console.error(`[ticket] Directus ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[ticket] ${err.message}`);
    return false;
  }
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

transporter.verify().then(
  () => console.log(`SMTP ready: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`),
  (e) => console.error('SMTP verify failed:', e.message)
);

// Simple in-memory rate-limit per IP (per process — fine for our scale).
const buckets = new Map(); // ip -> [timestamps]
function rateOk(ip) {
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000;
  const list = (buckets.get(ip) || []).filter((t) => t > cutoff);
  if (list.length >= RATE_PER_HOUR) {
    buckets.set(ip, list);
    return false;
  }
  list.push(now);
  buckets.set(ip, list);
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBJECT_WHITELIST = new Set(['General', 'Collaboration', 'Support', 'Other']);
const BRAND_WHITELIST = new Set(["Ava's Lewd", 'HDM']);

function badRequest(res, msg) {
  res.writeHead(400, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: msg }));
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

const server = createServer(async (req, res) => {
  // Health probe.
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/contact') {
    res.writeHead(404).end();
    return;
  }

  const ip = (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

  if (!rateOk(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'rate limit — try again later' }));
    return;
  }

  let body;
  try { body = await readJson(req); }
  catch { return badRequest(res, 'invalid json'); }

  // Honeypot — bots that fill hidden fields get a fake-success response
  // so they don't retry.
  if (body.website || body.url) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    console.log(`[honeypot] caught spam from ${ip}`);
    return;
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  // Default to the main brand so older clients without the field still work.
  const brand = String(body.brand || "Ava's Lewd").trim();
  const subject = String(body.subject || 'General').trim();
  const message = String(body.message || '').trim();

  if (!name || name.length > 200) return badRequest(res, 'name required (max 200)');
  if (!EMAIL_RE.test(email) || email.length > 200) return badRequest(res, 'valid email required');
  if (!BRAND_WHITELIST.has(brand)) return badRequest(res, 'invalid brand');
  if (!SUBJECT_WHITELIST.has(subject)) return badRequest(res, 'invalid subject');
  if (!message || message.length > 8000) return badRequest(res, 'message required (max 8000)');

  // Two independent sinks: the Directus ticket (workflow) and the e-mail
  // (notification). The submission counts as accepted when EITHER lands,
  // so an SMTP hiccup can't lose a ticket and vice versa.
  const stored = await storeTicket({ name, email, brand, subject, message, ip });

  let mailed = false;
  try {
    const mail = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.MAIL_TO,
      replyTo: `${name} <${email}>`,
      subject: `[${brand} · ${subject}] from ${name}`,
      text:
        `Brand:   ${brand}\n` +
        `Name:    ${name}\n` +
        `Email:   ${email}\n` +
        `Subject: ${subject}\n` +
        `IP:      ${ip}\n` +
        `Time:    ${new Date().toISOString()}\n\n` +
        `${message}\n`
    });
    mailed = true;
    console.log(`[ok] ${ip} -> ${email} (id ${mail.messageId}, ticket ${stored ? 'stored' : 'NOT stored'})`);
  } catch (err) {
    console.error(`[smtp] ${err.message} (ticket ${stored ? 'stored' : 'NOT stored'})`);
  }

  if (stored || mailed) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'message could not be delivered' }));
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Avalia mailer listening on :${PORT}`));
