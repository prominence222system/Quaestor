# SMOKE_RESULT

Generated: 2026-08-25 09:33:51

## File Checks
- All file checks passed

## Key Files
- key-files: regenerated 0 excluded (build|.gradle|.kotlin|obj|bin), checked 2 -- all present

## Build Commands
- No build commands defined

## Test Commands
- No test commands defined

## Entry Point Smoke
- deploy-bellows.ps1 (-DryRun): PASS (exit 0) -- exited 0

## Declared Smoke (MASTER.md ## Work Verify)
- EXECUTED_PASS: `node p-quaestor/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Quaestor, exit 0, 1s)
```
module (0.092ms)
✔ watch-loop.js wires lib/observation.js into pollOnce success/failure branches (0.1454ms)
✔ scrape-failure log line surfaces kind and hint (§5 diagnostic logging requirement) (0.1285ms)
✔ watch-loop.js does not re-implement frozen helpers (deriveDesired/isValidUsage/writeStopJsonAtomic/readConfig/resolveStopDir stay) (0.0803ms)
✔ p-quaestor/.js files do not reference the Claude CLI (0.4674ms)
✔ C1: requiring watch-loop.js does not call startControlServer at module-load time (0.8719ms)
✔ C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level (0.1534ms)
✔ C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally (0.126ms)
✔ never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists (0.069ms)
✔ live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable (0.1511ms)
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.0967ms)
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1071ms)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit (2.8077ms)
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling (1.7618ms)
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing (2.3781ms)
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes) (38.9613ms)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @) (1.4295ms)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop (0.1593ms)
ℹ tests 204
ℹ suites 0
ℹ pass 204
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 877.4162

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- No BOM policy violation (12 file(s) scanned)

## Targets
- Execution-class targets: 2
- Static-class targets: 4

## Verdict
SMOKE_PASS
