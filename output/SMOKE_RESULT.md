# SMOKE_RESULT

Generated: 2026-09-23 11:17:08

## File Checks
- All file checks passed

## Key Files
- key-files: regenerated 0 excluded (build|.gradle|.kotlin|obj|bin), checked 2 -- all present

## Build Commands
- No build commands defined

## Test Commands
- No test commands defined

## Entry Point Smoke
- deploy-quaestor.ps1 (-DryRun): PASS (exit 0) -- exited 0

## Declared Smoke (MASTER.md ## Work Verify)
- EXECUTED_PASS: `node p-quaestor/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Quaestor, exit 0, 4.7s)
```
73ms)
✔ never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists (0.0571ms)
✔ live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable (0.1393ms)
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.091ms)
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1025ms)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit (2.5768ms)
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling (1.395ms)
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing (1.6981ms)
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes) (39.8143ms)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @) (1.3345ms)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop (0.1247ms)
✔ W1: startControlServer(...) is called with both configPath and onConfigChange (0.1666ms)
✔ W2: refreshConfig() exists and updates lastCfg/lastConfigSource from readConfig(CONFIG_PATH) (0.1472ms)
✔ W3: pollOnce() calls refreshConfig() and does not duplicate config-reading logic (0.1349ms)
✔ W4 [SPEC]: existing [config] log strings are byte-for-byte unchanged, and watch-loop.js contains no "[thresholds]" string (0.0664ms)
✔ 014 §2: createAgyMonitor( is called exactly once, at module scope (not inside pollOnce()) (0.1071ms)
✔ 014 §2: pollOnce() calls agyMonitor.poll() right after refreshConfig(), unawaited, ahead of every early return (0.1489ms)
✔ 014 §2: watch-loop.js requires createAgyMonitor from ./lib/agy-usage (0.0935ms)
ℹ tests 406
ℹ suites 0
ℹ pass 406
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4595.4612

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- No BOM policy violation (12 file(s) scanned)

## Targets
- Execution-class targets: 2
- Static-class targets: 4

## Verdict
SMOKE_PASS
