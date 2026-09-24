# SMOKE_RESULT

Generated: 2026-09-24 23:38:44

## File Checks
- FAIL: declared smoke failed: node p-quaestor/test/run-all.js (exit 1)
- FAIL: declared smoke not verified: declared smoke: 1 declared / 0 executed-pass

## Key Files
- key-files: regenerated 0 excluded (build|.gradle|.kotlin|obj|bin), checked 3 -- all present

## Build Commands
- No build commands defined

## Test Commands
- No test commands defined

## Entry Point Smoke
- deploy-quaestor.ps1 (-DryRun): PASS (exit 0) -- exited 0

## Declared Smoke (MASTER.md ## Work Verify)
- EXECUTED_FAIL: `node p-quaestor/test/run-all.js` (cwd: F:\Workspace\Automatic\projects\Quaestor, exit 1, 4.8s)
```
e="width:5%"></div></div><span>5% · 85%p 남음</span></div>
  <div class="row"><span>주간</span><div class="gauge"><div class="gauge-fill" style="width:5%"></div></div><span>5% · 80%p 남음</span></div>
  </section>
  <section>
  <h2>임계값</h2>
  <div class="field">주간 정지 85% / 해제 70%</div>
  <div class="field">세션 정지 90% / 해제 75%</div>
  </section>
  <section>
  <h2>마지막 측정</h2>
  <div class="field">2026-09-24T14:38:41.110Z (방금)</div>
  </section>
  <section>
  <h2>STOP</h2>
  <div class="field">없음</div>
  </section>
  <section>
  <h2>마지막 실패</h2>
  <div class="field">없음</div>
  </section>
  <section>
  <h2>감시 상태</h2>
  <div class="field">ok · 감시 중 · 주간 5%</div>
  </section>
  <section>
  <h2>Gemini</h2>
  <div class="row"><span>주간 잔량</span><span>모름</span></div>
  <div class="row"><span>5시간 잔량</span><span>모름</span></div>
  <div class="field">마지막 측정: 모름</div>
  <div class="field">상태: 측정 전</div>
  </section>
  </main>
  <script>(function(){var el=document.querySelector(".wrap");if(!el)return;var sig=el.getAttribute("data-sig");function sigOf(d){var a=(d&&d.allowance)||{};var u=(d&&d.usage)||{};return [String(a.allowed),String(a.reason),String(u.session_pct),String(u.weekly_pct),String(u.stale),String(u.measured_at),String(d&&d.state)].join("|");}setInterval(function(){fetch("/api/status",{cache:"no-store"}).then(function(r){return r.ok?r.json():null;}).then(function(d){if(d&&sigOf(d)!==sig){location.reload();}}).catch(function(){});},30000);})();</script>
  </body>
  </html>
  
  
  1 !== 0
  
      at TestContext.<anonymous> (F:\Workspace\Automatic\projects\Quaestor\p-quaestor\test\control-server.test.js:2829:12)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 1,
    expected: 0,
    operator: 'strictEqual',
    diff: 'simple'
  }

```

## BOM Policy
- Scanned: 12 file(s) (required-class: 0)
- WARN: ACCEPTANCE.md UNEXPECTED_BOM (generated artifact must not carry a BOM)
- WARN: DESIGN.md UNEXPECTED_BOM (generated artifact must not carry a BOM)
- WARN: PROGRESS.md UNEXPECTED_BOM (generated artifact must not carry a BOM)

## Targets
- Execution-class targets: 1
- Static-class targets: 4

## Verdict
SMOKE_FAIL
