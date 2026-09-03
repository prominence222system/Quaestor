# SMOKE_RESULT

Generated: 2026-09-03 13:52:53

## File Checks
- FAIL: declared smoke failed: node p-quaestor/test/run-all.js (exit 1)
- FAIL: declared smoke not verified: declared smoke: 1 declared / 0 executed-pass

## Key Files
- All key files present

## Build Commands
- No build commands defined

## Test Commands
- No test commands defined

## Entry Point Smoke
- deploy-quaestor.ps1 (-DryRun): PASS (exit 0) -- exited 0

## Declared Smoke (MASTER.md ## Work Verify)
- EXECUTED_FAIL: `node p-quaestor/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Quaestor, exit 1, 2.9s)
```
ot re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1009ms)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit (2.577ms)
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling (1.4388ms)
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing (1.678ms)
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes) (40.4344ms)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @) (1.419ms)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop (0.1186ms)
✔ W1: startControlServer(...) is called with both configPath and onConfigChange (0.1483ms)
✔ W2: refreshConfig() exists and updates lastCfg/lastConfigSource from readConfig(CONFIG_PATH) (0.1449ms)
✔ W3: pollOnce() calls refreshConfig() and does not duplicate config-reading logic (0.1375ms)
✔ W4 [SPEC]: existing [config] log strings are byte-for-byte unchanged, and watch-loop.js contains no "[thresholds]" string (0.0647ms)
ℹ tests 357
ℹ suites 0
ℹ pass 356
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2789.7366

✖ failing tests:

test at p-quaestor\test\control-server.test.js:91:1
✖ omitting opts.port uses DEFAULT_PORT (3210) (0.9294ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  false !== true
  
      at TestContext.<anonymous> (F:\Workspace\Automatic\projects\Quaestor\p-quaestor\test\control-server.test.js:95:12)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: 'strictEqual',
    diff: 'simple'
  }

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- No BOM policy violation (12 file(s) scanned)

## Targets
- Execution-class targets: 1
- Static-class targets: 4

## Verdict
SMOKE_FAIL
