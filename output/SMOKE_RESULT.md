# SMOKE_RESULT

Generated: 2026-08-19 14:23:27

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
- EXECUTED_PASS: `node p-bellows/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Bellows, exit 0, 0.2s)
```
row or page is null (0.1823ms)
✔ collectDiagnostics caps textHead at 200 chars (0.1087ms)
✔ connect() failure classified as chrome-unreachable, existing message preserved (1.1772ms)
✔ browser.newPage() failure classified as chrome-unreachable, message/stack preserved (0.3771ms)
✔ page.goto() failure classified as nav-failed (0.3943ms)
✔ waitForFunction() failure classified as anchor-timeout, with diagnostics collected before close() (0.4626ms)
✔ waitForFunction() failure with unrecognizable page yields hint unknown, never login-expired by default (0.4485ms)
✔ page.evaluate() extraction failure classified as invalid-extraction (0.45ms)
✔ success path returns usage and only disconnects (never closes) the browser (0.3725ms)
✔ FAILURE_KINDS has exactly the 5 expected values (0.0844ms)
✔ HINTS matches the hint vocabulary observation.js recognizes (whitelist round-trip) (0.1627ms)
✔ err.detail carries url/textHead for diagnosis, but only hint is meant to reach deriveState fields (0.1156ms)
✔ scrapeUsage keeps its existing signature and is still exported (0.0665ms)
✔ lib/scrape.js references the claude.ai domain exactly once (constant only) (0.0825ms)
✔ lib/scrape.js does not require puppeteer at the top level (lazy load) (0.1008ms)
✔ requiring lib/scrape.js does not eagerly load the puppeteer module (0.0599ms)
✔ require("../watch-loop.js") loads without starting the watch loop (1.3403ms)
✔ watch-loop.js source guards its immediate-invocation loop with require.main === module (0.1002ms)
✔ watch-loop.js wires lib/observation.js into pollOnce success/failure branches (0.1292ms)
✔ scrape-failure log line surfaces kind and hint (§5 diagnostic logging requirement) (0.1324ms)
✔ watch-loop.js does not re-implement frozen helpers (deriveDesired/isValidUsage/writeStopJsonAtomic/readConfig/resolveStopDir stay) (0.0803ms)
✔ p-bellows/.js files do not reference the Claude CLI (0.4259ms)
ℹ tests 83
ℹ suites 0
ℹ pass 83
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 143.6039

```

## BOM Policy
- Scanned: 11 file(s) (required-class: 0)
- No BOM policy violation (11 file(s) scanned)

## Targets
- Execution-class targets: 2
- Static-class targets: 4

## Verdict
SMOKE_PASS
