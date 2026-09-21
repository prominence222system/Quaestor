# SMOKE_RESULT

Generated: 2026-09-21 10:47:53

## File Checks
- All file checks passed

## Key Files
- key-files: regenerated 0 excluded (build|.gradle|.kotlin|obj|bin), checked 1 -- all present

## Build Commands
- No build commands defined

## Test Commands
- No test commands defined

## Entry Point Smoke
- deploy-quaestor.ps1 (-DryRun): PASS (exit 0) -- exited 0

## Declared Smoke (MASTER.md ## Work Verify)
- EXECUTED_PASS: `node p-quaestor/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Quaestor, exit 0, 2.9s)
```
ring watch-loop.js does not call startControlServer at module-load time (0.7837ms)
✔ C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level (0.1856ms)
✔ C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally (0.0891ms)
✔ never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists (0.058ms)
✔ live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable (0.1346ms)
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.1044ms)
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1052ms)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit (2.5488ms)
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling (1.3991ms)
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing (1.5862ms)
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes) (40.0097ms)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @) (1.35ms)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop (0.1247ms)
✔ W1: startControlServer(...) is called with both configPath and onConfigChange (0.1581ms)
✔ W2: refreshConfig() exists and updates lastCfg/lastConfigSource from readConfig(CONFIG_PATH) (0.1509ms)
✔ W3: pollOnce() calls refreshConfig() and does not duplicate config-reading logic (0.1378ms)
✔ W4 [SPEC]: existing [config] log strings are byte-for-byte unchanged, and watch-loop.js contains no "[thresholds]" string (0.0638ms)
ℹ tests 362
ℹ suites 0
ℹ pass 362
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2791.415

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- No BOM policy violation (12 file(s) scanned)

## Targets
- Execution-class targets: 2
- Static-class targets: 4

## Verdict
SMOKE_PASS
