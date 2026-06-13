#!/bin/bash
# Backup van /opt/sites/ + alle databases naar Unraid.
# Draait dagelijks via /etc/cron.d/sites-backup als vectra-user (03:30).
# Retentie: 7 daily + 4 weekly (zondag wordt extra naar weekly/ gekopieerd).
# Lokaal log: /opt/sites/backups/sites-backup.log
#
# Inhoud van elke tarball:
#   - /opt/sites/                        (compose, nginx, html, mailer/builder src)
#   - hugosdesign-db                     (MariaDB, oude Drupal-site)
#   - avalia-directus-*.sql              (Postgres: alle CMS-content, tickets, collecties)
#   - avalia-umami-*.sql                 (Postgres: analytics)
#   - avalia-uploads-*.tgz               (Directus uploads-volume = originele bestanden)
# NB: de Postgres-DB's en uploads leven in Docker named volumes, NIET onder
#     /opt/sites/, dus die worden los gedumpt.

set -euo pipefail

# ---- config ----
SITES_DIR=/opt/sites
TMP_DIR=/tmp/sites-backup
DEST_HOST=root@192.168.178.161
DEST_DIR=/mnt/user/backups/mini-pc-sites
SSH_KEY=/home/vectra-user/.ssh/id_ed25519_unraid_backup
DB_CONTAINER=hugosdesign-db
LOG=/opt/sites/backups/sites-backup.log
DAILY_RETAIN=7
WEEKLY_RETAIN=4

DATE=$(date +%Y%m%d-%H%M)
DOW=$(date +%u)   # 1=ma..7=zo
HOSTNAME_S=$(hostname -s)
SSH_OPTS="-i $SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new"

# alle output naar logfile
exec >> "$LOG" 2>&1
echo
echo "=== $(date -Iseconds) start backup ==="

# ---- 1. tmp prep ----
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

# ---- 2. DB dump (hugosdesign MariaDB) ----
echo "-> mysqldump $DB_CONTAINER"
docker exec "$DB_CONTAINER" sh -c \
    'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mysqldump --single-transaction --all-databases -uroot' \
    > "$TMP_DIR/${DB_CONTAINER}-${DATE}.sql"
DB_SIZE=$(du -h "$TMP_DIR/${DB_CONTAINER}-${DATE}.sql" | cut -f1)
echo "   dump size: $DB_SIZE"

# ---- 2b. Avalia Postgres dumps (Directus + Umami) ----
# Local socket auth is trust inside the container, so no password needed.
echo "-> pg_dump avalia-cms-db (directus)"
docker exec avalia-cms-db pg_dump -U directus -d directus > "$TMP_DIR/avalia-directus-${DATE}.sql"
echo "   directus dump: $(du -h "$TMP_DIR/avalia-directus-${DATE}.sql" | cut -f1)"

echo "-> pg_dump avalia-umami-db (umami)"
docker exec avalia-umami-db pg_dump -U umami -d umami > "$TMP_DIR/avalia-umami-${DATE}.sql"
echo "   umami dump: $(du -h "$TMP_DIR/avalia-umami-${DATE}.sql" | cut -f1)"

# ---- 2c. Directus uploads volume (original files) ----
# A throwaway alpine container tars the volume to stdout; the redirect makes
# the file vectra-user-owned (no root / cleanup headaches).
echo "-> tar avalia-cms uploads volume"
docker run --rm -v avalia-cms_uploads:/data:ro alpine tar czf - -C /data . \
    > "$TMP_DIR/avalia-uploads-${DATE}.tgz"
echo "   uploads: $(du -h "$TMP_DIR/avalia-uploads-${DATE}.tgz" | cut -f1)"

# ---- 3. tarball ----
TARBALL_NAME="${HOSTNAME_S}-sites-${DATE}.tar.gz"
TARBALL="$TMP_DIR/$TARBALL_NAME"
echo "-> create tarball $TARBALL_NAME"
tar -czf "$TARBALL" \
    --exclude="${SITES_DIR}/backups" \
    --exclude='*/node_modules' \
    -C "$(dirname "$SITES_DIR")" "$(basename "$SITES_DIR")" \
    -C "$TMP_DIR" "${DB_CONTAINER}-${DATE}.sql" \
                  "avalia-directus-${DATE}.sql" \
                  "avalia-umami-${DATE}.sql" \
                  "avalia-uploads-${DATE}.tgz"
LOCAL_SIZE=$(stat -c%s "$TARBALL")
echo "   tarball: $(du -h "$TARBALL" | cut -f1) ($LOCAL_SIZE bytes)"

# ---- 4. ensure remote dirs, rsync ----
echo "-> rsync naar $DEST_HOST:$DEST_DIR/daily/"
ssh $SSH_OPTS "$DEST_HOST" "mkdir -p '$DEST_DIR/daily' '$DEST_DIR/weekly'"
rsync -a --partial -e "ssh $SSH_OPTS" "$TARBALL" "$DEST_HOST:$DEST_DIR/daily/"

# ---- 5. verify remote size ----
REMOTE_SIZE=$(ssh $SSH_OPTS "$DEST_HOST" "stat -c%s '$DEST_DIR/daily/$TARBALL_NAME'")
if [ "$REMOTE_SIZE" != "$LOCAL_SIZE" ]; then
    echo "!! FAIL: remote size $REMOTE_SIZE != local $LOCAL_SIZE"
    exit 1
fi
echo "   verified: $REMOTE_SIZE bytes op Unraid"

# ---- 6. zondag: kopie naar weekly/ ----
if [ "$DOW" = "7" ]; then
    echo "-> zondag: copy naar weekly/"
    ssh $SSH_OPTS "$DEST_HOST" "cp '$DEST_DIR/daily/$TARBALL_NAME' '$DEST_DIR/weekly/$TARBALL_NAME'"
fi

# ---- 7. retentie op Unraid ----
echo "-> retentie: behoud $DAILY_RETAIN daily + $WEEKLY_RETAIN weekly"
ssh $SSH_OPTS "$DEST_HOST" "
    cd '$DEST_DIR/daily'  && ls -1t | tail -n +$((DAILY_RETAIN+1))  | xargs -r rm -v;
    cd '$DEST_DIR/weekly' && ls -1t | tail -n +$((WEEKLY_RETAIN+1)) | xargs -r rm -v
"

# ---- 8. cleanup lokaal ----
rm -rf "$TMP_DIR"
echo "=== $(date -Iseconds) backup done ==="
