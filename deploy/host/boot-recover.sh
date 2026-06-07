#!/bin/sh
# Boot-time recovery for /opt/sites/<name>/ docker compose stacks.
#
# Why: containers in /opt/sites bind to a specific LAN IP (e.g.
# 192.168.178.29:8084). At boot there's a race between DHCP assigning that
# IP and Docker starting the containers — if Docker wins, the bind fails
# (exit 128), the network gets into an incoherent state, and `restart:
# unless-stopped` eventually gives up. The compose project's network can
# also end up without any containers attached.
#
# This script:
#   1. Waits up to TIMEOUT seconds for $LAN_IP to be assigned to *some*
#      interface.
#   2. Waits for Docker to respond.
#   3. For each /opt/sites/<name>/docker-compose.yml: if the number of
#      running containers is less than the number of declared services,
#      OR any container is in a restart loop, recreate the stack
#      (compose down + up). Healthy stacks are left untouched.
#
# Env overrides:
#   LAN_IP=192.168.178.29      Wait for this IP before recovering.
#   SITES_ROOT=/opt/sites      Where to look for compose projects.
#   TIMEOUT=120                Seconds to wait for LAN_IP.
#
# Triggered by avalia-boot-recover.service (After=docker.service,
# network-online.target).
set -eu

LAN_IP="${LAN_IP:-192.168.178.29}"
SITES_ROOT="${SITES_ROOT:-/opt/sites}"
TIMEOUT="${TIMEOUT:-120}"

log() { printf '%s  %s\n' "$(date '+%F %T')" "$*"; }

# 1. Wait for the LAN IP to appear --------------------------------------------
log "waiting for $LAN_IP (timeout ${TIMEOUT}s)..."
end=$(( $(date +%s) + TIMEOUT ))
while ! ip -4 addr show 2>/dev/null | grep -q "inet $LAN_IP/"; do
  if [ "$(date +%s)" -gt "$end" ]; then
    log "ERROR: $LAN_IP never appeared on any interface"
    exit 1
  fi
  sleep 2
done
log "LAN IP $LAN_IP is up"

# 2. Wait for Docker ----------------------------------------------------------
end=$(( $(date +%s) + 60 ))
while ! docker info >/dev/null 2>&1; do
  if [ "$(date +%s)" -gt "$end" ]; then
    log "ERROR: docker not responding"
    exit 1
  fi
  sleep 1
done
log "Docker is responding"

# 3. Walk each compose project -----------------------------------------------
fail=0
for dir in "$SITES_ROOT"/*/; do
  [ -f "${dir}docker-compose.yml" ] || [ -f "${dir}compose.yml" ] || continue
  name=$(basename "$dir")
  cd "$dir"

  expected=$(docker compose config --services 2>/dev/null | wc -l | tr -d ' ')
  running=$(docker compose ps --status running --quiet 2>/dev/null | wc -l | tr -d ' ')
  restarting=$(docker compose ps --status restarting --quiet 2>/dev/null | wc -l | tr -d ' ')

  # Healthy if: every declared service has a running container AND none is
  # in a restart loop.
  if [ "$expected" -gt 0 ] && [ "$expected" = "$running" ] && [ "$restarting" = "0" ]; then
    log "$name  OK ($running/$expected up)"
    continue
  fi

  log "$name  recreating (running=$running expected=$expected restarting=$restarting)"
  if ! docker compose down --remove-orphans 2>&1 | sed "s/^/  $name: /"; then
    log "$name  WARN: down had issues, continuing"
  fi
  if ! docker compose up -d 2>&1 | sed "s/^/  $name: /"; then
    log "$name  ERROR: up failed"
    fail=$(( fail + 1 ))
  fi
done

if [ "$fail" -gt 0 ]; then
  log "done with $fail failure(s)"
  exit 1
fi
log "done — all stacks healthy"
