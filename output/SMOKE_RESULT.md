# SMOKE_RESULT

Generated: 2026-09-03 13:03:50

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
- EXECUTED_FAIL: `node p-quaestor/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Quaestor, exit 1, 1.2s)
```
nally (0.1005ms)
✔ never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists (0.0627ms)
✔ live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable (0.136ms)
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.0962ms)
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1123ms)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit (2.6767ms)
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling (1.4763ms)
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing (1.7386ms)
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes) (41.1002ms)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @) (1.6427ms)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop (0.1335ms)
ℹ tests 301
ℹ suites 0
ℹ pass 300
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1124.3055

✖ failing tests:

test at p-quaestor\test\control-server.test.js:91:1
✖ omitting opts.port uses DEFAULT_PORT (3210) (1.0412ms)
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
