'use strict';
const fs = require('fs');
const path = require('path');
const { scrapeUsage } = require('./lib/scrape');
const { readConfig } = require('./lib/config');
const { createObservation, recordSuccess, recordFailure } = require('./lib/observation');
const { startControlServer } = require('./lib/control-server');
const { parseLogTail } = require('./lib/logparse');
const { envRaw } = require('./lib/env');

const PROFILE_DIR  = path.resolve(envRaw('PROFILE_DIR') || './.profile');
const INTERVAL_MIN = parseInt(envRaw('INTERVAL_MIN') || '15', 10);

function resolveStopDir() {
  const candidates = [
    'D:\\SynologyDrive\\Obsidian\\Automatic',
    'F:\\SynologyDrive\\Obsidian\\Automatic'
  ];
  for (let i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) {
      const p = path.join(candidates[i], '.prominence');
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      return p;
    }
  }
  return null;
}

const STOP_DIR = resolveStopDir();
if (!STOP_DIR) {
  console.error('[bellows] no Synology root found (D: or F:)');
  process.exit(1);
}
const LOG_PATH   = path.join(STOP_DIR, 'bellows.log');
const STOP_PATH  = path.join(STOP_DIR, 'STOP.json');
const CONFIG_PATH = path.join(STOP_DIR, 'bellows-config.json');

let observation = createObservation();
// Control-server snapshot source -- the ctx half of deriveState() that
// pollOnce() reads but never persists anywhere. See output/DESIGN.md
// section 9-4(a). lastStop is populated from the readStopJson()/write/
// unlink calls pollOnce() already makes -- no new file I/O is added here.
let lastCfg = null;
let lastStop = null;
let lastConfigSource = 'default';

function log(msg) {
  const ts = new Date().toISOString();
  fs.appendFileSync(LOG_PATH, ts + ' ' + msg + '\n');
}

function readStopJson() {
  if (!fs.existsSync(STOP_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(STOP_PATH, 'utf8')); } catch (e) { return null; }
}

function writeStopJsonAtomic(obj) {
  const tmp = STOP_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, STOP_PATH);
}

function deriveDesired(usage, t) {
  const wp = usage.weekly_pct, sp = usage.session_pct;
  const weeklyOver  = wp >= t.weekly_stop;
  const sessionOver = sp >= t.session_stop;
  const weeklyOk    = wp <  t.weekly_release;
  const sessionOk   = sp <  t.session_release;
  if (weeklyOver || sessionOver) {
    let reason;
    if (weeklyOver && sessionOver) reason = 'both';
    else if (weeklyOver) reason = 'weekly_threshold';
    else reason = 'session_threshold';
    return { state: 'stop', reason: reason };
  }
  if (weeklyOk && sessionOk) return { state: 'release' };
  return { state: 'hold' };
}

function isValidUsage(u) {
  if (!u) return false;
  if (typeof u.session_pct !== 'number') return false;
  if (typeof u.weekly_pct !== 'number') return false;
  if (u.session_pct < 0 || u.session_pct > 100) return false;
  if (u.weekly_pct < 0 || u.weekly_pct > 100) return false;
  return true;
}

async function pollOnce() {
  const cfg = readConfig(CONFIG_PATH);
  lastCfg = cfg;
  lastConfigSource = (fs.existsSync(CONFIG_PATH) && !cfg._parseError && !cfg._expired) ? 'file' : 'default';
  if (cfg._parseError) {
    log('[config] parse error, using defaults: ' + cfg._parseError);
  }
  if (cfg._expired) {
    log('[config] expires_at past, using defaults');
  }

  log('[poll start]');
  let usage = null;
  try {
    usage = await scrapeUsage(PROFILE_DIR);
  } catch (e) {
    const kind = e.kind || 'unknown';
    const hint = e.detail && e.detail.hint;
    log('[poll error] scrape failed: ' + e.message + ' kind=' + kind + (hint ? ' hint=' + hint : ''));
    observation = recordFailure(observation, kind, e.detail || null, Date.now());
    return;
  }
  if (!isValidUsage(usage)) {
    log('[poll error] invalid extraction: ' + JSON.stringify(usage));
    observation = recordFailure(observation, 'invalid-extraction', null, Date.now());
    return;
  }
  log('session=' + usage.session_pct + '% weekly=' + usage.weekly_pct + '%');
  observation = recordSuccess(observation, usage, Date.now());

  const existing = readStopJson();
  lastStop = existing;

  // if config disabled, skip threshold check + remove auto STOP if any
  if (!cfg.enabled) {
    log('[config] disabled, skipping threshold check');
    if (existing && existing.source === 'auto') {
      try { fs.unlinkSync(STOP_PATH); log('[config] removed auto STOP.json (disabled)'); lastStop = null; }
      catch (e) { log('[config] remove failed: ' + e.message); }
    }
    return;
  }

  if (existing && existing.source === 'manual') {
    log('[stop] manual STOP active, skip auto');
    return;
  }
  const desired = deriveDesired(usage, cfg.thresholds);
  if (desired.state === 'stop') {
    if (existing
        && existing.source === 'auto'
        && existing.reason === desired.reason) {
      log('[stop] holding STOP (reason=' + desired.reason + ', no rewrite)');
      return;
    }
    const stopRecord = {
      source:        'auto',
      reason:        desired.reason,
      weekly_pct:    usage.weekly_pct,
      session_pct:   usage.session_pct,
      weekly_reset:  usage.weekly_reset,
      session_reset: usage.session_reset,
      created_at:    new Date().toISOString(),
      thresholds: {
        weekly_stop:     cfg.thresholds.weekly_stop,
        weekly_release:  cfg.thresholds.weekly_release,
        session_stop:    cfg.thresholds.session_stop,
        session_release: cfg.thresholds.session_release
      }
    };
    writeStopJsonAtomic(stopRecord);
    lastStop = stopRecord;
    log('[stop] STOP.json written (reason=' + desired.reason + ')');
  } else if (desired.state === 'release') {
    if (existing && existing.source === 'auto') {
      try { fs.unlinkSync(STOP_PATH); log('[release] STOP.json removed (recovered)'); lastStop = null; }
      catch (e) { log('[release error] ' + e.message); }
    }
    // else: no STOP, nothing to do
  } else {
    log('[hold] hysteresis (weekly=' + usage.weekly_pct + '% session=' + usage.session_pct + '%)');
  }
}

// Snapshot source for lib/control-server.js. [SPEC] no I/O here -- reads
// only in-memory module variables that pollOnce() already keeps current.
// Must stay a live closure (not a value captured once at startup) so
// GET /api/status always reflects the latest poll, not the state at
// server-start time.
function controlSnapshot() {
  return {
    observation: observation,
    ctx: {
      enabled:      lastCfg ? lastCfg.enabled : true,
      thresholds:   lastCfg ? lastCfg.thresholds : undefined,
      stop:         lastStop,
      configSource: lastConfigSource
    }
  };
}

function readLogTailLines(logPath, maxBytes) {
  const limit = typeof maxBytes === 'number' ? maxBytes : 65536;
  if (!logPath || !fs.existsSync(logPath)) return null;
  let fd = null;
  try {
    const stats = fs.statSync(logPath);
    if (!stats || stats.size === 0) return null;
    const readSize = Math.min(stats.size, limit);
    const position = stats.size - readSize;
    const buf = Buffer.alloc(readSize);
    fd = fs.openSync(logPath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, readSize, position);
    fs.closeSync(fd);
    fd = null;
    if (bytesRead === 0) return null;

    const content = buf.toString('utf8', 0, bytesRead);
    const lines = content.split(/\r?\n/);
    if (position > 0 && lines.length > 0) {
      lines.shift();
    }
    return lines;
  } catch (e) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_) {}
    }
    return null;
  }
}

function restoreObservation(logPath) {
  try {
    const lines = readLogTailLines(logPath, 65536);
    if (!lines || lines.length === 0) return createObservation();
    const parsed = parseLogTail(lines);
    if (!parsed) return createObservation();

    const obs = Object.assign(createObservation(), {
      lastSuccessAt:       parsed.lastSuccessAt,
      lastUsage:           parsed.lastUsage,
      consecutiveFailures: parsed.consecutiveFailures,
      lastFailure:         parsed.lastFailure,
      totalPolls:          parsed.consecutiveFailures + (parsed.lastSuccessAt !== null ? 1 : 0),
      totalFailures:       parsed.consecutiveFailures
    });

    const lastSuccessIso = parsed.lastSuccessAt ? new Date(parsed.lastSuccessAt).toISOString() : 'null';
    const failureKind = parsed.lastFailure ? parsed.lastFailure.kind : 'unknown';
    log('[restore] lastSuccess=' + lastSuccessIso + ' failures=' + parsed.consecutiveFailures + ' kind=' + failureKind);

    return obs;
  } catch (e) {
    return createObservation();
  }
}

async function mainLoop() {
  try {
    const restored = restoreObservation(LOG_PATH);
    if (restored) {
      observation = restored;
    }
  } catch (restoreErr) {
    // never-brick: quiet fallback to default observation
  }

  log('[start] bellows watcher. interval=' + INTERVAL_MIN + 'm config=' + CONFIG_PATH);

  // Control HTTP surface is a bonus, not the product -- the watch loop
  // below must run whether or not this succeeds. [SPEC] never-brick:
  // startControlServer() itself never rejects, but the try/catch here is
  // deliberate double protection against a require-time regression or a
  // synchronous throw from an injected callback (see output/DESIGN.md D4/C2).
  try {
    const cfg0 = readConfig(CONFIG_PATH);
    const r = await startControlServer({
      port:        cfg0.control.port,
      authToken:   cfg0.control.authToken,
      getSnapshot: controlSnapshot,
      onLog:       log
    });
    if (!r.started) {
      log('[control] listen failed: ' + r.error);
    }
  } catch (e) {
    log('[control] listen failed: ' + e.message);
  }

  while (true) {
    try { await pollOnce(); }
    catch (e) { log('[poll uncaught] ' + e.message); }
    await new Promise(function (r) { setTimeout(r, INTERVAL_MIN * 60 * 1000); });
  }
}

// Guard: requiring this module (e.g. from a test) must not start the loop.
if (require.main === module) {
  mainLoop();
}

module.exports = {
  readLogTailLines,
  restoreObservation
};
