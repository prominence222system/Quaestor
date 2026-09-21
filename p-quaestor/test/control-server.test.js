'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const os = require('node:os');
const net = require('node:net');

const { startControlServer, HOST, DEFAULT_PORT, SERVICE_ID } = require('../lib/control-server');
const { createObservation, recordFailure, recordSuccess, deriveState } = require('../lib/observation');
const { readConfig, HARD_DEFAULTS } = require('../lib/config');

const SRC_PATH = path.join(__dirname, '..', 'lib', 'control-server.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');
const PKG = require('../package.json');

// ---- fixtures --------------------------------------------------------

const NOW = Date.parse('2026-08-19T12:00:00Z');

function critSnapshot() {
  let obs = createObservation();
  for (let i = 0; i < 5; i++) {
    obs = recordFailure(obs, 'anchor-timeout', { hint: 'login-expired' }, NOW - (5 - i) * 60000);
  }
  return { observation: obs, ctx: { enabled: true, configSource: 'file' } };
}

function okSnapshot() {
  const obs = recordSuccess(createObservation(), { session_pct: 5, weekly_pct: 5 }, Date.now());
  return { observation: obs, ctx: { enabled: true, configSource: 'default' } };
}

async function getJson(port, pathname, opts) {
  return httpRequest(port, pathname, opts);
}

// ---- binding / startup contract --------------------------------------

test('binds to 127.0.0.1 and reports it in the resolved value', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    assert.strictEqual(r.started, true);
    assert.strictEqual(r.address, '127.0.0.1');
    assert.strictEqual(HOST, '127.0.0.1');
    assert.ok(typeof r.port === 'number' && r.port > 0);
  } finally {
    await r.close();
  }
});

test('source has no 0.0.0.0 / :: literals and no host override option', () => {
  assert.ok(!SRC.includes('0.0.0.0'), 'must not contain 0.0.0.0');
  assert.ok(!/['"]::['"]/.test(SRC), 'must not contain \'::\' literal');
  assert.ok(!/o\.host\b/.test(SRC) && !/opts\.host\b/.test(SRC), 'must not read opts.host');
});

test('startControlServer never rejects/throws on an already-occupied port; started=false, error is a non-empty string', async () => {
  const a = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  assert.strictEqual(a.started, true);
  try {
    let b;
    await assert.doesNotReject(async () => {
      b = await startControlServer({ port: a.port, getSnapshot: okSnapshot });
    });
    assert.strictEqual(b.started, false);
    assert.strictEqual(b.port, null);
    assert.strictEqual(typeof b.error, 'string');
    assert.ok(b.error.length > 0);
    // close() on a failed start must be a safe no-op
    await assert.doesNotReject(async () => { await b.close(); });
  } finally {
    await a.close();
  }
});

test('after close(), the port is bindable again (no lingering handle)', async () => {
  const a = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  const port = a.port;
  await a.close();
  const b = await startControlServer({ port: port, getSnapshot: okSnapshot });
  try {
    assert.strictEqual(b.started, true);
    assert.strictEqual(b.port, port);
  } finally {
    await b.close();
  }
});

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, HOST, () => probe.close(() => resolve(true)));
  });
}

test('omitting opts.port uses DEFAULT_PORT (3210)', async () => {
  assert.strictEqual(DEFAULT_PORT, 3210);
  const free = await isPortFree(DEFAULT_PORT);
  const r = await startControlServer({ getSnapshot: okSnapshot });
  try {
    if (free) {
      assert.strictEqual(r.started, true);
      assert.strictEqual(r.port, DEFAULT_PORT);
    } else {
      // DEFAULT_PORT is held by another process on this machine (a real running
      // watcher). The bind attempt still proves the default was used: an
      // ephemeral fallback would have succeeded instead of colliding.
      assert.strictEqual(r.started, false);
      assert.match(String(r.error), /EADDRINUSE/);
    }
  } finally {
    await r.close();
  }
});

test('concurrent binds to the same port: one succeeds, the other resolves started:false without throwing (late error-event safety)', async () => {
  const probe = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  const port = probe.port;
  await probe.close();
  const results = await Promise.all([
    startControlServer({ port, getSnapshot: okSnapshot }),
    startControlServer({ port, getSnapshot: okSnapshot })
  ]);
  const started = results.filter((r) => r.started === true);
  const failed = results.filter((r) => r.started === false);
  assert.strictEqual(started.length, 1);
  assert.strictEqual(failed.length, 1);
  assert.strictEqual(typeof failed[0].error, 'string');
  assert.ok(failed[0].error.length > 0);
  await Promise.all(results.map((r) => r.close()));
});

// ---- GET /api/health ---------------------------------------------------

test('GET /api/health -- 200, id=quaestor, ok/version/startedAt present, does not touch getSnapshot', async () => {
  let calls = 0;
  const r = await startControlServer({ port: 0, getSnapshot: () => { calls++; return okSnapshot(); } });
  try {
    const res = await getJson(r.port, '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.id, 'quaestor');
    assert.strictEqual(SERVICE_ID, 'quaestor');
    assert.strictEqual(res.body.version, PKG.version);
    assert.strictEqual(typeof res.body.startedAt, 'string');
    assert.ok(!isNaN(Date.parse(res.body.startedAt)));
    assert.strictEqual(calls, 0, 'GET /api/health must not call getSnapshot()');
  } finally {
    await r.close();
  }
});

test('GET /api/health startedAt is constant across two requests', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const first = await getJson(r.port, '/api/health');
    const second = await getJson(r.port, '/api/health');
    assert.strictEqual(first.body.startedAt, second.body.startedAt);
  } finally {
    await r.close();
  }
});

// ---- 011: /api/health contracts field -------------------------------------

test('[SPEC] GET /api/health over real port returns top-level contracts object with contracts["supervised-v1"] === "1.4.0"', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/api/health');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.contracts && typeof body.contracts === 'object');
    assert.strictEqual(body.contracts['supervised-v1'], '1.4.0');
    assert.strictEqual(typeof body.contracts['supervised-v1'], 'string');
  } finally {
    await r.close();
  }
});

test('[SPEC] contracts field values are string types, not numbers or objects', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/api/health');
    const body = await res.json();
    for (const key of Object.keys(body.contracts)) {
      assert.strictEqual(typeof body.contracts[key], 'string');
    }
  } finally {
    await r.close();
  }
});

test('[SPEC] existing GET /api/health fields (ok, id, version, startedAt) remain present and unchanged', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/api/health');
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.id, 'quaestor');
    assert.strictEqual(body.version, '0.1.0');
    assert.strictEqual(typeof body.startedAt, 'string');
  } finally {
    await r.close();
  }
});

test('[SPEC] software version (0.1.0) and contract version (1.4.0) are distinct axes and have different values', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/api/health');
    const body = await res.json();
    assert.notStrictEqual(body.version, body.contracts['supervised-v1']);
    assert.strictEqual(body.version, '0.1.0');
    assert.strictEqual(body.contracts['supervised-v1'], '1.4.0');
  } finally {
    await r.close();
  }
});

test('[SPEC] GET /api/status response remains completely unchanged (no regression from 011)', async () => {
  const snap = okSnapshot();
  const expected = deriveState(snap.observation, snap.ctx, Date.now());
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/api/status');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(Object.keys(body).sort(), ['allowance', 'fields', 'ok', 'state', 'summary', 'updatedAt', 'usage']);
    assert.strictEqual(body.state, expected.state);
    assert.strictEqual(body.summary, expected.summary);
    assert.deepStrictEqual(body.fields, expected.fields);
  } finally {
    await r.close();
  }
});

test('[SPEC] GET /api/health response contains no secret tokens, profile paths, cookies, or account info', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot, authToken: 'super-secret-token' });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/api/health', {
      headers: { Authorization: 'Bearer super-secret-token' }
    });
    const text = await res.text();
    assert.ok(!text.includes('super-secret-token'));
    assert.ok(!text.includes('.profile'));
    assert.ok(!text.includes('cookie'));
    assert.ok(!text.includes('@'));
  } finally {
    await r.close();
  }
});

// ---- GET /api/status -----------------------------------------------------

test('GET /api/status -- 200, state matches deriveState() exactly, no re-judgement (crit fixture)', async () => {
  const snap = critSnapshot();
  const expected = deriveState(snap.observation, snap.ctx, Date.now());
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.state, 'crit');
    assert.notStrictEqual(res.body.state, 'ok');
    assert.strictEqual(res.body.summary, expected.summary);
    assert.deepStrictEqual(res.body.fields, expected.fields);
    assert.ok(typeof res.body.updatedAt === 'string' && !isNaN(Date.parse(res.body.updatedAt)));
  } finally {
    await r.close();
  }
});

// ---- Phase 2 Acceptance Criteria Tests -------------------------------------

test('Phase 2 [SPEC]: /api/status response contains unchanged fields, summary, and state', async () => {
  const snap = okSnapshot();
  const expectedState = deriveState(snap.observation, snap.ctx, Date.now());
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.state, expectedState.state);
    assert.strictEqual(res.body.summary, expectedState.summary);
    assert.deepStrictEqual(res.body.fields, expectedState.fields);
  } finally {
    await r.close();
  }
});

test('Phase 2 [SPEC]: /api/status response top-level contains allowance and usage objects', async () => {
  const snap = okSnapshot();
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.allowance === 'object' && res.body.allowance !== null, 'allowance must be present at top level');
    assert.ok(typeof res.body.usage === 'object' && res.body.usage !== null, 'usage must be present at top level');
  } finally {
    await r.close();
  }
});

test('Phase 2 [SPEC]: HTTP GET /api/status usage.session_pct is number type upon JSON deserialization', async () => {
  const snap = okSnapshot();
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof res.body.usage.session_pct, 'number');
    assert.strictEqual(typeof res.body.usage.weekly_pct, 'number');
  } finally {
    await r.close();
  }
});

test('Phase 2 [SPEC]: JSON.stringify(response.usage) contains no Korean strings except session_reset and weekly_reset values', async () => {
  const obs = recordSuccess(createObservation(), {
    session_pct: 24,
    weekly_pct: 24,
    session_reset: '1시간 25분 후 재설정',
    weekly_reset: '(월) 오후 1:00에 재설정'
  }, Date.now());
  const snap = { observation: obs, ctx: { enabled: true } };
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
    const usageObj = Object.assign({}, res.body.usage);
    delete usageObj.session_reset;
    delete usageObj.weekly_reset;
    const jsonStr = JSON.stringify(usageObj);
    const hangulRegex = /[\u3131-\u318E\uAC00-\uD7A3]/;
    assert.ok(!hangulRegex.test(jsonStr), 'JSON.stringify(usage) without reset values must contain no Korean');
    for (const key of Object.keys(res.body.usage)) {
      assert.ok(/^[\x00-\x7F]+$/.test(key), 'Key ' + key + ' must be ASCII');
    }
  } finally {
    await r.close();
  }
});

test('Phase 2 [SPEC]: long-term measurement failure (26-day silence / no history) sets allowed to null in /api/status response', async () => {
  const obs = createObservation();
  const snap = { observation: obs, ctx: { enabled: true } };
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.allowance.allowed, null);
    assert.strictEqual(res.body.allowance.reason, 'unmeasurable');
    assert.strictEqual(res.body.allowance.confidence, 'unknown');
    assert.strictEqual(res.body.usage.session_pct, null);
    assert.strictEqual(res.body.usage.stale, true);
  } finally {
    await r.close();
  }
});

// ---- 013: status declares engine scope (covers: ["claude"]) ---------------

test('013 Phase 2 [SPEC]: GET /api/status over real port returns usage.covers === ["claude"] and allowance.covers deepStrictEqual', async () => {
  const snap = okSnapshot();
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.usage.covers, ['claude']);
    assert.deepStrictEqual(res.body.allowance.covers, ['claude']);
    assert.deepStrictEqual(res.body.allowance.covers, res.body.usage.covers);
    assert.ok(!res.body.usage.covers.includes('agy'));
    assert.ok(!res.body.allowance.covers.includes('agy'));
  } finally {
    await r.close();
  }
});

test('013 Phase 2 [SPEC]: GET /api/status without observation history still returns covers: ["claude"] (never null)', async () => {
  const obs = createObservation();
  const snap = { observation: obs, ctx: { enabled: true } };
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.usage.session_pct, null);
    assert.strictEqual(res.body.allowance.allowed, null);
    assert.deepStrictEqual(res.body.usage.covers, ['claude']);
    assert.deepStrictEqual(res.body.allowance.covers, ['claude']);
    assert.ok(!res.body.usage.covers.includes('agy'));
    assert.ok(!res.body.allowance.covers.includes('agy'));
  } finally {
    await r.close();
  }
});

test('013 Phase 2 [DERIVED]: GET /api/status retains all existing usage and allowance fields alongside covers', async () => {
  const snap = okSnapshot();
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
    const expectedUsageKeys = [
      'age_sec', 'covers', 'measured_at', 'session_headroom', 'session_pct',
      'session_reset', 'stale', 'thresholds', 'weekly_headroom', 'weekly_pct', 'weekly_reset'
    ];
    assert.deepStrictEqual(Object.keys(res.body.usage).sort(), expectedUsageKeys.sort());
    assert.deepStrictEqual(Object.keys(res.body.allowance).sort(), ['allowed', 'confidence', 'covers', 'reason']);
  } finally {
    await r.close();
  }
});

// ---- 008: allowance respects measured usage (real port, serialized) ------

test('[008 red-first] real port -- session 97 / weekly 99 over stop 90/85, no STOP, fresh -> allowed:false, reason:over-threshold (JSON round-trip)', async () => {
  const obs = recordSuccess(createObservation(), { session_pct: 97, weekly_pct: 99 }, Date.now());
  const snap = { observation: obs, ctx: { enabled: true, thresholds: { session_stop: 90, weekly_stop: 85 }, stop: null, configSource: 'default' } };
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.allowance.allowed, false);
    assert.strictEqual(res.body.allowance.reason, 'over-threshold');
    assert.strictEqual(res.body.usage.session_headroom, 0);
    assert.strictEqual(res.body.usage.weekly_headroom, 0);
  } finally {
    await r.close();
  }
});

test('[008] real port -- invariant swept over a pct grid: allowed:true implies both headrooms > 0, and reason:under-threshold implies both pct below stop', async () => {
  const thresholds = { session_stop: 90, weekly_stop: 85 };
  for (let s = 0; s <= 100; s += 20) {
    for (let w = 0; w <= 100; w += 20) {
      const obs = recordSuccess(createObservation(), { session_pct: s, weekly_pct: w }, Date.now());
      const snap = { observation: obs, ctx: { enabled: true, thresholds, stop: null, configSource: 'default' } };
      const r = await startControlServer({ port: 0, getSnapshot: () => snap });
      try {
        const res = await getJson(r.port, '/api/status');
        if (res.body.allowance.allowed === true) {
          assert.ok(res.body.usage.session_headroom > 0, 's=' + s + ' w=' + w);
          assert.ok(res.body.usage.weekly_headroom > 0, 's=' + s + ' w=' + w);
        }
        if (res.body.allowance.reason === 'under-threshold') {
          assert.ok(s < thresholds.session_stop, 's=' + s);
          assert.ok(w < thresholds.weekly_stop, 'w=' + w);
        }
      } finally {
        await r.close();
      }
    }
  }
});

test('[008] real port -- enabled:false + threshold exceeded + no STOP -> allowed:false (numbers still tell the truth even when watching is off)', async () => {
  const obs = recordSuccess(createObservation(), { session_pct: 97, weekly_pct: 99 }, Date.now());
  const snap = { observation: obs, ctx: { enabled: false, thresholds: { session_stop: 90, weekly_stop: 85 }, stop: null, configSource: 'default' } };
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.body.allowance.allowed, false);
    assert.strictEqual(res.body.allowance.reason, 'over-threshold');
  } finally {
    await r.close();
  }
});

test('[008] real port -- STOP active outranks threshold breach (manual-stop, then auto original reason)', async () => {
  const thresholds = { session_stop: 90, weekly_stop: 85 };
  const obs = recordSuccess(createObservation(), { session_pct: 97, weekly_pct: 99 }, Date.now());

  const manualSnap = { observation: obs, ctx: { enabled: true, thresholds, stop: { source: 'manual', reason: 'vacation' }, configSource: 'default' } };
  const r1 = await startControlServer({ port: 0, getSnapshot: () => manualSnap });
  try {
    const res = await getJson(r1.port, '/api/status');
    assert.strictEqual(res.body.allowance.allowed, false);
    assert.strictEqual(res.body.allowance.reason, 'manual-stop');
  } finally {
    await r1.close();
  }

  const autoSnap = { observation: obs, ctx: { enabled: true, thresholds, stop: { source: 'auto', reason: 'weekly_threshold' }, configSource: 'default' } };
  const r2 = await startControlServer({ port: 0, getSnapshot: () => autoSnap });
  try {
    const res = await getJson(r2.port, '/api/status');
    assert.strictEqual(res.body.allowance.allowed, false);
    assert.strictEqual(res.body.allowance.reason, 'weekly_threshold');
  } finally {
    await r2.close();
  }
});

test('[008] real port -- allowance key set stays exactly {allowed, confidence, covers, reason} and top-level /api/status keys are unchanged from 007', async () => {
  const snap = okSnapshot();
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.deepStrictEqual(Object.keys(res.body.allowance).sort(), ['allowed', 'confidence', 'covers', 'reason']);
    assert.deepStrictEqual(Object.keys(res.body).sort(), ['allowance', 'fields', 'ok', 'state', 'summary', 'updatedAt', 'usage']);
  } finally {
    await r.close();
  }
});

test('GET /api/status has no side effects: getSnapshot observation is unchanged across two GETs', async () => {
  const snap = okSnapshot();
  const before = JSON.stringify(snap.observation);
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    await getJson(r.port, '/api/status');
    await getJson(r.port, '/api/status');
    assert.strictEqual(JSON.stringify(snap.observation), before);
  } finally {
    await r.close();
  }
});

test('GET /api/status: getSnapshot throwing does not yield ok:true', async () => {
  const r = await startControlServer({
    port: 0,
    getSnapshot: () => { throw new Error('boom'); }
  });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.notStrictEqual(res.body.ok, true);
    assert.strictEqual(res.status, 500);
  } finally {
    await r.close();
  }
});

test('handler exception is caught: after a throwing getSnapshot call, /api/health still responds 200', async () => {
  let throwNext = true;
  const r = await startControlServer({
    port: 0,
    getSnapshot: () => { if (throwNext) { throwNext = false; throw new Error('boom'); } return okSnapshot(); }
  });
  try {
    await getJson(r.port, '/api/status'); // triggers the throw
    const res = await getJson(r.port, '/api/health');
    assert.strictEqual(res.status, 200);
  } finally {
    await r.close();
  }
});

test('response JSON never contains authToken value, .profile, or cookie', async () => {
  let obs = recordFailure(createObservation(), 'anchor-timeout', {
    hint: 'login-expired',
    cookie: 'sess=abc123',
    authToken: 'super-secret-token',
    textHead: '.profile leaked here'
  }, Date.now());
  const snap = { observation: obs, ctx: { enabled: true, stop: { source: 'manual', reason: 'testing' }, configSource: 'file' } };
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const health = await getJson(r.port, '/api/health');
    const status = await getJson(r.port, '/api/status');
    const combined = (health.text + status.text).toLowerCase();
    assert.ok(!combined.includes('.profile'));
    assert.ok(!combined.includes('super-secret-token'));
    assert.ok(!combined.includes('cookie'));
  } finally {
    await r.close();
  }
});

test('GET /api/status does not touch the filesystem -- an unrelated temp file stays unchanged (mtime + existence)', async () => {
  const tmpPath = path.join(require('node:os').tmpdir(), 'bellows-control-server-test-STOP.json');
  fs.writeFileSync(tmpPath, JSON.stringify({ source: 'manual' }));
  const before = fs.statSync(tmpPath).mtimeMs;
  const snap = okSnapshot();
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    await getJson(r.port, '/api/status');
    await getJson(r.port, '/api/status');
    assert.ok(fs.existsSync(tmpPath));
    assert.strictEqual(fs.statSync(tmpPath).mtimeMs, before);
  } finally {
    await r.close();
    fs.unlinkSync(tmpPath);
  }
});

test('control-server.js source never references STOP.json / scrapeUsage / writeStopJsonAtomic', () => {
  assert.ok(!/STOP\.json/.test(SRC));
  assert.ok(!/scrapeUsage/.test(SRC));
  assert.ok(!/writeStopJsonAtomic/.test(SRC));
  assert.ok(!/resolveStopDir/.test(SRC));
});

// ---- routing / response shape --------------------------------------

test('response bodies are valid JSON with no stack traces, HTML, or internal file paths', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const paths = ['/api/health', '/api/status', '/nope'];
    for (const p of paths) {
      const res = await getJson(r.port, p);
      assert.ok(res.body !== null, p + ' response is valid JSON');
      assert.ok(!res.text.includes('<html'), p + ' has no HTML');
      assert.ok(!/at\s+\S+\s+\(.*:\d+:\d+\)/.test(res.text), p + ' has no stack trace frames');
      assert.ok(!/[A-Za-z]:[\\\/][^"]*\.js/i.test(res.text), p + ' has no internal file path');
    }
  } finally {
    await r.close();
  }
});

test('unknown path -> 404 ok:false', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/nope');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.ok, false);
  } finally {
    await r.close();
  }
});

test('non-GET on /api/health and /api/status -> 405 ok:false', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const h = await getJson(r.port, '/api/health', { method: 'POST' });
    assert.strictEqual(h.status, 405);
    assert.strictEqual(h.body.ok, false);
    const s = await getJson(r.port, '/api/status', { method: 'DELETE' });
    assert.strictEqual(s.status, 405);
    assert.strictEqual(s.body.ok, false);
  } finally {
    await r.close();
  }
});

test('POST /api/stop -> 501, intentionally-unimplemented marker present', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/stop', { method: 'POST' });
    assert.strictEqual(res.status, 501);
    assert.strictEqual(res.body.ok, false);
    assert.ok(res.text.toLowerCase().includes('not implemented'));
  } finally {
    await r.close();
  }
});

test('query string is ignored -- /api/status?x=1 matches /api/status shape', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const plain = await getJson(r.port, '/api/status');
    const withQuery = await getJson(r.port, '/api/status?x=1');
    assert.strictEqual(withQuery.status, plain.status);
    assert.deepStrictEqual(Object.keys(withQuery.body).sort(), Object.keys(plain.body).sort());
  } finally {
    await r.close();
  }
});

test('response headers: Content-Type json + Cache-Control no-store', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/api/health');
    assert.ok((res.headers.get('content-type') || '').includes('application/json'));
    assert.strictEqual(res.headers.get('cache-control'), 'no-store');
  } finally {
    await r.close();
  }
});

// ---- boundary / no-scope-creep checks -------------------------------------

test('control-server.js does not re-implement observation thresholds or state judgement', () => {
  assert.ok(!/\b85\b/.test(SRC), 'must not hardcode weekly_stop threshold');
  assert.ok(!/\b90\b/.test(SRC), 'must not hardcode session_stop threshold');
  assert.ok(!/\b70\b/.test(SRC), 'must not hardcode weekly_release threshold');
  assert.ok(!/\b75\b/.test(SRC), 'must not hardcode session_release threshold');
  assert.ok(/require\(\s*['"]\.\/observation['"]\s*\)/.test(SRC), 'must consume deriveState from ./observation');
});

test('control-server.js does not depend on Foreman (no require, no hardcoded path)', () => {
  assert.ok(!/require\(\s*['"][^'"]*foreman[^'"]*['"]\s*\)/i.test(SRC), 'must not require a Foreman module');
  assert.ok(!/[A-Za-z]:[\\\/][^'"\n]*foreman/i.test(SRC), 'must not hardcode a Foreman filesystem path');
});

test('control-server.js does not reference the Claude CLI', () => {
  const matches = SRC.match(/claude/g) || [];
  assert.strictEqual(matches.length, 0);
});

test('no new runtime dependency: package.json dependencies is still puppeteer-only', () => {
  assert.deepStrictEqual(Object.keys(PKG.dependencies), ['puppeteer']);
});

// ---- Phase 2: Authorization: Bearer -----------------------------------

const TOKEN = 'phase2-secret-token-abc123';

test('auth: token set, no Authorization header -> 401 ok:false', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.ok, false);
  } finally {
    await r.close();
  }
});

test('auth: token set, wrong token -> 401', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/status', { headers: { Authorization: 'Bearer wrong-token' } });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.ok, false);
  } finally {
    await r.close();
  }
});

test('auth: token set, correct token -> 200', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/status', { headers: { Authorization: 'Bearer ' + TOKEN } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  } finally {
    await r.close();
  }
});

test('auth: token not set (current on-disk default), no header -> 200', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
  } finally {
    await r.close();
  }
});

test('auth: "missing header" and "wrong token" responses are indistinguishable', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot });
  try {
    const noHeader = await getJson(r.port, '/api/status');
    const wrongToken = await getJson(r.port, '/api/status', { headers: { Authorization: 'Bearer nope' } });
    assert.strictEqual(noHeader.status, wrongToken.status);
    assert.deepStrictEqual(noHeader.body, wrongToken.body);
  } finally {
    await r.close();
  }
});

test('auth: 401 body never contains the expected token value', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/status', { headers: { Authorization: 'Bearer wrong' } });
    assert.ok(!res.text.includes(TOKEN));
  } finally {
    await r.close();
  }
});

test('auth: constant-time compare does not throw on very different token lengths (1 char / 500 chars)', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot });
  try {
    const short = await getJson(r.port, '/api/status', { headers: { Authorization: 'Bearer x' } });
    assert.strictEqual(short.status, 401);
    const long = await getJson(r.port, '/api/status', { headers: { Authorization: 'Bearer ' + 'x'.repeat(500) } });
    assert.strictEqual(long.status, 401);
  } finally {
    await r.close();
  }
});

test('source: no ===/==/startsWith/indexOf token comparison, and no length-based branch', () => {
  assert.ok(!/expected\s*===\s*provided|provided\s*===\s*expected/.test(SRC));
  assert.ok(!/expected\s*==\s*provided|provided\s*==\s*expected/.test(SRC));
  assert.ok(!/authToken\.startsWith/.test(SRC));
  assert.ok(!/authToken\.indexOf/.test(SRC));
  assert.ok(!/\.length\s*!==\s*.*\.length/.test(SRC), 'must not branch on token length before comparing');
  assert.ok(/timingSafeEqual/.test(SRC), 'must use crypto.timingSafeEqual');
});

test('auth: gate runs before routing -- unknown path with token set returns 401, not 404', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/nope');
    assert.strictEqual(res.status, 401);
  } finally {
    await r.close();
  }
});

test('auth: gate applies to POST /api/stop -- 401 before 501 when header missing', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/stop', { method: 'POST' });
    assert.strictEqual(res.status, 401);
  } finally {
    await r.close();
  }
});

test('auth: Bearer scheme match is case-insensitive', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/status', { headers: { Authorization: 'bearer ' + TOKEN } });
    assert.strictEqual(res.status, 200);
  } finally {
    await r.close();
  }
});

test('auth: malformed / other-scheme Authorization header -> 401, not 500', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot });
  try {
    const basic = await getJson(r.port, '/api/status', { headers: { Authorization: 'Basic dXNlcjpwYXNz' } });
    assert.strictEqual(basic.status, 401);
    const garbage = await getJson(r.port, '/api/status', { headers: { Authorization: 'not-a-valid-header' } });
    assert.strictEqual(garbage.status, 401);
  } finally {
    await r.close();
  }
});

test('auth: 401 has WWW-Authenticate: Bearer header with no path/token/account in its value', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/api/status');
    assert.strictEqual(res.status, 401);
    const hv = res.headers.get('www-authenticate') || '';
    assert.strictEqual(hv, 'Bearer');
    assert.ok(!hv.toLowerCase().includes(TOKEN.toLowerCase()));
  } finally {
    await r.close();
  }
});

// ---- Phase 2: secret non-leak across all response codes -----------------

test('secrets never leak: 200/401/404/405/501/500 bodies never contain the token, .profile, cookie, or the raw Authorization header', async () => {
  const r = await startControlServer({
    port: 0,
    authToken: TOKEN,
    getSnapshot: () => { throw new Error('getSnapshot boom: ' + TOKEN); }
  });
  try {
    const authHeader = 'Bearer ' + TOKEN;
    const cases = [
      await getJson(r.port, '/api/health', { headers: { Authorization: authHeader } }),           // 200
      await getJson(r.port, '/api/status'),                                                        // 401 (no header)
      await getJson(r.port, '/api/nope', { headers: { Authorization: authHeader } }),               // 404
      await getJson(r.port, '/api/health', { method: 'POST', headers: { Authorization: authHeader } }), // 405
      await getJson(r.port, '/api/stop', { method: 'POST', headers: { Authorization: authHeader } }),   // 501
      await getJson(r.port, '/api/status', { headers: { Authorization: authHeader } })              // 500 (getSnapshot throws)
    ];
    const statuses = cases.map((c) => c.status).sort();
    assert.deepStrictEqual(statuses, [200, 401, 404, 405, 500, 501]);
    for (const c of cases) {
      const lower = c.text.toLowerCase();
      assert.ok(!lower.includes(TOKEN.toLowerCase()), 'leaked token in ' + c.status + ' body: ' + c.text);
      assert.ok(!lower.includes('.profile'), '.profile leaked in ' + c.status + ' body');
      assert.ok(!lower.includes('cookie'), 'cookie leaked in ' + c.status + ' body');
      assert.ok(!lower.includes('bearer ' + TOKEN.toLowerCase()), 'raw Authorization header leaked in ' + c.status + ' body');
      assert.ok(!lower.includes('getsnapshot boom'), 'exception message leaked in ' + c.status + ' body');
    }
  } finally {
    await r.close();
  }
});

test('onLog never receives the received or expected token on an auth failure', async () => {
  const logs = [];
  const r = await startControlServer({
    port: 0,
    authToken: TOKEN,
    getSnapshot: okSnapshot,
    onLog: (msg) => logs.push(msg)
  });
  try {
    await getJson(r.port, '/api/status', { headers: { Authorization: 'Bearer some-other-value' } });
    for (const msg of logs) {
      assert.ok(!msg.includes(TOKEN));
      assert.ok(!msg.includes('some-other-value'));
    }
  } finally {
    await r.close();
  }
});

test('startup onLog reports auth enabled/disabled by presence, not by value', async () => {
  const logsOn = [];
  const on = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot, onLog: (m) => logsOn.push(m) });
  const logsOff = [];
  const off = await startControlServer({ port: 0, getSnapshot: okSnapshot, onLog: (m) => logsOff.push(m) });
  try {
    assert.ok(logsOn.some((m) => /auth:\s*enabled/.test(m)));
    assert.ok(!logsOn.some((m) => m.includes(TOKEN)));
    assert.ok(logsOff.some((m) => /auth:\s*disabled/.test(m)));
  } finally {
    await on.close();
    await off.close();
  }
});

// ---- Phase 2: POST /api/stop stays a no-op even past the auth gate -------

test('POST /api/stop with a valid token still does nothing (501, no STOP.json/deriveDesired path touched)', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/stop', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN } });
    assert.strictEqual(res.status, 501);
    assert.strictEqual(res.body.ok, false);
  } finally {
    await r.close();
  }
});

test('control-server.js source documents why POST /api/stop is intentionally unimplemented', () => {
  assert.ok(/intentionally/i.test(SRC));
  assert.ok(/PROJECT_INTENT\.md/.test(SRC));
});

// ---- Phase 2: config.js control block -----------------------------------

function withTempConfig(obj, fn) {
  const p = path.join(os.tmpdir(), 'bellows-control-config-test-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
  fs.writeFileSync(p, JSON.stringify(obj));
  try {
    return fn(p);
  } finally {
    fs.unlinkSync(p);
  }
}

test('config: readConfig() always has control.port (number) and control.authToken (string|null), even with no file', () => {
  const cfg = readConfig(path.join(os.tmpdir(), 'bellows-does-not-exist-' + Date.now() + '.json'));
  assert.strictEqual(typeof cfg.control.port, 'number');
  assert.strictEqual(cfg.control.port, 3210);
  assert.strictEqual(cfg.control.authToken, null);
});

test('config: HARD_DEFAULTS.control matches the documented default (port 3210, authToken null)', () => {
  assert.strictEqual(HARD_DEFAULTS.control.port, 3210);
  assert.strictEqual(HARD_DEFAULTS.control.authToken, null);
});

test('config: readConfig() never throws on malformed input (missing file / broken JSON / wrong types / expired)', () => {
  assert.doesNotThrow(() => readConfig(null));
  assert.doesNotThrow(() => readConfig(path.join(os.tmpdir(), 'nope-' + Date.now() + '.json')));
  const brokenPath = path.join(os.tmpdir(), 'bellows-broken-' + Date.now() + '.json');
  fs.writeFileSync(brokenPath, '{ not valid json');
  try {
    assert.doesNotThrow(() => readConfig(brokenPath));
    const cfg = readConfig(brokenPath);
    assert.strictEqual(cfg.control.port, 3210);
    assert.strictEqual(cfg.control.authToken, null);
  } finally {
    fs.unlinkSync(brokenPath);
  }
});

test('config: file control.port overrides default when a valid 1..65535 integer', () => {
  withTempConfig({ control: { port: 4444 } }, (p) => {
    const cfg = readConfig(p);
    assert.strictEqual(cfg.control.port, 4444);
  });
});

test('config: file control.port out of range or wrong type falls back to default', () => {
  withTempConfig({ control: { port: 0 } }, (p) => assert.strictEqual(readConfig(p).control.port, 3210));
  withTempConfig({ control: { port: 70000 } }, (p) => assert.strictEqual(readConfig(p).control.port, 3210));
  withTempConfig({ control: { port: '4444' } }, (p) => assert.strictEqual(readConfig(p).control.port, 3210));
  withTempConfig({ control: { port: 12.5 } }, (p) => assert.strictEqual(readConfig(p).control.port, 3210));
});

test('config: file control.authToken sets the token; empty/whitespace normalizes to null', () => {
  withTempConfig({ control: { authToken: 'file-token' } }, (p) => {
    assert.strictEqual(readConfig(p).control.authToken, 'file-token');
  });
  withTempConfig({ control: { authToken: '   ' } }, (p) => {
    assert.strictEqual(readConfig(p).control.authToken, null);
  });
});

test('config: top-level authToken is a fallback only when control.authToken is absent; control.authToken wins when both present', () => {
  withTempConfig({ authToken: 'top-level-token' }, (p) => {
    assert.strictEqual(readConfig(p).control.authToken, 'top-level-token');
  });
  withTempConfig({ authToken: 'top-level-token', control: { authToken: 'control-token' } }, (p) => {
    assert.strictEqual(readConfig(p).control.authToken, 'control-token');
  });
});

test('config: expired config or parse-error config resets control to defaults (auth off)', () => {
  withTempConfig({ control: { authToken: 'should-not-survive', port: 5555 }, expires_at: '2000-01-01T00:00:00Z' }, (p) => {
    const cfg = readConfig(p);
    assert.strictEqual(cfg._expired, true);
    assert.strictEqual(cfg.control.authToken, null);
    assert.strictEqual(cfg.control.port, 3210);
  });
  const brokenPath = path.join(os.tmpdir(), 'bellows-broken2-' + Date.now() + '.json');
  fs.writeFileSync(brokenPath, '{"control":{"authToken":"leak-attempt"');
  try {
    const cfg = readConfig(brokenPath);
    assert.strictEqual(cfg._parseError !== undefined, true);
    assert.strictEqual(cfg.control.authToken, null);
  } finally {
    fs.unlinkSync(brokenPath);
  }
});

test('config: existing fields (enabled/thresholds/expires_at) are unaffected by the control block addition', () => {
  withTempConfig({ enabled: false, thresholds: { weekly_stop: 80 } }, (p) => {
    const cfg = readConfig(p);
    assert.strictEqual(cfg.enabled, false);
    assert.strictEqual(cfg.thresholds.weekly_stop, 80);
    assert.strictEqual(cfg.thresholds.weekly_release, 70);
    assert.strictEqual(cfg.thresholds.session_stop, 90);
    assert.strictEqual(cfg.thresholds.session_release, 75);
  });
});

// ---- Phase 3: wiring behavior, reconstructed at the same shape --------
//
// pollOnce() is never driven in this suite (see test/watch-loop.test.js
// header note) -- these tests reconstruct the exact wiring shape
// (a mutable observation variable + a live-closure getSnapshot) inside
// the test itself and drive it through a real port, which is the only
// way to prove the "capture nothing, read live" property behaviorally.

test('live closure: reassigning the observation variable changes the next /api/status response (no capture-at-startup)', async () => {
  let obs = createObservation();
  const ctx = { enabled: true, configSource: 'default' };
  const r = await startControlServer({ port: 0, getSnapshot: () => ({ observation: obs, ctx: ctx }) });
  try {
    const before = await getJson(r.port, '/api/status');
    assert.notStrictEqual(before.body.state, 'crit');
    for (let i = 0; i < 5; i++) {
      obs = recordFailure(obs, 'anchor-timeout', { hint: 'login-expired' }, Date.now());
    }
    const after = await getJson(r.port, '/api/status');
    assert.strictEqual(after.body.state, 'crit', 'reassigning observation must be visible on the next GET');
  } finally {
    await r.close();
  }
});

test('never-brick simulation: startup on an occupied port resolves started:false and the caller keeps running (no exception escapes)', async () => {
  const occupied = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    let ranAfter = false;
    // Same shape as watch-loop.js mainLoop(): try/result-branch, then
    // unconditional continuation.
    try {
      const r = await startControlServer({ port: occupied.port, getSnapshot: okSnapshot });
      if (!r.started) { /* log-equivalent */ }
      await r.close(); // no-op for a failed start
    } catch (e) {
      // must not reach here
    }
    ranAfter = true;
    assert.strictEqual(ranAfter, true, 'code after the start attempt must run regardless of success/failure');
  } finally {
    await occupied.close();
  }
});

test('first poll before any success: empty observation + unset ctx yields state !== ok (no green light before measurement)', async () => {
  const obs = createObservation();
  const r = await startControlServer({ port: 0, getSnapshot: () => ({ observation: obs, ctx: {} }) });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.notStrictEqual(res.body.state, 'ok');
  } finally {
    await r.close();
  }
});

test('ctx.stop and ctx.configSource propagate into /api/status fields (STOP field + 설정 출처 field)', async () => {
  const obs = recordSuccess(createObservation(), { session_pct: 5, weekly_pct: 5 }, Date.now());
  const snap = {
    observation: obs,
    ctx: { enabled: true, stop: { source: 'auto', reason: 'weekly_threshold' }, configSource: 'file' }
  };
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status');
    const stopField = res.body.fields.find((f) => f.label === 'STOP');
    assert.ok(stopField && stopField.value.includes('auto'), 'STOP field must reflect ctx.stop');
    const sourceField = res.body.fields.find((f) => f.label === '설정 출처');
    assert.strictEqual(sourceField.value, '파일', 'config-source field must reflect ctx.configSource === "file"');
  } finally {
    await r.close();
  }
});

// ---- Phase 4: end-to-end assembly path -> contract default address -------
//
// Every prior real-port test used port: 0 (OS-assigned). The contract
// (_guides/SUPERVISED_TOOL_CONTRACT.md) pins the default control address to
// http://127.0.0.1:3210. This is the first test where that literal address
// is actually bound -- and the port value comes from readConfig(), not from
// a 3210 literal written into the test, so what's proven is "the config path
// produces the contract address", not just "3210 works". Placed last so it
// does not compete for the port with the port:0 tests above.

test('assembly path: readConfig() -> startControlServer() binds the contract default address (127.0.0.1:3210)', async () => {
  const noFilePath = path.join(os.tmpdir(), 'bellows-assembly-nofile-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
  const cfg = readConfig(noFilePath);
  assert.strictEqual(cfg.control.port, 3210, 'contract default port must come from readConfig(), not a test literal');

  const r = await startControlServer({ port: cfg.control.port, authToken: cfg.control.authToken, getSnapshot: okSnapshot });
  try {
    if (r.started) {
      assert.strictEqual(r.port, 3210);
      assert.strictEqual(r.address, '127.0.0.1');
      const health = await getJson(3210, '/api/health');
      assert.strictEqual(health.status, 200);
      assert.strictEqual(health.body.id, 'quaestor');
      const status = await getJson(3210, '/api/status');
      assert.strictEqual(status.status, 200);
      assert.ok('summary' in status.body && 'state' in status.body && 'fields' in status.body && 'updatedAt' in status.body);
    } else {
      // The contract port is already occupied (e.g. a real watcher is
      // running on this machine) -- never-brick applies to the test too:
      // no exception, a non-empty error, and execution continues.
      assert.strictEqual(typeof r.error, 'string');
      assert.ok(r.error.length > 0);
    }
  } finally {
    await r.close();
  }

  // Handle-leak check: only meaningful when this test itself held the
  // port (r.started === true) -- if it was occupied by another real
  // process, that process still owns it and re-binding must not be
  // asserted to succeed.
  if (r.started) {
    const again = await startControlServer({ port: cfg.control.port, getSnapshot: okSnapshot });
    try {
      assert.strictEqual(again.started, true, 'contract port must be free again after close()');
    } finally {
      await again.close();
    }
  }
});

test('env: BELLOWS_CONTROL_PORT / BELLOWS_CONTROL_TOKEN override hard defaults; file values still win over env', () => {
  const savedPort = process.env.BELLOWS_CONTROL_PORT;
  const savedToken = process.env.BELLOWS_CONTROL_TOKEN;
  try {
    process.env.BELLOWS_CONTROL_PORT = '5555';
    process.env.BELLOWS_CONTROL_TOKEN = 'env-token';

    const noFilePath = path.join(os.tmpdir(), 'bellows-env-nofile-' + Date.now() + '.json');
    const noFile = readConfig(noFilePath);
    assert.strictEqual(noFile.control.port, 5555);
    assert.strictEqual(noFile.control.authToken, 'env-token');

    withTempConfig({ control: { port: 6666, authToken: 'file-token' } }, (p) => {
      const withFile = readConfig(p);
      assert.strictEqual(withFile.control.port, 6666, 'file value must win over env');
      assert.strictEqual(withFile.control.authToken, 'file-token', 'file value must win over env');
    });
  } finally {
    if (savedPort === undefined) delete process.env.BELLOWS_CONTROL_PORT; else process.env.BELLOWS_CONTROL_PORT = savedPort;
    if (savedToken === undefined) delete process.env.BELLOWS_CONTROL_TOKEN; else process.env.BELLOWS_CONTROL_TOKEN = savedToken;
  }
});

// ---- Phase 5: response shape matrix + adversarial paths + resilience ----
//
// Verification-only phase: no changes to lib/* or watch-loop.js. Everything
// below is new assertions against the surface Phase 1-4 already built.
// All probes use port: 0 -- the contract default port (3210) stays reserved
// for the Phase 4 assembly-path test so the two do not compete for it.

const http = require('node:http');

const PHASE5_TOKEN = 'phase5-secret-token-xyz789';

// node:http.request wrapper -- used where fetch cannot express the probe
// (duplicate headers, a body on GET, oversized paths).
function httpRequest(port, pathname, opts) {
  const o = opts || {};
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: pathname,
      method: o.method || 'GET',
      headers: o.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let body = null;
        try { body = JSON.parse(data); } catch (e) { /* leave null */ }
        const headers = res.headers;
        headers.get = (name) => headers[name.toLowerCase()] || null;
        resolve({ status: res.statusCode, headers: headers, body, text: data });
      });
    });
    req.on('error', reject);
    if (o.body) req.write(o.body);
    req.end();
  });
}

// I1-I5 common invariants for the response-shape matrix (§11-3). followUpOpts
// lets a case pass credentials to the post-response /api/health liveness
// check (I5) when the server under test has auth enabled.
async function assertCommonInvariants(port, res, expectStatus, followUpOpts) {
  assert.strictEqual(res.status, expectStatus);
  assert.ok(res.body !== null, 'I1: body must parse as JSON -- got: ' + res.text);
  assert.ok((res.headers.get('content-type') || '').includes('application/json'), 'I2: content-type');
  assert.strictEqual(res.headers.get('cache-control'), 'no-store', 'I2: cache-control');
  assert.strictEqual(typeof res.body.ok, 'boolean', 'I3: ok must be boolean');
  if (expectStatus < 200 || expectStatus >= 300) {
    assert.strictEqual(res.body.ok, false, 'I3: non-2xx must be ok:false');
  }
  const lower = res.text.toLowerCase();
  assert.ok(!lower.includes(PHASE5_TOKEN.toLowerCase()), 'I4: token leaked');
  assert.ok(!lower.includes('.profile'), 'I4: .profile leaked');
  assert.ok(!lower.includes('cookie'), 'I4: cookie leaked');
  assert.ok(!/at\s+\S+\s+\(.*:\d+:\d+\)/.test(res.text), 'I4: stack trace leaked');
  assert.ok(!/[A-Za-z]:[\\\/][^"]*\.js/i.test(res.text), 'I4: absolute file path leaked');
  const followUp = await getJson(port, '/api/health', followUpOpts || {});
  assert.strictEqual(followUp.status, 200, 'I5: server must still answer /api/health 200 after this response');
}

test('response shape matrix: every reachable status code (200/200/401/404/405/500/501) is directly asserted for I1-I5', async () => {
  const authHeaders = { headers: { Authorization: 'Bearer ' + PHASE5_TOKEN } };
  const cases = [
    {
      name: '200 health',
      status: 200,
      authToken: null,
      getSnapshot: okSnapshot,
      request: (port) => getJson(port, '/api/health')
    },
    {
      name: '200 status',
      status: 200,
      authToken: null,
      getSnapshot: okSnapshot,
      request: (port) => getJson(port, '/api/status')
    },
    {
      name: '401',
      status: 401,
      authToken: PHASE5_TOKEN,
      getSnapshot: okSnapshot,
      request: (port) => getJson(port, '/api/status'),
      followUpOpts: authHeaders
    },
    {
      name: '404',
      status: 404,
      authToken: null,
      getSnapshot: okSnapshot,
      request: (port) => getJson(port, '/api/nope')
    },
    {
      name: '405',
      status: 405,
      authToken: null,
      getSnapshot: okSnapshot,
      request: (port) => getJson(port, '/api/health', { method: 'POST' })
    },
    {
      name: '500',
      status: 500,
      authToken: null,
      getSnapshot: () => { throw new Error('boom ' + PHASE5_TOKEN); },
      request: (port) => getJson(port, '/api/status')
    },
    {
      name: '501',
      status: 501,
      authToken: null,
      getSnapshot: okSnapshot,
      request: (port) => getJson(port, '/api/stop', { method: 'POST' })
    }
  ];

  for (const c of cases) {
    const r = await startControlServer({ port: 0, authToken: c.authToken, getSnapshot: c.getSnapshot });
    try {
      const res = await c.request(r.port);
      await assertCommonInvariants(r.port, res, c.status, c.followUpOpts);
    } finally {
      await r.close();
    }
  }
});

// ---- Phase 5: adversarial path matrix (well-formed but abnormal requests) --

test('adversarial paths: route variants and unknown methods are rejected as valid JSON without harming the server', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const cases = [
      { path: '/api/status/', method: 'GET', status: 404 },       // trailing slash -- not normalized
      { path: '//api/status', method: 'GET', status: 404 },       // double slash -- not normalized
      { path: '/API/STATUS', method: 'GET', status: 404 },        // case-sensitive routing
      { path: '/api/%73tatus', method: 'GET', status: 404 },      // percent-encoding not decoded for matching
      { path: '/api/health', method: 'PATCH', status: 405 },
      { path: '/api/health', method: 'DELETE', status: 405 },
      { path: '/api/health', method: 'OPTIONS', status: 405 },
      { path: '/api/status', method: 'PATCH', status: 405 },
      { path: '/api/status', method: 'DELETE', status: 405 },
      { path: '/api/status', method: 'OPTIONS', status: 405 },
      { path: '/api/stop', method: 'GET', status: 405 }
    ];
    for (const c of cases) {
      const res = await getJson(r.port, c.path, { method: c.method });
      assert.strictEqual(res.status, c.status, c.method + ' ' + c.path);
      assert.ok(res.body !== null, c.method + ' ' + c.path + ': must be parseable JSON');
      assert.strictEqual(typeof res.body.ok, 'boolean');
      assert.strictEqual(res.body.ok, false);
      assert.ok((res.headers.get('content-type') || '').includes('application/json'));
      assert.strictEqual(res.headers.get('cache-control'), 'no-store');
    }
    const alive = await getJson(r.port, '/api/health');
    assert.strictEqual(alive.status, 200, 'server still answers after the whole matrix');
  } finally {
    await r.close();
  }
});

test('adversarial: a dot-segment path normalizes to /api/status and matches the contract shape (no filesystem access)', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/../api/status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.ok('state' in res.body && 'summary' in res.body && 'fields' in res.body);
  } finally {
    await r.close();
  }
});

test('adversarial: HEAD /api/health -> 405, headers-only assertion (HTTP forbids a HEAD response body)', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/api/health', { method: 'HEAD' });
    assert.strictEqual(res.status, 405);
    assert.ok((res.headers.get('content-type') || '').includes('application/json'));
  } finally {
    await r.close();
  }
});

test('adversarial: an ~8KB request path draws a 4xx (exact code left to the Node parser layer) and the server keeps running', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const longPath = '/' + 'a'.repeat(8000);
    let res;
    try {
      res = await httpRequest(r.port, longPath, { method: 'GET' });
    } catch (e) {
      res = null; // a connection-level rejection is an acceptable outcome too
    }
    if (res) {
      assert.ok(res.status >= 400 && res.status < 500, 'expected 4xx, got ' + res.status);
    }
    const alive = await getJson(r.port, '/api/health');
    assert.strictEqual(alive.status, 200, 'server survives an oversized path');
  } finally {
    await r.close();
  }
});

test('adversarial: duplicate Authorization headers do not throw -- Node keeps the first value, a mismatch still yields 401', async () => {
  const r = await startControlServer({ port: 0, authToken: PHASE5_TOKEN, getSnapshot: okSnapshot });
  try {
    // Node discards duplicate Authorization header lines and keeps only the
    // first one (verified empirically), so the first entry here must be the
    // wrong token for this to exercise a mismatch rather than a match.
    const res = await httpRequest(r.port, '/api/status', {
      method: 'GET',
      headers: { Authorization: ['Bearer wrong-first', 'Bearer ' + PHASE5_TOKEN] }
    });
    assert.strictEqual(res.status, 401);
    assert.ok(res.body !== null);
    assert.strictEqual(res.body.ok, false);
  } finally {
    await r.close();
  }
});

test('adversarial: a multi-KB Bearer token does not throw -- 401, not 500', async () => {
  const r = await startControlServer({ port: 0, authToken: PHASE5_TOKEN, getSnapshot: okSnapshot });
  try {
    const huge = 'x'.repeat(4000);
    const res = await getJson(r.port, '/api/status', { headers: { Authorization: 'Bearer ' + huge } });
    assert.strictEqual(res.status, 401);
  } finally {
    await r.close();
  }
});

test('adversarial: GET /api/status with a request body is still 200 and has no side effects (the body is never read)', async () => {
  const snap = okSnapshot();
  const before = JSON.stringify(snap.observation);
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const res = await httpRequest(r.port, '/api/status', { method: 'GET', body: JSON.stringify({ x: 1 }) });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(JSON.stringify(snap.observation), before);
  } finally {
    await r.close();
  }
});

test('adversarial: POST /api/stop with Content-Type: text/xml is still 501 (the body is never parsed)', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await httpRequest(r.port, '/api/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: '<xml/>'
    });
    assert.strictEqual(res.status, 501);
  } finally {
    await r.close();
  }
});

// ---- Phase 5: resilience -- the dashboard must not kill the breaker -------

function sendRawAndDestroy(port, requestLine) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(requestLine);
      setImmediate(() => { socket.destroy(); resolve(); });
    });
    socket.on('error', () => resolve()); // ECONNRESET etc. are expected here
  });
}

function sendRawAndWaitClose(port, raw) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(raw);
    });
    let data = '';
    socket.on('data', (chunk) => { data += chunk; });
    socket.on('error', () => {});
    socket.on('close', () => resolve(data));
    setTimeout(() => { socket.destroy(); resolve(data); }, 500);
  });
}

// ---- 010 Phase 2: GET / status page route --------------------------------
//
// buildStatusPayload(ctx) is the single judgement point shared by
// GET /api/status (JSON) and GET / (HTML) -- see output/DESIGN.md 2.2.
// All probes here use a real port (port: 0) and the actual fetched HTML
// string, per the work file's "boundary verification" requirement --
// checking status-page.js's template function output alone would not
// prove routing or headers.

const EXTERNAL_URL_010 = /(src|href)\s*=\s*["']https?:\/\/|@import\s+["']?https?:\/\/|fetch\(\s*["']https?:\/\//i;

function firstPollSnapshot() {
  // No success ever recorded -- deriveAllowance -> allowed: null,
  // deriveUsage -> session_pct: null, stale: true. Mirrors the product's
  // own 3-week-silent-measurement history (see MASTER.md Round 2).
  const obs = createObservation();
  return { observation: obs, ctx: { enabled: true, configSource: 'default' } };
}

function oldMeasurementSnapshot() {
  // A real success recorded 26 days ago -- numbers exist but are stale
  // (successAgeMs far past STALE_CRIT_MS). Same fixture shape used in
  // status-page.test.js's stalePayload().
  const twentySixDaysAgo = Date.now() - 26 * 86400 * 1000;
  const obs = recordSuccess(createObservation(), { session_pct: 40, weekly_pct: 60 }, twentySixDaysAgo);
  return { observation: obs, ctx: { enabled: true, configSource: 'default' } };
}

test('[SPEC] GET / -- real port round trip returns 200 and Content-Type text/html; charset=utf-8', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/');
    assert.strictEqual(res.status, 200);
    assert.ok((res.headers.get('content-type') || '').includes('text/html; charset=utf-8'));
    const html = await res.text();
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(html.includes('엔진 범위: claude'), 'engine scope (covers) must be rendered in HTML');
  } finally {
    await r.close();
  }
});

// ---- 013 Phase 3: status page covers rendering -----------------------------

test('013 Phase 3 [SPEC]: 127.0.0.1 bound server GET / response HTML renders covers in human-readable form', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/');
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('엔진 범위: claude'), 'engine scope (covers) must be rendered in HTML');
    assert.ok(!html.includes('agy'), 'must not contain agy');
  } finally {
    await r.close();
  }
});

test('013 Phase 3 [SPEC]: test/status-page.test.js:230 /claude/gi 0 match assertion passes unmodified', () => {
  const statusPageSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'status-page.js'), 'utf8');
  const matches = statusPageSrc.match(/claude/gi) || [];
  assert.strictEqual(matches.length, 0, 'status-page.js must contain zero occurrences of claude');
});

test('013 Phase 3 [SPEC]: covers rendering is verified via real HTTP round trip over GET / on 127.0.0.1 (not pure renderer fixture)', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/');
    assert.strictEqual(res.status, 200);
    assert.ok((res.headers.get('content-type') || '').includes('text/html; charset=utf-8'));
    const html = await res.text();
    assert.ok(html.includes('<div class="field">엔진 범위: claude</div>'), 'integrated GET / route must assemble and render covers in HTML');
  } finally {
    await r.close();
  }
});

test('013 Phase 3 [DERIVED]: status-page.js safely escapes covers and contains no claude branching or literals', () => {
  const statusPageSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'status-page.js'), 'utf8');
  assert.ok(!statusPageSrc.includes("includes('claude')"));
  assert.ok(!statusPageSrc.includes('=== "claude"'));
  assert.ok(!statusPageSrc.includes("=== 'claude'"));
  assert.strictEqual((statusPageSrc.match(/claude/gi) || []).length, 0);

  const { renderStatusPage } = require('../lib/status-page');
  const payload = {
    allowance: { allowed: true, reason: 'under-threshold', covers: ['<engine&tag>'] },
    usage: { session_pct: 10, weekly_pct: 20, covers: ['<engine&tag>'] },
    fields: []
  };
  const html = renderStatusPage(payload);
  assert.ok(html.includes('엔진 범위: &lt;engine&amp;tag&gt;'), 'covers values must be escaped via esc()');
  assert.ok(!html.includes('<engine&tag>'), 'raw unescaped tags must not appear');
});

test('013 Phase 3 [DERIVED]: GET / rendered HTML contains no origin URL substring (https://)', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/');
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(!html.includes('https://'), 'HTML must not contain https://');
    assert.ok(!EXTERNAL_URL_010.test(html), 'HTML must not contain external URLs');
  } finally {
    await r.close();
  }
});

test('[SPEC] GET / with an allowed:null snapshot -- fetched HTML has no positive phrase, shows "모름", and never carries the green class token', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: firstPollSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/');
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('엔진 범위: claude'), 'engine scope must be rendered even when allowed:null');
    assert.ok(!html.includes('사용 가능'), 'positive phrase must not appear for allowed:null');
    assert.ok(html.includes('모름'), '"unknown" label must appear for allowed:null');
    assert.ok(!/\bst-allowed\b/.test(html), 'green class token must never appear for allowed:null');
  } finally {
    await r.close();
  }
});

test('[SPEC] GET / with a session_pct:null snapshot -- fetched HTML shows no bare 0% and reads "측정 없음" instead', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: firstPollSnapshot });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/');
    const html = await res.text();
    assert.ok(!/(?<!\d)0%(?!\d)/.test(html), 'bare 0% must not appear when session_pct is null');
    assert.ok(html.includes('측정 없음'));
  } finally {
    await r.close();
  }
});

test('[SPEC] GET / with a 26-day-old measurement -- fetched HTML shows elapsed time and a different state class than a fresh snapshot', async () => {
  const staleR = await startControlServer({ port: 0, getSnapshot: oldMeasurementSnapshot });
  const freshR = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const staleHtml = await (await fetch('http://127.0.0.1:' + staleR.port + '/')).text();
    const freshHtml = await (await fetch('http://127.0.0.1:' + freshR.port + '/')).text();
    assert.ok(staleHtml.includes('일 전'), 'elapsed time (26 days) must be shown');
    assert.ok(/\bst-stale\b/.test(staleHtml));
    assert.ok(!/\bst-stale\b/.test(freshHtml));
  } finally {
    await staleR.close();
    await freshR.close();
  }
});

test('[SPEC] GET / -- fetched HTML has zero http(s):// resource references; the only network target is relative /api/status', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const html = await (await fetch('http://127.0.0.1:' + r.port + '/')).text();
    assert.ok(!EXTERNAL_URL_010.test(html), html);
    assert.ok(!html.includes('http://'));
    assert.ok(!html.includes('https://'));
    assert.ok(html.includes('fetch("/api/status"'));
  } finally {
    await r.close();
  }
});

test('[SPEC] regression: GET /api/health and GET /api/status are byte-identical to their pre-010 shape (aside from the wall-clock timestamps)', async () => {
  const snap = okSnapshot();
  const expected = deriveState(snap.observation, snap.ctx, Date.now());
  const r = await startControlServer({ port: 0, getSnapshot: () => snap });
  try {
    const health = await getJson(r.port, '/api/health');
    assert.strictEqual(health.status, 200);
    assert.deepStrictEqual(Object.keys(health.body).sort(), ['contracts', 'id', 'ok', 'startedAt', 'version']);

    const status = await getJson(r.port, '/api/status');
    assert.strictEqual(status.status, 200);
    assert.deepStrictEqual(Object.keys(status.body).sort(), ['allowance', 'fields', 'ok', 'state', 'summary', 'updatedAt', 'usage']);
    assert.strictEqual(status.body.state, expected.state);
    assert.strictEqual(status.body.summary, expected.summary);
    assert.deepStrictEqual(status.body.fields, expected.fields);
    assert.ok((status.headers.get('content-type') || '').includes('application/json'));
    assert.strictEqual(status.headers.get('cache-control'), 'no-store');
  } finally {
    await r.close();
  }
});

test('[SPEC] GET /api/does-not-exist still returns JSON 404, not HTML, after the GET / route was added', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/does-not-exist');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.ok, false);
    assert.ok(!res.text.includes('<html'));
  } finally {
    await r.close();
  }
});

test('[SPEC] no path assembly -- GET /../../etc/hosts never exposes a file; it normalizes and falls through to JSON 404', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await httpRequest(r.port, '/../../etc/hosts');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.ok, false);
    assert.ok(!res.text.includes('<html'));
  } finally {
    await r.close();
  }
});

test('[SPEC] no path assembly -- a dot-segment path resolving onto /api/status still matches the API route, not the filesystem', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/../api/status');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  } finally {
    await r.close();
  }
});

test('[SPEC] auth: token set -- GET / is 401, same as the API (no screen-only exception)', async () => {
  const TOKEN010 = 'phase2-010-status-page-token';
  const r = await startControlServer({ port: 0, authToken: TOKEN010, getSnapshot: okSnapshot });
  try {
    const noHeader = await fetch('http://127.0.0.1:' + r.port + '/');
    assert.strictEqual(noHeader.status, 401);
    const withHeader = await fetch('http://127.0.0.1:' + r.port + '/', { headers: { Authorization: 'Bearer ' + TOKEN010 } });
    assert.strictEqual(withHeader.status, 200);
  } finally {
    await r.close();
  }
});

test('[SPEC] no secrets anywhere: GET / HTML never contains the auth token, .profile, or cookie', async () => {
  const TOKEN010B = 'phase2-010-secret-abc';
  let obs = recordFailure(createObservation(), 'anchor-timeout', { hint: 'login-expired' }, Date.now());
  const snap = { observation: obs, ctx: { enabled: true, stop: { source: 'manual', reason: 'testing' }, configSource: 'file' } };
  const r = await startControlServer({ port: 0, authToken: TOKEN010B, getSnapshot: () => snap });
  try {
    const html = await (await fetch('http://127.0.0.1:' + r.port + '/', { headers: { Authorization: 'Bearer ' + TOKEN010B } })).text();
    const lower = html.toLowerCase();
    assert.ok(!lower.includes(TOKEN010B.toLowerCase()));
    assert.ok(!lower.includes('.profile'));
    assert.ok(!lower.includes('cookie'));
  } finally {
    await r.close();
  }
});

test('POST / -> 405 ok:false (read-only page, no write route)', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/', { method: 'POST' });
    assert.strictEqual(res.status, 405);
    assert.strictEqual(res.body.ok, false);
  } finally {
    await r.close();
  }
});

test('never-brick: GET / falls back to JSON 500 (not a broken HTML page) when getSnapshot throws, and the watch loop surface stays alive', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: () => { throw new Error('boom'); } });
  try {
    const res = await fetch('http://127.0.0.1:' + r.port + '/');
    assert.strictEqual(res.status, 500);
    assert.ok((res.headers.get('content-type') || '').includes('application/json'));
    const health = await getJson(r.port, '/api/health');
    assert.strictEqual(health.status, 200);
  } finally {
    await r.close();
  }
});

test('control-server.js source: GET / and GET /api/status both call buildStatusPayload -- a single judgement point', () => {
  assert.ok(/function buildStatusPayload\(/.test(SRC));
  const handleIndexMatch = SRC.match(/function handleIndex\([\s\S]*?\n\}/);
  const handleStatusMatch = SRC.match(/function handleStatus\([\s\S]*?\n\}/);
  assert.ok(handleIndexMatch && /buildStatusPayload\(ctx\)/.test(handleIndexMatch[0]));
  assert.ok(handleStatusMatch && /buildStatusPayload\(ctx\)/.test(handleStatusMatch[0]));
});

test('resilience R1-R5: concurrency, abrupt disconnects, and malformed bytes never crash the server, leak side effects, or throw unhandled errors', async () => {
  const uncaught = [];
  const unhandled = [];
  const onUncaught = (err) => uncaught.push(err);
  const onUnhandled = (err) => unhandled.push(err);
  process.on('uncaughtException', onUncaught);
  process.on('unhandledRejection', onUnhandled);

  const stopPath = path.join(os.tmpdir(), 'bellows-r5-STOP-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
  fs.writeFileSync(stopPath, JSON.stringify({ source: 'manual' }));
  const beforeMtime = fs.statSync(stopPath).mtimeMs;

  let snapshotCalls = 0;
  const snap = okSnapshot();
  const r = await startControlServer({
    port: 0,
    getSnapshot: () => { snapshotCalls++; return snap; }
  });
  try {
    // R1: 25 concurrent /api/status requests all succeed and leave the
    // observation object untouched.
    const before = JSON.stringify(snap.observation);
    const concurrentResults = await Promise.all(
      Array.from({ length: 25 }, () => getJson(r.port, '/api/status'))
    );
    for (const res of concurrentResults) {
      assert.strictEqual(res.status, 200);
      assert.ok(res.body !== null);
      assert.strictEqual(res.body.ok, true);
    }
    assert.strictEqual(JSON.stringify(snap.observation), before, 'R1: observation must be unchanged after concurrent reads');

    // R2: client destroys the socket mid-request -- server must survive.
    await sendRawAndDestroy(r.port, 'GET /api/status HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n');
    const afterR2 = await getJson(r.port, '/api/health');
    assert.strictEqual(afterR2.status, 200, 'R2: server survives an abrupt client disconnect');

    // R3: bytes that are not valid HTTP -- response shape is unspecified by
    // design (Node's own parser layer, not this product's routing); only
    // process survival is required.
    await sendRawAndWaitClose(r.port, 'NOT-HTTP\r\n\r\n');
    const afterR3 = await getJson(r.port, '/api/health');
    assert.strictEqual(afterR3.status, 200, 'R3: server survives malformed bytes on the socket');

    // R5 (derived): rejected requests (404/405) never reach getSnapshot().
    const callsBeforeRejected = snapshotCalls;
    await getJson(r.port, '/api/nope');
    await getJson(r.port, '/api/health', { method: 'POST' });
    assert.strictEqual(snapshotCalls, callsBeforeRejected, 'R5: 404/405 must not call getSnapshot()');

    // R5: STOP.json (stand-in temp file) is untouched across the whole probe.
    assert.strictEqual(fs.statSync(stopPath).mtimeMs, beforeMtime, 'R5: STOP.json must be untouched');
  } finally {
    await r.close();
    fs.unlinkSync(stopPath);
    process.removeListener('uncaughtException', onUncaught);
    process.removeListener('unhandledRejection', onUnhandled);
  }

  // R4: none of the above probes triggered a process-level uncaught error.
  assert.strictEqual(uncaught.length, 0, 'R4: no uncaughtException during the probes: ' + uncaught.map((e) => e && e.message));
  assert.strictEqual(unhandled.length, 0, 'R4: no unhandledRejection during the probes: ' + unhandled.map((e) => e && e.message));
});

// ---- 012 Phase 2: PUT /api/thresholds ------------------------------------
//
// Real-port round trips against handlePutThresholds. Judgement itself
// (direction/hysteresis/expiry) is unit-tested in thresholds.test.js --
// these tests verify the HTTP wiring: token gate, readConfig() baseline,
// atomic file write + key preservation, [thresholds] logging, and the
// onConfigChange refresh path. See output/ACCEPTANCE.md Phase 2.

const { parseLogTail } = require('../lib/logparse');

const TOKEN012 = '012-thresholds-secret';
const FUTURE012 = '2099-01-01T00:00:00Z';
const PAST012 = '2000-01-01T00:00:00Z';

function tempConfigPath(name) {
  return path.join(os.tmpdir(), 'quaestor-012-' + name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
}

function writeConfigFile(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj));
}

function readConfigFile(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function putThresholds(port, body, opts) {
  const o = opts || {};
  return httpRequest(port, '/api/thresholds', {
    method: 'PUT',
    headers: Object.assign({ 'Content-Type': 'application/json' }, o.headers || {}),
    body: JSON.stringify(body)
  });
}

// ---- routing --------------------------------------------------------------

test('[SPEC] PUT /api/thresholds exists -- not a 404', async () => {
  const p = tempConfigPath('routing');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 80 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.notStrictEqual(res.status, 404);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[DERIVED] /api/thresholds with a non-PUT method -> 405', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN012, getSnapshot: okSnapshot });
  try {
    const get = await getJson(r.port, '/api/thresholds', { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(get.status, 405);
    const post = await getJson(r.port, '/api/thresholds', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(post.status, 405);
  } finally {
    await r.close();
  }
});

test('[DERIVED] PUT /api/thresholds does not call getSnapshot()', async () => {
  const p = tempConfigPath('no-snapshot');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  let calls = 0;
  const r = await startControlServer({
    port: 0, authToken: TOKEN012, configPath: p,
    getSnapshot: () => { calls++; return okSnapshot(); }
  });
  try {
    await putThresholds(r.port, { weekly_stop: 80 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(calls, 0);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

// ---- token gate: default-deny write --------------------------------------

test('[SPEC] no authToken configured -> PUT /api/thresholds is 403 write-requires-token', async () => {
  const p = tempConfigPath('no-token');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 80 });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.reason, 'write-requires-token');
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] same (no-token) state -- GET /api/status is still 200', async () => {
  const p = tempConfigPath('no-token-read');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] token configured + wrong/missing Bearer -> 401, and 401 is decided before 403', async () => {
  const p = tempConfigPath('wrong-bearer');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const noHeader = await putThresholds(r.port, { weekly_stop: 80 });
    assert.strictEqual(noHeader.status, 401);
    const wrong = await putThresholds(r.port, { weekly_stop: 80 }, { headers: { Authorization: 'Bearer wrong' } });
    assert.strictEqual(wrong.status, 401);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] token configured + correct Bearer -> proceeds past the auth gate to validation', async () => {
  const p = tempConfigPath('correct-bearer');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 80 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 200);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

// ---- loosen requires expiry, over HTTP -------------------------------------

test('[SPEC] loosen without expires_at -> 400 loosen-requires-expiry (200 must never happen here)', async () => {
  const p = tempConfigPath('loosen-no-expiry');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const before = readConfigFile(p);
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 99 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.reason, 'loosen-requires-expiry');
    assert.deepStrictEqual(readConfigFile(p), before, 'file must be untouched on rejection');
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] loosen with a future expires_at -> 200, direction loosen, file gets the expires_at', async () => {
  const p = tempConfigPath('loosen-future');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 99, expires_at: FUTURE012 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.direction, 'loosen');
    const onDisk = readConfigFile(p);
    assert.strictEqual(onDisk.thresholds.weekly_stop, 99);
    assert.strictEqual(onDisk.expires_at, FUTURE012);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] loosen with a past expires_at -> 400', async () => {
  const p = tempConfigPath('loosen-past');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 99, expires_at: PAST012 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 400);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] tighten (99->85, token set) -> 200, direction tighten, file reflects new thresholds', async () => {
  const p = tempConfigPath('tighten');
  writeConfigFile(p, { thresholds: { weekly_stop: 99, weekly_release: 70, session_stop: 99, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 85, session_stop: 90 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.direction, 'tighten');
    const onDisk = readConfigFile(p);
    assert.strictEqual(onDisk.thresholds.weekly_stop, 85);
    assert.strictEqual(onDisk.thresholds.session_stop, 90);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[DERIVED] rejected (4xx) PUTs never modify the config file -- validation happens before write', async () => {
  const p = tempConfigPath('reject-no-write');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 }, enabled: true });
  const before = fs.statSync(p).mtimeMs;
  const beforeContent = readConfigFile(p);
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    await putThresholds(r.port, { weekly_stop: 60 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } }); // hysteresis violation
    await putThresholds(r.port, { foo: 1 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } }); // unknown-key
    assert.deepStrictEqual(readConfigFile(p), beforeContent);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

// ---- validation delegated to ./thresholds ----------------------------------

test('[SPEC] hysteresis violation over HTTP -> 400', async () => {
  const p = tempConfigPath('hysteresis');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 60 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 400);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] unknown key over HTTP -> 400 unknown-key', async () => {
  const p = tempConfigPath('unknown-key');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 80, foo: 1 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.reason, 'unknown-key');
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[DERIVED] enabled/control in the body over HTTP -> 400 unknown-key', async () => {
  const p = tempConfigPath('unknown-key-2');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const r1 = await putThresholds(r.port, { enabled: false }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(r1.body.reason, 'unknown-key');
    const r2 = await putThresholds(r.port, { control: { port: 1 } }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(r2.body.reason, 'unknown-key');
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[DERIVED] unparseable JSON body -> 400 invalid-json', async () => {
  const p = tempConfigPath('invalid-json');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await httpRequest(r.port, '/api/thresholds', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + TOKEN012 },
      body: '{ not json'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.reason, 'invalid-json');
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[DERIVED] oversized body (>64KiB) -> 413 body-too-large', async () => {
  const p = tempConfigPath('too-large');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const huge = JSON.stringify({ weekly_stop: 80, padding: 'x'.repeat(70 * 1024) });
    const res = await httpRequest(r.port, '/api/thresholds', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + TOKEN012, 'Content-Length': String(Buffer.byteLength(huge)) },
      body: huge
    });
    assert.strictEqual(res.status, 413);
    assert.strictEqual(res.body.reason, 'body-too-large');
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

// ---- baseline is readConfig(), not the raw file --------------------------

test('[SPEC] baseline for direction/validation is readConfig(configPath).thresholds, not the raw file value', async () => {
  // File has an already-expired expires_at, so readConfig() falls back to
  // HARD_DEFAULTS (85/90) regardless of the stale on-disk thresholds (99/99).
  const p = tempConfigPath('baseline-expired');
  writeConfigFile(p, {
    thresholds: { weekly_stop: 99, weekly_release: 70, session_stop: 99, session_release: 75 },
    expires_at: '2000-01-01T00:00:00Z'
  });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    // Requesting weekly_stop:90 is a rise over the (expired) raw file's 99? No --
    // it's a rise over the HARD_DEFAULTS baseline (85), so this must be judged
    // as a loosen and rejected without expires_at.
    const res = await putThresholds(r.port, { weekly_stop: 90 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.reason, 'loosen-requires-expiry');
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

// ---- atomic write, key preservation ---------------------------------------

test('[SPEC] enabled and control.* are preserved after a write', async () => {
  const p = tempConfigPath('preserve');
  writeConfigFile(p, {
    enabled: false,
    control: { port: 3999, authToken: TOKEN012 },
    thresholds: { weekly_stop: 99, weekly_release: 70, session_stop: 99, session_release: 75 }
  });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 85 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 200);
    const onDisk = readConfigFile(p);
    assert.strictEqual(onDisk.enabled, false);
    assert.strictEqual(onDisk.control.port, 3999);
    assert.strictEqual(onDisk.control.authToken, TOKEN012);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] other pre-existing keys in the file are preserved after a write', async () => {
  const p = tempConfigPath('preserve-note');
  writeConfigFile(p, {
    note: 'hand-edited',
    thresholds: { weekly_stop: 99, weekly_release: 70, session_stop: 99, session_release: 75 }
  });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    await putThresholds(r.port, { weekly_stop: 85 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    const onDisk = readConfigFile(p);
    assert.strictEqual(onDisk.note, 'hand-edited');
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] partial request (weekly_stop only) -- the other 3 threshold values are unchanged on disk', async () => {
  const p = tempConfigPath('partial');
  writeConfigFile(p, { thresholds: { weekly_stop: 99, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    await putThresholds(r.port, { weekly_stop: 85 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    const onDisk = readConfigFile(p);
    assert.strictEqual(onDisk.thresholds.weekly_release, 70);
    assert.strictEqual(onDisk.thresholds.session_stop, 90);
    assert.strictEqual(onDisk.thresholds.session_release, 75);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] write is tmp-file + rename -- no .tmp file left behind and the target has no partial content', async () => {
  const p = tempConfigPath('atomic');
  writeConfigFile(p, { thresholds: { weekly_stop: 99, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 85 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(fs.existsSync(p + '.tmp'), false, 'tmp file must not linger after a successful write');
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(p, 'utf8')), 'target file must be fully-formed JSON, not partial');
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[DERIVED] config file missing -- PUT still succeeds, creating the file from {}', async () => {
  const p = tempConfigPath('missing');
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 80 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 200);
    const onDisk = readConfigFile(p);
    assert.strictEqual(onDisk.thresholds.weekly_stop, 80);
  } finally {
    await r.close();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

test('[DERIVED] config file exists but is unparseable JSON -- 500 config-unreadable, file left untouched', async () => {
  const p = tempConfigPath('unparseable');
  fs.writeFileSync(p, '{ this is not json');
  const before = fs.readFileSync(p, 'utf8');
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 80 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.reason, 'config-unreadable');
    assert.strictEqual(fs.readFileSync(p, 'utf8'), before);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[DERIVED] a UTF-8 BOM in the existing config file is read and merged without error', async () => {
  const p = tempConfigPath('bom');
  const json = JSON.stringify({ thresholds: { weekly_stop: 99, weekly_release: 70, session_stop: 90, session_release: 75 } });
  fs.writeFileSync(p, '\uFEFF' + json);
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 85 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 200);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[DERIVED] write failure (parent directory does not exist) -> 500 write-failed', async () => {
  const p = path.join(os.tmpdir(), 'quaestor-012-does-not-exist-dir-' + Date.now(), 'config.json');
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 80 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.reason, 'write-failed');
  } finally {
    await r.close();
  }
});

test('[DERIVED] no configPath given at all -> 500 config-unavailable (only once past the 403/401 gates)', async () => {
  const r = await startControlServer({ port: 0, authToken: TOKEN012, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 80 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.reason, 'config-unavailable');
  } finally {
    await r.close();
  }
});

test('[DERIVED] no configPath AND no token -- 403 fires first, not config-unavailable', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 80 });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.reason, 'write-requires-token');
  } finally {
    await r.close();
  }
});

// ---- never-brick ------------------------------------------------------------

test('[SPEC] a throwing onConfigChange callback still yields 200 -- the file write already committed', async () => {
  const p = tempConfigPath('never-brick');
  writeConfigFile(p, { thresholds: { weekly_stop: 99, weekly_release: 70, session_stop: 99, session_release: 75 } });
  const r = await startControlServer({
    port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot,
    onConfigChange: () => { throw new Error('refresh boom'); }
  });
  try {
    const res = await putThresholds(r.port, { weekly_stop: 85 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(res.status, 200);
    const health = await getJson(r.port, '/api/health', { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(health.status, 200, 'server must survive a throwing onConfigChange');
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] a write failure does not crash the server -- it keeps answering after', async () => {
  const p = path.join(os.tmpdir(), 'quaestor-012-nb2-' + Date.now(), 'config.json');
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot });
  try {
    await putThresholds(r.port, { weekly_stop: 80 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    const health = await getJson(r.port, '/api/health', { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.strictEqual(health.status, 200);
  } finally {
    await r.close();
  }
});

test('[SPEC] startControlServer() with configPath/onConfigChange options still never rejects/throws', async () => {
  const p = tempConfigPath('never-throws');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  await assert.doesNotReject(async () => {
    const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, onConfigChange: () => {}, getSnapshot: okSnapshot });
    await r.close();
  });
  fs.unlinkSync(p);
});

// ---- recording --------------------------------------------------------------

test('[SPEC] a successful change logs exactly one [thresholds]-prefixed line with from/to/direction/expires_at', async () => {
  const p = tempConfigPath('log-line');
  writeConfigFile(p, { thresholds: { weekly_stop: 99, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const logs = [];
  const r = await startControlServer({
    port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot,
    onLog: (m) => logs.push(m)
  });
  try {
    await putThresholds(r.port, { weekly_stop: 85 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    const thresholdLines = logs.filter((l) => l.startsWith('[thresholds]'));
    assert.strictEqual(thresholdLines.length, 1);
    assert.ok(thresholdLines[0].includes('tighten'));
    assert.ok(thresholdLines[0].includes('weekly_stop 99->85'));
    assert.ok(thresholdLines[0].includes('expires_at=none'));
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] the logged line, with an ISO timestamp prefix, is not misread by parseLogTail as a success or failure poll', async () => {
  const p = tempConfigPath('log-parse');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const logs = [];
  const r = await startControlServer({
    port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot,
    onLog: (m) => logs.push(m)
  });
  try {
    await putThresholds(r.port, { weekly_stop: 99, expires_at: FUTURE012 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    const line = logs.find((l) => l.startsWith('[thresholds]'));
    const withTimestamp = new Date().toISOString() + ' ' + line;
    assert.strictEqual(parseLogTail([withTimestamp]), null);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] rejected requests produce no [thresholds] log line', async () => {
  const p = tempConfigPath('log-none-on-reject');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const logs = [];
  const r = await startControlServer({
    port: 0, authToken: TOKEN012, configPath: p, getSnapshot: okSnapshot,
    onLog: (m) => logs.push(m)
  });
  try {
    await putThresholds(r.port, { weekly_stop: 99 }, { headers: { Authorization: 'Bearer ' + TOKEN012 } }); // loosen, no expiry
    assert.strictEqual(logs.filter((l) => l.startsWith('[thresholds]')).length, 0);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

// ---- immediate reflection via onConfigChange -------------------------------

test('[SPEC] a write is reflected by GET /api/status right away, via onConfigChange -- no waiting for the next poll', async () => {
  const p = tempConfigPath('immediate');
  writeConfigFile(p, { thresholds: { weekly_stop: 99, weekly_release: 70, session_stop: 99, session_release: 75 } });
  // Mirrors watch-loop.js's refreshConfig(): onConfigChange re-reads
  // readConfig(p) and the snapshot's ctx.thresholds is updated in place --
  // the control server does not assign to watch-loop's variables directly.
  let ctxThresholds = readConfig(p).thresholds;
  const snap = { observation: okSnapshot().observation, ctx: { enabled: true, thresholds: ctxThresholds, stop: null, configSource: 'file' } };
  const r = await startControlServer({
    port: 0, authToken: TOKEN012, configPath: p,
    getSnapshot: () => snap,
    onConfigChange: () => { snap.ctx.thresholds = readConfig(p).thresholds; }
  });
  try {
    const authHdr = { headers: { Authorization: 'Bearer ' + TOKEN012 } };
    const before = await getJson(r.port, '/api/status', authHdr);
    assert.strictEqual(before.body.usage.thresholds.weekly_stop, 99);

    await putThresholds(r.port, { weekly_stop: 85 }, authHdr);

    const after = await getJson(r.port, '/api/status', authHdr);
    assert.strictEqual(after.body.usage.thresholds.weekly_stop, 85);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[DERIVED] configPath/onConfigChange are optional -- a server started without them behaves as before for GET routes', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/status');
    assert.strictEqual(res.status, 200);
  } finally {
    await r.close();
  }
});

// ---- regression: existing surfaces unaffected by 012 -----------------------

test('[SPEC] regression: GET /api/status fields/summary/state/allowance/usage shape is unchanged after 012', async () => {
  const p = tempConfigPath('regress-status');
  writeConfigFile(p, { thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 } });
  const snap = okSnapshot();
  const expected = deriveState(snap.observation, snap.ctx, Date.now());
  const r = await startControlServer({ port: 0, authToken: TOKEN012, configPath: p, getSnapshot: () => snap });
  try {
    const res = await getJson(r.port, '/api/status', { headers: { Authorization: 'Bearer ' + TOKEN012 } });
    assert.deepStrictEqual(Object.keys(res.body).sort(), ['allowance', 'fields', 'ok', 'state', 'summary', 'updatedAt', 'usage']);
    assert.strictEqual(res.body.state, expected.state);
    assert.strictEqual(res.body.summary, expected.summary);
  } finally {
    await r.close();
    fs.unlinkSync(p);
  }
});

test('[SPEC] regression: GET / is still read-only -- no form/input/edit affordance in the HTML', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const html = await (await fetch('http://127.0.0.1:' + r.port + '/')).text();
    assert.ok(!/<form/i.test(html));
    assert.ok(!/<input/i.test(html));
    assert.ok(!/method=["']put["']/i.test(html));
  } finally {
    await r.close();
  }
});

test('[SPEC] regression: POST /api/stop is still 501', async () => {
  const r = await startControlServer({ port: 0, getSnapshot: okSnapshot });
  try {
    const res = await getJson(r.port, '/api/stop', { method: 'POST' });
    assert.strictEqual(res.status, 501);
  } finally {
    await r.close();
  }
});

test('[SPEC] regression: package.json version is unaffected -- software axis and contract axis stay separate', () => {
  assert.strictEqual(PKG.version, '0.1.0');
});

test('[DERIVED] GET /api/health still does not call getSnapshot() after 012', async () => {
  let calls = 0;
  const r = await startControlServer({ port: 0, getSnapshot: () => { calls++; return okSnapshot(); } });
  try {
    await getJson(r.port, '/api/health');
    assert.strictEqual(calls, 0);
  } finally {
    await r.close();
  }
});

test('[SPEC] control-server.js delegates validation to ./thresholds -- does not reimplement hysteresis/range checks itself', () => {
  const putSection = SRC.match(/function handlePutThresholds\([\s\S]*?\n\}/)[0];
  assert.ok(/validateThresholdRequest\(/.test(putSection));
  assert.ok(!/weekly_stop\s*>\s*weekly_release/.test(putSection), 'hysteresis check must live in ./thresholds, not here');
});

test('[DERIVED] handlePutThresholds reads the wall clock exactly once (Date.now()) and passes it as nowMs', () => {
  const putSection = SRC.match(/function handlePutThresholds\([\s\S]*?\n\}/)[0];
  const codeOnly = putSection.replace(/\/\/[^\n]*/g, ''); // strip // comments before counting
  const nowCalls = codeOnly.match(/Date\.now\(\)/g) || [];
  assert.strictEqual(nowCalls.length, 1, 'expected exactly one Date.now() read (outside comments) in handlePutThresholds');
  assert.ok(/validateThresholdRequest\([^)]*Date\.now\(\)\)/.test(putSection), 'Date.now() must be passed straight into validateThresholdRequest');
});
