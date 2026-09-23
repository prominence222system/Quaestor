'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const {
  AGY_ARGS,
  resolveAgyFile,
  parseUsage,
  measureAgy,
  createAgyMonitor
} = require('../lib/agy-usage');

const SRC_PATH = path.join(__dirname, '..', 'lib', 'agy-usage.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

const FAKE_AGY = path.join(__dirname, 'fixtures', 'fake-agy.js');

function makeFakeExecutor(mode) {
  return function (file, args, opts, cb) {
    const env = Object.assign({}, process.env, { FAKE_AGY_MODE: mode });
    const merged = Object.assign({}, opts, { env });
    return execFile(process.execPath, [FAKE_AGY].concat(args), merged, cb);
  };
}

// ---- source hygiene ----------------------------------------------------

test('AGY_ARGS is frozen and exactly ["-p", "/usage"]', () => {
  assert.deepStrictEqual(AGY_ARGS, ['-p', '/usage']);
  assert.strictEqual(Object.isFrozen(AGY_ARGS), true);
});

test('lib/agy-usage.js does not reference https://claude.ai', () => {
  const matches = SRC.match(/https:\/\/claude\.ai/g) || [];
  assert.strictEqual(matches.length, 0);
});

test('lib/agy-usage.js names no bucket other than "Gemini Models"', () => {
  const matches = SRC.match(/Models/g) || [];
  assert.strictEqual(matches.length, 1, 'the only "...Models" occurrence must be the Gemini Models bucket constant');
  assert.ok(!/Claude and GPT/.test(SRC), 'must not name the Claude and GPT models bucket');
});

test('measureAgy does not expose a way to inject agy arguments', () => {
  const sigMatch = SRC.match(/function measureAgy\s*\(([^)]*)\)/);
  assert.ok(sigMatch, 'expected a measureAgy(...) function declaration');
  assert.ok(!/\bargs\b/.test(sigMatch[1]), 'measureAgy(...) must not accept an args parameter');
  const arrayLiterals = SRC.match(/\[\s*'-p'/g) || [];
  assert.strictEqual(arrayLiterals.length, 1, 'only AGY_ARGS may look like an agy argument list');
});

// ---- parseUsage: measured vectors --------------------------------------

const PIPE_TEXT =
  'Gemini Models\tWeekly Limit Remaining\t45%\t2026-09-23T06:57:36Z\n' +
  'Gemini Models\tFive Hour Limit Remaining\t100%\t2026-09-23T05:53:40Z\n' +
  'Claude and GPT models\tWeekly Limit Remaining\t100%\t2026-09-30T00:53:40Z\n' +
  'Claude and GPT models\tFive Hour Limit Remaining\t100%\t2026-09-23T05:53:40Z\n';

const CONSOLE_TEXT =
  'Quota:\n' +
  'Gemini Models          Weekly Limit Remaining     51%   2026-09-23T06:57:36Z\n' +
  'Gemini Models          Five Hour Limit Remaining  89%   2026-09-22T11:07:46Z\n' +
  'Claude and GPT models  Weekly Limit Remaining     100%  2026-09-29T06:24:22Z\n' +
  'Claude and GPT models  Five Hour Limit Remaining  100%  2026-09-22T11:24:22Z\n';

test('[SPEC] parseUsage reads the pipe (TAB-delimited) vector: 45/100', () => {
  const r = parseUsage(PIPE_TEXT);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.weekly_remaining_pct, 45);
  assert.strictEqual(r.five_hour_remaining_pct, 100);
  assert.strictEqual(r.weekly_reset_raw, '2026-09-23T06:57:36Z');
  assert.strictEqual(r.five_hour_reset_raw, '2026-09-23T05:53:40Z');
});

test('[SPEC] parseUsage reads the console (space-aligned + Quota: header) vector: 51/89', () => {
  const r = parseUsage(CONSOLE_TEXT);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.weekly_remaining_pct, 51);
  assert.strictEqual(r.five_hour_remaining_pct, 89);
});

test('[SPEC] both formats yield the same result key set', () => {
  const pipeKeys = Object.keys(parseUsage(PIPE_TEXT)).sort();
  const consoleKeys = Object.keys(parseUsage(CONSOLE_TEXT)).sort();
  assert.deepStrictEqual(pipeKeys, consoleKeys);
  assert.deepStrictEqual(pipeKeys, ['five_hour_reset_raw', 'five_hour_remaining_pct', 'ok', 'weekly_remaining_pct', 'weekly_reset_raw'].sort());
});

// ---- parseUsage: strictness ---------------------------------------------

test('[SPEC] strict rejection cases each yield { ok: false }', () => {
  assert.strictEqual(parseUsage('Gemini Models\tWeekly Limit Remaining\t45%\t2026-09-23T06:57:36Z\n').ok, false, 'weekly-only');
  assert.strictEqual(
    parseUsage('Gemini Models\tWeekly Limit Remaining\t150%\t2026-09-23T06:57:36Z\nGemini Models\tFive Hour Limit Remaining\t100%\t2026-09-23T05:53:40Z\n').ok,
    false,
    '150% out of range'
  );
  assert.strictEqual(
    parseUsage(
      'Gemini Models\tWeekly Limit Remaining\t45%\t2026-09-23T06:57:36Z\n' +
      'Gemini Models\tWeekly Limit Remaining\t46%\t2026-09-23T06:57:36Z\n' +
      'Gemini Models\tFive Hour Limit Remaining\t100%\t2026-09-23T05:53:40Z\n'
    ).ok,
    false,
    'same metric, conflicting values'
  );
  assert.strictEqual(parseUsage('').ok, false, 'empty string');
  assert.strictEqual(parseUsage('Error: Please sign in to use agy.').ok, false, 'login-required line');
});

test('[SPEC] Gemini line order does not matter -- values follow the metric string', () => {
  const swapped =
    'Gemini Models\tFive Hour Limit Remaining\t100%\t2026-09-23T05:53:40Z\n' +
    'Gemini Models\tWeekly Limit Remaining\t45%\t2026-09-23T06:57:36Z\n';
  const r = parseUsage(swapped);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.weekly_remaining_pct, 45);
  assert.strictEqual(r.five_hour_remaining_pct, 100);
});

// Gemini values here deliberately avoid the digit substrings "37"/"23" and
// the "2031-01-01"/"2032-02-02" dates used by the sentinel rows below --
// otherwise a coincidental substring match (e.g. day-of-month "23") would
// produce a false positive in the leak check.
const SENTINEL_TEXT =
  'Gemini Models\tWeekly Limit Remaining\t45%\t2026-09-20T06:57:36Z\n' +
  'Gemini Models\tFive Hour Limit Remaining\t88%\t2026-09-20T05:53:40Z\n' +
  'Claude and GPT models\tWeekly Limit Remaining\t37%\t2031-01-01T00:00:00Z\n' +
  'Claude and GPT models\tFive Hour Limit Remaining\t23%\t2032-02-02T00:00:00Z\n';

test('[SPEC] non-Gemini bucket values never leak into the result (sentinel fixture)', () => {
  const r = parseUsage(SENTINEL_TEXT);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.weekly_remaining_pct, 45);
  assert.strictEqual(r.five_hour_remaining_pct, 88);
  const serialized = JSON.stringify(r);
  for (const sentinel of ['37', '23', '2031-01-01', '2032-02-02']) {
    assert.ok(!serialized.includes(sentinel), 'sentinel value "' + sentinel + '" leaked into result: ' + serialized);
  }
});

test('[DERIVED] malformed rows are dropped, not fatal (bad col count / blank / Quota: header)', () => {
  const r = parseUsage(
    'Quota:\n' +
    '\n' +
    'garbage line with too few cols\n' +
    'Gemini Models\tWeekly Limit Remaining\t45%\t2026-09-23T06:57:36Z\n' +
    'Gemini Models\tFive Hour Limit Remaining\t100%\t2026-09-23T05:53:40Z\n'
  );
  assert.strictEqual(r.ok, true);
});

test('[DERIVED] parseUsage is pure: non-string input yields { ok: false } without throwing, same input -> same output', () => {
  for (const bad of [null, undefined, 42, {}, []]) {
    assert.doesNotThrow(() => {
      const r = parseUsage(bad);
      assert.strictEqual(r.ok, false);
    });
  }
  const r1 = parseUsage(PIPE_TEXT);
  const r2 = parseUsage(PIPE_TEXT);
  assert.deepStrictEqual(r1, r2);
});

// ---- resolveAgyFile -------------------------------------------------------

function withEnv(overrides, fn) {
  const keys = ['QUAESTOR_AGY_EXE', 'BELLOWS_AGY_EXE'];
  const saved = {};
  for (const k of keys) saved[k] = process.env[k];
  try {
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, overrides);
    fn();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test('[SPEC] resolveAgyFile() returns "agy" when both env vars are undefined', () => {
  withEnv({}, () => {
    assert.strictEqual(resolveAgyFile(), 'agy');
  });
});

test('[SPEC] resolveAgyFile() prefers QUAESTOR_AGY_EXE over BELLOWS_AGY_EXE', () => {
  withEnv({ QUAESTOR_AGY_EXE: 'C:\\tools\\agy-new.exe', BELLOWS_AGY_EXE: 'C:\\tools\\agy-old.exe' }, () => {
    assert.strictEqual(resolveAgyFile(), 'C:\\tools\\agy-new.exe');
  });
});

test('[DERIVED] resolveAgyFile() falls back to "agy" for empty/whitespace values', () => {
  withEnv({ QUAESTOR_AGY_EXE: '   ' }, () => {
    assert.strictEqual(resolveAgyFile(), 'agy');
  });
});

// ---- measureAgy: real process boundary -----------------------------------

test('[SPEC] measureAgy over a real child process (pipe vector) resolves ok:true 45/100, proving arg fixing survives the process boundary', async () => {
  const r = await measureAgy({ executor: makeFakeExecutor('pipe'), file: 'unused', timeoutMs: 5000 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.weekly_remaining_pct, 45);
  assert.strictEqual(r.five_hour_remaining_pct, 100);
});

test('[SPEC] measureAgy over a real child process (console vector) resolves ok:true 51/89', async () => {
  const r = await measureAgy({ executor: makeFakeExecutor('console'), file: 'unused', timeoutMs: 5000 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.weekly_remaining_pct, 51);
  assert.strictEqual(r.five_hour_remaining_pct, 89);
});

test('[SPEC] measureAgy over a real child process (sentinel vector) leaks no non-Gemini values', async () => {
  const r = await measureAgy({ executor: makeFakeExecutor('sentinel'), file: 'unused', timeoutMs: 5000 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.weekly_remaining_pct, 45);
  assert.strictEqual(r.five_hour_remaining_pct, 88);
  // Serialize only the parsed fields -- `at` is wall-clock (from nowFn) and
  // may legitimately contain digit substrings like "23" on any given day,
  // which is not the leak this test is guarding against.
  const serialized = JSON.stringify({
    weekly_remaining_pct: r.weekly_remaining_pct,
    five_hour_remaining_pct: r.five_hour_remaining_pct,
    weekly_reset_raw: r.weekly_reset_raw,
    five_hour_reset_raw: r.five_hour_reset_raw
  });
  for (const sentinel of ['37', '23', '2031-01-01', '2032-02-02']) {
    assert.ok(!serialized.includes(sentinel));
  }
});

test('measureAgy passes exactly ["-p", "/usage"] as the second argument to the executor', async () => {
  let capturedArgs = null;
  const spyExecutor = (file, args, opts, cb) => {
    capturedArgs = args;
    setImmediate(() => cb(null, PIPE_TEXT, ''));
    return { kill() {} };
  };
  await measureAgy({ executor: spyExecutor, file: 'agy', timeoutMs: 5000 });
  assert.deepStrictEqual(capturedArgs, ['-p', '/usage']);
});

test('[DERIVED] measureAgy calls the executor with shell:false (Windows .cmd/.bat trap avoidance)', async () => {
  let capturedOpts = null;
  const spyExecutor = (file, args, opts, cb) => {
    capturedOpts = opts;
    setImmediate(() => cb(null, PIPE_TEXT, ''));
    return { kill() {} };
  };
  await measureAgy({ executor: spyExecutor, file: 'agy', timeoutMs: 5000 });
  assert.strictEqual(capturedOpts.shell, false);
});

test('[SPEC] exit 0 + error text stdout -> parse-failed (+hint), exit 0 + empty stdout -> parse-failed (no hint), exit 1 + error text -> exit-nonzero (+hint)', async () => {
  const login0 = await measureAgy({ executor: makeFakeExecutor('login0'), file: 'unused', timeoutMs: 5000 });
  assert.strictEqual(login0.ok, false);
  assert.strictEqual(login0.kind, 'parse-failed');
  assert.strictEqual(login0.hint, 'login-required');

  const empty = await measureAgy({ executor: makeFakeExecutor('empty'), file: 'unused', timeoutMs: 5000 });
  assert.strictEqual(empty.ok, false);
  assert.strictEqual(empty.kind, 'parse-failed');
  assert.strictEqual(empty.hint, undefined, 'hint key must not be present when no login text is seen');

  const login1 = await measureAgy({ executor: makeFakeExecutor('login1'), file: 'unused', timeoutMs: 5000 });
  assert.strictEqual(login1.ok, false);
  assert.strictEqual(login1.kind, 'exit-nonzero');
  assert.strictEqual(login1.hint, 'login-required');
});

test('[SPEC] a 60s-sleeping fake agy with timeoutMs=1000 resolves kind:"timeout" within 3.5s', async () => {
  const start = Date.now();
  const r = await measureAgy({ executor: makeFakeExecutor('hang'), file: 'unused', timeoutMs: 1000 });
  const elapsed = Date.now() - start;
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.kind, 'timeout');
  assert.ok(elapsed < 3500, 'expected timeout within 3.5s, took ' + elapsed + 'ms');
});

test('[SPEC] a non-existent absolute QUAESTOR_AGY_EXE path with the default (real) executor yields kind:"not-installed"', async () => {
  const bogusPath = path.join(__dirname, 'does-not-exist-' + Date.now() + '.exe');
  const r = await measureAgy({ file: bogusPath, timeoutMs: 5000 });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.kind, 'not-installed');
});

// ---- measureAgy: never-reject, synthetic error shapes ---------------------

test('[SPEC] measureAgy never rejects, even when the executor throws synchronously', async () => {
  const throwingExecutor = () => { throw new Error('boom'); };
  await assert.doesNotReject(async () => {
    const r = await measureAgy({ executor: throwingExecutor, file: 'agy', timeoutMs: 5000 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.kind, 'spawn-failed');
  });
});

test('[SPEC] error.code that is a non-ENOENT string (e.g. EINVAL) yields kind:"spawn-failed"', async () => {
  const executor = (file, args, opts, cb) => {
    const err = new Error('spawn EINVAL');
    err.code = 'EINVAL';
    setImmediate(() => cb(err, '', ''));
    return { kill() {} };
  };
  const r = await measureAgy({ executor, file: 'agy', timeoutMs: 5000 });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.kind, 'spawn-failed');
});

test('[DERIVED] `at` reflects the injected nowFn as an ISO string', async () => {
  const fixedNow = Date.parse('2026-09-23T00:00:00.000Z');
  const r = await measureAgy({ executor: makeFakeExecutor('pipe'), file: 'unused', timeoutMs: 5000, nowFn: () => fixedNow });
  assert.strictEqual(r.at, '2026-09-23T00:00:00.000Z');
});

test('[DERIVED] measureAgy settles exactly once even if the executor invokes the callback twice', async () => {
  const executor = (file, args, opts, cb) => {
    setImmediate(() => cb(null, PIPE_TEXT, ''));
    setImmediate(() => cb(null, PIPE_TEXT, ''));
    return { kill() {} };
  };
  const r = await measureAgy({ executor, file: 'agy', timeoutMs: 5000 });
  assert.strictEqual(r.ok, true);
});

// ---- createAgyMonitor -------------------------------------------------------

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('[SPEC] .poll() returns synchronously even if measure() takes long, and a second .poll() while in-flight does not re-invoke measure', async () => {
  let calls = 0;
  const measure = () => {
    calls++;
    return new Promise((resolve) => setTimeout(() => resolve({ ok: true, at: 'x', weekly_remaining_pct: 45, five_hour_remaining_pct: 100, weekly_reset_raw: 'r1', five_hour_reset_raw: 'r2' }), 50));
  };
  const monitor = createAgyMonitor({ measure });

  const before = Date.now();
  monitor.poll();
  const afterFirst = Date.now();
  assert.ok(afterFirst - before < 25, '.poll() must return immediately');
  assert.strictEqual(monitor.snapshot().inFlight, true);

  monitor.poll(); // should be a no-op -- measure still in flight
  assert.strictEqual(calls, 1, 'measure() must not be called again while in flight');

  await delay(100);
  assert.strictEqual(calls, 1);
  assert.strictEqual(monitor.snapshot().inFlight, false);
  assert.strictEqual(monitor.snapshot().lastSuccess.weekly_remaining_pct, 45);
});

test('[SPEC] a failure after a success preserves lastSuccess, only lastAttempt changes', async () => {
  let mode = 'ok';
  const measure = () => Promise.resolve(
    mode === 'ok'
      ? { ok: true, at: 't1', weekly_remaining_pct: 45, five_hour_remaining_pct: 100, weekly_reset_raw: 'r1', five_hour_reset_raw: 'r2' }
      : { ok: false, at: 't2', kind: 'timeout' }
  );
  const monitor = createAgyMonitor({ measure });

  monitor.poll();
  await delay(10);
  assert.deepStrictEqual(monitor.snapshot().lastSuccess.weekly_remaining_pct, 45);

  mode = 'fail';
  monitor.poll();
  await delay(10);
  const snap = monitor.snapshot();
  assert.strictEqual(snap.lastSuccess.weekly_remaining_pct, 45, 'lastSuccess must survive a subsequent failure');
  assert.strictEqual(snap.lastAttempt.ok, false);
  assert.strictEqual(snap.lastAttempt.kind, 'timeout');
});

test('[SPEC] the monitor survives a synchronously-throwing measure() and a rejecting measure(), and keeps polling afterward', async () => {
  let mode = 'throw';
  const measure = () => {
    if (mode === 'throw') throw new Error('sync boom');
    if (mode === 'reject') return Promise.reject(new Error('async boom'));
    return Promise.resolve({ ok: true, at: 't', weekly_remaining_pct: 45, five_hour_remaining_pct: 100, weekly_reset_raw: 'r1', five_hour_reset_raw: 'r2' });
  };
  const monitor = createAgyMonitor({ measure });

  assert.doesNotThrow(() => monitor.poll());
  assert.strictEqual(monitor.snapshot().inFlight, false);

  mode = 'reject';
  monitor.poll();
  await delay(10);
  assert.strictEqual(monitor.snapshot().inFlight, false);

  mode = 'ok';
  monitor.poll();
  await delay(10);
  assert.strictEqual(monitor.snapshot().lastSuccess.weekly_remaining_pct, 45);
});

test('[DERIVED] snapshot() returns a fresh object each call; mutating it does not affect the monitor', async () => {
  const measure = () => Promise.resolve({ ok: true, at: 't', weekly_remaining_pct: 45, five_hour_remaining_pct: 100, weekly_reset_raw: 'r1', five_hour_reset_raw: 'r2' });
  const monitor = createAgyMonitor({ measure });
  monitor.poll();
  await delay(10);
  const s1 = monitor.snapshot();
  s1.lastSuccess.weekly_remaining_pct = 999;
  const s2 = monitor.snapshot();
  assert.strictEqual(s2.lastSuccess.weekly_remaining_pct, 45);
  assert.notStrictEqual(s1, s2);
});

test('[DERIVED] initial snapshot is { lastSuccess: null, lastAttempt: null, inFlight: false }', () => {
  const monitor = createAgyMonitor({ measure: () => Promise.resolve({ ok: true }) });
  assert.deepStrictEqual(monitor.snapshot(), { lastSuccess: null, lastAttempt: null, inFlight: false });
});

test('[DERIVED] a throwing/absent log callback does not prevent state updates', async () => {
  const measure = () => Promise.resolve({ ok: true, at: 't', weekly_remaining_pct: 45, five_hour_remaining_pct: 100, weekly_reset_raw: 'r1', five_hour_reset_raw: 'r2' });
  const throwingLog = () => { throw new Error('log boom'); };
  const monitor = createAgyMonitor({ measure, log: throwingLog });
  assert.doesNotThrow(() => monitor.poll());
  await delay(10);
  assert.strictEqual(monitor.snapshot().lastSuccess.weekly_remaining_pct, 45);
});

test('[DERIVED] success/failure log lines match the fixed format exactly once each', async () => {
  const logs = [];
  let mode = 'ok';
  const measure = () => Promise.resolve(
    mode === 'ok'
      ? { ok: true, at: 't', weekly_remaining_pct: 45, five_hour_remaining_pct: 100, weekly_reset_raw: 'r1', five_hour_reset_raw: 'r2' }
      : { ok: false, at: 't', kind: 'exit-nonzero', hint: 'login-required' }
  );
  const monitor = createAgyMonitor({ measure, log: (m) => logs.push(m) });

  monitor.poll();
  await delay(10);
  mode = 'fail';
  monitor.poll();
  await delay(10);

  assert.deepStrictEqual(logs, [
    '[agy] gemini weekly_left=45% five_hour_left=100%',
    '[agy] fail kind=exit-nonzero hint=login-required'
  ]);
});

// ---- log-line non-contamination (Phase 1 scope: format is fixed now) -----

test('[SPEC] monitor log lines never contain "session=", "weekly=" or "[poll error]"', async () => {
  const logs = [];
  const measure = () => Promise.resolve({ ok: false, at: 't', kind: 'timeout' });
  const monitor = createAgyMonitor({ measure, log: (m) => logs.push(m) });
  monitor.poll();
  await delay(10);

  const successLogs = [];
  const successMeasure = () => Promise.resolve({ ok: true, at: 't', weekly_remaining_pct: 45, five_hour_remaining_pct: 100, weekly_reset_raw: 'r1', five_hour_reset_raw: 'r2' });
  const successMonitor = createAgyMonitor({ measure: successMeasure, log: (m) => successLogs.push(m) });
  successMonitor.poll();
  await delay(10);

  for (const line of logs.concat(successLogs)) {
    assert.ok(!line.includes('session='), line);
    assert.ok(!line.includes('weekly='), line);
    assert.ok(!line.includes('[poll error]'), line);
  }
});
