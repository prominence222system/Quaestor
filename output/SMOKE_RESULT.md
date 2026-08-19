# SMOKE_RESULT

Generated: 2026-08-19 15:25:32

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
- EXECUTED_PASS: `node p-bellows/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Bellows, exit 0, 0.8s)
```
ist round-trip) (0.1493ms)
✔ err.detail carries url/textHead for diagnosis, but only hint is meant to reach deriveState fields (0.1118ms)
✔ scrapeUsage keeps its existing signature and is still exported (0.0632ms)
✔ lib/scrape.js references the claude.ai domain exactly once (constant only) (0.0845ms)
✔ lib/scrape.js does not require puppeteer at the top level (lazy load) (0.1036ms)
✔ requiring lib/scrape.js does not eagerly load the puppeteer module (0.0628ms)
✔ require("../watch-loop.js") loads without starting the watch loop (1.0683ms)
✔ watch-loop.js source guards its immediate-invocation loop with require.main === module (0.1006ms)
✔ watch-loop.js wires lib/observation.js into pollOnce success/failure branches (0.122ms)
✔ scrape-failure log line surfaces kind and hint (§5 diagnostic logging requirement) (0.1286ms)
✔ watch-loop.js does not re-implement frozen helpers (deriveDesired/isValidUsage/writeStopJsonAtomic/readConfig/resolveStopDir stay) (0.0804ms)
✔ p-bellows/.js files do not reference the Claude CLI (0.397ms)
✔ C1: requiring watch-loop.js does not call startControlServer at module-load time (0.901ms)
✔ C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level (0.1226ms)
✔ C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally (0.0913ms)
✔ never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists (0.0702ms)
✔ live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable (0.1565ms)
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.0938ms)
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1364ms)
ℹ tests 133
ℹ suites 0
ℹ pass 133
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 766.2146

```

## BOM Policy
- Scanned: 11 file(s) (required-class: 0)
- No BOM policy violation (11 file(s) scanned)

## Targets
- Execution-class targets: 2
- Static-class targets: 4

## Verdict
SMOKE_PASS
