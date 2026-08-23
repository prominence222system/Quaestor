# SMOKE_RESULT

Generated: 2026-08-23 16:57:34

## File Checks
- FAIL: declared smoke failed: node p-bellows/test/run-all.js (exit 1)
- FAIL: declared smoke not verified: declared smoke: 1 declared / 0 executed-pass

## Key Files
- All key files present

## Build Commands
- No build commands defined

## Test Commands
- No test commands defined

## Entry Point Smoke
- deploy-bellows.ps1 (-DryRun): PASS (exit 0) -- exited 0

## Declared Smoke (MASTER.md ## Work Verify)
- EXECUTED_FAIL: `node p-bellows/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Bellows, exit 1, 0.9s)
```
lSnapshot) whose body references the observation module variable (0.1609ms)
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.0931ms)
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1058ms)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit (2.7066ms)
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling (1.4807ms)
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing (1.6526ms)
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes) (37.6656ms)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @) (1.471ms)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop (0.1368ms)
ℹ tests 123
ℹ suites 0
ℹ pass 123
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 783.1713
[run-all] failed to load scrape-classify.test.js: Error: Cannot find module 'puppeteer'
Require stack:
- F:\Workspace\Automatic\projects\Bellows\p-bellows\test\scrape-classify.test.js
- F:\Workspace\Automatic\projects\Bellows\p-bellows\test\run-all.js
    at Module._resolveFilename (node:internal/modules/cjs/loader:1456:15)
    at require.resolve (node:internal/modules/helpers:163:19)
    at Object.<anonymous> (F:\Workspace\Automatic\projects\Bellows\p-bellows\test\scrape-classify.test.js:9:31)
    at Module._compile (node:internal/modules/cjs/loader:1812:14)
    at Object..js (node:internal/modules/cjs/loader:1943:10)
    at Module.load (node:internal/modules/cjs/loader:1533:32)
    at Module._load (node:internal/modules/cjs/loader:1335:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
    at Module.require (node:internal/modules/cjs/loader:1556:12)
    at require (node:internal/modules/helpers:152:16)

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- WARN: WORK_VERIFY.md UNEXPECTED_BOM (generated artifact must not carry a BOM)

## Targets
- Execution-class targets: 1
- Static-class targets: 4

## Verdict
SMOKE_FAIL
