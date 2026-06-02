#!/bin/sh
# Avalia builder entrypoint.
#
# - On first run: clones the repo into $REPO_DIR (bind-mounted from the host).
# - On every run: writes an Astro .env file from container env so the build
#   reads DIRECTUS_URL from there.
# - Configures a benign git identity so `git reset`/merges don't complain.
# - Then execs the CMD (node index.mjs).
set -e

REPO_DIR="${REPO_DIR:-/srv/site}"
REPO_URL="${REPO_URL:?REPO_URL is required (e.g. https://github.com/erikhuijs2023/avalia.rocks.git)}"
GIT_BRANCH="${GIT_BRANCH:-main}"

mkdir -p "$REPO_DIR"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "[bootstrap] cloning $REPO_URL (branch $GIT_BRANCH) into $REPO_DIR ..."
  # The bind mount may already contain stale junk on first run — wipe it.
  rm -rf "$REPO_DIR"/* "$REPO_DIR"/.[!.]* 2>/dev/null || true
  git clone --depth=1 --branch "$GIT_BRANCH" "$REPO_URL" "$REPO_DIR"
fi

# Write Astro's .env (Vite reads .env from the project root for import.meta.env).
# We always overwrite so a stale value can't survive a container env change.
if [ -n "$DIRECTUS_URL" ]; then
  printf 'DIRECTUS_URL=%s\n' "$DIRECTUS_URL" > "$REPO_DIR/.env"
fi

git -C "$REPO_DIR" config user.email "builder@avalia.rocks"
git -C "$REPO_DIR" config user.name  "Avalia Builder"
git -C "$REPO_DIR" config --add safe.directory "$REPO_DIR"

echo "[bootstrap] ready — REPO_DIR=$REPO_DIR DIST_DIR=$DIST_DIR BRANCH=$GIT_BRANCH"
exec "$@"
