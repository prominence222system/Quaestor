## Verdict
FIX
## Verdict Criteria (current work file only)
- NEXT: a phase REMAINS WITHIN the current work file (not for other work files)
- FIX: Current Phase has bugs or missing features
- REDESIGN: Fundamental design issues require architecture change
- INTEGRATE: ALL phases of the current work file are DONE, need an integration test
- PASS: the current work file is complete (all its phases DONE, tests pass); forge advances to the next work file

## Redesign Needed
NO

## Current Phase Evaluation
- Phase: 3
- Feature: `watch-loop.js` 배선 — 관측 상태 갱신(`recordSuccess`/`recordFailure`) · 실패 로그에 `kind`/`hint` 동반 · `require.main === module` 가드 · 모듈 로드 경계 검증
- Complete: yes
- Issues found: 없음. `require('../watch-loop.js')` 가 실제로 루프를 시작하지 않고 반환함을 직접 재현해 확인(가드 부재 시 무한 루프로 테스트가 멈추는 방식의 행동 검증). `pollOnce()` 성공/실패 분기 각각 `recordSuccess`/`recordFailure` 호출 확인, 실패 로그 라인에 `kind`·`hint` 노출 확인. `deriveDesired`/`isValidUsage`/`writeStopJsonAtomic`/`readConfig`/`resolveStopDir` 는 소스 diff 없이 그대로 유지됨(재구현 금지 준수).

## Acceptance-Criteria Integrity Check
- `output/ACCEPTANCE.md` 에는 Phase 1·2 절만 있고 Phase 3 전용 [SPEC]/[DERIVED] 태그가 없다.
  `output/TEST_RESULT.md` 가 작업지시서 §5(`watch-loop.js` 배선) · §6(검증 하네스) · 상단 Acceptance
  항목을 근거로 Phase 3 채택 기준을 명시하고, 그 각각을 실제 테스트(`watch-loop.test.js` 6개)와
  대응시켜 Pass/Fail 표로 정리했다 — 직접 재실행(`node p-bellows/test/run-all.js`, 58/58 pass)으로
  확인.
- Phase 1(42개)·Phase 2(약 30개) 기준은 이전 iteration 대비 삭제·완화 없이 그대로이며,
  `observation.test.js`(29개)·`scrape-classify.test.js`(23개) 테스트 수도 이전 평가와 일치한다.
- 남는 것은 프로세스 상의 공백(design-next 가 Phase 3 용 ACCEPTANCE 절을 별도로 작성하지
  않음)이며, 실질적 커버리지 자체는 TEST_RESULT.md 의 자체 채택 기준으로 메워져 있고 작업지시서
  003 최상단의 전체 Acceptance 목록(순수성·`ok` 오판 금지·비밀 미유출·연속 실패 리셋·
  `require.main` 경계·hint 판정)과도 전부 대응됨을 확인했으므로 이번 판정을 막는 갭으로
  보지 않는다.

## Work Detail
- Files created/modified: `p-bellows/lib/observation.js`(신규) · `p-bellows/lib/scrape.js`(수정: `err.kind` 부착, `hintFrom`/`collectDiagnostics` 추가, puppeteer 지연 로드) · `p-bellows/watch-loop.js`(수정: 관측 배선 + `require.main` 가드) · `p-bellows/test/observation.test.js`(신규, 29개) · `p-bellows/test/scrape-classify.test.js`(신규, 23개) · `p-bellows/test/watch-loop.test.js`(신규, 6개) · `p-bellows/test/run-all.js`(신규 하네스)
- 직접 재실행 확인: `node p-bellows/test/run-all.js` → `tests 58 / pass 58 / fail 0`, 종료 코드 0.
- `deriveState()` 순수성·판정 규칙(R1~R7, first-match-wins)·`fields` 화이트리스트(비밀 미유출)·`kind`/`hint` 고정 어휘 일치(scrape.js ↔ observation.js) 모두 소스 리뷰로 설계(DESIGN.md)와 일치함을 확인.
- STOP.json 스키마·경로, `deriveDesired()` 임계 판정과 히스테리시스, 수동 STOP 우선 규칙 — 무변경 확인(`watch-loop.js` 의 해당 함수 본문이 그대로 유지됨).

## Issues
- `output/ACCEPTANCE.md` 에 Phase 3 절이 없다(위 Integrity Check 참조) — 다음 NNN 부터 design-next
  단계에서 각 Phase 착수 전 ACCEPTANCE 절을 함께 채우는 것을 권장한다. 이번 라운드는 TEST_RESULT.md
  의 자체 채택 기준이 작업지시서 원문과 정확히 일치해 실질 공백은 없었다.
- 프로젝트 전역 스모크(`SMOKE_RESULT.md`)의 `Entry Point Smoke` 항목이 `deploy-bellows.ps1 -DryRun`
  에서 "Bellows source not found in Synology" 로 FAIL 하지만, 이는 이 NNN 이 건드리지 않은 파일이고
  원인도 이 평가 환경에 Synology 소스 트리 경로가 없다는 환경 문제다. MASTER.md 가 명시한
  `## Work Verify`(`node p-bellows/test/run-all.js`)는 `EXECUTED_PASS` 로 별도 기록되어 있어
  이 NNN 의 판정 근거로는 그것을 채택했다.

## Good Points
- 🔒 조항("측정이 죽어 있는데 `ok` 로 보이면 실패")을 코드·테스트 양쪽에서 정확히 구현: `lastSuccessAt===null` 및 `consecutiveFailures>=4` 케이스 모두 `ok` 를 반환하지 않음을 전용 테스트로 고정.
- `hintFrom()` 이 근거 부족 시 `login-expired` 로 기울지 않고 `unknown` 을 기본값으로 반환하도록 first-match-wins 로 구현 — 설계 의도(오판이 사람을 헛걸음시키는 문제)를 정확히 반영.
- `fields`/`summary` 에 `detail`(원문 200자·URL 전체)을 절대 싣지 않고 고정 어휘(`kind`/`hint`)만 화이트리스트로 노출 — 비밀 유출 테스트로 고정.
- `require('puppeteer')` 지연 로드로 순수 판정 경로가 Chrome 드라이버 없이도 hermetic 하게 검증됨.
- `require.main === module` 가드의 부재를 "테스트가 멈춘다"는 행동적 방식으로 검증한 설계가 실제로 유효함을 재실행으로 확인.
- STOP.json 관련 불변 로직(`deriveDesired`/`writeStopJsonAtomic`/`resolveStopDir` 등)을 재구현하지 않고 그대로 감쌌다.

## How to Run

**전제**: Node.js (내장 `node:test`/`node:assert` 사용, 추가 설치 불필요).

1. Hermetic 테스트 실행(Chrome·네트워크 불필요):
   ```
   node p-bellows/test/run-all.js
   ```
   58개 테스트 전부 통과, 종료 코드 0 이어야 한다.

2. 실제 감시 루프를 돌리려면(선택, 이 NNN 의 범위는 아니지만 참고):
   ```
   run-bellows.ps1 [-IntervalMinutes 15] [-ChromePath ...] [-ChromeProfileDir ...]
   ```
   Chrome 을 `--remote-debugging-port=9222` 전용 프로필로 띄운 뒤 `watch-loop.js` 가 15분마다 폴링한다.
   🔒 `node watch-loop.js` 를 단독으로 실행하지 말 것 — Chrome 이 9222 로 떠 있지 않으면 연결 실패로 끝난다.

3. 관측 상태·실패 분류 결과는 `bellows.log`(`.prominence` 폴더)에 `kind`·`hint` 와 함께 기록된다.
   HTTP 로 노출(`/api/health`·`/api/status`)하는 것은 **004** 작업의 범위다.


## Verdict
FIX

## Smoke Override
Smoke verification failed. Forced to FIX.
