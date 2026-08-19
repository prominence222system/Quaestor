'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { startControlServer, HOST, DEFAULT_PORT, SERVICE_ID } = require('../lib/control-server');
const { createObservation, recordFailure, recordSuccess, deriveState } = require('../lib/observation');

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
