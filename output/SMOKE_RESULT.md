# SMOKE_RESULT

Generated: 2026-08-19 14:04:46

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
throw or page is null (0.1926ms)
✔ collectDiagnostics caps textHead at 200 chars (0.106ms)
✔ connect() failure classified as chrome-unreachable, existing message preserved (1.3056ms)
✔ browser.newPage() failure classified as chrome-unreachable, message/stack preserved (0.4483ms)
✔ page.goto() failure classified as nav-failed (0.4932ms)
✔ waitForFunction() failure classified as anchor-timeout, with diagnostics collected before close() (0.5094ms)
✔ waitForFunction() failure with unrecognizable page yields hint unknown, never login-expired by default (0.4437ms)
✔ page.evaluate() extraction failure classified as invalid-extraction (0.4788ms)
✔ success path returns usage and only disconnects (never closes) the browser (0.3637ms)
✔ FAILURE_KINDS has exactly the 5 expected values (0.0741ms)
✔ HINTS matches the hint vocabulary observation.js recognizes (whitelist round-trip) (0.1404ms)
✔ err.detail carries url/textHead for diagnosis, but only hint is meant to reach deriveState fields (0.1147ms)
✔ scrapeUsage keeps its existing signature and is still exported (0.0639ms)
✔ lib/scrape.js references the claude.ai domain exactly once (constant only) (0.075ms)
✔ lib/scrape.js does not require puppeteer at the top level (lazy load) (0.0991ms)
✔ requiring lib/scrape.js does not eagerly load the puppeteer module (0.0592ms)
✔ require("../watch-loop.js") loads without starting the watch loop (1.3845ms)
✔ watch-loop.js source guards its immediate-invocation loop with require.main === module (0.1083ms)
✔ watch-loop.js wires lib/observation.js into pollOnce success/failure branches (0.143ms)
✔ scrape-failure log line surfaces kind and hint (§5 diagnostic logging requirement) (0.1381ms)
✔ watch-loop.js does not re-implement frozen helpers (deriveDesired/isValidUsage/writeStopJsonAtomic/readConfig/resolveStopDir stay) (0.0893ms)
✔ p-bellows/.js files do not reference the Claude CLI (0.3945ms)
ℹ tests 58
ℹ suites 0
ℹ pass 58
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 28.3542

```

## BOM Policy
- Scanned: 9 file(s) (required-class: 0)
- No BOM policy violation (9 file(s) scanned)

## Targets
- Execution-class targets: 1
- Static-class targets: 4

## Verdict
SMOKE_FAIL
