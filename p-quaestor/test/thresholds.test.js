'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  THRESHOLD_KEYS,
  ALLOWED_KEYS,
  validateThresholdRequest,
  mergeIntoConfig,
  formatThresholdLog
} = require('../lib/thresholds');
const { parseLogTail } = require('../lib/logparse');

const SRC_PATH = path.join(__dirname, '..', 'lib', 'thresholds.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

const NOW = Date.parse('2026-09-03T12:00:00Z');
const FUTURE = '2026-09-09T00:00:00Z';
const PAST = '2026-08-01T00:00:00Z';

const APPLIED = { weekly_stop: 99, weekly_release: 70, session_stop: 99, session_release: 75 };
const APPLIED_TIGHT = { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 };

test('module purity: exports required names', () => {
  assert.strictEqual(typeof validateThresholdRequest, 'function');
  assert.strictEqual(typeof mergeIntoConfig, 'function');
  assert.strictEqual(typeof formatThresholdLog, 'function');
  assert.deepStrictEqual(THRESHOLD_KEYS, ['weekly_stop', 'weekly_release', 'session_stop', 'session_release']);
  assert.deepStrictEqual(ALLOWED_KEYS, THRESHOLD_KEYS.concat(['expires_at']));
});

test('module purity: does not require http/net, does not call Date.now()', () => {
  assert.ok(!/require\(\s*['"](?:node:)?http['"]\s*\)/.test(SRC), 'must not require http');
  assert.ok(!/require\(\s*['"](?:node:)?net['"]\s*\)/.test(SRC), 'must not require net');
  assert.ok(!/Date\.now\s*\(/.test(SRC), 'must not call Date.now()');
});

test('module purity: no literal "claude" in source', () => {
  assert.ok(!/claude/i.test(SRC));
});

test('tighten: 99,99 -> 85,90 succeeds', () => {
  const r = validateThresholdRequest({ weekly_stop: 85, session_stop: 90 }, APPLIED, null, NOW);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.direction, 'tighten');
});

test('tighten: identical request is tighten', () => {
  const r = validateThresholdRequest({ weekly_stop: 99, session_stop: 99 }, APPLIED, null, NOW);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.direction, 'tighten');
});

test('tighten: only *_release changed is tighten', () => {
  const r = validateThresholdRequest({ weekly_release: 65 }, APPLIED, null, NOW);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.direction, 'tighten');
});

test('loosen without expires_at is rejected (400 loosen-requires-expiry)', () => {
  const r = validateThresholdRequest({ weekly_stop: 99 }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.reason, 'loosen-requires-expiry');
});

test('loosen with future expires_at succeeds', () => {
  const r = validateThresholdRequest({ weekly_stop: 99, expires_at: FUTURE }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.direction, 'loosen');
  assert.strictEqual(r.expiresAt, FUTURE);
});

test('loosen with past expires_at is rejected (400 expiry-in-past)', () => {
  const r = validateThresholdRequest({ weekly_stop: 99, expires_at: PAST }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.reason, 'expiry-in-past');
});

test('invalid expires_at string is rejected (400 invalid-expiry)', () => {
  const r = validateThresholdRequest({ weekly_stop: 99, expires_at: 'not-a-date' }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.reason, 'invalid-expiry');
});

test('loosen with omitted expires_at but future currentExpiresAt succeeds', () => {
  const r = validateThresholdRequest({ weekly_stop: 99 }, APPLIED_TIGHT, FUTURE, NOW);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.direction, 'loosen');
  assert.strictEqual(r.expiresAt, FUTURE);
});

test('loosen with omitted expires_at and null currentExpiresAt is rejected', () => {
  const r = validateThresholdRequest({ weekly_stop: 99 }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'loosen-requires-expiry');
});

test('loosen with omitted expires_at and past currentExpiresAt is rejected', () => {
  const r = validateThresholdRequest({ weekly_stop: 99 }, APPLIED_TIGHT, PAST, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'loosen-requires-expiry');
});

test('explicit expires_at:null allowed when both *_stop within HARD_DEFAULTS', () => {
  const r = validateThresholdRequest({ weekly_stop: 85, session_stop: 90, expires_at: null }, APPLIED, FUTURE, NOW);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.expiresAt, null);
});

test('explicit expires_at:null rejected when *_stop above HARD_DEFAULTS', () => {
  const r = validateThresholdRequest({ weekly_stop: 99, expires_at: null }, APPLIED_TIGHT, FUTURE, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'loosen-requires-expiry');
});

test('loosen-requires-expiry error message mentions hard defaults / temporary file', () => {
  const r = validateThresholdRequest({ weekly_stop: 99 }, APPLIED_TIGHT, null, NOW);
  assert.match(r.error, /hard default/i);
  assert.match(r.error, /temporary/i);
});

test('hysteresis: weekly_stop <= weekly_release rejected', () => {
  const r = validateThresholdRequest({ weekly_stop: 60 }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.reason, 'hysteresis-violation');
});

test('hysteresis: session_stop <= session_release rejected', () => {
  const r = validateThresholdRequest({ session_stop: 70 }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'hysteresis-violation');
});

test('hysteresis: equal stop/release rejected', () => {
  const r = validateThresholdRequest({ weekly_stop: 70 }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'hysteresis-violation');
});

test('invalid value: non-integer rejected', () => {
  const r = validateThresholdRequest({ weekly_stop: 85.5 }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'invalid-value');
});

test('invalid value: non-numeric string rejected', () => {
  const r = validateThresholdRequest({ weekly_stop: '85' }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'invalid-value');
});

test('invalid value: null rejected', () => {
  const r = validateThresholdRequest({ weekly_stop: null }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'invalid-value');
});

test('invalid value: boolean rejected', () => {
  const r = validateThresholdRequest({ weekly_stop: true }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'invalid-value');
});

test('invalid value: out of range rejected', () => {
  const r1 = validateThresholdRequest({ weekly_stop: -1 }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r1.reason, 'invalid-value');
  const r2 = validateThresholdRequest({ weekly_stop: 101 }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r2.reason, 'invalid-value');
});

test('unknown key rejected', () => {
  const r = validateThresholdRequest({ weekly_stop: 85, foo: 1 }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.reason, 'unknown-key');
});

test('unknown key: enabled/control rejected', () => {
  const r1 = validateThresholdRequest({ enabled: false }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r1.reason, 'unknown-key');
  const r2 = validateThresholdRequest({ control: { port: 1 } }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r2.reason, 'unknown-key');
});

test('invalid body: null/array/non-object rejected', () => {
  assert.strictEqual(validateThresholdRequest(null, APPLIED_TIGHT, null, NOW).reason, 'invalid-body');
  assert.strictEqual(validateThresholdRequest([], APPLIED_TIGHT, null, NOW).reason, 'invalid-body');
  assert.strictEqual(validateThresholdRequest('x', APPLIED_TIGHT, null, NOW).reason, 'invalid-body');
});

test('invalid body: empty object rejected', () => {
  const r = validateThresholdRequest({}, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'invalid-body');
});

test('partial request: other 3 values unchanged in next', () => {
  const r = validateThresholdRequest({ weekly_stop: 85 }, APPLIED_TIGHT, null, NOW);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.next.weekly_release, APPLIED_TIGHT.weekly_release);
  assert.strictEqual(r.next.session_stop, APPLIED_TIGHT.session_stop);
  assert.strictEqual(r.next.session_release, APPLIED_TIGHT.session_release);
});

test('returns previous and next with all 4 values', () => {
  const r = validateThresholdRequest({ weekly_stop: 80 }, APPLIED_TIGHT, null, NOW);
  assert.deepStrictEqual(r.previous, APPLIED_TIGHT);
  assert.strictEqual(Object.keys(r.next).length, 4);
});

test('mergeIntoConfig preserves other keys', () => {
  const rawConfig = { enabled: false, control: { port: 3999, authToken: 't' }, note: 'x', thresholds: APPLIED_TIGHT };
  const next = { weekly_stop: 80, weekly_release: 70, session_stop: 90, session_release: 75 };
  const merged = mergeIntoConfig(rawConfig, next, null);
  assert.strictEqual(merged.enabled, false);
  assert.strictEqual(merged.control.port, 3999);
  assert.strictEqual(merged.control.authToken, 't');
  assert.strictEqual(merged.note, 'x');
  assert.deepStrictEqual(merged.thresholds, next);
  assert.strictEqual(merged.expires_at, null);
});

test('mergeIntoConfig does not mutate input', () => {
  const rawConfig = { enabled: true, thresholds: { weekly_stop: 99 } };
  const before = JSON.parse(JSON.stringify(rawConfig));
  mergeIntoConfig(rawConfig, { weekly_stop: 85 }, FUTURE);
  assert.deepStrictEqual(rawConfig, before);
});

test('mergeIntoConfig handles missing/non-object thresholds', () => {
  const merged = mergeIntoConfig({ enabled: true }, APPLIED_TIGHT, null);
  assert.deepStrictEqual(merged.thresholds, APPLIED_TIGHT);
});

test('formatThresholdLog format and no forbidden tokens', () => {
  const line = formatThresholdLog('loosen', [
    { key: 'weekly_stop', from: 85, to: 99 },
    { key: 'session_stop', from: 90, to: 99 }
  ], FUTURE);
  assert.ok(line.startsWith('[thresholds] loosen:'));
  assert.ok(line.indexOf('weekly_stop 85->99') !== -1);
  assert.ok(line.indexOf('session_stop 90->99') !== -1);
  assert.ok(line.indexOf('expires_at=' + FUTURE) !== -1);
  assert.ok(line.indexOf('%') === -1);
  assert.ok(line.indexOf('session=') === -1);
  assert.ok(line.indexOf('weekly=') === -1);
});

test('formatThresholdLog with no expiry says none, unchanged keys omitted', () => {
  const line = formatThresholdLog('tighten', [{ key: 'weekly_stop', from: 99, to: 85 }], null);
  assert.ok(line.indexOf('expires_at=none') !== -1);
  assert.ok(line.indexOf('session_stop') === -1);
});

test('generated log line does not confuse 005 parseLogTail (returns null)', () => {
  const line = '2026-09-03T12:00:00.000Z ' + formatThresholdLog('loosen', [
    { key: 'weekly_stop', from: 85, to: 99 }
  ], FUTURE);
  const result = parseLogTail([line]);
  assert.strictEqual(result, null);
});
