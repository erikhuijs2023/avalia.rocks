/**
 * Avalia builder — webhook-triggered static-site rebuilder.
 *
 * Flow:
 *   1. Directus fires POST /hook (with X-Avalia-Token header).
 *   2. We debounce DEBOUNCE_MS so a burst of saves collapses into one build.
 *   3. When the timer fires we run: git fetch + reset, npm ci, npm run build,
 *      then rsync dist/ -> /srv/dist/ (the html/ bind mount).
 *   4. If a hook arrives while a build is in progress, we set a "queued" flag
 *      so exactly one extra build runs after the current one finishes.
 *
 * Env:
 *   PORT          listen port (default 8087)
 *   HOOK_TOKEN    shared secret, required in X-Avalia-Token on /hook
 *   REPO_DIR      git checkout location (default /srv/site)
 *   DIST_DIR      nginx html bind mount (default /srv/dist)
 *   GIT_BRANCH    branch to track (default main)
 *   DEBOUNCE_MS   debounce window (default 10000)
 *
 * Endpoints:
 *   GET  /health  — JSON: build state + last build summary
 *   POST /hook    — schedules a debounced rebuild (any body, ignored)
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';

const PORT         = Number(process.env.PORT || 8087);
const HOOK_TOKEN   = process.env.HOOK_TOKEN;
const REPO_DIR     = process.env.REPO_DIR  || '/srv/site';
const DIST_DIR     = process.env.DIST_DIR  || '/srv/dist';
const GIT_BRANCH   = process.env.GIT_BRANCH || 'main';
const DEBOUNCE_MS  = Number(process.env.DEBOUNCE_MS || 10_000);

if (!HOOK_TOKEN) { console.error('HOOK_TOKEN required'); process.exit(1); }

// ---- state ----------------------------------------------------------------
let debounceTimer  = null;
let buildInFlight  = false;
let buildQueued    = false;
let lastBuild = {
  startedAt: null, finishedAt: null, ok: null,
  durationMs: null, error: null, tail: []
};

// ---- helpers --------------------------------------------------------------
function constantEq(a, b) {
  const aBuf = Buffer.from(a || '');
  const bBuf = Buffer.from(b || '');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function runCmd(cmd, args, cwd, sink) {
  return new Promise((resolve, reject) => {
    console.log(`[run] ${cmd} ${args.join(' ')}  (cwd=${cwd})`);
    const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    function pipe(stream, target) {
      stream.on('data', (d) => {
        const s = d.toString();
        sink.push(s);
        if (sink.length > 500) sink.splice(0, sink.length - 500);
        target.write(s);
      });
    }
    pipe(p.stdout, process.stdout);
    pipe(p.stderr, process.stderr);
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))
    );
  });
}

async function runBuild() {
  if (buildInFlight) { buildQueued = true; console.log('[build] in-flight, queuing'); return; }
  buildInFlight = true;
  const started = Date.now();
  const sink = [];
  lastBuild = { startedAt: new Date(started).toISOString(), finishedAt: null, ok: null, durationMs: null, error: null, tail: sink };
  console.log(`[build] start ${lastBuild.startedAt}`);
  try {
    await runCmd('git', ['fetch', '--depth=1', 'origin', GIT_BRANCH], REPO_DIR, sink);
    await runCmd('git', ['reset', '--hard', `origin/${GIT_BRANCH}`], REPO_DIR, sink);
    await runCmd('npm', ['ci', '--no-audit', '--no-fund'], REPO_DIR, sink);
    await runCmd('npm', ['run', 'build'], REPO_DIR, sink);
    // Trailing slash on src so rsync copies CONTENTS (not the dist/ dir itself).
    await runCmd('rsync', ['-a', '--delete', 'dist/', `${DIST_DIR}/`], REPO_DIR, sink);
    lastBuild.ok = true;
  } catch (e) {
    lastBuild.ok = false;
    lastBuild.error = e.message;
    console.error(`[build] FAIL  ${e.message}`);
  } finally {
    lastBuild.finishedAt = new Date().toISOString();
    lastBuild.durationMs = Date.now() - started;
    // Keep only the last ~80 lines in the tail surfaced via /health.
    lastBuild.tail = sink.join('').split('\n').slice(-80);
    buildInFlight = false;
    console.log(`[build] ${lastBuild.ok ? 'ok' : 'fail'} in ${lastBuild.durationMs}ms`);
    if (buildQueued) {
      buildQueued = false;
      console.log('[build] running queued follow-up');
      // Re-arm immediately (no debounce — the hook that queued it already
      // waited DEBOUNCE_MS before triggering the first build).
      runBuild();
    }
  }
}

function trigger(reason) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { debounceTimer = null; runBuild(); }, DEBOUNCE_MS);
  console.log(`[trigger] ${reason} (build in ${DEBOUNCE_MS}ms)`);
}

// ---- HTTP -----------------------------------------------------------------
const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      buildInFlight,
      buildQueued,
      debouncePending: Boolean(debounceTimer),
      lastBuild
    }, null, 2));
    return;
  }

  if (req.method === 'POST' && req.url === '/hook') {
    const token = req.headers['x-avalia-token'];
    if (!constantEq(String(token || ''), HOOK_TOKEN)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      return;
    }
    // Drain (but ignore) the body so the connection closes cleanly.
    let bytes = 0;
    req.on('data', (c) => { bytes += c.length; if (bytes > 16 * 1024) req.destroy(); });
    req.on('end', () => {
      trigger(`hook ${bytes}b from ${req.socket.remoteAddress}`);
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, queued: true, debounceMs: DEBOUNCE_MS }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not found' }));
});

server.listen(PORT, '0.0.0.0', () =>
  console.log(`Avalia builder listening on :${PORT}  (debounce ${DEBOUNCE_MS}ms, branch ${GIT_BRANCH})`)
);

// Graceful shutdown so a `docker compose down` doesn't kill mid-build noisily.
function shutdown(sig) {
  console.log(`[shutdown] ${sig}`);
  server.close(() => process.exit(0));
  // Don't wait forever if a build is still running.
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
