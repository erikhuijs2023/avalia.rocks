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
  const subject = String(body.subject || 'General').trim();
  const message = String(body.message || '').trim();

  if (!name || name.length > 200) return badRequest(res, 'name required (max 200)');
  if (!EMAIL_RE.test(email) || email.length > 200) return badRequest(res, 'valid email required');
  if (!SUBJECT_WHITELIST.has(subject)) return badRequest(res, 'invalid subject');
  if (!message || message.length > 8000) return badRequest(res, 'message required (max 8000)');

  try {
    const mail = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.MAIL_TO,
      replyTo: `${name} <${email}>`,
      subject: `[Avalia ${subject}] from ${name}`,
      text:
        `Name:    ${name}\n` +
        `Email:   ${email}\n` +
        `Subject: ${subject}\n` +
        `IP:      ${ip}\n` +
        `Time:    ${new Date().toISOString()}\n\n` +
        `${message}\n`
    });
    console.log(`[ok] ${ip} -> ${email} (id ${mail.messageId})`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error(`[smtp] ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'mail send failed' }));
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Avalia mailer listening on :${PORT}`));
