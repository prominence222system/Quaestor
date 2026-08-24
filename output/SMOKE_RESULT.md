# SMOKE_RESULT

Generated: 2026-08-24 15:33:19

## File Checks
- FAIL: deploy-bellows.ps1: entry-point -DryRun did not start (startup-failure signature: ErrorRecordCategoryInfo)
- FAIL: declared smoke failed: node p-quaestor/test/run-all.js (exit -1073740791)
- FAIL: declared smoke not verified: declared smoke: 1 declared / 0 executed-pass

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
- EXECUTED_FAIL: `node p-quaestor/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Quaestor, exit -1073740791, 0.5s)
```
 config: expired config or parse-error config resets control to defaults (auth off) (1.5249ms)
✔ config: existing fields (enabled/thresholds/expires_at) are unaffected by the control block addition (0.7264ms)
✔ live closure: reassigning the observation variable changes the next /api/status response (no capture-at-startup) (3.601ms)
✔ never-brick simulation: startup on an occupied port resolves started:false and the caller keeps running (no exception escapes) (1.1195ms)
✔ first poll before any success: empty observation + unset ctx yields state !== ok (no green light before measurement) (2.5328ms)
✔ ctx.stop and ctx.configSource propagate into /api/status fields (STOP field + 설정 출처 field) (2.1173ms)
✔ assembly path: readConfig() -> startControlServer() binds the contract default address (127.0.0.1:3210) (3.6508ms)
✔ env: BELLOWS_CONTROL_PORT / BELLOWS_CONTROL_TOKEN override hard defaults; file values still win over env (1.0819ms)
✔ response shape matrix: every reachable status code (200/200/401/404/405/500/501) is directly asserted for I1-I5 (26.0476ms)
✔ adversarial paths: route variants and unknown methods are rejected as valid JSON without harming the server (8.0404ms)
✔ adversarial: a dot-segment path normalizes to /api/status and matches the contract shape (no filesystem access) (2.4198ms)
✔ adversarial: HEAD /api/health -> 405, headers-only assertion (HTTP forbids a HEAD response body) (2.6922ms)
✔ adversarial: an ~8KB request path draws a 4xx (exact code left to the Node parser layer) and the server keeps running (5.1946ms)
✔ adversarial: duplicate Authorization headers do not throw -- Node keeps the first value, a mismatch still yields 401 (2.3503ms)
✔ adversarial: a multi-KB Bearer token does not throw -- 401, not 500 (2.2302ms)
✔ adversarial: GET /api/status with a request body is still 200 and has no side effects (the body is never read) (2.6777ms)
✔ adversarial: POST /api/stop with Content-Type: text/xml is still 501 (the body is never parsed) (2.1586ms)

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- WARN: WORK_VERIFY.md UNEXPECTED_BOM (generated artifact must not carry a BOM)

## Targets
- Execution-class targets: 0
- Static-class targets: 4

## Verdict
SMOKE_FAIL
