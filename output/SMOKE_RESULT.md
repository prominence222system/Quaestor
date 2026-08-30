# SMOKE_RESULT

Generated: 2026-08-30 16:13:47

## File Checks
- All file checks passed

## Key Files
- All key files present

## Build Commands
- No build commands defined

## Test Commands
- No test commands defined

## Entry Point Smoke
- deploy-quaestor.ps1 (-DryRun): PASS (exit 0) -- exited 0

## Declared Smoke (MASTER.md ## Work Verify)
- EXECUTED_PASS: `node p-quaestor/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Quaestor, exit 0, 1.3s)
```
module (0.093ms)
✔ watch-loop.js wires lib/observation.js into pollOnce success/failure branches (0.123ms)
✔ scrape-failure log line surfaces kind and hint (§5 diagnostic logging requirement) (0.1427ms)
✔ watch-loop.js does not re-implement frozen helpers (deriveDesired/isValidUsage/writeStopJsonAtomic/readConfig/resolveStopDir stay) (0.0818ms)
✔ p-quaestor/.js files do not reference the Claude CLI (0.3879ms)
✔ C1: requiring watch-loop.js does not call startControlServer at module-load time (0.8735ms)
✔ C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level (0.1293ms)
✔ C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally (0.114ms)
✔ never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists (0.1176ms)
✔ live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable (0.1818ms)
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.1049ms)
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1054ms)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit (2.8746ms)
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling (1.6912ms)
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing (1.9886ms)
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes) (43.0935ms)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @) (1.516ms)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop (0.1489ms)
ℹ tests 265
ℹ suites 0
ℹ pass 265
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1153.2827

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- No BOM policy violation (12 file(s) scanned)

## Targets
- Execution-class targets: 2
- Static-class targets: 4

## Verdict
SMOKE_PASS
