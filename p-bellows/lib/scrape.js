'use strict';
const puppeteer = require('puppeteer');
const { extractUsage } = require('./extract');

const DEFAULT_DEBUG_URL = process.env.BELLOWS_CHROME_DEBUG_URL || 'http://127.0.0.1:9222';

async function scrapeUsage(_unusedProfileDir, opts) {
  opts = opts || {};
  const debugUrl     = opts.debugUrl     || DEFAULT_DEBUG_URL;
  const navTimeoutMs = opts.navTimeoutMs || 60000;
  const waitTimeoutMs = opts.waitTimeoutMs || 20000;

  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: debugUrl,
      defaultViewport: null
    });
  } catch (e) {
    throw new Error(
      'failed to connect to Chrome at ' + debugUrl +
      '. is Chrome running with --remote-debugging-port? ' +
      'underlying: ' + e.message
    );
  }

  let page = null;
  try {
    page = await browser.newPage();
    await page.goto('https://claude.ai/settings/usage', {
      waitUntil: 'networkidle2',
      timeout: navTimeoutMs
    });
    await page.waitForFunction(
      () => document.body.innerText.indexOf('마지막 업데이트:') >= 0,
      { timeout: waitTimeoutMs }
    );
    return await page.evaluate(extractUsage);
  } finally {
    if (page) {
      try { await page.close(); } catch (e) {}
    }
    // IMPORTANT: do NOT close the browser — it's the user's Chrome instance.
    try { await browser.disconnect(); } catch (e) {}
  }
}

module.exports = { scrapeUsage };
