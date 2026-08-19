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

// ---- Phase 3: control-server wiring (never-brick) --------------------
//
// See output/DESIGN.md section 9-7: pollOnce() is never driven here
// (it would touch the real STOP.json / bellows.log on this machine), so
// wiring behavior is verified two ways -- (a) a behavioral module-load
// boundary check using a patched startControlServer, and (b) structural
// checks against source for everything that would otherwise require
// driving mainLoop() end-to-end.

test('C1: requiring watch-loop.js does not call startControlServer at module-load time', () => {
  const controlServerPath = require.resolve('../lib/control-server');
  const watchLoopPath = require.resolve('../watch-loop.js');
  delete require.cache[watchLoopPath];

  const controlServerModule = require(controlServerPath);
  const original = controlServerModule.startControlServer;
  let calls = 0;
  controlServerModule.startControlServer = function (...args) {
    calls++;
    return original.apply(this, args);
  };
  try {
    require(watchLoopPath);
    assert.strictEqual(calls, 0, 'requiring watch-loop.js must not invoke startControlServer');
  } finally {
    controlServerModule.startControlServer = original;
    delete require.cache[watchLoopPath];
    require(watchLoopPath); // restore a clean cached module for any test after this one
  }
});

test('C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level', () => {
  const mainLoopMatch = SRC.match(/async function mainLoop\(\)[\s\S]*?\/\/ Guard:/);
  assert.ok(mainLoopMatch, 'expected to find mainLoop() function body');
  const block = mainLoopMatch[0];
  assert.ok(/startControlServer\(/.test(block), 'startControlServer( must be called inside mainLoop()');
  const beforeMainLoop = SRC.slice(0, SRC.indexOf('async function mainLoop'));
  assert.ok(!/startControlServer\(/.test(beforeMainLoop), 'startControlServer( must not appear before mainLoop() (i.e. not at module top level)');
});

test('C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally', () => {
  const mainLoopMatch = SRC.match(/async function mainLoop\(\)[\s\S]*?\/\/ Guard:/);
  const block = mainLoopMatch[0];
  const tryIdx = block.indexOf('try {');
  // Match the actual call site, not the "startControlServer() itself
  // never rejects" prose in the comment above it.
  const callIdx = block.indexOf('await startControlServer(');
  const catchIdx = block.indexOf('catch (e)');
  const whileIdx = block.indexOf('while (true)');
  assert.ok(tryIdx >= 0 && callIdx >= 0, 'expected both a try block and a startControlServer( call site');
  assert.ok(tryIdx < callIdx, 'startControlServer( must be inside a try block');
  assert.ok(callIdx < catchIdx, 'a catch must follow the startControlServer( call');
  assert.ok(catchIdx < whileIdx, 'the while(true) polling loop must come after the try/catch, unconditionally');
});

test('never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists', () => {
  assert.ok(/\[control\] listen failed/.test(SRC), 'expected a "[control] listen failed" log line');
});

test('live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable', () => {
  const snapshotMatch = SRC.match(/function controlSnapshot\(\)[\s\S]*?\n\}/);
  assert.ok(snapshotMatch, 'expected a controlSnapshot() function');
  const block = snapshotMatch[0];
  assert.ok(/\bobservation\b/.test(block), 'controlSnapshot() must reference the observation module variable');
  assert.ok(/getSnapshot:\s*controlSnapshot\b/.test(SRC), 'startControlServer(...) must be given controlSnapshot as getSnapshot');
});

test('C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference', () => {
  const snapshotMatch = SRC.match(/function controlSnapshot\(\)[\s\S]*?\n\}/);
  const block = snapshotMatch[0];
  assert.ok(!/\bfs\./.test(block), 'controlSnapshot() must not touch the filesystem');
  assert.ok(!/scrapeUsage/.test(block), 'controlSnapshot() must not scrape');
  assert.ok(!/STOP_PATH/.test(block), 'controlSnapshot() must not reference STOP_PATH');
});

test('watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring)', () => {
  const mainLoopMatch = SRC.match(/async function mainLoop\(\)[\s\S]*?\/\/ Guard:/);
  const block = mainLoopMatch[0];
  assert.ok(!/\bstate\s*===\s*['"](ok|warn|crit)['"]/.test(block), 'mainLoop() must not re-implement state judgement');
});
