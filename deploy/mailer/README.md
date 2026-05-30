# Avalia mailer

Tiny Node service that receives `POST /contact` from the Astro contact form
and forwards it to your inbox via SMTP. Lives next to the site on the
mini-pc; nginx in `avalia-web` proxies `/api/contact` to here.

## Endpoints

- `POST /contact` — JSON `{ name, email, subject, message, website? }`
  - `website` is the honeypot field (must be empty / absent)
  - returns `200 {ok:true}` on success, `400` on validation error,
    `429` on rate-limit, `502` on SMTP failure
- `GET /health` — `200 {ok:true}` for liveness checks

## Env vars

Configured in the same `/opt/sites/avalia/.env` as the rest of the avalia
compose. See `.env.example` in `deploy/site/` for the full list.

| | |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` for Gmail |
| `SMTP_PORT` | `465` (SSL) or `587` (STARTTLS) — `465` is safest |
| `SMTP_USER` | the Gmail address |
| `SMTP_PASS` | a Gmail **app password** (not your account password) |
| `MAIL_TO`   | where mail should land |
| `MAIL_FROM` | `'Avalia Contact <addr@gmail.com>'` |
| `RATE_PER_HOUR` | optional, default 5 |

## Gmail app password (one-time)

1. The Gmail account must have 2FA enabled.
2. Go to https://myaccount.google.com/apppasswords
3. Name it "Avalia mailer", get a 16-character token.
4. Paste it into `.env` as `SMTP_PASS=` (no spaces, no dashes).

App passwords bypass interactive sign-in and are scoped to one app — revoke
in the same UI if it ever leaks.

## Rate limit + honeypot

In-memory per-IP rate limit (default 5/hr) so a bot can't drain the SMTP
quota. The `website` hidden field is a honeypot — if a bot fills it the
server returns 200 without sending mail, so the bot thinks it succeeded
and stops retrying.
