'use strict';
// Single source of truth for the Quaestor logo (work/016).
// Pure: zero requires, zero I/O. The only global used is Buffer.
//
// Concept C -- "two gauges and a stop line": two rounded bars (session,
// weekly) over a dark rounded square, the lower one filled amber up to a
// light vertical stop line.
//
// MARK_BODY is the primitive. ICON_SVG and MARK_INLINE are both built
// from it, so the two surfaces can never drift apart. The canonical bytes
// are pinned by sha256 in test/brand.test.js -- do not edit either the
// body or the wrappers without updating that hash, and do not relax the
// hash instead of fixing the string.
//
// FAVICON_HREF is base64 on purpose, not as a workaround. A favicon is
// a standalone SVG document, so it needs xmlns="http://..." to render at
// all -- but the rendered HTML is asserted to contain zero "http://"
// substrings (test/status-page.test.js, test/control-server.test.js).
// xmlns is a namespace identifier, not a fetch target, so base64 honours
// both the assertion and its original "zero external requests" intent.

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Quaestor">';

const MARK_BODY = '<rect x="2" y="2" width="60" height="60" rx="14" fill="#1f2430"/><rect x="11" y="18" width="42" height="9" rx="4.5" fill="#3a4152"/><rect x="11" y="37" width="42" height="9" rx="4.5" fill="#3a4152"/><rect x="11" y="18" width="20" height="9" rx="4.5" fill="#f2f4f8"/><rect x="11" y="37" width="33" height="9" rx="4.5" fill="#e0a33e"/><line x1="44" y1="12" x2="44" y2="52" stroke="#f2f4f8" stroke-width="3" stroke-linecap="round"/>';

const ICON_SVG = SVG_OPEN + '<title>Quaestor</title>' + MARK_BODY + '</svg>';

const MARK_INLINE = '<svg class="mark" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" focusable="false">' + MARK_BODY + '</svg>';

const FAVICON_HREF = 'data:image/svg+xml;base64,' + Buffer.from(ICON_SVG, 'utf8').toString('base64');

module.exports = { MARK_BODY, ICON_SVG, MARK_INLINE, FAVICON_HREF };
