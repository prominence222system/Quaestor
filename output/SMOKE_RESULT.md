# SMOKE_RESULT

Generated: 2026-08-24 15:29:53

## File Checks
- FAIL: deploy-bellows.ps1: entry-point -DryRun did not start (startup-failure signature: ErrorRecordCategoryInfo)

## Key Files
- All key files present

## Build Commands
- No build commands defined

## Test Commands
- No test commands defined

## Entry Point Smoke
- deploy-bellows.ps1 (-DryRun): FAIL (exit 1) -- startup-failure signature: ErrorRecordCategoryInfo
```
Bellows source not found in Synology
��ġ F:\Workspace\Automatic\projects\Quaestor\deploy-bellows.ps1:16 ����:22
+ if (-not $SrcRoot) { throw 'Bellows source not found in Synology' }
+                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : OperationStopped: (Bellows source not found in Synology:String) [], RuntimeException
    + FullyQualifiedErrorId : Bellows source not found in Synology
 

```

## Declared Smoke (MASTER.md ## Work Verify)
- EXECUTED_PASS: `node p-quaestor/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Quaestor, exit 0, 0.9s)
```
ule (0.0834ms)
✔ watch-loop.js wires lib/observation.js into pollOnce success/failure branches (0.1114ms)
✔ scrape-failure log line surfaces kind and hint (§5 diagnostic logging requirement) (0.1235ms)
✔ watch-loop.js does not re-implement frozen helpers (deriveDesired/isValidUsage/writeStopJsonAtomic/readConfig/resolveStopDir stay) (0.0893ms)
✔ p-quaestor/.js files do not reference the Claude CLI (0.3904ms)
✔ C1: requiring watch-loop.js does not call startControlServer at module-load time (0.8662ms)
✔ C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level (0.1244ms)
✔ C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally (0.0946ms)
✔ never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists (0.0639ms)
✔ live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable (0.1395ms)
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.0979ms)
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1031ms)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit (4.4302ms)
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling (1.5138ms)
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing (1.7274ms)
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes) (36.7205ms)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @) (1.4272ms)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop (0.1247ms)
ℹ tests 186
ℹ suites 0
ℹ pass 186
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 779.8071

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- WARN: WORK_VERIFY.md UNEXPECTED_BOM (generated artifact must not carry a BOM)

## Targets
- Execution-class targets: 1
- Static-class targets: 4

## Verdict
SMOKE_FAIL
