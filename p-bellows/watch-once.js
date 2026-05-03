'use strict';
const path = require('path');
const { scrapeUsage } = require('./lib/scrape');

const PROFILE_DIR = path.resolve(process.env.BELLOWS_PROFILE_DIR || './.profile');

(async () => {
  try {
    const result = await scrapeUsage(PROFILE_DIR);
    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  } catch (e) {
    console.error('[bellows-once] scrape failed:', e.message);
    process.exit(1);
  }
})();
