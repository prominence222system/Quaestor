'use strict';

/**
 * Pure parser for log tail lines.
 * No I/O, no wall-clock reads (Date methods), no side effects.
 *
 * @param {string[]} lines - Array of log text lines
 * @returns {object|null} Restored observation state object or null if no info found
 */
function parseLogTail(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return null;
  }

  let lastSuccessIdx = -1;
  let lastSuccessAt = null;
  let lastUsage = null;
  let lastFailure = null;
  let failureCount = 0;
  let failuresAfterSuccess = 0;
  let totalValidEvents = 0;

  const isoRe = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/;
  const sessRe = /session=(\d+(?:\.\d+)?)%/;
  const weekRe = /weekly=(\d+(?:\.\d+)?)%/;
  const kindRe = /kind=([^\s]+)/;
  const hintRe = /hint=([^\s]+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (typeof line !== 'string') continue;

    const isoMatch = line.match(isoRe);
    if (!isoMatch) continue;

    const ts = Date.parse(isoMatch[1]);
    if (isNaN(ts)) continue;

    const sessMatch = line.match(sessRe);
    const weekMatch = line.match(weekRe);

    if (sessMatch && weekMatch) {
      const session_pct = parseFloat(sessMatch[1]);
      const weekly_pct = parseFloat(weekMatch[1]);

      if (!isNaN(session_pct) && !isNaN(weekly_pct)) {
        lastSuccessIdx = i;
        lastSuccessAt = ts;
        lastUsage = {
          session_pct: session_pct,
          weekly_pct: weekly_pct
        };
        failuresAfterSuccess = 0;
        totalValidEvents++;
        continue;
      }
    }

    if (line.indexOf('[poll error]') !== -1) {
      const kindMatch = line.match(kindRe);
      const hintMatch = line.match(hintRe);

      const kind = kindMatch ? kindMatch[1] : 'unknown';
      let detail = null;
      if (hintMatch) {
        detail = { hint: hintMatch[1] };
      }

      lastFailure = {
        kind: kind,
        detail: detail,
        at: ts
      };

      failureCount++;
      if (lastSuccessIdx !== -1) {
        failuresAfterSuccess++;
      }
      totalValidEvents++;
    }
  }

  if (totalValidEvents === 0) {
    return null;
  }

  const consecutiveFailures = lastSuccessIdx !== -1 ? failuresAfterSuccess : failureCount;

  return {
    lastSuccessAt: lastSuccessAt,
    lastUsage: lastUsage,
    consecutiveFailures: consecutiveFailures,
    lastFailure: lastFailure
  };
}

module.exports = {
  parseLogTail
};
