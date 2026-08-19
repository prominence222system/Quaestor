'use strict';
// Test harness. Run: node p-bellows/test/run-all.js
// Loads every *.test.js in this directory (name order) via require(), so
// node:test registers and executes them and sets process.exitCode on failure.
// Does not use `npm` or spawn a subprocess.
const fs = require('node:fs');
const path = require('node:path');

const testDir = __dirname;
const files = fs.readdirSync(testDir)
  .filter((f) => f.endsWith('.test.js'))
  .sort();

if (files.length === 0) {
  console.error('[run-all] no test files found in ' + testDir);
  process.exitCode = 1;
} else {
  console.log('[run-all] loading ' + files.length + ' test file(s): ' + files.join(', '));
  for (const f of files) {
    const full = path.join(testDir, f);
    try {
      require(full);
    } catch (e) {
      console.error('[run-all] failed to load ' + f + ': ' + (e && e.stack ? e.stack : e));
      process.exitCode = 1;
    }
  }
}
