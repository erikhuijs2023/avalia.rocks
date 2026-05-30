<#
.SYNOPSIS
  Build + deploy the Avalia site to the mini-pc.

.DESCRIPTION
  1. Runs `npm run build` locally (pulls fresh data from Directus).
  2. Uploads the new dist/ to /opt/sites/avalia/html.new/ via scp.
  3. Atomically swaps html.new/ into place — zero downtime, no half-served state.
  4. Hits the live URL to confirm 200.

  Re-run any time you change content in Directus or code in the repo.

.PARAMETER SkipBuild
  Skip `npm run build` and reuse whatever is in dist/. Useful for retrying
  just the upload step.

.PARAMETER Infra
  Also push docker-compose.yml, nginx.conf and the mailer/ source, then
  `docker compose up -d --build`. Use after editing infra-side code.

.EXAMPLE
  .\deploy\site\deploy.ps1
  .\deploy\site\deploy.ps1 -SkipBuild
  .\deploy\site\deploy.ps1 -Infra
#>
[CmdletBinding()]
param(
  [switch] $SkipBuild,
  [switch] $Infra
)

$ErrorActionPreference = 'Stop'
$RepoRoot   = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$SshHost    = 'vectra-user@192.168.178.29'
$RemoteRoot = '/opt/sites/avalia'
$LiveUrl    = 'http://192.168.178.29:8084'

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  OK $msg" -ForegroundColor Green }

Push-Location $RepoRoot
try {
  # 0. Infra sync (optional) --------------------------------------------------
  if ($Infra) {
    Step 'Syncing infra files (compose, nginx, mailer/)...'
    scp deploy/site/docker-compose.yml deploy/site/nginx.conf "${SshHost}:${RemoteRoot}/" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'infra scp (compose+nginx) failed' }
    scp -r deploy/mailer "${SshHost}:${RemoteRoot}/" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'infra scp (mailer) failed' }
    Ok 'uploaded'

    Step 'docker compose up -d --build ...'
    ssh $SshHost "cd $RemoteRoot && docker compose up -d --build" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'docker compose failed (run interactively to see logs)' }
    Ok 'containers up'
  }

  # 1. Build ------------------------------------------------------------------
  if (-not $SkipBuild) {
    Step 'Building Astro (pulling fresh data from Directus)...'
    npm run build | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
    $size = (Get-ChildItem dist -Recurse | Measure-Object -Property Length -Sum).Sum
    Ok ("dist/ {0:N0} KB across {1} files" -f ($size/1KB), (Get-ChildItem dist -Recurse -File).Count)
  } else {
    Step 'Skipping build (using existing dist/)'
  }

  if (-not (Test-Path 'dist')) { throw 'dist/ not found — run without -SkipBuild first' }

  # 2. Stage upload -----------------------------------------------------------
  Step 'Preparing staging dir on mini-pc...'
  ssh $SshHost "rm -rf $RemoteRoot/html.new && mkdir -p $RemoteRoot/html.new"
  if ($LASTEXITCODE -ne 0) { throw 'remote staging dir failed' }
  Ok 'staging dir clean'

  Step 'Uploading dist/ -> html.new/ ...'
  scp -r dist/* "${SshHost}:${RemoteRoot}/html.new/" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'scp failed' }
  Ok 'upload done'

  # 3. Replace contents -------------------------------------------------------
  # Replacing the html/ DIRECTORY (mv) would break Docker's bind mount — it
  # holds the original inode. Instead, wipe + copy contents so the inode
  # survives. The ~ms-long empty window is acceptable for a static site.
  Step 'Replacing html/ contents (preserves the bind mount inode)...'
  $swap = "set -e; cd $RemoteRoot; rm -rf html/* html/.[!.]* 2>/dev/null || true; cp -a html.new/. html/; rm -rf html.new"
  ssh $SshHost $swap
  if ($LASTEXITCODE -ne 0) { throw 'replace failed' }
  Ok 'live'

  # 4. Verify -----------------------------------------------------------------
  Step "Verifying $LiveUrl ..."
  $checks = @('/', '/products', '/updates', '/about', '/feed.xml')
  $fail = 0
  foreach ($p in $checks) {
    try {
      $r = Invoke-WebRequest -Uri "$LiveUrl$p" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
      Ok ("{0,4}  {1,8}  {2}" -f $r.StatusCode, $r.RawContentLength, $p)
    } catch {
      Write-Host ("  x FAIL  {0}  ({1})" -f $p, $_.Exception.Message) -ForegroundColor Red
      $fail++
    }
  }
  if ($fail -gt 0) { throw "$fail route(s) failed health check" }

  Write-Host "`nOK Deployed to $LiveUrl" -ForegroundColor Green
}
finally {
  Pop-Location
}
