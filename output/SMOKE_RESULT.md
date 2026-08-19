# SMOKE_RESULT

Generated: 2026-08-19 14:35:58

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
- EXECUTED_PASS: `node p-bellows/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Bellows, exit 0, 0.3s)
```
row or page is null (0.1897ms)
✔ collectDiagnostics caps textHead at 200 chars (0.1039ms)
✔ connect() failure classified as chrome-unreachable, existing message preserved (1.2612ms)
✔ browser.newPage() failure classified as chrome-unreachable, message/stack preserved (0.3636ms)
✔ page.goto() failure classified as nav-failed (0.3642ms)
✔ waitForFunction() failure classified as anchor-timeout, with diagnostics collected before close() (0.44ms)
✔ waitForFunction() failure with unrecognizable page yields hint unknown, never login-expired by default (0.4214ms)
✔ page.evaluate() extraction failure classified as invalid-extraction (0.3995ms)
✔ success path returns usage and only disconnects (never closes) the browser (0.378ms)
✔ FAILURE_KINDS has exactly the 5 expected values (0.0779ms)
✔ HINTS matches the hint vocabulary observation.js recognizes (whitelist round-trip) (0.1478ms)
✔ err.detail carries url/textHead for diagnosis, but only hint is meant to reach deriveState fields (0.1098ms)
✔ scrapeUsage keeps its existing signature and is still exported (0.0634ms)
✔ lib/scrape.js references the claude.ai domain exactly once (constant only) (0.0721ms)
✔ lib/scrape.js does not require puppeteer at the top level (lazy load) (0.1134ms)
✔ requiring lib/scrape.js does not eagerly load the puppeteer module (0.0765ms)
✔ require("../watch-loop.js") loads without starting the watch loop (0.9526ms)
✔ watch-loop.js source guards its immediate-invocation loop with require.main === module (0.097ms)
✔ watch-loop.js wires lib/observation.js into pollOnce success/failure branches (0.1156ms)
✔ scrape-failure log line surfaces kind and hint (§5 diagnostic logging requirement) (0.1258ms)
✔ watch-loop.js does not re-implement frozen helpers (deriveDesired/isValidUsage/writeStopJsonAtomic/readConfig/resolveStopDir stay) (0.0831ms)
✔ p-bellows/.js files do not reference the Claude CLI (0.3931ms)
ℹ tests 110
ℹ suites 0
ℹ pass 110
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 190.7426

```

## BOM Policy
- Scanned: 11 file(s) (required-class: 0)
- No BOM policy violation (11 file(s) scanned)

## Targets
- Execution-class targets: 2
- Static-class targets: 4

## Verdict
SMOKE_PASS
