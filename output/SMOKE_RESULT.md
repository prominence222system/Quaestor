# SMOKE_RESULT

Generated: 2026-09-23 11:25:30

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
5ms)
✔ never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists (0.0598ms)
✔ live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable (0.1609ms)
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.0909ms)
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1007ms)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit (2.8744ms)
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling (1.8596ms)
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing (2.0731ms)
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes) (40.9681ms)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @) (1.3476ms)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop (0.1308ms)
✔ W1: startControlServer(...) is called with both configPath and onConfigChange (0.1497ms)
✔ W2: refreshConfig() exists and updates lastCfg/lastConfigSource from readConfig(CONFIG_PATH) (0.1401ms)
✔ W3: pollOnce() calls refreshConfig() and does not duplicate config-reading logic (0.1279ms)
✔ W4 [SPEC]: existing [config] log strings are byte-for-byte unchanged, and watch-loop.js contains no "[thresholds]" string (0.0642ms)
✔ 014 §2: createAgyMonitor( is called exactly once, at module scope (not inside pollOnce()) (0.109ms)
✔ 014 §2: pollOnce() calls agyMonitor.poll() right after refreshConfig(), unawaited, ahead of every early return (0.1468ms)
✔ 014 §2: watch-loop.js requires createAgyMonitor from ./lib/agy-usage (0.0837ms)
ℹ tests 406
ℹ suites 0
ℹ pass 406
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4573.1628

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- No BOM policy violation (12 file(s) scanned)

## Targets
- Execution-class targets: 2
- Static-class targets: 4

## Verdict
SMOKE_PASS
