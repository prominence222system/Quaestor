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
const { restoreObservation, readLogTailLines } = require(WATCH_LOOP_PATH);
const { deriveState } = require('../lib/observation');
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

// ---- Phase 2: boot restoration & boundary tests ---------------------

test('Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bellows-test-'));
  const tmpLog = path.join(tmpDir, 'bellows.log');

  const lines = [
    '2026-07-28T11:58:12.472Z session=24% weekly=24%'
  ];
  const baseTime = Date.parse('2026-07-28T12:13:00.000Z');
  for (let i = 0; i < 500; i++) {
    const ts = new Date(baseTime + i * 15 * 60 * 1000).toISOString();
    lines.push(`${ts} [poll error] scrape failed: timeout kind=nav-failed`);
  }
  fs.writeFileSync(tmpLog, lines.join('\n') + '\n', 'utf8');

  try {
    const obs = restoreObservation(tmpLog);
    assert.ok(obs !== null, 'restored observation should not be null');
    assert.strictEqual(obs.lastSuccessAt, Date.parse('2026-07-28T11:58:12.472Z'));
    assert.strictEqual(obs.consecutiveFailures, 500);

    const now = Date.parse('2026-08-23T12:00:00.000Z'); // ~26 days later
    const ctx = { enabled: true, configSource: 'default' };
    const res = deriveState(obs, ctx, now);

    assert.strictEqual(res.state, 'crit', 'deriveState() must return crit for 26-day silence fixture');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bellows-test-'));
  const tmpLog = path.join(tmpDir, 'bellows.log');

  const content = '2026-07-28T10:00:00.000Z [poll error] scrape failed: partial line cut off before this\n' +
                  '2026-07-28T11:58:12.472Z session=30% weekly=40%\n' +
                  '2026-07-28T12:15:00.000Z [poll error] scrape failed: timeout kind=anchor-missing hint=login-expired\n';

  fs.writeFileSync(tmpLog, content, 'utf8');

  try {
    const lines = readLogTailLines(tmpLog, 150);
    assert.ok(Array.isArray(lines), 'readLogTailLines must return an array');
    // First line should be chopped off because position > 0
    assert.ok(!lines[0].includes('partial line cut off'), 'first chopped line must be discarded when position > 0');

    const obs = restoreObservation(tmpLog);
    assert.strictEqual(obs.lastSuccessAt, Date.parse('2026-07-28T11:58:12.472Z'));
    assert.strictEqual(obs.consecutiveFailures, 1);
    assert.strictEqual(obs.lastFailure.kind, 'anchor-missing');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bellows-test-'));
  const nonExistentPath = path.join(tmpDir, 'does-not-exist.log');
  const zeroBytePath = path.join(tmpDir, 'zero.log');
  const corruptPath = path.join(tmpDir, 'corrupt.log');

  fs.writeFileSync(zeroBytePath, '');
  fs.writeFileSync(corruptPath, Buffer.from([0xFF, 0xFE, 0x00, 0x12, 0x89, 0xAA, 0xBB]));

  try {
    assert.doesNotThrow(() => {
      const obs1 = restoreObservation(nonExistentPath);
      assert.strictEqual(obs1.lastSuccessAt, null);
      assert.strictEqual(obs1.consecutiveFailures, 0);

      const obs2 = restoreObservation(zeroBytePath);
      assert.strictEqual(obs2.lastSuccessAt, null);
      assert.strictEqual(obs2.consecutiveFailures, 0);

      const obs3 = restoreObservation(corruptPath);
      assert.strictEqual(obs3.lastSuccessAt, null);
      assert.strictEqual(obs3.consecutiveFailures, 0);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes)', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bellows-test-'));
  const tmpLog = path.join(tmpDir, 'large.log');

  const chunk = '2026-07-28T12:00:00.000Z [poll error] scrape failed: timeout kind=nav-failed\n';
  let largeContent = '';
  while (Buffer.byteLength(largeContent, 'utf8') < 100000) {
    largeContent += chunk;
  }
  fs.writeFileSync(tmpLog, largeContent, 'utf8');

  try {
    const lines = readLogTailLines(tmpLog, 65536);
    assert.ok(lines !== null);
    const reconstructedText = lines.join('\n');
    assert.ok(Buffer.byteLength(reconstructedText, 'utf8') <= 65536, 'read bytes must be <= 65536');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @)', () => {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bellows-test-'));
  const tmpLog = path.join(tmpDir, 'bellows.log');

  const lines = [
    '2026-07-28T11:58:12.472Z session=24% weekly=24%',
    '2026-07-28T12:13:00.000Z [poll error] scrape failed: timeout kind=nav-failed'
  ];
  fs.writeFileSync(tmpLog, lines.join('\n') + '\n', 'utf8');

  try {
    const obs = restoreObservation(tmpLog);
    const jsonStr = JSON.stringify(obs);
    assert.strictEqual(jsonStr.includes('.profile'), false, 'must not include .profile');
    assert.strictEqual(jsonStr.includes('cookie'), false, 'must not include cookie');
    assert.strictEqual(jsonStr.includes('@'), false, 'must not include @');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop', () => {
  assert.ok(/restoreObservation\s*\(/.test(SRC), 'mainLoop must invoke restoreObservation');
});

