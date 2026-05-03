'use strict';

// IMPORTANT: this function runs inside the browser page context.
// Do not reference Node globals.
function extractUsage() {
  const text = document.body.innerText;
  function pctAfter(anchor) {
    const idx = text.indexOf(anchor);
    if (idx < 0) return null;
    const w = text.slice(idx, idx + 300);
    const m = w.match(/(\d{1,3})\s*%/);
    return m ? parseInt(m[1], 10) : null;
  }
  function resetAfter(anchor) {
    const idx = text.indexOf(anchor);
    if (idx < 0) return null;
    const w = text.slice(idx, idx + 300);
    const m = w.match(/(\([월화수목금토일]\)\s*[^\n]+에\s*재설정|[\d시간분 ]+후\s*재설정)/);
    return m ? m[0].trim() : null;
  }
  const planMatch = text.match(/Max\s*\(\s*(\d+)x\s*\)/);
  return {
    plan: planMatch ? `Max (${planMatch[1]}x)` : null,
    session_pct: pctAfter('현재 세션'),
    session_reset: resetAfter('현재 세션'),
    weekly_pct: pctAfter('모든 모델'),
    weekly_reset: resetAfter('모든 모델'),
    last_update: (text.match(/마지막 업데이트:[^\n]+/) || [null])[0]
  };
}

module.exports = { extractUsage };
