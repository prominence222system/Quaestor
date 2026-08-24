# SMOKE_RESULT

Generated: 2026-08-24 15:41:16

## File Checks
- All file checks passed

## Key Files
- All key files present

## Build Commands
- No build commands defined

## Test Commands
- No test commands defined

## Entry Point Smoke
- deploy-bellows.ps1 (-DryRun): PASS (exit 0) -- exited 0

## Declared Smoke (MASTER.md ## Work Verify)
- EXECUTED_PASS: `node p-quaestor/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Quaestor, exit 0, 0.8s)
```
 module (0.0869ms)
✔ watch-loop.js wires lib/observation.js into pollOnce success/failure branches (0.1343ms)
✔ scrape-failure log line surfaces kind and hint (§5 diagnostic logging requirement) (0.128ms)
✔ watch-loop.js does not re-implement frozen helpers (deriveDesired/isValidUsage/writeStopJsonAtomic/readConfig/resolveStopDir stay) (0.081ms)
✔ p-quaestor/.js files do not reference the Claude CLI (0.4661ms)
✔ C1: requiring watch-loop.js does not call startControlServer at module-load time (0.8874ms)
✔ C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level (0.1248ms)
✔ C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally (0.0919ms)
✔ never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists (0.0641ms)
✔ live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable (0.1444ms)
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.0962ms)
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1123ms)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit (3.7845ms)
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling (2.0012ms)
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing (1.7703ms)
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes) (38.7204ms)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @) (1.482ms)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop (0.154ms)
ℹ tests 191
ℹ suites 0
ℹ pass 191
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 755.0805

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- No BOM policy violation (12 file(s) scanned)

## Targets
- Execution-class targets: 2
- Static-class targets: 4

## Verdict
SMOKE_PASS
