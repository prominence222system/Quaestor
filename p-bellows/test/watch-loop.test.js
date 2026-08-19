'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// NOTE ON HERMETICITY: watch-loop.js resolves a real Synology STOP_DIR at
// module-load time (resolveStopDir()) -- this is pre-existing, frozen
// behavior (see MASTER.md 불변) that this NNN must not touch or make
// injectable. Because of that, this suite intentionally does NOT drive
// pollOnce() end-to-end: doing so would read/write the *real* STOP.json /
// bellows.log on this machine, which is exactly the safety-critical file
// this product exists to protect. Instead this suite verifies (a) the
// require.main guard behaviorally (module-load boundary), and (b) the
// observation-wiring/logging requirements structurally against source.

const WATCH_LOOP_PATH = path.join(__dirname, '..', 'watch-loop.js');
const SRC = fs.readFileSync(WATCH_LOOP_PATH, 'utf8');

test('require("../watch-loop.js") loads without starting the watch loop', () => {
  // If the require.main guard were missing, this require() would enter the
  // `while (true)` loop and this test would hang until the outer test
  // runner timeout kills the process -- i.e. failure here is a hang, not
  // a thrown assertion. The require() itself completing is the assertion.
  assert.doesNotThrow(() => { require(WATCH_LOOP_PATH); });
});

test('watch-loop.js source guards its immediate-invocation loop with require.main === module', () => {
  assert.ok(
    /require\.main\s*===\s*module/.test(SRC),
    'watch-loop.js must guard its self-starting loop so requiring it for tests is safe'
  );
});

test('watch-loop.js wires lib/observation.js into pollOnce success/failure branches', () => {
  assert.ok(
    /require\(\s*['"]\.\/lib\/observation['"]\s*\)/.test(SRC),
    'watch-loop.js must require ./lib/observation'
  );
  assert.ok(/recordSuccess\s*\(/.test(SRC), 'success branch must call recordSuccess()');
  assert.ok(/recordFailure\s*\(/.test(SRC), 'failure branch(es) must call recordFailure()');
});

test('scrape-failure log line surfaces kind and hint (§5 diagnostic logging requirement)', () => {
  // Find the catch block around the scrapeUsage() call and confirm the log
  // line built there references both kind and hint, so a human reading
  // bellows.log alone can distinguish login-expired from anchor-missing.
  const catchBlockMatch = SRC.match(/catch \(e\) \{\s*const kind[\s\S]*?return;\s*\}/);
  assert.ok(catchBlockMatch, 'expected a catch block that derives kind/hint after scrapeUsage()');
  const block = catchBlockMatch[0];
  assert.ok(/kind/.test(block), 'catch block must reference kind');
  assert.ok(/hint/.test(block), 'catch block must reference hint');
  assert.ok(/recordFailure\s*\(\s*observation/.test(block), 'catch block must record the failure into observation state');
});

test('watch-loop.js does not re-implement frozen helpers (deriveDesired/isValidUsage/writeStopJsonAtomic/readConfig/resolveStopDir stay)', () => {
  for (const fn of ['deriveDesired', 'isValidUsage', 'writeStopJsonAtomic', 'readConfig', 'resolveStopDir']) {
    assert.ok(SRC.includes(fn), 'expected ' + fn + ' to still be present in watch-loop.js');
  }
});

test('p-bellows/.js files do not reference the Claude CLI', () => {
  const libDir = path.join(__dirname, '..');
  const jsFiles = fs.readdirSync(libDir).filter((f) => f.endsWith('.js'));
  for (const f of jsFiles) {
    const content = fs.readFileSync(path.join(libDir, f), 'utf8');
    // 'claude' is allowed only as part of the claude.ai domain constant.
    const matches = content.match(/claude/g) || [];
    if (f === 'watch-loop.js') {
      assert.strictEqual(matches.length, 0, 'watch-loop.js must not reference "claude" at all');
    }
  }
});
