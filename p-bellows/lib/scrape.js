'use strict';
const { extractUsage } = require('./extract');

const DEFAULT_DEBUG_URL = process.env.BELLOWS_CHROME_DEBUG_URL || 'http://127.0.0.1:9222';

// Domain URL -- the one place this file references the target site.
const ORIGIN       = 'https://claude.ai';
const LOGIN_PREFIX = ORIGIN + '/login';
const USAGE_URL    = ORIGIN + '/settings/usage';

const TEXT_HEAD_LEN = 200;

const HINTS = ['login-expired', 'anchor-missing', 'unknown'];
const FAILURE_KINDS = ['chrome-unreachable', 'anchor-timeout', 'invalid-extraction', 'nav-failed', 'unknown'];

// Pure. No I/O, no clock. First-match-wins: unknown is the default --
// do not lean toward login-expired when evidence is missing (see design P2.3 H4).
function hintFrom(diag) {
  const d = diag || {};
  const url = d.url;
  const textHead = d.textHead;

  if (typeof url !== 'string' || url.length === 0) return 'unknown';
  if (url.indexOf(LOGIN_PREFIX) === 0) return 'login-expired';
  if (url.indexOf(ORIGIN) === 0 && typeof textHead === 'string' && textHead.length > 0) {
    return 'anchor-missing';
  }
  return 'unknown';
}

// Never throws. Reads only page.url() and page.evaluate(fn) -- the minimal
// interface a test double needs to implement.
async function collectDiagnostics(page) {
  let url = null;
  let textHead = null;

  try {
    if (page && typeof page.url === 'function') {
      const u = page.url();
      if (typeof u === 'string') url = u;
    }
  } catch (e) {
    url = null;
  }

  try {
    if (page && typeof page.evaluate === 'function') {
      const t = await page.evaluate(() => document.body.innerText);
      if (typeof t === 'string') textHead = t.slice(0, TEXT_HEAD_LEN);
    }
  } catch (e) {
    textHead = null;
  }

  return { url: url, textHead: textHead, hint: hintFrom({ url: url, textHead: textHead }) };
}

async function scrapeUsage(_unusedProfileDir, opts) {
  opts = opts || {};
  const debugUrl      = opts.debugUrl      || DEFAULT_DEBUG_URL;
  const navTimeoutMs  = opts.navTimeoutMs  || 60000;
  const waitTimeoutMs = opts.waitTimeoutMs || 20000;

  let browser;
  try {
    const puppeteer = require('puppeteer'); // lazy: keeps hermetic tests free of the driver
    browser = await puppeteer.connect({
      browserURL: debugUrl,
      defaultViewport: null
    });
  } catch (e) {
    const err = new Error(
      'failed to connect to Chrome at ' + debugUrl +
      '. is Chrome running with --remote-debugging-port? ' +
      'underlying: ' + e.message
    );
    err.kind = 'chrome-unreachable';
    throw err;
  }

  let page = null;
  try {
    try {
      page = await browser.newPage();
    } catch (e) {
      e.kind = 'chrome-unreachable';
      throw e;
    }

    try {
      await page.goto(USAGE_URL, {
        waitUntil: 'networkidle2',
        timeout: navTimeoutMs
      });
    } catch (e) {
      e.kind = 'nav-failed';
      throw e;
    }

    try {
      await page.waitForFunction(
        () => document.body.innerText.indexOf('마지막 업데이트:') >= 0,
        { timeout: waitTimeoutMs }
      );
    } catch (e) {
      e.kind = 'anchor-timeout';
      e.detail = await collectDiagnostics(page); // must run before page.close() in finally
      throw e;
    }

    try {
      return await page.evaluate(extractUsage);
    } catch (e) {
      e.kind = 'invalid-extraction';
      throw e;
    }
  } finally {
    if (page) {
      try { await page.close(); } catch (e) {}
    }
    // IMPORTANT: do NOT close the browser -- it's the user's Chrome instance.
    try { await browser.disconnect(); } catch (e) {}
  }
}

module.exports = { scrapeUsage, hintFrom, collectDiagnostics, FAILURE_KINDS, HINTS };
