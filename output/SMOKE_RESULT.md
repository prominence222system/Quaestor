# SMOKE_RESULT

Generated: 2026-09-23 11:45:33

## File Checks
- All file checks passed

## Key Files
- All key files present

## Build Commands
- No build commands defined

## Test Commands
- No test commands defined

## Entry Point Smoke
- deploy-quaestor.ps1 (-DryRun): PASS (exit 0) -- exited 0

## Declared Smoke (MASTER.md ## Work Verify)
- EXECUTED_PASS: `node p-quaestor/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Quaestor, exit 0, 4.5s)
```
(0.0602ms)
✔ live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable (0.1419ms)
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.1004ms)
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1043ms)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit (2.7557ms)
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling (1.6174ms)
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing (1.9732ms)
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes) (43.5386ms)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @) (1.4967ms)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop (0.118ms)
✔ W1: startControlServer(...) is called with both configPath and onConfigChange (0.1726ms)
✔ W2: refreshConfig() exists and updates lastCfg/lastConfigSource from readConfig(CONFIG_PATH) (0.1446ms)
✔ W3: pollOnce() calls refreshConfig() and does not duplicate config-reading logic (0.1321ms)
✔ W4 [SPEC]: existing [config] log strings are byte-for-byte unchanged, and watch-loop.js contains no "[thresholds]" string (0.0832ms)
✔ 014 §2: createAgyMonitor( is called exactly once, at module scope (not inside pollOnce()) (0.1093ms)
✔ 014 §2: pollOnce() calls agyMonitor.poll() right after refreshConfig(), unawaited, ahead of every early return (0.1491ms)
✔ 014 §2: watch-loop.js requires createAgyMonitor from ./lib/agy-usage (0.0903ms)
✔ 015 Phase 2 [SPEC]: controlSnapshot() returns ctx with agy key populated by agyMonitor.snapshot() (0.1626ms)
ℹ tests 420
ℹ suites 0
ℹ pass 420
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4430.1701

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- No BOM policy violation (12 file(s) scanned)

## Targets
- Execution-class targets: 2
- Static-class targets: 4

## Verdict
SMOKE_PASS
