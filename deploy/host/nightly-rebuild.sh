#!/bin/bash
# /opt/sites/host/nightly-rebuild.sh
#
# Nightly avalia.rocks rebuild. The "New" product badge is date-driven
# (published within 21 days, see src/lib/directus.ts) and the site is
# statically built, so a badge only disappears on the next rebuild. Content
# saves trigger rebuilds during active periods; this cron guarantees the badge
# still expires during quiet stretches with no CMS activity.
#
# Idempotent: the avalia-builder rebuilds from origin/main and rsyncs into the
# nginx bind mount. Runs as vectra-user (can read the builder .env + reach the
# hook on the LAN IP). Mirror of the live script, kept in the repo for VC.
set -euo pipefail

# HOOK_TOKEN lives in the builder stack's .env (not in git).
TOKEN=$(grep -E '^HOOK_TOKEN=' /opt/sites/avalia/.env | cut -d= -f2-)
if [ -z "${TOKEN:-}" ]; then
  echo "$(date -Is) ERROR: HOOK_TOKEN not found in /opt/sites/avalia/.env" >&2
  exit 1
fi

# The builder publishes on the LAN IP, NOT 127.0.0.1 (container port binding).
if curl -fsS -X POST -H "X-Avalia-Token: $TOKEN" \
        http://192.168.178.29:8087/hook >/dev/null; then
  echo "$(date -Is) nightly rebuild triggered"
else
  echo "$(date -Is) ERROR: hook POST failed" >&2
  exit 1
fi
