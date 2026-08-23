## 2026-08-19T06:25:34Z  round=Round 2  completed=004-control-http-contract.md  verdict=VERIFIED
- project: Bellows
- project_dir: F:\Workspace\Automatic\projects\Bellows
- head: 89a91d20cc895361fe71c47a61968c84977c024c
- worktree: UNCHANGED
- duration: 1s
- checks: 1 declared / 1 ran / 1 passed
- NOTE: report only. This is NOT a verdict and does NOT change project state.

### [1/1] SMOKE 1/1 -- PASS (exit 0)
- command: node p-bellows/test/run-all.js
- workdir: F:\Workspace\Automatic\projects\Bellows
- failure point: none (passed)
- reproduce:
      cd "F:\Workspace\Automatic\projects\Bellows"
      node p-bellows/test/run-all.js
- log tail:
```
on malformed input (missing file / broken JSON / wrong types / expired) (1.2288ms)
? config: file control.port overrides default when a valid 1..65535 integer (0.7687ms)
? config: file control.port out of range or wrong type falls back to default (2.4632ms)
? config: file control.authToken sets the token; empty/whitespace normalizes to null (1.2684ms)
? config: top-level authToken is a fallback only when control.authToken is absent; control.authToken wins when both present (1.2928ms)
? config: expired config or parse-error config resets control to defaults (auth off) (1.2681ms)
? config: existing fields (enabled/thresholds/expires_at) are unaffected by the control block addition (0.7192ms)
? live closure: reassigning the observation variable changes the next /api/status response (no capture-at-startup) (3.2514ms)
? never-brick simulation: startup on an occupied port resolves started:false and the caller keeps running (no exception escapes) (0.9ms)
? first poll before any success: empty observation + unset ctx yields state !== ok (no green light before measurement) (2.1022ms)
? ctx.stop and ctx.configSource propagate into /api/status fields (STOP field + ?? ?? field) (2.0799ms)
? assembly path: readConfig() -> startControlServer() binds the contract default address (127.0.0.1:3210) (3.6143ms)
? env: BELLOWS_CONTROL_PORT / BELLOWS_CONTROL_TOKEN override hard defaults; file values still win over env (0.9533ms)
? response shape matrix: every reachable status code (200/200/401/404/405/500/501) is directly asserted for I1-I5 (21.408ms)
? adversarial paths: route variants and unknown methods are rejected as valid JSON without harming the server (7.6928ms)
? adversarial: a dot-segment path normalizes to /api/status and matches the contract shape (no filesystem access) (3.4959ms)
? adversarial: HEAD /api/health -> 405, headers-only assertion (HTTP forbids a HEAD response body) (3.6428ms)
? adversarial: an ~8KB request path draws a 4xx (exact code left to the Node parser layer) and the server keeps running (6.8514ms)
? adversarial: duplicate Authorization headers do not throw -- Node keeps the first value, a mismatch still yields 401 (2.3402ms)
? adversarial: a multi-KB Bearer token does not throw -- 401, not 500 (1.9452ms)
? adversarial: GET /api/status with a request body is still 200 and has no side effects (the body is never read) (2.1049ms)
? adversarial: POST /api/stop with Content-Type: text/xml is still 501 (the body is never parsed) (1.7956ms)
? resilience R1-R5: concurrency, abrupt disconnects, and malformed bytes never crash the server, leak side effects, or throw unhandled errors (24.4621ms)
? deriveState is pure and deterministic (same input twice) (0.1458ms)
? observation.js source does not read wall-clock time or fs (0.1699ms)
? deriveState does not mutate obs or ctx (0.1317ms)
? recordSuccess/recordFailure do not mutate input obs (0.083ms)
? fields are timezone independent (0.2434ms)
? never-success observation is not ok (0.0751ms)
? consecutiveFailures at crit threshold is crit, even with no success history (0.0864ms)
? stale success (>2h) is crit (0.1864ms)
? stale success (>45m, <=2h) is warn (0.0915ms)
? fresh + near threshold is warn, fresh + headroom is ok (0.0929ms)
? enabled=false forces idle regardless of other conditions (0.0884ms)
? state is always one of the four enum values (0.103ms)
? deriveState never throws on missing/empty inputs (0.1126ms)
? success -> failure -> failure -> success resets consecutiveFailures to 0 (0.0841ms)
? recordFailure increments consecutiveFailures/totalFailures, keeps lastSuccessAt (0.0751ms)
? recordSuccess sets lastSuccessAt to now, resets consecutiveFailures, keeps totalPolls counting (0.0744ms)
? createObservation initial shape (0.0937ms)
? recordFailure normalizes falsy/non-string kind to unknown (0.0752ms)
? recordSuccess keeps prior lastFailure (0.084ms)
? no secrets leak into deriveState output, even when detail carries them (0.1204ms)
? lastFailure field carries only kind + known hint vocabulary (0.0901ms)
? unknown/garbage hint is dropped, not surfaced (0.0849ms)
? fields entries have string label/value and optional valid state (0.1009ms)
? fields include all required items (0.0846ms)
? STOP field distinguishes manual vs auto vs none (0.1248ms)
? configSource field reflects ctx.configSource (0.0967ms)
? lastUsage=null keeps session/weekly fields present with placeholder value (0.0928ms)
? field order is stable across calls (0.1292ms)
? observation.js requires no external modules (puppeteer etc.) (0.1167ms)
? hintFrom: login path -> login-expired (0.1223ms)
? hintFrom: target origin + non-empty body, no login -> anchor-missing (0.064ms)
? hintFrom: unknown when evidence is missing or inconclusive (0.0818ms)
? hintFrom: malformed url strings do not throw and fall back to unknown (0.0816ms)
? hintFrom: pure -- does not mutate its input, same input gives same output (0.0841ms)
? HINTS enumerates exactly the three known hint values (0.0666ms)
? collectDiagnostics reproduces all three hints via an injected fake page (0.2103ms)
? collectDiagnostics never throws, even when url()/evaluate() throw or page is null (0.1733ms)
? collectDiagnostics caps textHead at 200 chars (0.1047ms)
? connect() failure classified as chrome-unreachable, existing message preserved (1.197ms)
? browser.newPage() failure classified as chrome-unreachable, message/stack preserved (0.3778ms)
? page.goto() failure classified as nav-failed (0.3709ms)
? waitForFunction() failure classified as anchor-timeout, with diagnostics collected before close() (0.4627ms)
? waitForFunction() failure with unrecognizable page yields hint unknown, never login-expired by default (0.4251ms)
? page.evaluate() extraction failure classified as invalid-extraction (0.3845ms)
? success path returns usage and only disconnects (never closes) the browser (0.3777ms)
? FAILURE_KINDS has exactly the 5 expected values (0.0762ms)
? HINTS matches the hint vocabulary observation.js recognizes (whitelist round-trip) (0.1523ms)
? err.detail carries url/textHead for diagnosis, but only hint is meant to reach deriveState fields (0.1125ms)
? scrapeUsage keeps its existing signature and is still exported (0.0708ms)
? lib/scrape.js references the claude.ai domain exactly once (constant only) (0.0853ms)
? lib/scrape.js does not require puppeteer at the top level (lazy load) (0.0988ms)
? requiring lib/scrape.js does not eagerly load the puppeteer module (0.0604ms)
? require("../watch-loop.js") loads without starting the watch loop (1.0621ms)
? watch-loop.js source guards its immediate-invocation loop with require.main === module (0.0986ms)
? watch-loop.js wires lib/observation.js into pollOnce success/failure branches (0.1978ms)
? scrape-failure log line surfaces kind and hint (?5 diagnostic logging requirement) (0.1367ms)
? watch-loop.js does not re-implement frozen helpers (deriveDesired/isValidUsage/writeStopJsonAtomic/readConfig/resolveStopDir stay) (0.0804ms)
? p-bellows/.js files do not reference the Claude CLI (0.3904ms)
? C1: requiring watch-loop.js does not call startControlServer at module-load time (0.8841ms)
? C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level (0.1237ms)
? C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally (0.0918ms)
? never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists (0.0801ms)
? live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable (0.1589ms)
? C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference (0.0994ms)
? watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring) (0.1308ms)
? tests 133
? suites 0
? pass 133
? fail 0
? cancelled 0
? skipped 0
? todo 0
? duration_ms 774.037

```

