# SMOKE_RESULT

Generated: 2026-09-21 10:56:28

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
- EXECUTED_PASS: `node p-quaestor/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Quaestor, exit 0, 2.8s)
```
 watch-loop.js does not call startControlServer at module-load time (0.8145ms)
✔ C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level (0.1309ms)
✔ C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally (0.0904ms)
✔ never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists (0.0597ms)
✔ live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable (0.1344ms)
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.0905ms)
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1036ms)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit (2.6057ms)
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling (1.5661ms)
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing (2.3821ms)
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes) (40.3323ms)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @) (1.3073ms)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop (0.1178ms)
✔ W1: startControlServer(...) is called with both configPath and onConfigChange (0.1526ms)
✔ W2: refreshConfig() exists and updates lastCfg/lastConfigSource from readConfig(CONFIG_PATH) (0.1411ms)
✔ W3: pollOnce() calls refreshConfig() and does not duplicate config-reading logic (0.1365ms)
✔ W4 [SPEC]: existing [config] log strings are byte-for-byte unchanged, and watch-loop.js contains no "[thresholds]" string (0.0651ms)
ℹ tests 367
ℹ suites 0
ℹ pass 367
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2756.4901

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- No BOM policy violation (12 file(s) scanned)

## Targets
- Execution-class targets: 2
- Static-class targets: 4

## Verdict
SMOKE_PASS
