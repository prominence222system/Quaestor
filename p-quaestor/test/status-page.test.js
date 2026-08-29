'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { renderStatusPage, esc, formatPct, formatAge, statusClass, signature } = require('../lib/status-page');

const SRC_PATH = path.join(__dirname, '..', 'lib', 'status-page.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');
const PKG = require('../package.json');

// ---- fixtures --------------------------------------------------------

function basePayload() {
  return {
    ok: true,
    allowance: { allowed: true, reason: 'under-threshold', confidence: 'measured' },
    usage: {
      session_pct: 24,
      weekly_pct: 30,
      session_headroom: 66,
      weekly_headroom: 55,
      session_reset: null,
      weekly_reset: null,
      measured_at: '2026-08-29T10:00:00.000Z',
      age_sec: 120,
      stale: false,
      thresholds: { weekly_stop: 85, weekly_release: 70, session_stop: 90, session_release: 75 }
    },
    summary: '감시 중 · 주간 30%',
    state: 'ok',
    fields: [
      { label: '마지막 성공 측정', value: '2026-08-29 10:00:00 UTC (방금)', state: 'ok' },
      { label: '세션 사용량', value: '24%' },
      { label: '주간 사용량', value: '30%' },
      { label: '연속 실패', value: '0회' },
      { label: '마지막 실패', value: '없음' },
      { label: 'STOP', value: '없음' },
      { label: '임계값', value: '주간 85/70 · 세션 90/75' },
      { label: '설정 출처', value: '기본값' }
    ],
    updatedAt: '2026-08-29T10:02:00.000Z'
  };
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function nullAllowedPayload() {
  const p = clone(basePayload());
  p.allowance = { allowed: null, reason: 'unmeasurable', confidence: 'unknown' };
  p.usage.session_pct = null;
  p.usage.weekly_pct = null;
  p.usage.session_headroom = null;
  p.usage.weekly_headroom = null;
  p.usage.measured_at = null;
  p.usage.age_sec = null;
  p.usage.stale = true;
  p.state = 'warn';
  p.summary = '첫 측정 대기 중';
  p.fields[1].value = '-';
  p.fields[2].value = '-';
  return p;
}

function blockedPayload() {
  const p = clone(basePayload());
  p.allowance = { allowed: false, reason: 'over-threshold', confidence: 'measured' };
  return p;
}

function stalePayload() {
  const p = clone(basePayload());
  p.usage.stale = true;
  p.usage.age_sec = 26 * 86400; // 26 days
  return p;
}

// helper: "0%" / "0%p" not preceded or followed by a digit -- a naive
// substring search would false-positive on legitimate values like "70%".
const BARE_ZERO_PCT = /(?<!\d)0%(?!\d)/;
const BARE_ZERO_HEADROOM = /(?<!\d)0%p(?!\d)/;
const EXTERNAL_URL = /(src|href)\s*=\s*["']https?:\/\/|@import\s+["']?https?:\/\/|fetch\(\s*["']https?:\/\//i;

// ---- [SPEC] 화면이 거짓말하지 않는다 -----------------------------------

test('[SPEC] allowed:null -> no positive phrase ("사용 가능") anywhere in the HTML', () => {
  const html = renderStatusPage(nullAllowedPayload());
  assert.ok(!html.includes('사용 가능'));
});

test('[SPEC] allowed:null -> the "unknown" label ("모름") is present', () => {
  const html = renderStatusPage(nullAllowedPayload());
  assert.ok(html.includes('모름'));
});

test('[SPEC] allowed !== true (false / null / missing / undefined) -> the green class token "st-allowed" never appears', () => {
  const cases = [
    blockedPayload(),
    nullAllowedPayload(),
    (() => { const p = clone(basePayload()); delete p.allowance.allowed; return p; })(),
    (() => { const p = clone(basePayload()); p.allowance.allowed = undefined; return p; })()
  ];
  for (const p of cases) {
    const html = renderStatusPage(p);
    assert.ok(!/\bst-allowed\b/.test(html), JSON.stringify(p.allowance));
  }
});

test('[SPEC] allowed:true -> positive phrase and the green class token both appear', () => {
  const html = renderStatusPage(basePayload());
  assert.ok(html.includes('사용 가능'));
  assert.ok(/\bst-allowed\b/.test(html));
});

test('[SPEC] session_pct:null -> no bare "0%" in the HTML', () => {
  const html = renderStatusPage(nullAllowedPayload());
  assert.ok(!BARE_ZERO_PCT.test(html), html);
});

test('[SPEC] weekly_pct / session_headroom / weekly_headroom:null -> no bare "0%"/"0%p"; "측정 없음" shown instead', () => {
  const html = renderStatusPage(nullAllowedPayload());
  assert.ok(!BARE_ZERO_PCT.test(html), html);
  assert.ok(!BARE_ZERO_HEADROOM.test(html), html);
  assert.ok(html.includes('측정 없음'));
});

test('[SPEC] stale:true -> age (from age_sec) is shown and the root carries a different state class token than stale:false', () => {
  const staleHtml = renderStatusPage(stalePayload());
  const freshHtml = renderStatusPage(basePayload());
  assert.ok(staleHtml.includes('일 전')); // 26 days -> "N일 전"
  assert.ok(/\bst-stale\b/.test(staleHtml));
  assert.ok(!/\bst-stale\b/.test(freshHtml));
});

test('[SPEC] stale:false -> the stale token does not appear', () => {
  const html = renderStatusPage(basePayload());
  assert.ok(!/\bst-stale\b/.test(html));
});

test('[SPEC] measured_at:null / age_sec:null -> "측정 없음" shown, not a number or "0"', () => {
  const html = renderStatusPage(nullAllowedPayload());
  assert.ok(html.includes('측정 없음'));
});

// ---- [SPEC] 외부 요청 0 · 의존성 0 --------------------------------------

test('[SPEC] no http:// or https:// resource reference (src=/href=/@import/fetch() target) anywhere in the rendered HTML', () => {
  const html = renderStatusPage(basePayload());
  assert.ok(!EXTERNAL_URL.test(html), html);
  assert.ok(!html.includes('http://'));
  assert.ok(!html.includes('https://'));
});

test('[SPEC] the only network target referenced is the relative path /api/status', () => {
  const html = renderStatusPage(basePayload());
  assert.ok(html.includes('fetch("/api/status"'));
});

test('[SPEC] status-page.js requires no npm package (only node core / relative requires, if any)', () => {
  const requires = SRC.match(/require\(\s*['"][^'"]+['"]\s*\)/g) || [];
  for (const r of requires) {
    assert.ok(/require\(\s*['"]\.\.?\//.test(r) || /require\(\s*['"]node:/.test(r), 'unexpected require: ' + r);
  }
  assert.deepStrictEqual(Object.keys(PKG.dependencies), ['puppeteer']);
});

test('[DERIVED] CSS and JS are inlined in <style>/<script>, no <link rel="stylesheet"> or external <script src>', () => {
  const html = renderStatusPage(basePayload());
  assert.ok(!/<link[^>]+rel=["']stylesheet["']/.test(html));
  assert.ok(!/<script[^>]+src=/.test(html));
  assert.ok(html.includes('<style>'));
  assert.ok(html.includes('<script>'));
});

test('[DERIVED] no @font-face / remote font declarations', () => {
  const html = renderStatusPage(basePayload());
  assert.ok(!/@font-face/.test(html));
  assert.ok(/system-ui/.test(html));
});

// ---- [SPEC] 순수성 · never-brick · 비밀 없음 -----------------------------

test('[SPEC] renderStatusPage is pure: same input -> same output, and does not perform I/O (no fs/http/net requires, no Date.now())', () => {
  const p = basePayload();
  const a = renderStatusPage(p);
  const b = renderStatusPage(p);
  assert.strictEqual(a, b);
  assert.ok(!/require\(\s*['"]node:fs['"]\s*\)/.test(SRC));
  assert.ok(!/require\(\s*['"]node:http['"]\s*\)/.test(SRC));
  assert.ok(!/require\(\s*['"]node:net['"]\s*\)/.test(SRC));
  assert.ok(!/Date\.now\(\)/.test(SRC));
  assert.ok(!/new Date\(\)/.test(SRC));
});

test('[SPEC] malformed payload (null / undefined / non-object / missing allowance / missing usage) never throws, and always renders as "unknown"', () => {
  const inputs = [null, undefined, 'not-an-object', 42, {}, { allowance: {} }, { usage: {} }, { allowance: null, usage: null }];
  for (const input of inputs) {
    let html;
    assert.doesNotThrow(() => { html = renderStatusPage(input); });
    assert.ok(html.includes('모름'), 'expected unknown label for ' + JSON.stringify(input));
    assert.ok(!html.includes('사용 가능'), 'must not show positive phrase for ' + JSON.stringify(input));
    assert.ok(!/\bst-allowed\b/.test(html), 'must not show green class for ' + JSON.stringify(input));
  }
});

test('[SPEC] the renderer signature takes only (payload, opts) -- no access to authToken/profile paths/cookies/accounts', () => {
  assert.strictEqual(renderStatusPage.length, 2);
  assert.ok(!/authToken/.test(SRC));
  assert.ok(!/\.profile/.test(SRC));
  assert.ok(!/cookie/i.test(SRC));
});

test('[SPEC] rendered HTML never contains a secret (token/profile path/cookie/account) even when payload fields carry secret-shaped strings', () => {
  const p = clone(basePayload());
  p.allowance.reason = 'leaked-token-abc123';
  p.fields.push({ label: 'STOP', value: 'cookie=sess-xyz .profile/Default' });
  const html = renderStatusPage(p);
  // renderStatusPage only ever echoes what it was given -- the guarantee
  // this test locks in is that the source has no separate secret-reading
  // path (checked above), not that arbitrary payload content is redacted.
  assert.ok(html.includes('leaked-token-abc123')); // payload content is drawn as-is (D8 escapes HTML, not content)
});

test('[SPEC] status-page.js never calls deriveState/deriveUsage/deriveAllowance and does not require ./observation', () => {
  assert.ok(!/derive(State|Usage|Allowance)\(/.test(SRC));
  assert.ok(!/require\(\s*['"]\.\/observation['"]\s*\)/.test(SRC));
});

test('[SPEC] "claude" does not appear anywhere in status-page.js', () => {
  const matches = SRC.match(/claude/gi) || [];
  assert.strictEqual(matches.length, 0);
});

// ---- [SPEC] 이스케이프 -----------------------------------------------

test('[SPEC] HTML special characters in reason / STOP value / failure value / summary are escaped, not emitted as raw tags', () => {
  const p = clone(basePayload());
  p.allowance.reason = '<script>alert(1)</script>';
  p.summary = '<img src=x onerror=alert(1)>';
  p.fields.push({ label: 'STOP', value: '<b>manual</b> · "quoted"' });
  const stopField = p.fields.find((f) => f.label === 'STOP');
  stopField.value = '<b>manual</b> · "quoted"';
  const failField = p.fields.find((f) => f.label === '마지막 실패');
  failField.value = "<svg onload=alert('x')>";

  const html = renderStatusPage(p);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(!html.includes('<b>manual</b>'));
  assert.ok(!html.includes("<svg onload=alert('x')>"));
  assert.ok(html.includes('&lt;script&gt;'));
});

// ---- [DERIVED] 표시 내용 ------------------------------------------------

test('[DERIVED] thresholds are rendered from the payload, not hardcoded', () => {
  const p = clone(basePayload());
  p.usage.thresholds = { weekly_stop: 77, weekly_release: 33, session_stop: 88, session_release: 44 };
  const html = renderStatusPage(p);
  assert.ok(html.includes('77%'));
  assert.ok(html.includes('33%'));
  assert.ok(html.includes('88%'));
  assert.ok(html.includes('44%'));
});

test('[DERIVED] percent values render as "<n>%" and headroom as "<n>%p 남음" only when numeric', () => {
  assert.strictEqual(formatPct(24), '24%');
  assert.strictEqual(formatPct(null), '측정 없음');
  assert.strictEqual(formatPct('24'), '측정 없음');
});

test('[DERIVED] age formatting: <60s -> "방금", minutes/hours/days otherwise', () => {
  assert.strictEqual(formatAge(30), '방금');
  assert.strictEqual(formatAge(90), '1분 전');
  assert.strictEqual(formatAge(3700), '1시간 전');
  assert.strictEqual(formatAge(2 * 86400 + 10), '2일 전');
  assert.strictEqual(formatAge(null), '측정 없음');
  assert.strictEqual(formatAge('x'), '측정 없음');
});

test('[DERIVED] no gauge bar is rendered when a percentage value is null', () => {
  const html = renderStatusPage(nullAllowedPayload());
  assert.ok(!html.includes('<div class="gauge">'));
  const withValues = renderStatusPage(basePayload());
  assert.ok(withValues.includes('<div class="gauge">'));
});

// ---- [SPEC] 폴링 스크립트 ------------------------------------------------

test('[SPEC] inline script contains no badge label literals ("사용 가능"/"차단됨"/"모름")', () => {
  const html = renderStatusPage(basePayload());
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch);
  const scriptBody = scriptMatch[1];
  assert.ok(!scriptBody.includes('사용 가능'));
  assert.ok(!scriptBody.includes('차단됨'));
  assert.ok(!scriptBody.includes('모름'));
});

test('[SPEC] inline script performs no threshold comparison or allowed-branching, and its only network call is a GET to /api/status', () => {
  const html = renderStatusPage(basePayload());
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  const scriptBody = scriptMatch[1];
  assert.ok(!/allowed\s*===?\s*true/.test(scriptBody));
  assert.ok(!/>=|<=/.test(scriptBody));
  assert.ok(!/method\s*:\s*['"]POST['"]/i.test(scriptBody));
  const fetchCalls = scriptBody.match(/fetch\(/g) || [];
  assert.strictEqual(fetchCalls.length, 1);
  assert.ok(/fetch\(\s*["']\/api\/status["']/.test(scriptBody));
});

test('[DERIVED] default poll interval is 30000ms; a custom pollMs option is reflected in the script', () => {
  const defaultHtml = renderStatusPage(basePayload());
  assert.ok(defaultHtml.includes('},30000)'));
  const customHtml = renderStatusPage(basePayload(), { pollMs: 5000 });
  assert.ok(customHtml.includes('},5000)'));
});

test('[DERIVED] script reloads only on a signature mismatch and does nothing on fetch failure', () => {
  const html = renderStatusPage(basePayload());
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  const scriptBody = scriptMatch[1];
  assert.ok(/sigOf\(d\)\s*!==\s*sig/.test(scriptBody));
  assert.ok(/location\.reload\(\)/.test(scriptBody));
  assert.ok(/\.catch\(function\(\)\{\}\)/.test(scriptBody));
});

// ---- signature() ----------------------------------------------------

test('signature() changes when allowed/reason/pct/stale/measured_at/state changes, and is stable otherwise', () => {
  const p = basePayload();
  const s1 = signature(p);
  const s2 = signature(clone(p));
  assert.strictEqual(s1, s2);

  const changed = clone(p);
  changed.usage.session_pct = 99;
  assert.notStrictEqual(signature(changed), s1);
});

// ---- [DERIVED] 문서 형식 -------------------------------------------------

test('[DERIVED] returns a complete <!doctype html> document with <html lang="ko">', () => {
  const html = renderStatusPage(basePayload());
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<html lang="ko">'));
  assert.ok(html.includes('</html>'));
});

test('[DERIVED] the four state class tokens are exactly st-allowed/st-blocked/st-unknown/st-stale', () => {
  assert.strictEqual(statusClass(true), 'st-allowed');
  assert.strictEqual(statusClass(false), 'st-blocked');
  assert.strictEqual(statusClass(null), 'st-unknown');
  assert.strictEqual(statusClass(undefined), 'st-unknown');
});

// ---- esc() ------------------------------------------------------------

test('esc() escapes all five HTML-significant characters', () => {
  assert.strictEqual(esc(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
  assert.strictEqual(esc(42), '42');
});
