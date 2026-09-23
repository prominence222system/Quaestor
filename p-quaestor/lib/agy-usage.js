'use strict';
// Measures Gemini quota via `agy -p "/usage"` (a query, not a model turn --
// no tokens spent). See output/DESIGN.md D1-D10 and work/014 for rationale.
//
// This module never rejects and never throws out of measureAgy()/poll().
// Failures are resolved values, not exceptions, so a broken/missing `agy`
// never costs claude a poll (see output/DESIGN.md section 2).
const { envRaw } = require('./env');

const AGY_ARGS = Object.freeze(['-p', '/usage']);
const DEFAULT_AGY_FILE = 'agy';
const DEFAULT_TIMEOUT_MS = 45000;
const DEADLINE_SLACK_MS = 2000;

const BUCKET = 'Gemini Models'; // allowlist -- the only bucket name this file knows
const METRIC_WEEKLY = 'Weekly Limit Remaining';
const METRIC_5H = 'Five Hour Limit Remaining';

const LOGIN_HINT_RE = /please\s+sign\s+in/i;

// Returns the agy executable path/name. Reads process.env at call time
// (same discipline as env.js) -- never caches.
function resolveAgyFile() {
  const raw = envRaw('AGY_EXE');
  if (typeof raw === 'string' && raw.trim() !== '') return raw;
  return DEFAULT_AGY_FILE;
}

// Pure parser. No I/O, no process.env, no Date access. Strict: unreadable
// input yields { ok: false } rather than a guess.
function parseUsage(text) {
  if (typeof text !== 'string') return { ok: false };

  const lines = text.split(/\r?\n/);
  let weekly = null;
  let fiveHour = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') continue;
    if (line === 'Quota:') continue;

    let cols = line.split('\t');
    if (cols.length !== 4) {
      cols = line.split(/\s{2,}/);
    }
    if (cols.length !== 4) continue;
    cols = cols.map((c) => c.trim());

    const [bucket, metric, pctRaw, resetRaw] = cols;
    if (bucket !== BUCKET) continue;

    if (!/^\d{1,3}%$/.test(pctRaw)) continue;
    const pct = parseInt(pctRaw, 10);
    if (pct < 0 || pct > 100) continue;

    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(resetRaw)) continue;

    if (metric === METRIC_WEEKLY) {
      if (weekly !== null && (weekly.pct !== pct || weekly.reset !== resetRaw)) {
        return { ok: false };
      }
      weekly = { pct, reset: resetRaw };
    } else if (metric === METRIC_5H) {
      if (fiveHour !== null && (fiveHour.pct !== pct || fiveHour.reset !== resetRaw)) {
        return { ok: false };
      }
      fiveHour = { pct, reset: resetRaw };
    }
    // else: unrecognized metric under the allowlisted bucket -- skip
  }

  if (weekly === null || fiveHour === null) return { ok: false };

  return {
    ok: true,
    weekly_remaining_pct: weekly.pct,
    five_hour_remaining_pct: fiveHour.pct,
    weekly_reset_raw: weekly.reset,
    five_hour_reset_raw: fiveHour.reset
  };
}

function loginHint(stdout, stderr) {
  const combined = (stdout || '') + '\n' + (stderr || '');
  return LOGIN_HINT_RE.test(combined) ? 'login-required' : null;
}

// Classifies a completed (err, stdout, stderr) triple per output/DESIGN.md
// D5's table. Order matters -- the same login-required text is
// parse-failed at exit 0 but exit-nonzero at exit 1.
function classify(err, stdout, stderr, at) {
  const hint = loginHint(stdout, stderr);
  if (err) {
    if (typeof err.code === 'string' && err.code !== 'ENOENT') {
      return hint ? { ok: false, at, kind: 'spawn-failed', hint } : { ok: false, at, kind: 'spawn-failed' };
    }
    if (err.code === 'ENOENT') {
      return hint ? { ok: false, at, kind: 'not-installed', hint } : { ok: false, at, kind: 'not-installed' };
    }
    if (err.killed === true) {
      return hint ? { ok: false, at, kind: 'timeout', hint } : { ok: false, at, kind: 'timeout' };
    }
    if (typeof err.code === 'number' && err.code !== 0) {
      return hint ? { ok: false, at, kind: 'exit-nonzero', hint } : { ok: false, at, kind: 'exit-nonzero' };
    }
    return hint ? { ok: false, at, kind: 'spawn-failed', hint } : { ok: false, at, kind: 'spawn-failed' };
  }

  const p = parseUsage(stdout);
  if (!p.ok) {
    return hint ? { ok: false, at, kind: 'parse-failed', hint } : { ok: false, at, kind: 'parse-failed' };
  }
  return {
    ok: true,
    at,
    weekly_remaining_pct: p.weekly_remaining_pct,
    five_hour_remaining_pct: p.five_hour_remaining_pct,
    weekly_reset_raw: p.weekly_reset_raw,
    five_hour_reset_raw: p.five_hour_reset_raw
  };
}

// Never rejects. `executor` defaults to the real child_process.execFile;
// tests inject an adapter that still spawns a real child process (see
// output/DESIGN.md D1).
function measureAgy(opts) {
  const o = opts || {};
  const executor = o.executor || require('node:child_process').execFile;
  const file = o.file || resolveAgyFile();
  const timeoutMs = typeof o.timeoutMs === 'number' ? o.timeoutMs : DEFAULT_TIMEOUT_MS;
  const nowFn = o.nowFn || Date.now;

  return new Promise((resolve) => {
    let settled = false;
    let child = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const at = new Date(nowFn()).toISOString();

    const timer = setTimeout(() => {
      try { if (child && typeof child.kill === 'function') child.kill(); } catch (_) { /* ignore */ }
      finish({ ok: false, at, kind: 'timeout' });
    }, timeoutMs + DEADLINE_SLACK_MS);
    if (typeof timer.unref === 'function') timer.unref();

    try {
      child = executor(
        file,
        AGY_ARGS,
        { shell: false, windowsHide: true, timeout: timeoutMs, encoding: 'utf8' },
        (err, stdout, stderr) => {
          finish(classify(err, stdout, stderr, at));
        }
      );
    } catch (e) {
      const hint = loginHint(e && e.message, null);
      finish(hint ? { ok: false, at, kind: 'spawn-failed', hint } : { ok: false, at, kind: 'spawn-failed' });
    }
  });
}

// Creates a poll-driven monitor. .poll() returns synchronously; measurement
// runs in the background. See output/DESIGN.md D8.
function createAgyMonitor(opts) {
  const o = opts || {};
  const measure = o.measure || measureAgy;
  const log = o.log;
  const nowFn = o.nowFn || Date.now;

  let lastSuccess = null;
  let lastAttempt = null;
  let inFlight = false;

  function safeLog(msg) {
    if (typeof log !== 'function') return;
    try { log(msg); } catch (_) { /* swallow */ }
  }

  function formatLogLine(result) {
    if (result.ok) {
      return '[agy] gemini weekly_left=' + result.weekly_remaining_pct + '% five_hour_left=' + result.five_hour_remaining_pct + '%';
    }
    let line = '[agy] fail kind=' + result.kind;
    if (result.hint) line += ' hint=' + result.hint;
    return line;
  }

  function onResult(r) {
    inFlight = false;
    lastAttempt = { at: r.at, ok: r.ok, kind: r.ok ? null : r.kind };
    if (r.ok) {
      lastSuccess = {
        weekly_remaining_pct: r.weekly_remaining_pct,
        five_hour_remaining_pct: r.five_hour_remaining_pct,
        weekly_reset_raw: r.weekly_reset_raw,
        five_hour_reset_raw: r.five_hour_reset_raw,
        at: r.at
      };
    }
    safeLog(formatLogLine(r));
  }

  function onRejected() {
    inFlight = false;
    const at = new Date(nowFn()).toISOString();
    lastAttempt = { at, ok: false, kind: 'spawn-failed' };
    safeLog(formatLogLine({ ok: false, kind: 'spawn-failed' }));
  }

  function poll() {
    if (inFlight) return;
    inFlight = true;
    let p;
    try {
      p = measure();
    } catch (e) {
      inFlight = false;
      const at = new Date(nowFn()).toISOString();
      lastAttempt = { at, ok: false, kind: 'spawn-failed' };
      safeLog(formatLogLine({ ok: false, kind: 'spawn-failed' }));
      return;
    }
    Promise.resolve(p).then(onResult, onRejected);
  }

  function snapshot() {
    return {
      lastSuccess: lastSuccess ? Object.assign({}, lastSuccess) : null,
      lastAttempt: lastAttempt ? Object.assign({}, lastAttempt) : null,
      inFlight
    };
  }

  return { poll, snapshot };
}

module.exports = { AGY_ARGS, resolveAgyFile, parseUsage, measureAgy, createAgyMonitor };
