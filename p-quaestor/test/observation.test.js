'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  createObservation,
  recordSuccess,
  recordFailure,
  deriveState,
  deriveUsage,
  deriveAllowance,
  deriveAgy
} = require('../lib/observation');

const SRC_PATH = path.join(__dirname, '..', 'lib', 'observation.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-08-19T12:00:00Z');

test('deriveState is pure and deterministic (same input twice)', () => {
  const obs = recordSuccess(createObservation(), { session_pct: 10, weekly_pct: 20 }, NOW);
  const ctx = { enabled: true, configSource: 'default' };
  const r1 = deriveState(obs, ctx, NOW);
  const r2 = deriveState(obs, ctx, NOW);
  assert.deepStrictEqual(r1, r2);
});

test('observation.js source does not read wall-clock time or fs', () => {
  assert.ok(!/Date\.now\s*\(/.test(SRC), 'must not call Date.now()');
  assert.ok(!/new Date\s*\(\s*\)/.test(SRC), 'must not call new Date() with no args');
  assert.ok(!/require\(\s*['"](?:node:)?fs['"]\s*\)/.test(SRC), 'must not require fs');
});

test('deriveState does not mutate obs or ctx', () => {
  const obs = recordFailure(createObservation(), 'anchor-timeout', { hint: 'unknown' }, NOW);
  const ctx = { enabled: true, thresholds: { weekly_stop: 85 }, stop: null, configSource: 'file' };
  const beforeObs = JSON.stringify(obs);
  const beforeCtx = JSON.stringify(ctx);
  deriveState(obs, ctx, NOW);
  assert.strictEqual(JSON.stringify(obs), beforeObs);
  assert.strictEqual(JSON.stringify(ctx), beforeCtx);
});

test('recordSuccess/recordFailure do not mutate input obs', () => {
  const obs = createObservation();
  const before = JSON.stringify(obs);
  const s = recordSuccess(obs, { session_pct: 1, weekly_pct: 2 }, NOW);
  s.consecutiveFailures = 999;
  assert.strictEqual(JSON.stringify(obs), before);

  const f = recordFailure(obs, 'nav-failed', null, NOW);
  f.consecutiveFailures = 999;
  assert.strictEqual(JSON.stringify(obs), before);
});

test('fields are timezone independent', () => {
  const obs = recordSuccess(createObservation(), { session_pct: 1, weekly_pct: 2 }, NOW);
  const orig = process.env.TZ;
  process.env.TZ = 'UTC';
  const a = deriveState(obs, {}, NOW + 5 * MIN);
  process.env.TZ = 'America/New_York';
  const b = deriveState(obs, {}, NOW + 5 * MIN);
  process.env.TZ = orig;
  assert.deepStrictEqual(a, b);
});

test('never-success observation is not ok', () => {
  const obs = createObservation();
  const r = deriveState(obs, {}, NOW);
  assert.notStrictEqual(r.state, 'ok');
  assert.strictEqual(r.state, 'warn');
});

test('consecutiveFailures at crit threshold is crit, even with no success history', () => {
  let obs = createObservation();
  for (let i = 0; i < 4; i++) obs = recordFailure(obs, 'anchor-timeout', null, NOW);
  const r = deriveState(obs, {}, NOW);
  assert.strictEqual(r.state, 'crit');
});

test('stale success (>2h) is crit', () => {
  const obs = recordSuccess(createObservation(), { session_pct: 1, weekly_pct: 2 }, NOW);
  const r = deriveState(obs, {}, NOW + 3 * HOUR);
  assert.strictEqual(r.state, 'crit');
});

test('stale success (>45m, <=2h) is warn', () => {
  const obs = recordSuccess(createObservation(), { session_pct: 1, weekly_pct: 2 }, NOW);
  const r = deriveState(obs, {}, NOW + 50 * MIN);
  assert.strictEqual(r.state, 'warn');
});

test('fresh + near threshold is warn, fresh + headroom is ok', () => {
  const near = recordSuccess(createObservation(), { session_pct: 10, weekly_pct: 79 }, NOW);
  const rNear = deriveState(near, {}, NOW + 5 * MIN);
  assert.strictEqual(rNear.state, 'warn');

  const ok = recordSuccess(createObservation(), { session_pct: 10, weekly_pct: 24 }, NOW);
  const rOk = deriveState(ok, {}, NOW + 5 * MIN);
  assert.strictEqual(rOk.state, 'ok');
});

test('enabled=false forces idle regardless of other conditions', () => {
  let obs = createObservation();
  for (let i = 0; i < 10; i++) obs = recordFailure(obs, 'anchor-timeout', null, NOW);
  const r = deriveState(obs, { enabled: false }, NOW);
  assert.strictEqual(r.state, 'idle');
});

test('state is always one of the four enum values', () => {
  const enums = ['ok', 'warn', 'crit', 'idle'];
  const cases = [
    createObservation(),
    recordSuccess(createObservation(), { session_pct: 50, weekly_pct: 50 }, NOW),
    recordFailure(createObservation(), 'chrome-unreachable', null, NOW)
  ];
  for (const obs of cases) {
    const r = deriveState(obs, {}, NOW);
    assert.ok(enums.includes(r.state));
  }
});

test('deriveState never throws on missing/empty inputs', () => {
  assert.doesNotThrow(() => deriveState({}, {}, NOW));
  assert.doesNotThrow(() => deriveState(undefined, undefined, NOW));
  assert.doesNotThrow(() => deriveState(createObservation(), undefined, NOW));
  const r = deriveState({}, {}, NOW);
  assert.strictEqual(typeof r.summary, 'string');
  assert.ok(r.summary.length > 0);
  assert.ok(Array.isArray(r.fields));
});

test('success -> failure -> failure -> success resets consecutiveFailures to 0', () => {
  let obs = createObservation();
  obs = recordSuccess(obs, { session_pct: 1, weekly_pct: 2 }, NOW);
  obs = recordFailure(obs, 'anchor-timeout', null, NOW + MIN);
  obs = recordFailure(obs, 'anchor-timeout', null, NOW + 2 * MIN);
  obs = recordSuccess(obs, { session_pct: 1, weekly_pct: 2 }, NOW + 3 * MIN);
  assert.strictEqual(obs.consecutiveFailures, 0);
});

test('recordFailure increments consecutiveFailures/totalFailures, keeps lastSuccessAt', () => {
  let obs = recordSuccess(createObservation(), { session_pct: 1, weekly_pct: 2 }, NOW);
  obs = recordFailure(obs, 'nav-failed', null, NOW + MIN);
  assert.strictEqual(obs.consecutiveFailures, 1);
  assert.strictEqual(obs.totalFailures, 1);
  assert.strictEqual(obs.lastSuccessAt, NOW);
});

test('recordSuccess sets lastSuccessAt to now, resets consecutiveFailures, keeps totalPolls counting', () => {
  let obs = recordFailure(createObservation(), 'nav-failed', null, NOW);
  obs = recordSuccess(obs, { session_pct: 1, weekly_pct: 2 }, NOW + MIN);
  assert.strictEqual(obs.lastSuccessAt, NOW + MIN);
  assert.strictEqual(obs.consecutiveFailures, 0);
  assert.strictEqual(obs.totalPolls, 2);
});

test('createObservation initial shape', () => {
  const obs = createObservation();
  assert.strictEqual(obs.lastSuccessAt, null);
  assert.strictEqual(obs.lastUsage, null);
  assert.strictEqual(obs.lastFailure, null);
  assert.strictEqual(obs.consecutiveFailures, 0);
  assert.strictEqual(obs.totalPolls, 0);
  assert.strictEqual(obs.totalFailures, 0);
});

test('recordFailure normalizes falsy/non-string kind to unknown', () => {
  const a = recordFailure(createObservation(), null, null, NOW);
  const b = recordFailure(createObservation(), '', null, NOW);
  const c = recordFailure(createObservation(), 42, null, NOW);
  assert.strictEqual(a.lastFailure.kind, 'unknown');
  assert.strictEqual(b.lastFailure.kind, 'unknown');
  assert.strictEqual(c.lastFailure.kind, 'unknown');
});

test('recordSuccess keeps prior lastFailure', () => {
  let obs = recordFailure(createObservation(), 'anchor-timeout', null, NOW);
  obs = recordSuccess(obs, { session_pct: 1, weekly_pct: 2 }, NOW + MIN);
  assert.ok(obs.lastFailure);
  assert.strictEqual(obs.lastFailure.kind, 'anchor-timeout');
});

test('no secrets leak into deriveState output, even when detail carries them', () => {
  const obs = recordFailure(
    createObservation(),
    'anchor-timeout',
    {
      hint: 'login-expired',
      url: 'https://claude.ai/login?next=%2F',
      textHead: 'account: someone@example.com cookie=abc authToken=xyz .profile',
      cookie: 'sess=abc123',
      authToken: 'xyz-secret'
    },
    NOW
  );
  const ctx = { enabled: true, stop: { source: 'manual', reason: 'testing' }, configSource: 'file' };
  const out = deriveState(obs, ctx, NOW);
  const str = JSON.stringify(out);
  assert.ok(!str.includes('.profile'));
  assert.ok(!str.includes('authToken'));
  assert.ok(!str.includes('cookie'));
  assert.ok(!str.includes('@'));
  assert.ok(!str.includes('9222'));
  assert.ok(!str.includes('example.com'));
});

test('lastFailure field carries only kind + known hint vocabulary', () => {
  const obs = recordFailure(createObservation(), 'anchor-timeout', { hint: 'login-expired' }, NOW);
  const r = deriveState(obs, {}, NOW);
  const field = r.fields.find((f) => f.label === '마지막 실패');
  assert.strictEqual(field.value, 'anchor-timeout · login-expired');
});

test('unknown/garbage hint is dropped, not surfaced', () => {
  const obs = recordFailure(createObservation(), 'anchor-timeout', { hint: 'totally-made-up' }, NOW);
  const r = deriveState(obs, {}, NOW);
  const field = r.fields.find((f) => f.label === '마지막 실패');
  assert.strictEqual(field.value, 'anchor-timeout');
});

test('fields entries have string label/value and optional valid state', () => {
  const obs = recordFailure(createObservation(), 'anchor-timeout', null, NOW);
  const r = deriveState(obs, { stop: { source: 'auto', reason: 'weekly_threshold' } }, NOW);
  const enums = ['ok', 'warn', 'crit', 'idle'];
  for (const f of r.fields) {
    assert.strictEqual(typeof f.label, 'string');
    assert.strictEqual(typeof f.value, 'string');
    if ('state' in f) assert.ok(enums.includes(f.state));
  }
});

test('fields include all required items', () => {
  const obs = createObservation();
  const r = deriveState(obs, {}, NOW);
  const labels = r.fields.map((f) => f.label);
  assert.deepStrictEqual(labels, [
    '마지막 성공 측정', '세션 사용량', '주간 사용량', '연속 실패',
    '마지막 실패', 'STOP', '임계값', '설정 출처',
    'Gemini 주간 잔량', 'Gemini 5시간 잔량'
  ]);
});

test('STOP field distinguishes manual vs auto vs none', () => {
  const obs = createObservation();
  const none = deriveState(obs, {}, NOW).fields.find((f) => f.label === 'STOP');
  assert.strictEqual(none.value, '없음');

  const auto = deriveState(obs, { stop: { source: 'auto', reason: 'weekly_threshold' } }, NOW)
    .fields.find((f) => f.label === 'STOP');
  assert.strictEqual(auto.value, 'auto · weekly_threshold');

  const manual = deriveState(obs, { stop: { source: 'manual', reason: 'vacation' } }, NOW)
    .fields.find((f) => f.label === 'STOP');
  assert.strictEqual(manual.value, 'manual · vacation');
});

test('configSource field reflects ctx.configSource', () => {
  const obs = createObservation();
  const file = deriveState(obs, { configSource: 'file' }, NOW).fields.find((f) => f.label === '설정 출처');
  assert.strictEqual(file.value, '파일');
  const dflt = deriveState(obs, { configSource: 'default' }, NOW).fields.find((f) => f.label === '설정 출처');
  assert.strictEqual(dflt.value, '기본값');
});

test('lastUsage=null keeps session/weekly fields present with placeholder value', () => {
  const obs = createObservation();
  const r = deriveState(obs, {}, NOW);
  const session = r.fields.find((f) => f.label === '세션 사용량');
  const weekly = r.fields.find((f) => f.label === '주간 사용량');
  assert.ok(session && weekly);
  assert.strictEqual(session.value, '-');
  assert.strictEqual(weekly.value, '-');
});

test('field order is stable across calls', () => {
  const obs = recordSuccess(createObservation(), { session_pct: 5, weekly_pct: 5 }, NOW);
  const r1 = deriveState(obs, {}, NOW);
  const r2 = deriveState(obs, {}, NOW);
  assert.deepStrictEqual(r1.fields.map((f) => f.label), r2.fields.map((f) => f.label));
});

test('observation.js requires no external modules (puppeteer etc.)', () => {
  assert.ok(!/require\(\s*['"]puppeteer['"]\s*\)/.test(SRC));
});

test('deriveUsage returns numbers for session_pct and weekly_pct when observation exists', () => {
  const obs = recordSuccess(createObservation(), { session_pct: 24, weekly_pct: 24, session_reset: '1시간 25분 후 재설정' }, NOW);
  const u = deriveUsage(obs, { weekly_stop: 85, session_stop: 90 }, NOW);
  assert.strictEqual(typeof u.session_pct, 'number');
  assert.strictEqual(typeof u.weekly_pct, 'number');
  assert.strictEqual(u.session_pct, 24);
  assert.strictEqual(u.weekly_pct, 24);
  assert.strictEqual(u.session_headroom, 66);
  assert.strictEqual(u.weekly_headroom, 61);
  assert.strictEqual(u.session_reset, '1시간 25분 후 재설정');
  assert.strictEqual(u.stale, false);
});

test('deriveUsage returns null (not 0) for percentages when no observation history exists', () => {
  const obs = createObservation();
  const u = deriveUsage(obs, {}, NOW);
  assert.strictEqual(u.session_pct, null);
  assert.strictEqual(u.weekly_pct, null);
  assert.strictEqual(u.session_headroom, null);
  assert.strictEqual(u.weekly_headroom, null);
  assert.strictEqual(u.measured_at, null);
  assert.strictEqual(u.age_sec, null);
  assert.strictEqual(u.stale, true);
});

test('deriveUsage headroom is 0 (not negative) when usage exceeds stop threshold', () => {
  const obs = recordSuccess(createObservation(), { session_pct: 95, weekly_pct: 90 }, NOW);
  const u = deriveUsage(obs, { weekly_stop: 85, session_stop: 90 }, NOW);
  assert.strictEqual(u.session_headroom, 0);
  assert.strictEqual(u.weekly_headroom, 0);
});

test('deriveUsage includes passed thresholds', () => {
  const obs = createObservation();
  const thresholds = { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 };
  const u = deriveUsage(obs, thresholds, NOW);
  assert.deepStrictEqual(u.thresholds, thresholds);
});

test('deriveAllowance returns allowed: null and confidence: unknown when no observation history exists', () => {
  const usage = { session_headroom: null, weekly_headroom: null, stale: true };
  const a = deriveAllowance(null, usage, false);
  assert.strictEqual(a.allowed, null);
  assert.strictEqual(a.reason, 'unmeasurable');
  assert.strictEqual(a.confidence, 'unknown');
});

test('deriveAllowance returns allowed: false and reason: manual-stop for manual STOP', () => {
  const stopInfo = { source: 'manual', reason: 'user requested' };
  const usage = { session_headroom: 5, weekly_headroom: 5, stale: false };
  const a = deriveAllowance(stopInfo, usage, true);
  assert.strictEqual(a.allowed, false);
  assert.strictEqual(a.reason, 'manual-stop');
  assert.strictEqual(a.confidence, 'measured');
});

test('deriveAllowance returns allowed: false and original reason for auto STOP', () => {
  const stopInfo = { source: 'auto', reason: 'weekly_threshold' };
  const usage = { session_headroom: 5, weekly_headroom: 5, stale: false };
  const a = deriveAllowance(stopInfo, usage, true);
  assert.strictEqual(a.allowed, false);
  assert.strictEqual(a.reason, 'weekly_threshold');
  assert.strictEqual(a.confidence, 'measured');
});

test('deriveAllowance returns allowed: true with confidence measured or stale when no STOP exists', () => {
  const fresh = deriveAllowance(null, { session_headroom: 5, weekly_headroom: 5, stale: false }, true);
  assert.strictEqual(fresh.allowed, true);
  assert.strictEqual(fresh.reason, 'under-threshold');
  assert.strictEqual(fresh.confidence, 'measured');

  const stale = deriveAllowance(null, { session_headroom: 5, weekly_headroom: 5, stale: true }, true);
  assert.strictEqual(stale.allowed, true);
  assert.strictEqual(stale.reason, 'under-threshold');
  assert.strictEqual(stale.confidence, 'stale');
});

test('deriveUsage and deriveAllowance are pure functions without side effects', () => {
  const obs = recordSuccess(createObservation(), { session_pct: 10, weekly_pct: 20 }, NOW);
  const beforeObs = JSON.stringify(obs);
  deriveUsage(obs, {}, NOW);
  deriveAllowance(null, { session_headroom: 5, weekly_headroom: 5, stale: false }, true);
  assert.strictEqual(JSON.stringify(obs), beforeObs);
});

test('[008 red-first] session 97 / weekly 99 over stop 90/85, no STOP, fresh -> allowed false, reason over-threshold', () => {
  const obs = recordSuccess(createObservation(), { session_pct: 97, weekly_pct: 99 }, NOW);
  const thresholds = { session_stop: 90, weekly_stop: 85 };
  const usage = deriveUsage(obs, thresholds, NOW);
  const a = deriveAllowance(null, usage, true);
  assert.strictEqual(a.allowed, false);
  assert.strictEqual(a.reason, 'over-threshold');
  assert.strictEqual(a.confidence, 'measured');
});

test('[008] boundary: pct === stop is over-threshold (>=), for session and weekly independently', () => {
  const thresholds = { session_stop: 90, weekly_stop: 85 };
  const sessionAtStop = deriveUsage(recordSuccess(createObservation(), { session_pct: 90, weekly_pct: 10 }, NOW), thresholds, NOW);
  const a1 = deriveAllowance(null, sessionAtStop, true);
  assert.strictEqual(a1.allowed, false);
  assert.strictEqual(a1.reason, 'over-threshold');

  const weeklyAtStop = deriveUsage(recordSuccess(createObservation(), { session_pct: 10, weekly_pct: 85 }, NOW), thresholds, NOW);
  const a2 = deriveAllowance(null, weeklyAtStop, true);
  assert.strictEqual(a2.allowed, false);
  assert.strictEqual(a2.reason, 'over-threshold');
});

test('[008] boundary: pct === stop - 1 on both sides is allowed under-threshold', () => {
  const thresholds = { session_stop: 90, weekly_stop: 85 };
  const obs = recordSuccess(createObservation(), { session_pct: 89, weekly_pct: 84 }, NOW);
  const usage = deriveUsage(obs, thresholds, NOW);
  const a = deriveAllowance(null, usage, true);
  assert.strictEqual(a.allowed, true);
  assert.strictEqual(a.reason, 'under-threshold');
});

test('[008] one side only exceeds -> false, in both directions (session-only, weekly-only)', () => {
  const thresholds = { session_stop: 90, weekly_stop: 85 };
  const sessionOnly = deriveUsage(recordSuccess(createObservation(), { session_pct: 95, weekly_pct: 10 }, NOW), thresholds, NOW);
  const a1 = deriveAllowance(null, sessionOnly, true);
  assert.strictEqual(a1.allowed, false);
  assert.strictEqual(a1.reason, 'over-threshold');

  const weeklyOnly = deriveUsage(recordSuccess(createObservation(), { session_pct: 10, weekly_pct: 90 }, NOW), thresholds, NOW);
  const a2 = deriveAllowance(null, weeklyOnly, true);
  assert.strictEqual(a2.allowed, false);
  assert.strictEqual(a2.reason, 'over-threshold');
});

test('[008] STOP active outranks threshold breach: manual-stop and auto original reason both survive over-threshold usage', () => {
  const thresholds = { session_stop: 90, weekly_stop: 85 };
  const obs = recordSuccess(createObservation(), { session_pct: 97, weekly_pct: 99 }, NOW);
  const usage = deriveUsage(obs, thresholds, NOW);

  const manual = deriveAllowance({ source: 'manual', reason: 'user requested' }, usage, true);
  assert.strictEqual(manual.allowed, false);
  assert.strictEqual(manual.reason, 'manual-stop');

  const auto = deriveAllowance({ source: 'auto', reason: 'weekly_threshold' }, usage, true);
  assert.strictEqual(auto.allowed, false);
  assert.strictEqual(auto.reason, 'weekly_threshold');
  assert.notStrictEqual(auto.reason, 'over-threshold');
});

test('[008] unmeasurable outranks STOP: no observation history + STOP present -> still allowed:null/unmeasurable', () => {
  const usage = { session_headroom: null, weekly_headroom: null, stale: true };
  const a = deriveAllowance({ source: 'manual', reason: 'vacation' }, usage, false);
  assert.strictEqual(a.allowed, null);
  assert.strictEqual(a.reason, 'unmeasurable');
  assert.strictEqual(a.confidence, 'unknown');
});

test('[008] single-sided measurement (one headroom missing) cannot assert both positive -> unmeasurable', () => {
  const usage = { session_headroom: 10, weekly_headroom: null, stale: false };
  const a = deriveAllowance(null, usage, true);
  assert.strictEqual(a.allowed, null);
  assert.strictEqual(a.reason, 'unmeasurable');
  assert.strictEqual(a.confidence, 'unknown');
});

test('[008] invariant + anti-false-assertion swept over a pct grid: allowed===true => both headrooms > 0; reason===under-threshold => both pct < stop', () => {
  const thresholds = { session_stop: 90, weekly_stop: 85 };
  for (let s = 0; s <= 100; s += 5) {
    for (let w = 0; w <= 100; w += 5) {
      const obs = recordSuccess(createObservation(), { session_pct: s, weekly_pct: w }, NOW);
      const usage = deriveUsage(obs, thresholds, NOW);
      const a = deriveAllowance(null, usage, true);
      if (a.allowed === true) {
        assert.ok(usage.session_headroom > 0, 's=' + s + ' w=' + w);
        assert.ok(usage.weekly_headroom > 0, 's=' + s + ' w=' + w);
      }
      if (a.reason === 'under-threshold') {
        assert.ok(s < thresholds.session_stop, 's=' + s + ' should be < session_stop');
        assert.ok(w < thresholds.weekly_stop, 'w=' + w + ' should be < weekly_stop');
      }
    }
  }
});

test('stale in deriveUsage is consistent with deriveState criteria', () => {
  const obsFresh = recordSuccess(createObservation(), { session_pct: 10, weekly_pct: 20 }, NOW);
  const uFresh = deriveUsage(obsFresh, {}, NOW + 5 * MIN);
  const stFresh = deriveState(obsFresh, {}, NOW + 5 * MIN);
  assert.strictEqual(uFresh.stale, false);
  assert.strictEqual(stFresh.state, 'ok');

  const obsStaleWarn = recordSuccess(createObservation(), { session_pct: 10, weekly_pct: 20 }, NOW);
  const uStaleWarn = deriveUsage(obsStaleWarn, {}, NOW + 50 * MIN);
  const stStaleWarn = deriveState(obsStaleWarn, {}, NOW + 50 * MIN);
  assert.strictEqual(uStaleWarn.stale, true);
  assert.strictEqual(stStaleWarn.state, 'warn');

  const obsStaleCrit = recordSuccess(createObservation(), { session_pct: 10, weekly_pct: 20 }, NOW);
  const uStaleCrit = deriveUsage(obsStaleCrit, {}, NOW + 3 * HOUR);
  const stStaleCrit = deriveState(obsStaleCrit, {}, NOW + 3 * HOUR);
  assert.strictEqual(uStaleCrit.stale, true);
  assert.strictEqual(stStaleCrit.state, 'crit');
});

// Phase 1 tests for 015: deriveAgy & deriveState Gemini fields

test('[015 Phase 1 SPEC] deriveAgy truth table case 1: no snapshot or no attempt finished', () => {
  const cases = [undefined, null, {}, { lastAttempt: null, lastSuccess: null }];
  const expectedKeys = [
    'covers', 'bucket', 'weekly_remaining_pct', 'five_hour_remaining_pct',
    'weekly_reset', 'five_hour_reset', 'measured_at', 'age_sec', 'stale', 'last_error'
  ];

  for (const snap of cases) {
    const r = deriveAgy(snap, NOW);
    assert.deepStrictEqual(Object.keys(r), expectedKeys);
    assert.deepStrictEqual(r.covers, ['agy']);
    assert.strictEqual(r.bucket, 'Gemini Models');
    assert.strictEqual(r.weekly_remaining_pct, null);
    assert.strictEqual(r.five_hour_remaining_pct, null);
    assert.strictEqual(r.weekly_reset, null);
    assert.strictEqual(r.five_hour_reset, null);
    assert.strictEqual(r.measured_at, null);
    assert.strictEqual(r.age_sec, null);
    assert.strictEqual(r.stale, true);
    assert.strictEqual(r.last_error, 'not-yet-measured');
  }
});

test('[015 Phase 1 SPEC] deriveAgy truth table case 2: last attempt success', () => {
  const snap = {
    lastAttempt: { at: '2026-09-23T06:10:02Z', ok: true, kind: null },
    lastSuccess: {
      weekly_remaining_pct: 45,
      five_hour_remaining_pct: 80,
      weekly_reset_raw: '2026-09-23T06:57:36Z',
      five_hour_reset_raw: '2026-09-23T11:10:02Z',
      at: '2026-09-23T06:10:02Z'
    },
    inFlight: false
  };

  // Fresh: 12 seconds after measurement
  const freshNow = Date.parse('2026-09-23T06:10:14Z');
  const fresh = deriveAgy(snap, freshNow);
  assert.strictEqual(fresh.weekly_remaining_pct, 45);
  assert.strictEqual(fresh.five_hour_remaining_pct, 80);
  assert.strictEqual(fresh.weekly_reset, '2026-09-23T06:57:36Z');
  assert.strictEqual(fresh.five_hour_reset, '2026-09-23T11:10:02Z');
  assert.strictEqual(fresh.measured_at, '2026-09-23T06:10:02Z');
  assert.strictEqual(fresh.age_sec, 12);
  assert.strictEqual(fresh.stale, false);
  assert.strictEqual(fresh.last_error, null);

  // Stale: 50 minutes after measurement (> 45 min STALE_WARN_MS)
  const staleNow = Date.parse('2026-09-23T07:00:02Z');
  const stale = deriveAgy(snap, staleNow);
  assert.strictEqual(stale.weekly_remaining_pct, 45);
  assert.strictEqual(stale.age_sec, 50 * 60);
  assert.strictEqual(stale.stale, true);
  assert.strictEqual(stale.last_error, null);
});

test('[015 Phase 1 SPEC] deriveAgy truth table case 3: last attempt failure, previous success exists (preserves success values)', () => {
  const snap = {
    lastAttempt: { at: '2026-09-23T06:25:00Z', ok: false, kind: 'timeout' },
    lastSuccess: {
      weekly_remaining_pct: 45,
      five_hour_remaining_pct: 80,
      weekly_reset_raw: '2026-09-23T06:57:36Z',
      five_hour_reset_raw: '2026-09-23T11:10:02Z',
      at: '2026-09-23T06:10:02Z'
    },
    inFlight: false
  };

  // Measured at 06:10:02, attempt failed at 06:25:00, now is 06:25:02 (15 min after success: fresh)
  const nowMs = Date.parse('2026-09-23T06:25:02Z');
  const r = deriveAgy(snap, nowMs);
  assert.strictEqual(r.weekly_remaining_pct, 45);
  assert.strictEqual(r.five_hour_remaining_pct, 80);
  assert.strictEqual(r.weekly_reset, '2026-09-23T06:57:36Z');
  assert.strictEqual(r.five_hour_reset, '2026-09-23T11:10:02Z');
  assert.strictEqual(r.measured_at, '2026-09-23T06:10:02Z');
  assert.strictEqual(r.age_sec, 15 * 60);
  assert.strictEqual(r.stale, false);
  assert.strictEqual(r.last_error, 'timeout');
});

test('[015 Phase 1 SPEC] deriveAgy truth table case 4: last attempt failure, no previous success', () => {
  const snap = {
    lastAttempt: { at: '2026-09-23T06:25:00Z', ok: false, kind: 'spawn-failed' },
    lastSuccess: null,
    inFlight: false
  };

  const nowMs = Date.parse('2026-09-23T06:25:02Z');
  const r = deriveAgy(snap, nowMs);
  assert.strictEqual(r.weekly_remaining_pct, null);
  assert.strictEqual(r.five_hour_remaining_pct, null);
  assert.strictEqual(r.weekly_reset, null);
  assert.strictEqual(r.five_hour_reset, null);
  assert.strictEqual(r.measured_at, null);
  assert.strictEqual(r.age_sec, null);
  assert.strictEqual(r.stale, true);
  assert.strictEqual(r.last_error, 'spawn-failed');
});

test('[015 Phase 1 SPEC] deriveAgy 100% reset sentinel rule: 100% bucket reset is null', () => {
  const snap = {
    lastAttempt: { at: '2026-09-23T06:10:02Z', ok: true, kind: null },
    lastSuccess: {
      weekly_remaining_pct: 45,
      five_hour_remaining_pct: 100,
      weekly_reset_raw: '2026-09-23T06:57:36Z',
      five_hour_reset_raw: '2030-05-05T05:05:05Z',
      at: '2026-09-23T06:10:02Z'
    }
  };

  const r = deriveAgy(snap, Date.parse('2026-09-23T06:10:14Z'));
  assert.strictEqual(r.five_hour_remaining_pct, 100);
  assert.strictEqual(r.five_hour_reset, null, '100% five hour reset must be null');
  assert.strictEqual(r.weekly_reset, '2026-09-23T06:57:36Z', 'non-100% weekly reset must be present');

  // Reverse case: weekly is 100%, five_hour is not
  const snap2 = {
    lastAttempt: { at: '2026-09-23T06:10:02Z', ok: true, kind: null },
    lastSuccess: {
      weekly_remaining_pct: 100,
      five_hour_remaining_pct: 50,
      weekly_reset_raw: '2030-01-01T00:00:00Z',
      five_hour_reset_raw: '2026-09-23T11:10:02Z',
      at: '2026-09-23T06:10:02Z'
    }
  };
  const r2 = deriveAgy(snap2, Date.parse('2026-09-23T06:10:14Z'));
  assert.strictEqual(r2.weekly_remaining_pct, 100);
  assert.strictEqual(r2.weekly_reset, null, '100% weekly reset must be null');
  assert.strictEqual(r2.five_hour_reset, '2026-09-23T11:10:02Z');
});

test('[015 Phase 1 SPEC] deriveAgy unmeasured bucket yields null pct (never 0 or 100)', () => {
  const rNoSnap = deriveAgy(null, NOW);
  assert.strictEqual(rNoSnap.weekly_remaining_pct, null);
  assert.strictEqual(rNoSnap.five_hour_remaining_pct, null);

  const rFailed = deriveAgy({ lastAttempt: { ok: false, kind: 'timeout' }, lastSuccess: null }, NOW);
  assert.strictEqual(rFailed.weekly_remaining_pct, null);
  assert.strictEqual(rFailed.five_hour_remaining_pct, null);
});

test('[015 Phase 1 SPEC] deriveState fields: Gemini rows formatting (모름, N%, N% (낡음))', () => {
  const obs = recordSuccess(createObservation(), { session_pct: 10, weekly_pct: 20 }, NOW);

  // 1. Without ctx.agy: both are '모름'
  const rNone = deriveState(obs, {}, NOW);
  const wNone = rNone.fields.find((f) => f.label === 'Gemini 주간 잔량');
  const fNone = rNone.fields.find((f) => f.label === 'Gemini 5시간 잔량');
  assert.ok(wNone && fNone);
  assert.strictEqual(wNone.value, '모름');
  assert.strictEqual(fNone.value, '모름');

  // 2. Fresh agy: '45%' and '100%'
  const freshAgy = {
    lastAttempt: { at: new Date(NOW).toISOString(), ok: true },
    lastSuccess: {
      weekly_remaining_pct: 45,
      five_hour_remaining_pct: 100,
      weekly_reset_raw: '2026-09-23T06:57:36Z',
      five_hour_reset_raw: '2030-05-05T05:05:05Z',
      at: new Date(NOW).toISOString()
    }
  };
  const rFresh = deriveState(obs, { agy: freshAgy }, NOW + 10 * 1000);
  const wFresh = rFresh.fields.find((f) => f.label === 'Gemini 주간 잔량');
  const fFresh = rFresh.fields.find((f) => f.label === 'Gemini 5시간 잔량');
  assert.strictEqual(wFresh.value, '45%');
  assert.strictEqual(fFresh.value, '100%');

  // 3. Stale agy: '45% (낡음)' and '100% (낡음)'
  const rStale = deriveState(obs, { agy: freshAgy }, NOW + 50 * MIN);
  const wStale = rStale.fields.find((f) => f.label === 'Gemini 주간 잔량');
  const fStale = rStale.fields.find((f) => f.label === 'Gemini 5시간 잔량');
  assert.strictEqual(wStale.value, '45% (낡음)');
  assert.strictEqual(fStale.value, '100% (낡음)');

  // 4. 0% remaining: '0%' and '0% (낡음)'
  const zeroAgy = {
    lastAttempt: { at: new Date(NOW).toISOString(), ok: true },
    lastSuccess: {
      weekly_remaining_pct: 0,
      five_hour_remaining_pct: 0,
      weekly_reset_raw: '2026-09-23T06:57:36Z',
      five_hour_reset_raw: '2026-09-23T11:10:02Z',
      at: new Date(NOW).toISOString()
    }
  };
  const rZeroFresh = deriveState(obs, { agy: zeroAgy }, NOW + 10 * 1000);
  assert.strictEqual(rZeroFresh.fields.find((f) => f.label === 'Gemini 주간 잔량').value, '0%');
  assert.strictEqual(rZeroFresh.fields.find((f) => f.label === 'Gemini 5시간 잔량').value, '0%');

  const rZeroStale = deriveState(obs, { agy: zeroAgy }, NOW + 50 * MIN);
  assert.strictEqual(rZeroStale.fields.find((f) => f.label === 'Gemini 주간 잔량').value, '0% (낡음)');
  assert.strictEqual(rZeroStale.fields.find((f) => f.label === 'Gemini 5시간 잔량').value, '0% (낡음)');
});

test('[015 Phase 1 SPEC] deriveState independence: ctx.agy presence and failure does not affect state, summary, usage, allowance', () => {
  const obs = recordSuccess(createObservation(), { session_pct: 10, weekly_pct: 20 }, NOW);
  const ctxWithout = { enabled: true, thresholds: { weekly_stop: 85, session_stop: 90 }, stop: null };
  const ctxWithFailedAgy = Object.assign({}, ctxWithout, {
    agy: {
      lastAttempt: { at: new Date(NOW).toISOString(), ok: false, kind: 'timeout' },
      lastSuccess: null
    }
  });

  const r1 = deriveState(obs, ctxWithout, NOW);
  const r2 = deriveState(obs, ctxWithFailedAgy, NOW);

  assert.strictEqual(r1.state, r2.state);
  assert.strictEqual(r1.summary, r2.summary);

  const u1 = deriveUsage(obs, ctxWithout.thresholds, NOW);
  const u2 = deriveUsage(obs, ctxWithFailedAgy.thresholds, NOW);
  assert.deepStrictEqual(u1, u2);

  const a1 = deriveAllowance(ctxWithout.stop, u1, true);
  const a2 = deriveAllowance(ctxWithFailedAgy.stop, u2, true);
  assert.deepStrictEqual(a1, a2);
});

test('[015 Phase 1 SPEC] deriveAgy is pure and does not mutate input snapshot', () => {
  const snap = {
    lastAttempt: { at: '2026-09-23T06:10:02Z', ok: true },
    lastSuccess: {
      weekly_remaining_pct: 45,
      five_hour_remaining_pct: 80,
      weekly_reset_raw: '2026-09-23T06:57:36Z',
      five_hour_reset_raw: '2026-09-23T11:10:02Z',
      at: '2026-09-23T06:10:02Z'
    }
  };
  const snapJson = JSON.stringify(snap);
  const r1 = deriveAgy(snap, NOW);
  const r2 = deriveAgy(snap, NOW);
  assert.deepStrictEqual(r1, r2);
  assert.strictEqual(JSON.stringify(snap), snapJson);
});


