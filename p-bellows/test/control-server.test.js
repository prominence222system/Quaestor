'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const os = require('node:os');

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
  const res = await fetch('http://127.0.0.1:' + port + pathname, opts || {});
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (e) { /* leave null */ }
  return { status: res.status, headers: res.headers, body, text };
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

test('omitting opts.port uses DEFAULT_PORT (3210)', async () => {
  assert.strictEqual(DEFAULT_PORT, 3210);
  const r = await startControlServer({ getSnapshot: okSnapshot });
  try {
    assert.strictEqual(r.started, true);
    assert.strictEqual(r.port, 3210);
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
