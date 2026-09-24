'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { MARK_BODY, ICON_SVG, MARK_INLINE, FAVICON_HREF } = require('../lib/brand');

const CANONICAL_SHA256 = '9d37e924332295cc860c6231bcd75a139435acd95d4f9de321e04e8ae8397e72';
const ASSET_PATH = path.join(__dirname, '..', 'assets', 'icon.svg');
const SRC_PATH = path.join(__dirname, '..', 'lib', 'brand.js');
const EXTERNAL_URL_RE = /(src|href)\s*=\s*["']https?:\/\/|@import\s+["']?https?:\/\/|fetch\(\s*["']https?:\/\//i;

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// ---- canonical bytes ----------------------------------------------------

test('ICON_SVG is exactly 574 UTF-8 bytes and matches the pinned sha256', () => {
  assert.strictEqual(Buffer.byteLength(ICON_SVG, 'utf8'), 574);
  assert.strictEqual(sha256(Buffer.from(ICON_SVG, 'utf8')), CANONICAL_SHA256);
});

test('ICON_SVG has zero \\n and zero \\r and no leading BOM', () => {
  assert.strictEqual(ICON_SVG.includes('\n'), false);
  assert.strictEqual(ICON_SVG.includes('\r'), false);
  assert.strictEqual(ICON_SVG.charCodeAt(0) === 0xfeff, false);
});

test('MARK_BODY excludes <title> and holds exactly 6 shapes (5 rect + 1 line)', () => {
  assert.strictEqual(MARK_BODY.includes('<title>'), false);
  assert.strictEqual(MARK_BODY.includes('</title>'), false);
  assert.strictEqual((MARK_BODY.match(/<rect/g) || []).length, 5);
  assert.strictEqual((MARK_BODY.match(/<line/g) || []).length, 1);
});

// ---- asset file identity -------------------------------------------------

test('assets/icon.svg bytes equal Buffer.from(ICON_SVG, "utf8") exactly', () => {
  const assetBytes = fs.readFileSync(ASSET_PATH);
  const iconBytes = Buffer.from(ICON_SVG, 'utf8');
  assert.strictEqual(sha256(assetBytes), sha256(iconBytes));
  assert.strictEqual(assetBytes.length, iconBytes.length);
  assert.strictEqual(Buffer.compare(assetBytes, iconBytes), 0);
});

// ---- favicon round-trip ---------------------------------------------------

test('FAVICON_HREF is a base64 data URI that decodes back to ICON_SVG', () => {
  const prefix = 'data:image/svg+xml;base64,';
  assert.strictEqual(FAVICON_HREF.startsWith(prefix), true);
  const decoded = Buffer.from(FAVICON_HREF.slice(prefix.length), 'base64').toString('utf8');
  assert.strictEqual(decoded, ICON_SVG);
  assert.strictEqual(decoded.includes('xmlns="http://www.w3.org/2000/svg"'), true);
});

test('FAVICON_HREF itself contains zero agy/http://https:// substrings', () => {
  assert.strictEqual(FAVICON_HREF.toLowerCase().includes('agy'), false);
  assert.strictEqual(FAVICON_HREF.includes('http://'), false);
  assert.strictEqual(FAVICON_HREF.includes('https://'), false);
});

test('FAVICON_HREF as href="..." does not match the external-URL guard regex', () => {
  const rendered = 'href="' + FAVICON_HREF + '"';
  assert.strictEqual(EXTERNAL_URL_RE.test(rendered), false);
});

// ---- single source, inline form -------------------------------------------

test('MARK_INLINE has zero xmlns/http and carries aria-hidden="true"', () => {
  assert.strictEqual(MARK_INLINE.includes('xmlns'), false);
  assert.strictEqual(MARK_INLINE.includes('http'), false);
  assert.strictEqual(MARK_INLINE.includes('aria-hidden="true"'), true);
});

test('MARK_INLINE opening tag and closing tag match spec exactly', () => {
  const expectedOpen = '<svg class="mark" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" focusable="false">';
  assert.strictEqual(MARK_INLINE.startsWith(expectedOpen), true);
  assert.strictEqual(MARK_INLINE.endsWith('</svg>'), true);
});

test('MARK_BODY is a substring of both ICON_SVG and MARK_INLINE', () => {
  assert.strictEqual(ICON_SVG.includes(MARK_BODY), true);
  assert.strictEqual(MARK_INLINE.includes(MARK_BODY), true);
});

test('MARK_INLINE has zero st-* prefixed tokens', () => {
  const matches = MARK_INLINE.match(/\bst-[a-z0-9_-]+\b/g) || [];
  assert.strictEqual(matches.length, 0);
});

// ---- icon safety check (same conditions as the Agora vault check) --------

test('ICON_SVG has zero <script/onload=/onerror=/<foreignObject/href= and stays under 65536 bytes', () => {
  assert.strictEqual(/<script/i.test(ICON_SVG), false);
  assert.strictEqual(/onload=/i.test(ICON_SVG), false);
  assert.strictEqual(/onerror=/i.test(ICON_SVG), false);
  assert.strictEqual(/<foreignObject/i.test(ICON_SVG), false);
  assert.strictEqual(/href=/i.test(ICON_SVG), false);
  assert.strictEqual(Buffer.byteLength(ICON_SVG, 'utf8') <= 65536, true);
});

// ---- constraint compliance -------------------------------------------------

test('lib/brand.js source has zero "claude" (case-insensitive) and zero require(', () => {
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  assert.strictEqual(/claude/i.test(src), false);
  assert.strictEqual(/require\(/.test(src), false);
});

test('package.json dependencies remain exactly ["puppeteer"]', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.deepStrictEqual(Object.keys(pkg.dependencies || {}), ['puppeteer']);
});
