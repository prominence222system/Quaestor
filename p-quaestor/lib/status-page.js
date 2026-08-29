'use strict';
// Pure renderer: /api/status payload -> a complete HTML document string.
// No I/O, no wall-clock reads, no re-judgement -- see output/DESIGN.md.
//
// Design invariants (see output/DESIGN.md D1-D11):
// - This module never calls any of the judgement functions in
//   ./observation.js. It only reads the already-derived payload and
//   draws it.
// - Ignorance (allowed === null, or any missing/malformed input) always
//   renders as "unknown" -- never as "allowed" (green).
// - null numeric fields render as "no measurement" text, never as 0/0%.
// - Zero external resource references: CSS and JS are inlined below.
// - The literal class token "st-allowed" (the only green token) is never
//   written into the static <style> block -- it only appears in the root
//   element's class attribute, and only when allowance.allowed === true.
//   This keeps "st-allowed does not appear unless allowed===true" true at
//   the level of the raw HTML string, not just at the level of applied
//   styles.
// - Korean text below is UI-facing display copy (page labels), the one
//   exception to English-only code/comments in this project.

const DEFAULT_POLL_MS = 30000;

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(v) {
  return String(v).replace(/[&<>"']/g, function (ch) { return ESCAPE_MAP[ch]; });
}

const NO_MEASUREMENT = '측정 없음';

function formatPct(v) {
  return typeof v === 'number' ? (v + '%') : NO_MEASUREMENT;
}

function formatHeadroom(v) {
  return typeof v === 'number' ? (v + '%p 남음') : NO_MEASUREMENT;
}

function formatAge(sec) {
  if (typeof sec !== 'number') return NO_MEASUREMENT;
  if (sec < 60) return '방금';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + '분 전';
  const hr = Math.floor(sec / 3600);
  if (hr < 24) return hr + '시간 전';
  const day = Math.floor(sec / 86400);
  return day + '일 전';
}

function statusClass(allowed) {
  if (allowed === true) return 'st-allowed';
  if (allowed === false) return 'st-blocked';
  return 'st-unknown';
}

function statusLabel(allowed) {
  if (allowed === true) return '사용 가능';
  if (allowed === false) return '차단됨';
  return '모름';
}

function fieldValue(fields, label) {
  if (!Array.isArray(fields)) return null;
  const f = fields.find(function (x) { return x && x.label === label; });
  return (f && typeof f.value === 'string') ? f.value : null;
}

// D3: the browser never re-judges anything. It only compares this string
// (embedded server-side as data-sig) against the same string recomputed
// client-side from the next /api/status poll, and reloads on mismatch.
function signature(payload) {
  const p = (payload && typeof payload === 'object') ? payload : {};
  const allowance = (p.allowance && typeof p.allowance === 'object') ? p.allowance : {};
  const usage = (p.usage && typeof p.usage === 'object') ? p.usage : {};
  return [
    String(allowance.allowed),
    String(allowance.reason),
    String(usage.session_pct),
    String(usage.weekly_pct),
    String(usage.stale),
    String(usage.measured_at),
    String(p.state)
  ].join('|');
}

function gaugeHtml(pct) {
  if (typeof pct !== 'number') return '';
  const w = Math.max(0, Math.min(100, pct));
  return '<div class="gauge"><div class="gauge-fill" style="width:' + w + '%"></div></div>';
}

function styleBlock() {
  // No ".st-allowed" or ".st-stale" selector here on purpose -- their
  // styling is applied inline, conditionally, so the class tokens
  // themselves never appear in this static block. See module header.
  return '' +
    '*{box-sizing:border-box}' +
    'body{margin:0;padding:24px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f6f8fa;color:#1f2328}' +
    '.wrap{max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.1)}' +
    'h1{font-size:1.1rem;margin:0 0 16px;color:#57606a}' +
    '.badge{display:inline-block;padding:8px 20px;border-radius:999px;font-weight:700;font-size:1.2rem;background:#6e7781;color:#fff}' +
    '.st-blocked .badge{background:#cf222e}' +
    '.st-unknown .badge{background:#6e7781}' +
    '.reason{color:#57606a;margin:8px 0 0}' +
    'section{margin-top:20px;padding-top:16px;border-top:1px solid #d0d7de}' +
    'section h2{font-size:.85rem;text-transform:uppercase;letter-spacing:.04em;color:#57606a;margin:0 0 8px}' +
    '.row{display:flex;justify-content:space-between;align-items:center;margin:6px 0}' +
    '.gauge{background:#e6e9ec;border-radius:6px;height:8px;flex:1;margin:0 12px;overflow:hidden}' +
    '.gauge-fill{background:#57606a;height:100%}' +
    '.stale-flag{color:#9a6700;font-weight:700;margin-left:8px}' +
    '.field{margin:4px 0}';
}

function scriptBlock(pollMs) {
  // No badge label literals here on purpose -- labels are chosen only by
  // the server, never re-derived in the browser. See D3.
  return '(function(){' +
    'var el=document.querySelector(".wrap");' +
    'if(!el)return;' +
    'var sig=el.getAttribute("data-sig");' +
    'function sigOf(d){' +
      'var a=(d&&d.allowance)||{};' +
      'var u=(d&&d.usage)||{};' +
      'return [String(a.allowed),String(a.reason),String(u.session_pct),String(u.weekly_pct),String(u.stale),String(u.measured_at),String(d&&d.state)].join("|");' +
    '}' +
    'setInterval(function(){' +
      'fetch("/api/status",{cache:"no-store"})' +
        '.then(function(r){return r.ok?r.json():null;})' +
        '.then(function(d){if(d&&sigOf(d)!==sig){location.reload();}})' +
        '.catch(function(){});' +
    '},' + pollMs + ');' +
  '})();';
}

// payload: the same object shape returned by GET /api/status.
// opts: { pollMs?: number }
// Never throws -- missing/malformed input renders as the "unknown" state.
function renderStatusPage(payload, opts) {
  const p = (payload && typeof payload === 'object') ? payload : {};
  const allowance = (p.allowance && typeof p.allowance === 'object') ? p.allowance : {};
  const usage = (p.usage && typeof p.usage === 'object') ? p.usage : {};
  const thresholds = (usage.thresholds && typeof usage.thresholds === 'object') ? usage.thresholds : {};
  const fields = Array.isArray(p.fields) ? p.fields : [];
  const state = typeof p.state === 'string' ? p.state : null;
  const summary = typeof p.summary === 'string' ? p.summary : null;
  const o = (opts && typeof opts === 'object') ? opts : {};
  const pollMs = (typeof o.pollMs === 'number' && o.pollMs > 0) ? o.pollMs : DEFAULT_POLL_MS;

  const allowed = allowance.allowed === true ? true : (allowance.allowed === false ? false : null);
  const cls = statusClass(allowed);
  const label = statusLabel(allowed);
  // reason is a raw enum value from ./observation (e.g. "unmeasurable",
  // "over-threshold") -- shown as-is, not translated (D4).
  const reason = typeof allowance.reason === 'string' ? allowance.reason : NO_MEASUREMENT;
  const stale = usage.stale === true;

  // Only the true case gets an inline color -- keeps the literal token
  // "st-allowed" out of the static <style> block entirely (see D4).
  const badgeStyle = cls === 'st-allowed' ? ' style="background:#1a7f37"' : '';
  const wrapStyle = stale ? ' style="border:2px dashed #d4a72c"' : '';

  const wrapClasses = ['wrap', cls];
  if (stale) wrapClasses.push('st-stale');

  const sig = signature(p);

  const measuredAt = typeof usage.measured_at === 'string' ? usage.measured_at : null;
  const measuredLine = measuredAt
    ? (esc(measuredAt) + ' (' + esc(formatAge(usage.age_sec)) + ')')
    : NO_MEASUREMENT;
  const staleFlag = stale ? '<span class="stale-flag">낡은 값</span>' : '';

  // The observation module's field labels are Korean; read them directly
  // so this stays a thin projection, not a re-derivation.
  const stopLine = fieldValue(fields, 'STOP') || '없음';
  const failureLine = fieldValue(fields, '마지막 실패') || '없음';

  const html = '' +
    '<!doctype html>\n' +
    '<html lang="ko">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>Quaestor \u2014 사용량</title>\n' +
    '<style>' + styleBlock() + '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '<main class="' + esc(wrapClasses.join(' ')) + '" data-sig="' + esc(sig) + '"' + wrapStyle + '>\n' +
    '<h1>Quaestor</h1>\n' +
    '<div class="badge"' + badgeStyle + '>' + esc(label) + '</div>\n' +
    '<p class="reason">reason: ' + esc(reason) + '</p>\n' +
    '<section>\n' +
    '<h2>사용량</h2>\n' +
    '<div class="row"><span>세션</span>' + gaugeHtml(usage.session_pct) + '<span>' + esc(formatPct(usage.session_pct)) + ' \u00B7 ' + esc(formatHeadroom(usage.session_headroom)) + '</span></div>\n' +
    '<div class="row"><span>주간</span>' + gaugeHtml(usage.weekly_pct) + '<span>' + esc(formatPct(usage.weekly_pct)) + ' \u00B7 ' + esc(formatHeadroom(usage.weekly_headroom)) + '</span></div>\n' +
    '</section>\n' +
    '<section>\n' +
    '<h2>임계값</h2>\n' +
    '<div class="field">주간 정지 ' + esc(formatPct(thresholds.weekly_stop)) + ' / 해제 ' + esc(formatPct(thresholds.weekly_release)) + '</div>\n' +
    '<div class="field">세션 정지 ' + esc(formatPct(thresholds.session_stop)) + ' / 해제 ' + esc(formatPct(thresholds.session_release)) + '</div>\n' +
    '</section>\n' +
    '<section>\n' +
    '<h2>마지막 측정</h2>\n' +
    '<div class="field">' + measuredLine + staleFlag + '</div>\n' +
    '</section>\n' +
    '<section>\n' +
    '<h2>STOP</h2>\n' +
    '<div class="field">' + esc(stopLine) + '</div>\n' +
    '</section>\n' +
    '<section>\n' +
    '<h2>마지막 실패</h2>\n' +
    '<div class="field">' + esc(failureLine) + '</div>\n' +
    '</section>\n' +
    '<section>\n' +
    '<h2>감시 상태</h2>\n' +
    '<div class="field">' + esc(state || NO_MEASUREMENT) + ' \u00B7 ' + esc(summary || NO_MEASUREMENT) + '</div>\n' +
    '</section>\n' +
    '</main>\n' +
    '<script>' + scriptBlock(pollMs) + '</script>\n' +
    '</body>\n' +
    '</html>\n';

  return html;
}

module.exports = { renderStatusPage, esc, formatPct, formatAge, statusClass, signature };
