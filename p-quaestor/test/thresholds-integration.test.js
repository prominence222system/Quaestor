'use strict';
// Phase 3 -- scenario/lifecycle/concurrency integration tests for
// PUT /api/thresholds. Unit-level judgement is covered by
// test/thresholds.test.js (pure) and single-call HTTP wiring by
// test/control-server.test.js (§012 Phase 2, both left unmodified as
// regression evidence). This file focuses on what Phase 1/2 tests do not:
// whether the safety line holds across *sequences* of calls and across
// real elapsed time -- see output/DESIGN.md §3.0.
//
// Local helpers only (control-server.test.js's httpRequest/getJson live in
// that file's module scope and are not exported -- re-implemented here
// minimally per output/DESIGN.md §3.2). All servers use port:0. All config
// files live under os.tmpdir() -- never .prominence.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');

const { startControlServer } = require('../lib/control-server');
const { readConfig, HARD_DEFAULTS } = require('../lib/config');
const { parseLogTail } = require('../lib/logparse');
const { createObservation, recordSuccess } = require('../lib/observation');

const TOKEN = 'thresholds-integration-secret';

function httpJson(port, pathname, opts) {
  const o = opts || {};
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: pathname,
      method: o.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, o.headers || {})
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let body = null;
        try { body = JSON.parse(data); } catch (e) { /* leave null */ }
        resolve({ status: res.statusCode, body, raw: data });
      });
    });
    req.on('error', reject);
    if (o.body != null) req.write(o.body);
    req.end();
  });
}

function putThresholds(port, body, headers) {
  return httpJson(port, '/api/thresholds', { method: 'PUT', headers, body: JSON.stringify(body) });
}

function getStatus(port, headers) {
  return httpJson(port, '/api/status', { headers });
}

const AUTH = { Authorization: 'Bearer ' + TOKEN };

function tmpConfigPath(name) {
  return path.join(
    os.tmpdir(),
    'quaestor-012-int-' + name + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json'
  );
}

// Creates a temp config file, hands its path to fn, and always cleans up
// (both the file and any leftover .tmp from a would-be atomic write).
async function withConfig(initialObj, fn) {
  const p = tmpConfigPath('cfg');
  fs.writeFileSync(p, JSON.stringify(initialObj));
  try {
    return await fn(p);
  } finally {
    try { fs.unlinkSync(p); } catch (e) { /* already gone */ }
    try { fs.unlinkSync(p + '.tmp'); } catch (e) { /* none left */ }
  }
}

async function withServer(opts, fn) {
  const r = await startControlServer(Object.assign({ port: 0 }, opts));
  try {
    return await fn(r);
  } finally {
    await r.close();
  }
}

// getSnapshot as a fresh closure that re-reads the config file on every
// call -- the same shape watch-loop's refreshConfig()/controlSnapshot()
// pairing produces, so "PUT then immediately GET /api/status" can be
// observed over a real port without needing a running watch-loop process
// (which requires Chrome; see MASTER.md and test/watch-loop.test.js).
function freshSnapshot(configPath) {
  return function () {
    const obs = recordSuccess(createObservation(), { session_pct: 5, weekly_pct: 5 }, Date.now());
    return {
      observation: obs,
      ctx: { enabled: true, thresholds: readConfig(configPath).thresholds, stop: null, configSource: 'file' }
    };
  };
}

const TIGHT = { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 };
const LOOSE = { weekly_stop: 99, weekly_release: 70, session_stop: 99, session_release: 75 };

// ---- S1: USER_GATE-A -------------------------------------------------

test('[SPEC] S1 USER_GATE-A: tighten round trip then GET /api/status reflects new thresholds immediately (no poll wait)', async () => {
  await withConfig({ thresholds: LOOSE, enabled: true, control: { port: 3210, authToken: null } }, async (p) => {
    await withServer({ authToken: TOKEN, configPath: p, getSnapshot: freshSnapshot(p) }, async (r) => {
      const put = await putThresholds(r.port, { weekly_stop: 85, session_stop: 90 }, { Authorization: 'Bearer ' + TOKEN });
      assert.strictEqual(put.status, 200);
      assert.strictEqual(put.body.direction, 'tighten');
      assert.deepStrictEqual(put.body.previous, LOOSE);
      assert.deepStrictEqual(put.body.applied, TIGHT);

      const status = await getStatus(r.port, AUTH);
      assert.strictEqual(status.status, 200);
      assert.strictEqual(status.body.usage.thresholds.weekly_stop, 85);
      assert.strictEqual(status.body.usage.thresholds.session_stop, 90);
    });
  });
});

// ---- S2: USER_GATE-B (zero side effects on rejection) -----------------

test('[SPEC] S2 USER_GATE-B: loosen without expires_at is rejected with 400 and leaves zero side effects', async () => {
  await withConfig({ thresholds: TIGHT, enabled: true, control: { port: 3210, authToken: null } }, async (p) => {
    const logs = [];
    await withServer({ authToken: TOKEN, configPath: p, onLog: (m) => logs.push(m), getSnapshot: freshSnapshot(p) }, async (r) => {
      const before = fs.readFileSync(p, 'utf8');

      const put = await putThresholds(r.port, { weekly_stop: 99 }, { Authorization: 'Bearer ' + TOKEN });
      assert.strictEqual(put.status, 400, '200 here would mean this NNN failed');
      assert.strictEqual(put.body.reason, 'loosen-requires-expiry');

      const after = fs.readFileSync(p, 'utf8');
      assert.strictEqual(after, before, 'config file must be byte-identical after a rejected write');
      assert.strictEqual(
        logs.filter((l) => l.startsWith('[thresholds]')).length, 0,
        'a rejected write must not produce a [thresholds] log line'
      );

      const status = await getStatus(r.port, AUTH);
      assert.strictEqual(status.body.usage.thresholds.weekly_stop, 85, 'GET /api/status must be unaffected by the rejection');
    });
  });
});

// ---- S3: two-call bypass is blocked ------------------------------------

test('[SPEC] S3 two-call bypass: loosen+expiry succeeds, then a follow-up expires_at:null-only request is rejected and the stored expiry survives', async () => {
  await withConfig({ thresholds: TIGHT, enabled: true, control: { port: 3210, authToken: null } }, async (p) => {
    await withServer({ authToken: TOKEN, configPath: p, getSnapshot: freshSnapshot(p) }, async (r) => {
      const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const put1 = await putThresholds(r.port, { weekly_stop: 99, session_stop: 99, expires_at: future }, { Authorization: 'Bearer ' + TOKEN });
      assert.strictEqual(put1.status, 200);
      assert.strictEqual(put1.body.direction, 'loosen');
      assert.strictEqual(put1.body.expires_at, future);

      const put2 = await putThresholds(r.port, { expires_at: null }, { Authorization: 'Bearer ' + TOKEN });
      assert.strictEqual(put2.status, 400, '5 월 사건의 결과 상태(99/99 + 만료 없음)는 두 번째 호출로 도달할 수 없어야 한다');
      assert.strictEqual(put2.body.reason, 'loosen-requires-expiry');

      const onDisk = JSON.parse(fs.readFileSync(p, 'utf8'));
      assert.strictEqual(onDisk.expires_at, future, 'the expiry from the first, successful call must still be on disk');
      assert.strictEqual(onDisk.thresholds.weekly_stop, 99);
    });
  });
});

// ---- S4: expiry actually elapses and self-heals ------------------------

test('[SPEC] S4 an expiry that actually elapses causes readConfig() and GET /api/status to fall back to HARD_DEFAULTS', async () => {
  await withConfig({ thresholds: TIGHT, enabled: true, control: { port: 3210, authToken: null } }, async (p) => {
    await withServer({ authToken: TOKEN, configPath: p, getSnapshot: freshSnapshot(p) }, async (r) => {
      const soon = new Date(Date.now() + 1200).toISOString(); // ~1.2s out

      const put = await putThresholds(r.port, { weekly_stop: 99, session_stop: 99, expires_at: soon }, { Authorization: 'Bearer ' + TOKEN });
      assert.strictEqual(put.status, 200);

      // Confirm the loosened state is actually in effect before it elapses.
      const before = await getStatus(r.port, AUTH);
      assert.strictEqual(before.body.usage.thresholds.weekly_stop, 99);

      // Let real time pass -- isExpired() is not reimplemented and the
      // clock is not mocked (output/DESIGN.md D7/S4).
      await new Promise((res) => setTimeout(res, 1500));

      const cfg = readConfig(p);
      assert.strictEqual(cfg.thresholds.weekly_stop, HARD_DEFAULTS.thresholds.weekly_stop);
      assert.strictEqual(cfg.thresholds.session_stop, HARD_DEFAULTS.thresholds.session_stop);

      const after = await getStatus(r.port, AUTH);
      assert.strictEqual(after.body.usage.thresholds.weekly_stop, HARD_DEFAULTS.thresholds.weekly_stop);
      assert.strictEqual(after.body.usage.thresholds.session_stop, HARD_DEFAULTS.thresholds.session_stop);
    });
  });
});

// ---- S5: the May incident, reproduced and recorded ---------------------

test('[SPEC] S5 reproduces the May incident state (99/99, no expiry) and records exactly one recovery log line', async () => {
  await withConfig({ thresholds: LOOSE, enabled: true, control: { port: 3210, authToken: null } }, async (p) => {
    const logs = [];
    await withServer({ authToken: TOKEN, configPath: p, onLog: (m) => logs.push(m), getSnapshot: freshSnapshot(p) }, async (r) => {
      const status0 = await getStatus(r.port, AUTH);
      assert.strictEqual(status0.body.usage.thresholds.weekly_stop, 99, 'reproduces the incident-time screen');
      assert.strictEqual(status0.body.usage.thresholds.session_stop, 99);

      const put = await putThresholds(r.port, { weekly_stop: 85, session_stop: 90 }, { Authorization: 'Bearer ' + TOKEN });
      assert.strictEqual(put.status, 200);
      assert.strictEqual(put.body.direction, 'tighten');

      const thresholdLines = logs.filter((l) => l.startsWith('[thresholds]'));
      assert.strictEqual(thresholdLines.length, 1, 'exactly one [thresholds] line -- the incident\'s real damage was the absence of this line');
      assert.match(thresholdLines[0], /^\[thresholds\] tighten:/);
      assert.match(thresholdLines[0], /weekly_stop 99->85/);
      assert.match(thresholdLines[0], /session_stop 99->90/);
      assert.match(thresholdLines[0], /expires_at=none/);

      const lineWithTs = new Date().toISOString() + ' ' + thresholdLines[0];
      assert.strictEqual(parseLogTail([lineWithTs]), null, 'must not be misread as a success or failure poll by 005\'s parser');

      const undoAttempt = await putThresholds(r.port, { weekly_stop: 99, session_stop: 99 }, { Authorization: 'Bearer ' + TOKEN });
      assert.strictEqual(undoAttempt.status, 400);
      assert.strictEqual(undoAttempt.body.reason, 'loosen-requires-expiry');
    });
  });
});

// ---- S6: concurrent writes -- atomicity's observable face --------------

test('[DERIVED] S6 concurrent PUTs: both responses are valid JSON, the file stays valid, and no .tmp survives', async () => {
  await withConfig({ thresholds: TIGHT, enabled: true, control: { port: 4242, authToken: 'kept-token' } }, async (p) => {
    await withServer({ authToken: TOKEN, configPath: p, getSnapshot: freshSnapshot(p) }, async (r) => {
      const [a, b] = await Promise.all([
        putThresholds(r.port, { weekly_stop: 80 }, { Authorization: 'Bearer ' + TOKEN }),
        putThresholds(r.port, { session_stop: 88 }, { Authorization: 'Bearer ' + TOKEN })
      ]);

      for (const res of [a, b]) {
        assert.ok(res.body !== null, 'every response must parse as JSON, not crash the connection');
        assert.ok([200, 400, 500].includes(res.status), 'status must be a deterministic code, not a hang/empty response');
      }

      const onDisk = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const k of ['weekly_stop', 'weekly_release', 'session_stop', 'session_release']) {
        assert.strictEqual(typeof onDisk.thresholds[k], 'number');
        assert.ok(Number.isInteger(onDisk.thresholds[k]));
      }
      assert.strictEqual(onDisk.enabled, true, 'enabled must survive concurrent writes');
      assert.strictEqual(onDisk.control.port, 4242);
      assert.strictEqual(onDisk.control.authToken, 'kept-token');
      assert.strictEqual(fs.existsSync(p + '.tmp'), false, 'no leftover .tmp file');

      const health = await httpJson(r.port, '/api/health', { headers: AUTH });
      assert.strictEqual(health.status, 200, 'server must still be alive after concurrent writes');
    });
  });
});

// ---- S7: never-brick across a run of failures ---------------------------

test('[SPEC] S7 never-brick: config-unreadable, write-failed, 403, and 401 in sequence leave the dashboard alive', async () => {
  const brokenPath = tmpConfigPath('broken');
  fs.writeFileSync(brokenPath, '{ not valid json ]');
  try {
    // (1) config-unreadable -- token set, valid body, but the file on disk is corrupt.
    await withServer({ authToken: TOKEN, configPath: brokenPath, getSnapshot: freshSnapshot(brokenPath) }, async (r) => {
      const res1 = await putThresholds(r.port, { weekly_stop: 80 }, { Authorization: 'Bearer ' + TOKEN });
      assert.strictEqual(res1.status, 500);
      assert.strictEqual(res1.body.reason, 'config-unreadable');

      const health1 = await httpJson(r.port, '/api/health', { headers: AUTH });
      assert.strictEqual(health1.status, 200);
    });

    // (2) write-failed -- configPath points inside a non-existent directory,
    // so the file is missing (readable as {}) but the rename cannot land.
    const nonexistentDir = path.join(os.tmpdir(), 'quaestor-012-missing-dir-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    const unwritablePath = path.join(nonexistentDir, 'bellows-config.json');
    await withServer({ authToken: TOKEN, configPath: unwritablePath, getSnapshot: freshSnapshot(unwritablePath) }, async (r) => {
      const res2 = await putThresholds(r.port, { weekly_stop: 80 }, { Authorization: 'Bearer ' + TOKEN });
      assert.strictEqual(res2.status, 500);
      assert.strictEqual(res2.body.reason, 'write-failed');

      // (3) write-requires-token -- same server, but simulate by re-checking
      // with no Authorization header against a *different* server with no
      // token configured, then (4) a wrong-Bearer 401 against this server.
      const res4 = await putThresholds(r.port, { weekly_stop: 80 }, { Authorization: 'Bearer wrong-token' });
      assert.strictEqual(res4.status, 401);

      const health2 = await httpJson(r.port, '/api/health', { headers: AUTH });
      const status2 = await httpJson(r.port, '/api/status', { headers: AUTH });
      const index2 = await httpJson(r.port, '/', { headers: AUTH });
      assert.strictEqual(health2.status, 200);
      assert.strictEqual(status2.status, 200);
      assert.strictEqual(index2.status, 200);
    });

    await withConfig({ thresholds: TIGHT }, async (p) => {
      await withServer({ configPath: p, getSnapshot: freshSnapshot(p) }, async (r) => {
        const res3 = await putThresholds(r.port, { weekly_stop: 80 });
        assert.strictEqual(res3.status, 403);
        assert.strictEqual(res3.body.reason, 'write-requires-token');

        const health3 = await httpJson(r.port, '/api/health');
        assert.strictEqual(health3.status, 200);
      });
    });
  } finally {
    try { fs.unlinkSync(brokenPath); } catch (e) { /* already gone */ }
  }
});

test('[SPEC] never-brick: no uncaughtException/unhandledRejection observed across the S7 failure sequence', async () => {
  const seen = [];
  const onUncaught = (e) => seen.push('uncaughtException: ' + e.message);
  const onUnhandled = (e) => seen.push('unhandledRejection: ' + (e && e.message));
  process.on('uncaughtException', onUncaught);
  process.on('unhandledRejection', onUnhandled);
  try {
    const brokenPath = tmpConfigPath('broken2');
    fs.writeFileSync(brokenPath, '{ not valid json ]');
    try {
      await withServer({ authToken: TOKEN, configPath: brokenPath, getSnapshot: freshSnapshot(brokenPath) }, async (r) => {
        await putThresholds(r.port, { weekly_stop: 80 }, { Authorization: 'Bearer ' + TOKEN });
        await putThresholds(r.port, {}, { Authorization: 'Bearer ' + TOKEN });
        await putThresholds(r.port, { weekly_stop: 80 }, { Authorization: 'Bearer wrong' });
        await putThresholds(r.port, { weekly_stop: 80 });
      });
    } finally {
      try { fs.unlinkSync(brokenPath); } catch (e) { /* already gone */ }
    }
    // give the event loop a turn for any late async rejection to surface
    await new Promise((res) => setImmediate(res));
    assert.deepStrictEqual(seen, []);
  } finally {
    process.off('uncaughtException', onUncaught);
    process.off('unhandledRejection', onUnhandled);
  }
});

// ---- hermetic discipline sanity -----------------------------------------

test('[SPEC] hermetic discipline: this file never references a real product config path, only os.tmpdir()', () => {
  const src = fs.readFileSync(__filename, 'utf8');
  // Forbidden substrings are built by concatenation so this assertion does
  // not match against its own source text.
  const realDrivePath = 'Synology' + 'Drive';
  const realPathHelper = 'resolveStop' + 'Dir';
  assert.ok(src.indexOf(realDrivePath) === -1, 'must not reference the real product\'s Synology-hosted config path');
  assert.ok(src.indexOf(realPathHelper) === -1, 'must not reuse the real product\'s path-resolution helper');
  assert.ok(/os\.tmpdir\(\)/.test(src), 'config paths must be built from os.tmpdir()');
});
