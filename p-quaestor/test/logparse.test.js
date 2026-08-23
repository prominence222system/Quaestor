'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { parseLogTail } = require('../lib/logparse');
const { deriveState } = require('../lib/observation');

const SRC_PATH = path.join(__dirname, '..', 'lib', 'logparse.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

test('logparse.js source does not read wall-clock time or fs', () => {
  assert.ok(!/Date\.now\s*\(/.test(SRC), 'must not call Date.now()');
  assert.ok(!/new Date\s*\(\s*\)/.test(SRC), 'must not call new Date() with no args');
  assert.ok(!/require\(\s*['"](?:node:)?fs['"]\s*\)/.test(SRC), 'must not require fs');
});

test('parseLogTail is pure and deterministic (same input -> same output)', () => {
  const lines = [
    '2026-07-28T11:58:12.472Z session=24% weekly=24%',
    '2026-07-28T12:13:00.000Z [poll error] scrape failed: timeout kind=nav-failed'
  ];
  const r1 = parseLogTail(lines);
  const r2 = parseLogTail(lines);
  assert.deepStrictEqual(r1, r2);
});

test('26-day silence fixture: 1 success line + 500 failure lines yields deriveState() === crit', () => {
  const lines = [
    '2026-07-28T11:58:12.472Z session=24% weekly=24%'
  ];
  const baseTime = Date.parse('2026-07-28T12:13:00.000Z');
  for (let i = 0; i < 500; i++) {
    const ts = new Date(baseTime + i * 15 * 60 * 1000).toISOString();
    lines.push(`${ts} [poll error] scrape failed: timeout`);
  }

  const parsedObs = parseLogTail(lines);
  assert.ok(parsedObs !== null, 'parsedObs should not be null');
  assert.strictEqual(parsedObs.lastSuccessAt, Date.parse('2026-07-28T11:58:12.472Z'));
  assert.strictEqual(parsedObs.consecutiveFailures, 500);

  const now = Date.parse('2026-08-23T12:00:00.000Z'); // ~26 days later
  const ctx = { enabled: true, configSource: 'default' };
  const res = deriveState(parsedObs, ctx, now);

  assert.strictEqual(res.state, 'crit', 'state must be crit, not warn or ok');
});

test('log with no success line yields lastSuccessAt === null and lastUsage === null', () => {
  const lines = [
    '2026-07-25T10:00:00.000Z [poll error] scrape failed: timeout',
    '2026-07-25T10:15:00.000Z [poll error] scrape failed: timeout'
  ];
  const parsedObs = parseLogTail(lines);
  assert.ok(parsedObs !== null);
  assert.strictEqual(parsedObs.lastSuccessAt, null);
  assert.strictEqual(parsedObs.lastUsage, null);
  assert.strictEqual(parsedObs.consecutiveFailures, 2);
});

test('old format failure line without kind= yields kind === unknown and detail === null', () => {
  const lines = [
    '2026-07-25T10:00:00.000Z [poll error] scrape failed: selector timeout'
  ];
  const parsedObs = parseLogTail(lines);
  assert.ok(parsedObs !== null);
  assert.deepStrictEqual(parsedObs.lastFailure, {
    kind: 'unknown',
    detail: null,
    at: Date.parse('2026-07-25T10:00:00.000Z')
  });
});

test('failure lines before last success line are excluded from consecutiveFailures', () => {
  const lines = [
    '2026-07-28T10:00:00.000Z [poll error] scrape failed: timeout kind=nav-failed',
    '2026-07-28T10:15:00.000Z [poll error] scrape failed: timeout kind=nav-failed',
    '2026-07-28T10:30:00.000Z session=15% weekly=20%',
    '2026-07-28T10:45:00.000Z [poll error] scrape failed: timeout kind=anchor-missing hint=login-expired',
    '2026-07-28T11:00:00.000Z [poll error] scrape failed: timeout kind=anchor-missing hint=login-expired'
  ];
  const parsedObs = parseLogTail(lines);
  assert.ok(parsedObs !== null);
  assert.strictEqual(parsedObs.consecutiveFailures, 2);
  assert.strictEqual(parsedObs.lastSuccessAt, Date.parse('2026-07-28T10:30:00.000Z'));
  assert.deepStrictEqual(parsedObs.lastUsage, { session_pct: 15, weekly_pct: 20 });
  assert.deepStrictEqual(parsedObs.lastFailure, {
    kind: 'anchor-missing',
    detail: { hint: 'login-expired' },
    at: Date.parse('2026-07-28T11:00:00.000Z')
  });
});

test('empty lines or lines without valid events return null', () => {
  assert.strictEqual(parseLogTail([]), null);
  assert.strictEqual(parseLogTail(null), null);
  assert.strictEqual(parseLogTail(['[start] bellows watcher. interval=15m']), null);
});
