## Verdict
PASS

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
- `SMOKE_RESULT.md` 의 `Entry Point Smoke`(`deploy-bellows.ps1 -DryRun`)가 "Bellows source not found
  in Synology" 로 FAIL 한다. 원인은 `deploy-bellows.ps1` 의 `$SrcRoot` 탐색이 `D:\SynologyDrive\...`
  / `F:\SynologyDrive\...` 를 찾는데, 이 평가 환경에는 해당 드라이브가 마운트돼 있지 않다는 것이다.
  이 NNN 은 `deploy-bellows.ps1` 을 전혀 수정하지 않았고(§ Scope 밖), MASTER.md 가 이 NNN 에 대해
  명시한 `## Work Verify`(`node p-bellows/test/run-all.js`)는 `SMOKE_RESULT.md` 에도
  `EXECUTED_PASS` 로 별도 기록돼 있다 — 이 NNN 의 판정 근거로 후자를 채택했다. 다만 이 환경적
  불일치가 조직 차원의 스모크 게이트에서 별도로 FIX 를 강제할 수 있음을 인지하고 있다; 코드
  결함이 아니라 배포 스크립트가 요구하는 드라이브 마운트 여부의 환경 차이라는 점을 기록해 둔다.

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


## Fix Loop Diagnosis
[fix-diag] attempts=1 identical=1/1 escalated=yes escalation-helped=yes


===========================================
NNN: 004-control-http-contract
Started: 2026-08-19T05:10:46Z
===========================================

## Verdict
NEXT

## Verdict Criteria (current work file only)
- NEXT: a phase REMAINS WITHIN the current work file (not for other work files)
- FIX: Current Phase has bugs or missing features
- REDESIGN: Fundamental design issues require architecture change
- INTEGRATE: ALL phases of the current work file are DONE, need an integration test
- PASS: the current work file is complete (all its phases DONE, tests pass); forge advances to the next work file

## Redesign Needed
NO

## Current Phase Evaluation
- Phase: 1
- Feature: `lib/control-server.js` 코어 — `127.0.0.1` 고정 리스너 · 라우팅 · `GET /api/health`(id=`quaestor`) · `GET /api/status`(`deriveState()` 투영, 부작용 0) · never-throw 기동 계약
- Complete: yes
- Issues found: 없음

## Acceptance-Criteria Integrity Check (output/ACCEPTANCE.md 존재 — 실행함)
- `output/ACCEPTANCE.md` 의 Phase 1 절 전체([SPEC] 다수 + [DERIVED] 다수)를 `output/TEST_RESULT.md` 의
  "Acceptance 기준별 결과" 표와 1:1 대조. 누락 없음 — 바인딩·기동 계약, `/api/health`, `/api/status`,
  라우팅·응답 형식, 경계·무변경 보장 4개 섹션 전부 테스트 이름과 매핑되어 있다.
- 이전 iteration 대비 [SPEC] 항목이 삭제·완화된 흔적 없음(`## Superseded` 노트 불필요 — 004 최초 평가).
- `node p-bellows/test/run-all.js` 직접 재실행으로 확인: **83/83 통과, 종료 코드 0**
  (기존 58 + control-server 신규 25). TEST_RESULT.md 의 수치와 일치.

## Work Detail
- Files created/modified: `p-bellows/lib/control-server.js`(신규), `p-bellows/test/control-server.test.js`(신규)
- `startControlServer(opts)` → `{ started, port, address, error, close }` — never-throw 기동 계약,
  `HOST='127.0.0.1'` 하드코딩(opts 로 오버라이드 불가), `EADDRINUSE` 등 실패 시 reject 없이 `started:false`.
- `GET /api/health` — `getSnapshot()` 을 호출하지 않는다(observation-free). `id:'quaestor'` 고정(폴더명 `bellows` 와 분리).
- `GET /api/status` — `deriveState()` 결과를 그대로 투영. 재판정 로직 없음, `getSnapshot` throw 시 `ok:true` 안 냄.
- `POST /api/stop` — 501 + 의도적 미구현 마커(작업지시서 §6 대로).
- 라우팅: 404(미지 경로)·405(GET 아닌 메서드)·쿼리스트링 무시·`Content-Type`/`Cache-Control: no-store` 헤더.
- `config.js`·`watch-loop.js` 는 `git diff` 로 무수정 확인 — Phase 2/3 범위 조기 착수 없음.

## Issues
없음.

## Good Points
- 실제 포트(`port:0`)를 열고 `fetch` 로 실요청 — 주입 픽스처만으로 끝내지 않는다는 §Acceptance 요구를 정확히 이행.
- `/api/health`(HTTP 생존)과 `/api/status`(측정 건강)를 코드·테스트 양쪽에서 분리 — 3주 침묵 재발 방지 조항을 지켰다.
- `getSnapshot` 호출 횟수·observation 불변성(`totalPolls` 등)까지 관측 가능한 방식으로 부작용 없음을 증명.
- 소스에 `85`/`90`/`70`/`75` 임계 리터럴이 없음을 grep 테스트로 확인 — 판정 중복 방지가 문서상 결정에 그치지 않고 코드로 검증됨.
- 테스트 파일의 구문 오류(잔재 `------`)를 발견해 즉시 수정하고 그 사실을 TEST_RESULT.md 에 정직하게 기록함.

## How to Run (Phase 1 한정 — 004 전체 완료 아님)
```
node p-bellows/test/run-all.js
```
전체 작업(004) 완료 후 실제 기동 확인은 Phase 3 종료 시 USER_GATE 절차(`work/004` §USER_GATE)를 따른다.
