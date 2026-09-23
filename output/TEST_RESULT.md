# TEST_RESULT — 015 Phase 2: `watch-loop.js` 에 스냅샷 전달 구현 및 `lib/control-server.js` 최상위 `agy` 블록, 1.5.0 계약 갱신

## 현재 Phase

**Phase 2 / 3** — `watch-loop.js` 에 스냅샷 전달 구현 및 `lib/control-server.js` 최상위 `agy` 블록, 1.5.0 계약 갱신

## Phase 2 Acceptance 기준별 결과

| 기준 | 상태 | 근거 및 검증 내용 |
|---|---|---|
| [SPEC] `watch-loop.js` 의 `controlSnapshot()` 이 돌려주는 `ctx` 반환 객체에 `agy` 키가 포함되며, 그 값은 모니터의 `snapshot()` 에서 제공된다. | PASS | `test/watch-loop.test.js` 의 `015 Phase 2 [SPEC]: controlSnapshot() returns ctx with agy key populated by agyMonitor.snapshot()` 테스트 통과. `controlSnapshot()` 함수 내부에서 `agy: agyMonitor.snapshot()` 으로 주입됨을 소스 구조 및 호출 검증 완료 |
| [SPEC] 실서버(`127.0.0.1` 바인딩) `GET /api/status` 호출 시 응답 최상위에 `agy` 블록이 존재하며, 키 집합이 1.5.0 규격과 정확히 일치한다. | PASS | `test/control-server.test.js` 의 `015 Phase 2 [SPEC]: real server GET /api/status returns top-level agy block with exact 1.5.0 key set` 및 `100% reset sentinel` 테스트 통과. 실서버 바인딩 상에서 `agy` 최상위 키 및 10개 서브키(`age_sec`, `bucket`, `covers`, `five_hour_remaining_pct`, `five_hour_reset`, `last_error`, `measured_at`, `stale`, `weekly_remaining_pct`, `weekly_reset`)의 정확한 존재와 형식 확인 |
| [SPEC] 독립성 보장: `ctx.agy` 가 실패 상태(`last_error: "timeout"`, 성공 이력 없음)일 때 반환되는 `usage`, `allowance`, `state`, `summary` 가 `ctx.agy` 가 없을 때와 실서버 환경에서 `deepStrictEqual` 임을 확인한다. | PASS | `test/control-server.test.js` 의 `015 Phase 2 [SPEC]: independence over real server -- ctx.agy in failure state does not affect usage, allowance, state, summary` 테스트 통과. 실제 구동된 2개의 서버 인스턴스를 통해 `ctx.agy` 실패 상태 주입 시 기존 필드에 어떠한 사이드이펙트도 없음을 실측 검증 |
| [SPEC] `GET /api/health` 응답의 `contracts["supervised-v1"]` 값이 `1.5.0` 이어야 한다. | PASS | `test/control-server.test.js` 의 `015 Phase 2 [SPEC]: real server GET /api/health returns contracts["supervised-v1"] === "1.5.0"` 및 기존 health 계약 테스트 통과. 실제 HTTP 요청을 통해 `contracts['supervised-v1'] === '1.5.0'` 검증 |
| [SPEC] 지정된 4곳의 `test/control-server.test.js` 테스트 편집(최상위 키 배열 추가 및 버전 갱신) 외에 기존 테스트 회귀가 0건이어야 하며, 특히 `usage.covers` 와 `allowance.covers` 에 `agy`가 포함되지 않음을 단언하는 기존 테스트들이 통과되어야 한다. | PASS | 허가된 4곳(`:231`, `:501`, `:1632`, `:2425`) 최상위 키 집합 검증 배열과 버전 검증 통과. `usage.covers` 및 `allowance.covers` 가 계속 `["claude"]` 를 유지하며 `agy` 가 포함되지 않음을 단언하는 기존 테스트(`:373`, `:374`, `:391`, `:392`) 전수 통과 |

## 전체 테스트 실행 결과

```
$ node p-quaestor/test/run-all.js
✔ require("../watch-loop.js") loads without starting the watch loop
✔ watch-loop.js source guards its immediate-invocation loop with require.main === module
✔ watch-loop.js wires lib/observation.js into pollOnce success/failure branches
✔ scrape-failure log line surfaces kind and hint (§5 diagnostic logging requirement)
✔ watch-loop.js does not re-implement frozen helpers (deriveDesired/isValidUsage/writeStopJsonAtomic/readConfig/resolveStopDir stay)
✔ p-quaestor/.js files do not reference the Claude CLI
✔ C1: requiring watch-loop.js does not call startControlServer at module-load time
✔ C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level
✔ C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally
✔ never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists
✔ live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable
✔ C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference
✔ watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring)
✔ Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit
✔ Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling
✔ Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing
✔ Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes)
✔ Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @)
✔ Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop
✔ W1: startControlServer(...) is called with both configPath and onConfigChange
✔ W2: refreshConfig() exists and updates lastCfg/lastConfigSource from readConfig(CONFIG_PATH)
✔ W3: pollOnce() calls refreshConfig() and does not duplicate config-reading logic
✔ W4 [SPEC]: existing [config] log strings are byte-for-byte unchanged, and watch-loop.js contains no "[thresholds]" string
✔ 014 §2: createAgyMonitor( is called exactly once, at module scope (not inside pollOnce())
✔ 014 §2: pollOnce() calls agyMonitor.poll() right after refreshConfig(), unawaited, ahead of every early return
✔ 014 §2: watch-loop.js requires createAgyMonitor from ./lib/agy-usage
✔ 015 Phase 2 [SPEC]: controlSnapshot() returns ctx with agy key populated by agyMonitor.snapshot()
✔ 015 Phase 2 [SPEC]: real server GET /api/status returns top-level agy block with exact 1.5.0 key set
✔ 015 Phase 2 [SPEC]: real server 100% reset sentinel -- five_hour_reset is null and absent from /api/status response
✔ 015 Phase 2 [SPEC]: independence over real server -- ctx.agy in failure state does not affect usage, allowance, state, summary
✔ 015 Phase 2 [SPEC]: real server GET /api/health returns contracts["supervised-v1"] === "1.5.0"
...
ℹ tests 420
ℹ suites 0
ℹ pass 420
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ~4445ms
```

- 제어 서버 단위 테스트(`test/control-server.test.js`): 153개 전수 통과 (PASS: 153, FAIL: 0)
- 워치 루프 단위 테스트(`test/watch-loop.test.js`): 27개 전수 통과 (PASS: 27, FAIL: 0)
- 전체 스위트(`node p-quaestor/test/run-all.js`): 420개 전수 통과 (PASS: 420, FAIL: 0, 회귀: 0, 종료 코드: 0)

## Phase 2 관련 테스트 목록

### `test/watch-loop.test.js`
- `015 Phase 2 [SPEC]: controlSnapshot() returns ctx with agy key populated by agyMonitor.snapshot()` — PASS
- `require("../watch-loop.js") loads without starting the watch loop` — PASS
- `watch-loop.js source guards its immediate-invocation loop with require.main === module` — PASS
- `watch-loop.js wires lib/observation.js into pollOnce success/failure branches` — PASS
- `p-quaestor/.js files do not reference the Claude CLI` — PASS
- `C1: requiring watch-loop.js does not call startControlServer at module-load time` — PASS
- `C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level` — PASS
- `C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally` — PASS
- `live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable` — PASS
- `C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference` — PASS
- `014 §2: createAgyMonitor( is called exactly once, at module scope (not inside pollOnce())` — PASS
- `014 §2: pollOnce() calls agyMonitor.poll() right after refreshConfig(), unawaited, ahead of every early return` — PASS
- `014 §2: watch-loop.js requires createAgyMonitor from ./lib/agy-usage` — PASS

### `test/control-server.test.js` (주요 Phase 2 테스트)
- `015 Phase 2 [SPEC]: real server GET /api/status returns top-level agy block with exact 1.5.0 key set` — PASS
- `015 Phase 2 [SPEC]: real server 100% reset sentinel -- five_hour_reset is null and absent from /api/status response` — PASS
- `015 Phase 2 [SPEC]: independence over real server -- ctx.agy in failure state does not affect usage, allowance, state, summary` — PASS
- `015 Phase 2 [SPEC]: real server GET /api/health returns contracts["supervised-v1"] === "1.5.0"` — PASS
- `[SPEC] GET /api/health over real port returns top-level contracts object with contracts["supervised-v1"] === "1.5.0"` — PASS
- `[SPEC] contracts field values are string types, not numbers or objects` — PASS
- `[SPEC] existing GET /api/health fields (ok, id, version, startedAt) remain present and unchanged` — PASS
- `[SPEC] software version (0.1.0) and contract version (1.5.0) are distinct axes and have different values` — PASS
- `[SPEC] GET /api/status response remains completely unchanged (no regression from 011)` — PASS
- `[008] real port -- allowance key set stays exactly {allowed, confidence, covers, reason} and top-level /api/status keys are unchanged from 007` — PASS
- `013 Phase 2 [SPEC]: real server GET /api/status returns covers: ["claude"] in both usage and allowance` — PASS
- `013 Phase 2 [SPEC]: GET /api/status without observation history still returns covers: ["claude"] (never null)` — PASS
- `[SPEC] regression: GET /api/health and GET /api/status are byte-identical to their pre-010 shape (aside from the wall-clock timestamps)` — PASS
- `[SPEC] regression: GET /api/status fields/summary/state/allowance/usage shape is unchanged after 012` — PASS

## 구현 코드에서 고친 버그

- 없음: `watch-loop.js` 및 `lib/control-server.js` 에 구현된 스냅샷 전달, 최상위 `agy` 블록 노출, `CONTRACTS` 1.5.0 갱신 등이 Phase 2 의 Acceptance Criteria 를 완벽히 충족하며 모든 테스트가 첫 실행부터 결함 없이 통과되었습니다.

## 이전 Phase 통합 검증 결과

- Phase 1 구현(`lib/observation.js` 의 `deriveAgy`, `fields` 내 Gemini 2행 렌더링) 및 001~014 전 라운드 회귀 0건 확인:
  - 015 Phase 1 `deriveAgy` 진리표 4가지 및 100% 리셋 센티넬 단위 테스트 전수 통과
  - 014 agy 모니터링 단위 테스트(`test/agy-usage.test.js`) 47개 전수 통과
  - 010 상태 웹페이지 무오염 검증(`test/status-page.test.js`) 28개 전수 통과
  - 012 임계값 수정 API 및 통합 검증(`test/thresholds*.test.js`) 38개 전수 통과
  - 005 로그 파싱 및 침묵 복원 검증(`test/logparse.test.js`) 전수 통과
- `control-server.js` 및 `watch-loop.js` 내에 금지된 `claude` 문자열(주석/변수명 포함) 0회 유지 확인 (`p-quaestor/.js files do not reference the Claude CLI` 통과).

## 결론

**PASS.** `output/ACCEPTANCE.md` 에 정의된 Phase 2 수용 기준 5개 항목이 모두 충족되었으며, 전체 테스트 스위트 420/420 통과, 회귀 0건, 종료 코드 0으로 검증 완료되었습니다.
