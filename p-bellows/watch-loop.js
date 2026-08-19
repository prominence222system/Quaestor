'use strict';
const fs = require('fs');
const path = require('path');
const { scrapeUsage } = require('./lib/scrape');
const { readConfig } = require('./lib/config');
const { createObservation, recordSuccess, recordFailure } = require('./lib/observation');

const PROFILE_DIR  = path.resolve(process.env.BELLOWS_PROFILE_DIR || './.profile');
const INTERVAL_MIN = parseInt(process.env.BELLOWS_INTERVAL_MIN || '15', 10);

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

  // if config disabled, skip threshold check + remove auto STOP if any
  if (!cfg.enabled) {
    log('[config] disabled, skipping threshold check');
    if (existing && existing.source === 'auto') {
      try { fs.unlinkSync(STOP_PATH); log('[config] removed auto STOP.json (disabled)'); }
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
    writeStopJsonAtomic({
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
    });
    log('[stop] STOP.json written (reason=' + desired.reason + ')');
  } else if (desired.state === 'release') {
    if (existing && existing.source === 'auto') {
      try { fs.unlinkSync(STOP_PATH); log('[release] STOP.json removed (recovered)'); }
      catch (e) { log('[release error] ' + e.message); }
    }
    // else: no STOP, nothing to do
  } else {
    log('[hold] hysteresis (weekly=' + usage.weekly_pct + '% session=' + usage.session_pct + '%)');
  }
}

async function mainLoop() {
  log('[start] bellows watcher. interval=' + INTERVAL_MIN + 'm config=' + CONFIG_PATH);
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
