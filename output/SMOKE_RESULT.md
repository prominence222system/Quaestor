# SMOKE_RESULT

Generated: 2026-08-19 13:49:17

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
��ġ F:\Workspace\Automatic\projects\Bellows\deploy-bellows.ps1:16 ����:22
+ if (-not $SrcRoot) { throw 'Bellows source not found in Synology' }
+                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : OperationStopped: (Bellows source not found in Synology:String) [], RuntimeException
    + FullyQualifiedErrorId : Bellows source not found in Synology
 

```

## Declared Smoke (MASTER.md ## Work Verify)
- EXECUTED_PASS: `node p-bellows/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Bellows, exit 0, 0.1s)
```
deriveState is pure and deterministic (same input twice) (2.5166ms)
✔ observation.js source does not read wall-clock time or fs (0.2462ms)
✔ deriveState does not mutate obs or ctx (0.2334ms)
✔ recordSuccess/recordFailure do not mutate input obs (0.1287ms)
✔ fields are timezone independent (0.3029ms)
✔ never-success observation is not ok (0.1651ms)
✔ consecutiveFailures at crit threshold is crit, even with no success history (0.1498ms)
✔ stale success (>2h) is crit (0.229ms)
✔ stale success (>45m, <=2h) is warn (0.159ms)
✔ fresh + near threshold is warn, fresh + headroom is ok (0.2446ms)
✔ enabled=false forces idle regardless of other conditions (0.2918ms)
✔ state is always one of the four enum values (0.1761ms)
✔ deriveState never throws on missing/empty inputs (0.2156ms)
✔ success -> failure -> failure -> success resets consecutiveFailures to 0 (0.1146ms)
✔ recordFailure increments consecutiveFailures/totalFailures, keeps lastSuccessAt (0.6783ms)
✔ recordSuccess sets lastSuccessAt to now, resets consecutiveFailures, keeps totalPolls counting (0.0959ms)
✔ createObservation initial shape (0.1307ms)
✔ recordFailure normalizes falsy/non-string kind to unknown (0.1548ms)
✔ recordSuccess keeps prior lastFailure (0.0964ms)
✔ no secrets leak into deriveState output, even when detail carries them (0.1355ms)
✔ lastFailure field carries only kind + known hint vocabulary (0.0909ms)
✔ unknown/garbage hint is dropped, not surfaced (0.0839ms)
✔ fields entries have string label/value and optional valid state (0.0994ms)
✔ fields include all required items (0.0857ms)
✔ STOP field distinguishes manual vs auto vs none (0.117ms)
✔ configSource field reflects ctx.configSource (0.1002ms)
✔ lastUsage=null keeps session/weekly fields present with placeholder value (0.085ms)
✔ field order is stable across calls (0.108ms)
✔ observation.js requires no external modules (puppeteer etc.) (0.1053ms)
ℹ tests 29
ℹ suites 0
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14.1005

```

## BOM Policy
- Scanned: 8 file(s) (required-class: 0)
- No BOM policy violation (8 file(s) scanned)

## Targets
- Execution-class targets: 1
- Static-class targets: 4

## Verdict
SMOKE_FAIL
