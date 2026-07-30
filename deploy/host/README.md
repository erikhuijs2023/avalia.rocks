# Boot-time recovery for the mini-pc

If the mini-pc reboots (power-cut, move) there's a race between DHCP
assigning the LAN IP `192.168.178.29` and Docker starting the containers
that bind to it. When Docker wins, the bind fails (exit code 128) and
`restart: unless-stopped` gives up after a handful of tries — leaving the
containers down and the compose networks in an incoherent state. The fix
that gets things back is `docker compose down && docker compose up -d`
per project, run AFTER the LAN IP is present.

`boot-recover.sh` + the `avalia-boot-recover.service` unit do that
automatically at every boot.

## Files

| File                          | Lives at                                    |
|-------------------------------|---------------------------------------------|
| `boot-recover.sh`             | `/opt/sites/host/boot-recover.sh` (executable) |
| `avalia-boot-recover.service` | `/etc/systemd/system/avalia-boot-recover.service` |

## Install

From your workstation:

```powershell
scp -r deploy/host vectra-user@192.168.178.29:/tmp/host
```

On the mini-pc:

```sh
sudo mkdir -p /opt/sites/host
sudo cp /tmp/host/boot-recover.sh /opt/sites/host/
sudo chmod +x /opt/sites/host/boot-recover.sh

sudo cp /tmp/host/avalia-boot-recover.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable avalia-boot-recover.service
```

## Verify

Run the script manually — should be a no-op when everything is healthy:

```sh
sudo systemctl start avalia-boot-recover.service
sudo journalctl -u avalia-boot-recover --since '1 minute ago' --no-pager
```

Output looks like:

```
LAN IP 192.168.178.29 is up
Docker is responding
avalia            OK (3/3 up)
avalia-cms        OK (2/2 up)
avalia-analytics  OK (2/2 up)
avalia-pics       OK (2/2 up)
hugosdesign       OK (2/2 up)
test              OK (1/1 up)
destemvansylvie   OK (1/1 up)
done — all stacks healthy
```

There is no list of projects to maintain: the script globs
`/opt/sites/*/` and covers any directory holding a `docker-compose.yml`.
A new stack is picked up the moment its directory exists.

If a stack is unhealthy it logs `recreating (running=X expected=Y …)`
and runs `down + up` for that project only.

If its compose file can't be parsed at all — almost always a missing or
incomplete `.env` — it logs `ERROR: compose config failed` with the reason
and moves on, rather than churning through down/up to no effect. Stacks
with required variables (`avalia-pics` needs `SESSION_SECRET` and
`ORIGINALS_DIR`) fail this way when their `.env` is absent.

## What it doesn't do

- It does not touch stacks outside `/opt/sites/`.
- It does not rebuild images. If a build context changed (e.g. you edited
  `deploy/mailer/`) you still need to deploy via `deploy.ps1 -Infra`.
- It does not solve permanent failures. A broken `.env` is reported and
  skipped; a stack that starts and then crashes will be recreated on every
  boot without ever becoming healthy.
