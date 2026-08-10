# avalia-notifier

Turns one published **Update** into a **Second Life group notice**, via the
[SmartBots HTTP API](https://docs.mysmartbots.com/s/dev/doc/send_notice-Wsfk2HfRcn).
This is the only part of the stack that can push into SL from outside the
viewer — Subscribe-O-Matic can only be sent from in-world.

## Why it is a button, not a save hook

The builder rebuilds the site on every content save. The notifier deliberately
does **not**: a group notice reaches everyone's screen and cannot be recalled,
and Directus fires `items.update` on every keystroke-save. So sending is a
manual flow you run from the update you're looking at.

```
Directus "Send group notice" button
        │  POST /notice {id}   (X-Avalia-Token)
        ▼
   notifier ──▶ read update from Directus (never trusts the hook body)
             ──▶ build subject + <=512-byte body + link
             ──▶ attach: texture_upload / notecard_create ──▶ inventory UUID
             ──▶ send_notice  ──▶ SmartBots  ──▶ SL group
             ──▶ stamp notice_sent_at / notice_status back on the item
```

## Endpoints

| Method | Path      | Auth                          | Notes                                  |
|--------|-----------|-------------------------------|----------------------------------------|
| GET    | `/health` | none                          | config + last send result, no secrets  |
| POST   | `/notice` | `X-Avalia-Token: $NOTICE_TOKEN` | sends one notice                     |

`POST /notice` body:

| Field    | Default | Meaning                                                        |
|----------|---------|----------------------------------------------------------------|
| `id`     | —       | Update id (required)                                           |
| `dry`    | `false` | Build and return the notice, send nothing. **Use this first.**  |
| `test`   | `false` | Send to `SB_GROUP_TEST` instead, leaving no trace on the update |
| `force`  | `false` | Send even if the update is a draft or was already notified      |

`test` is the rehearsal switch: it sends a real notice with a real attachment
to a throwaway group of your own alts, skips the draft/already-sent guards, and
does **not** stamp `notice_sent_at` — so the real send afterwards still works,
and you can repeat the test as often as you like. It does not record an
uploaded texture either, so a test `attach=image` leaves one throwaway texture
in the bot's inventory per run; that's what `SB_FOLDER_UUID` is for.
| `attach` | `auto`  | `auto` \| `image` \| `notecard` \| `none` — see below           |

### Attachments

An SL notice carries exactly **one** attachment, so `attach` is a choice, not a
set of flags. A set `notice_attachment_uuid` on the item always wins.

| `attach`   | What happens                                                                       |
|------------|------------------------------------------------------------------------------------|
| `auto`     | The item's own UUID, else `SB_ATTACHMENT` (typically the store landmark)            |
| `image`    | The update's `afbeelding` is uploaded as an SL texture and attached                 |
| `notecard` | The full body text becomes a notecard — for updates that don't fit in 512 bytes     |
| `none`     | Text-only notice                                                                    |

`image` uses `texture_upload` — the same call `SLproductionDeamon`'s
`smartbots_upload.py` uses for product textures. Directus does the resize
(`?width=1024&fit=inside&format=png`); SL caps textures at 1024 and downscales
anything bigger itself, so there's no point POSTing more. Free on a Pro bot;
on a plain account SL charges L$10 per upload.

Recipients see "Attached: <name>" in the notice and open it — a notice never
renders an image inline, whoever sends it. The upload's inventory UUID is
written back to `notice_attachment_uuid`, so a resend reuses it instead of
uploading a second copy.

Refuses (409) on a draft, and on an update that already has `notice_sent_at` —
so a double-click doesn't notify the group twice.

LAN-only: port `8088` is bound to `192.168.178.29`.

## Env vars (in `/opt/sites/avalia/.env`)

See `deploy/site/.env.example`. Required: `NOTICE_TOKEN`, `SB_APIKEY`,
`SB_BOTNAME`, `SB_SECRET`, `SB_GROUP_UUID`, `NOTIFIER_TOKEN`.

## One-time setup

1. **SmartBots account + bot.** Register at https://www.mysmartbots.com/,
   attach a bot avatar (your own alt or a hosted one). Note the bot name, its
   access code, and the account API key.
2. **Group.** Invite the bot to the SL group and put it in a role that has the
   **Send Notices** ability. ⚠️ SmartBots answers `result=OK` even when the bot
   *lacks* that ability — the notice just never arrives. Verify in-world once,
   and re-verify after any role change.
3. **Group UUID.** From the group's profile in the viewer, or the SmartBots
   group page.
4. **Directus bot.** Run `deploy/cms/build-schema.mjs` with `NOTIFIER_TOKEN`
   set — it creates the `notice-bot` user with a *Notice Sender* policy that
   can read updates and write only `notice_sent_at` / `notice_status`.
5. **Default attachment (optional).** For `attach=auto`, put a store landmark in
   the bot's inventory in-world, let the bot accept it, and copy its
   **inventory** UUID (not the asset UUID) from the SmartBots inventory page
   into `SB_ATTACHMENT`. Items must be copy+transfer. Textures and notecards
   the notifier creates itself need no manual step.
6. **Upload folder (optional).** Set `SB_FOLDER_UUID` to an inventory folder so
   uploaded notice textures don't pile up loose in the bot's inventory.

## Wiring the Directus flow

Admin → **Settings → Flows** → **Create Flow**:

- **Trigger:** Manual → Collections: `Updates` → *Require confirmation:* on
  (text: "Send this update as a group notice?")
- **Operation:** Webhook / Request URL
  - Method `POST`, URL `http://192.168.178.29:8088/notice`
  - Header `X-Avalia-Token: <NOTICE_TOKEN>`
  - Body: `{ "id": "{{$trigger.body.keys[0]}}", "attach": "image" }`

Worth making three flows, since the body is the only thing that differs:
"Preview notice" (`"dry": true`), "Send notice" (`"attach": "auto"`), and
"Send notice + image" (`"attach": "image"`).

## Writing the notice

The body is capped at **512 bytes** by SmartBots — not characters. `é` costs 2,
an emoji 4. The link is reserved first and never truncated; the prose is what
gets cut. So:

- Fill `notice_text` with 1–2 sentences. What + when + where, nothing else.
- Leave it empty and the `excerpt` is used, then the stripped `content`.
- The subject is ASCII-folded (`Café` → `Cafe`) and capped at `SUBJECT_MAX`
  (63). **International characters in the subject make SmartBots drop the
  notice silently**, hence the folding.
- The link is `link_url` when set, else `https://avalia.rocks/updates/<slug>`.
  For an event or store visit, set `link_url` to the SLURL — a clickable
  teleport beats a website link inside SL.

## Manual test

```bash
curl -s http://192.168.178.29:8088/health
```

```bash
curl -s -X POST http://192.168.178.29:8088/notice -H "X-Avalia-Token: $NOTICE_TOKEN" -H 'Content-Type: application/json' -d '{"id":1,"dry":true}'
```

Then a real send to the test group — this is the one that proves the bot's
group role is right, which no dry run can tell you:

```bash
curl -s -X POST http://192.168.178.29:8088/notice -H "X-Avalia-Token: $NOTICE_TOKEN" -H 'Content-Type: application/json' -d '{"id":1,"test":true,"attach":"image"}'
```

Log in as an alt in that group and confirm the notice arrived *and* the
attachment opens. `result=OK` from SmartBots does not prove either.

## Rate limits

SmartBots silently discards more than 3 notices in 3 seconds; we always send
with `autodelay=1` (3 per 5s, then spaced). Not a concern at one notice per
update, but relevant if you ever loop over a backlog.
