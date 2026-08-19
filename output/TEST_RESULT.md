# TEST_RESULT — Phase 3

**대상 NNN**: 003-observation-state-and-failure-classification
**대상 Phase**: Phase 3 — `watch-loop.js` 배선 (관측 상태 갱신 · `kind`/`hint` 로그 · `require.main` 가드)
**판정**: **PASS** (58/58 통과, 종료 코드 0)

**QA 재검증 (별도 세션)**: `node p-bellows/test/run-all.js` 를 저장소 루트에서 재실행해
동일하게 58/58 PASS, 종료 코드 0 을 확인했다. `p-bellows/*.js` 전체(재귀) grep 으로
`watch-loop.js`·`watch-once.js` 에 `claude` 매칭 0건, `lib/scrape.js` 에는 도메인 상수
1건만 존재함을 재확인했다. 구현·테스트 코드 수정 없음 — 아래 기존 결과가 그대로 유효하다.

## 기준 문서에 대한 메모

`output/ACCEPTANCE.md` 는 **Phase 1**(`lib/observation.js`)과 **Phase 2**(`lib/scrape.js`)까지만
정의되어 있고, `output/PROGRESS.md` 가 CURRENT 로 표시한 **Phase 3**(`watch-loop.js` 배선)에 대한
기준이 없다. 규칙에 따라 **작업지시서 §5 `watch-loop.js` 배선 · §6 검증 하네스 · 최상단
Acceptance 항목**을 Phase 3 의 기준으로 채택했다. `output/ACCEPTANCE.md` 는 수정하지 않았다.

채택한 Phase 3 기준:
- [SPEC] `pollOnce()` 의 성공/실패 각 분기에서 관측 상태(`observation.js`)를 갱신한다.
- [SPEC] 실패 로그에 `kind` 와 `hint` 를 함께 남긴다.
- [SPEC] 파일 맨 아래 즉시실행 루프를 `require.main === module` 가드로 감싼다.
- [SPEC] `require('../watch-loop.js')` 가 감시 루프를 시작하지 않고 반환한다.
- [SPEC] `deriveDesired()`·`isValidUsage()`·`writeStopJsonAtomic()`·`readConfig()`·`resolveStopDir()`
  를 재구현하지 않는다(그대로 유지).
- [SPEC] `claude` 문자열이 `.js` 코드에 grep 매칭되지 않는다(도메인 URL 예외).
- [SPEC] `node p-bellows/test/run-all.js` 가 Chrome·네트워크 없이 완주하고 종료 코드 0 이다.

## 구현 중 발견/수정한 버그

착수 시점에 `watch-loop.js` 는 Phase 1·2 산출물이 준비된 뒤에도 **배선이 되어 있지 않았다** —
관측 상태 갱신이 없고, 파일 맨 아래 즉시실행 루프에 `require.main` 가드도 없어
`require('./watch-loop')` 만 해도 감시 루프가 시작되는 상태였다(작업지시서 §5 가 정확히 지적한
결함). 이번 라운드에서 다음을 구현해 해소했다:

1. `lib/observation.js` 의 `createObservation`/`recordSuccess`/`recordFailure` import.
2. 모듈 스코프 `let observation = createObservation();` 추가, 그리고
   - `scrapeUsage()` 예외 분기 — `kind = e.kind || 'unknown'`, `hint = e.detail && e.detail.hint`
     를 로그 줄에 남기고 `observation = recordFailure(observation, kind, e.detail || null, Date.now())`.
   - `isValidUsage()` 실패 분기 — `observation = recordFailure(observation, 'invalid-extraction', null, Date.now())`.
   - 성공 분기 — `observation = recordSuccess(observation, usage, Date.now())`.
3. 즉시실행 IIFE 를 `async function mainLoop() {...}` 로 이름 붙이고
   `if (require.main === module) { mainLoop(); }` 가드로 감쌌다.
4. `deriveDesired`·`isValidUsage`·`writeStopJsonAtomic`·`readConfig`·`resolveStopDir` 는
   시그니처·동작 무변경(재구현 없음) — `git status` 로 확인: 변경 파일은 `watch-loop.js` 와
   신규 `test/watch-loop.test.js` 뿐, `lib/*.js` 는 손대지 않았다.

이 변경으로 STOP.json 판정 로직·히스테리시스에는 변화가 없다.

## Hermetic 검증에 대한 설계 결정

`resolveStopDir()` 는 실제 Synology 드라이브(`D:`/`F:`)를 훑어 `.prominence` 를 찾는 🔒 불변
로직이며, 이 NNN 스코프에서 주입 가능하게 바꾸는 것이 금지되어 있다. 그 결과 `pollOnce()` 를
실제로 호출하는 종단 테스트는 실제 `STOP.json`/`bellows.log` 를 건드리게 된다 — 이는 이
제품이 보호하려는 바로 그 안전장치 파일이므로, 테스트로 그 상태를 흔드는 것은 과도한 위험으로
판단해 **의도적으로 피했다**. 대신:

- `require('../watch-loop.js')` 호출 자체를 검증해 가드가 즉시실행 루프를 실제로 막는지
  행동 기준으로 확인했다 — 가드가 없다면 `require()` 가 `while(true)` 에 진입해 테스트가
  멈춘다. 통과는 곧 가드가 동작한다는 뜻이다.
- 관측 상태 배선(`recordSuccess`/`recordFailure` 호출)과 실패 로그의 `kind`/`hint` 노출은
  소스 구조 검사로 고정했다 — `observation.test.js` 가 이미 이 방식(`Date.now()`/`fs` 미사용을
  소스 정규식으로 검증)을 쓰고 있어 저장소 관례와 일치한다.
- `pollOnce()` 내부의 STOP.json 읽기/쓰기 경로 자체는 Phase 3 스코프 밖(재구현 금지)이므로
  종단 단위테스트 대상에서 제외했다. `require()` 시점에 `resolveStopDir()` 가 이미 실행되어
  `.prominence` 디렉터리 존재를 보장하는 부수효과는 이 NNN 이전부터 있던 동작이며 이번
  테스트로 새로 발생한 위험이 아니다(로그 미기록 확인 — `mainLoop()` 가 호출되지 않으므로
  `log('[start] ...')` 도 실행되지 않는다).

## Phase 3 Acceptance Criteria — Pass/Fail

| # | 기준 | 결과 |
|---|---|---|
| 1 | `pollOnce()` 성공/실패 각 분기에서 관측 상태 갱신 | PASS (구조 검사: `recordSuccess`/`recordFailure` 호출 존재 + 소스 리뷰) |
| 2 | 실패 로그에 `kind`·`hint` 동반 | PASS (구조 검사: catch 블록에 `kind`·`hint` 참조 확인) |
| 3 | 즉시실행 루프를 `require.main === module` 로 가드 | PASS |
| 4 | `require('../watch-loop.js')` 가 루프를 시작하지 않고 반환 | PASS (행동 검증: `require()` 가 멈추지 않고 완료) |
| 5 | `deriveDesired`/`isValidUsage`/`writeStopJsonAtomic`/`readConfig`/`resolveStopDir` 재구현 금지 | PASS |
| 6 | `p-bellows/*.js` 에 `claude` grep 매칭 0건(도메인 URL 예외) — `watch-loop.js` 자체는 예외 없이 0건 | PASS |
| 7 | `node p-bellows/test/run-all.js` Chrome·네트워크 없이 완주, 종료 코드 0 | PASS |

## 테스트 전체 목록 및 결과

`node p-bellows/test/run-all.js` — 3개 테스트 파일 로드, **58/58 PASS**, 종료 코드 0.

- `observation.test.js` — 28개 (Phase 1, 회귀 없음)
- `scrape-classify.test.js` — 24개 (Phase 2, 회귀 없음)
- `watch-loop.test.js` — 6개 (신규, Phase 3)
  1. `require("../watch-loop.js") loads without starting the watch loop`
  2. `watch-loop.js source guards its immediate-invocation loop with require.main === module`
  3. `watch-loop.js wires lib/observation.js into pollOnce success/failure branches`
  4. `scrape-failure log line surfaces kind and hint (§5 diagnostic logging requirement)`
  5. `watch-loop.js does not re-implement frozen helpers (deriveDesired/isValidUsage/writeStopJsonAtomic/readConfig/resolveStopDir stay)`
  6. `p-bellows/.js files do not reference the Claude CLI`

실행 로그 요약:
```
[run-all] loading 3 test file(s): observation.test.js, scrape-classify.test.js, watch-loop.test.js
tests 58 / pass 58 / fail 0 / cancelled 0 / skipped 0 / duration_ms ~28ms
```
재실행으로 결정성도 확인(동일 결과, 종료 코드 0).

## 이전 Phase 통합 검증

- Phase 1(`lib/observation.js`) 28개 테스트 전부 통과 — 순수성·판정 규칙·비밀 미유출·`fields` 형식 무변경.
- Phase 2(`lib/scrape.js`) 24개 테스트 전부 통과 — `err.kind`/`hintFrom`/`collectDiagnostics`/어휘 일치 무변경.
- Phase 3 는 `lib/scrape.js`·`lib/observation.js`·`lib/extract.js`·`lib/config.js` 를 일절
  수정하지 않았다 — `git status` 확인 결과 변경 파일은 `watch-loop.js`(수정)와
  `test/watch-loop.test.js`(신규) 뿐이다.
- STOP.json 스키마·경로, `deriveDesired()` 임계 판정과 히스테리시스, 수동 STOP 우선 규칙 — 무변경.
- `p-bellows` 의 `.js` 파일 전체에서 `claude` grep 매칭은 `lib/scrape.js` 의 도메인 상수 1건뿐이고
  (Phase 2 산출물), `watch-loop.js` 를 포함한 신규/수정 파일은 매칭 0건 — Claude CLI 미사용 제약 유지.


===========================================
NNN: 004-control-http-contract
Started: 2026-08-19T05:10:46Z
===========================================
