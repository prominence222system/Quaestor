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
- Phase: 4 (종단 통합 검증 · 계약 원문 대조 — CURRENT, 004의 마지막 Phase)
- Feature: `readConfig() → startControlServer()` 조립 경로가 계약 기본 주소(`http://127.0.0.1:3210`)에 실제로 바인딩됨을 검증 + 계약 체크리스트 1:1 대조표 + 이탈점(`id`/`tokenFrom`) 인수인계 기록
- Complete: yes
- Issues found: 없음 (경미한 서술 부정확 1건, 아래 Issues 참조 — 기능적 결함 아님)

## Acceptance-Criteria Integrity Check (output/ACCEPTANCE.md 존재 — 실행함)
- "004 Phase 4" 절의 전 항목([SPEC]/[DERIVED])을 `output/TEST_RESULT.md` 의 "Phase 4 Acceptance 기준별 결과" 표와 1:1 대조 — 조립 경로 종단 검증 8항목, 계약 원문 대조·인수인계 5항목, 부재 규칙 2항목, 무회귀·경계 9항목, USER_GATE 2항목(사람 확인 전용 — 계약상 자동 대체 불가로 명시돼 있어 갭 아님) 전부 대응 확인. 누락 없음.
- `p-bellows/test/control-server.test.js` 마지막 테스트(`assembly path: ...`)를 직접 읽고 대조 — 포트 값이 `cfg.control.port`(즉 `readConfig()` 반환값)에서 오고 `3210` 리터럴은 assert 우변에만 등장, `started` 이지선다 분기, `try/finally close()`, 재바인딩 확인, 파일 내 최종 배치 모두 설계(§10-3)와 일치.
- `CONTINUATION.md`(Synology)를 직접 열람 — 계약 체크리스트 8행 전부 판정(✅5·🔒1·⛔2), 이탈점 2곳(`supervised[].id`: `bellows`→`quaestor`, `control.tokenFrom`: `control.authToken` 우선/최상위 `authToken` 폴백) 명시 확인. `_guides\SUPERVISED_TOOL_CONTRACT.md` 는 열람만 하고 미수정임을 파일시스템으로 재확인(오늘 이 세션 중 수정 이력 없음).
- 이전 iteration(Phase 1·2·3 ACCEPTANCE) 대비 [SPEC] 삭제·완화 없음 — `git log -p -- output/ACCEPTANCE.md` 로 확인, 삭제된 `[SPEC]` 줄 없음.
- `git status --porcelain` 재확인 — `lib/control-server.js`·`lib/config.js`·`lib/observation.js`·`lib/scrape.js`·`watch-loop.js` 5개 파일 모두 dirty 아님(§10-2 "검증·문서 Phase" 자기 구속 준수).
- `node p-bellows/test/run-all.js` **직접 재실행**: **123/123 통과, 종료 코드 0**(fail 0, cancelled 0). TEST_RESULT.md 의 수치와 일치.
- `powershell -NoProfile -ExecutionPolicy Bypass -File ./deploy-bellows.ps1 -DryRun` **직접 재실행**: 정상 종료(에러 없음), TEST_RESULT.md 의 출력과 일치.

## Work Detail
- `p-bellows/test/control-server.test.js` — 신규 테스트 1개 `assembly path: readConfig() -> startControlServer() binds the contract default address (127.0.0.1:3210)` 추가. 성공/점유 두 갈래를 모두 무예외로 처리하는 플레이키 회피 구조.
- `CONTINUATION.md`(Synology) — "감독 HTTP 계약면(004, 완료)" 절 추가.
- `PROJECT_INTENT.md`(Synology) — `POST /api/stop` 영구 미구현 결정과 근거(Phase 2 산출물, 재확인만 함).
- `lib/control-server.js` · `lib/config.js` · `lib/observation.js` · `lib/scrape.js` · `watch-loop.js` — **무수정**.

## Issues
- TEST_RESULT.md가 "모든 응답 경로(200/401/404/405/500/501)가 파싱 가능한 JSON" 기준의 근거로 `secrets never leak` 테스트 하나만 인용했는데, 그 테스트 자체는 `body !== null` 을 직접 단언하지 않는다. 다만 재확인한 결과 동일 스위트의 다른 테스트들(401 인증 케이스들, 405 케이스, 501 stop 케이스, 500 getSnapshot-throw 케이스)이 각각 `res.body.ok` 를 참조하고 있어 — JSON 파싱이 실패했다면 `null.ok` 접근에서 즉시 throw 되어 해당 테스트가 깨졌을 것이다. 즉 기준 자체는 스위트 전체에 걸쳐 실질적으로 커버되어 있으나, TEST_RESULT.md의 근거 인용이 다소 부정확하다. 기능적 결함이 아니므로 FIX 사유로 보지 않았다.

## Good Points
- 이지선다(started true/false) 검증 설계가 "제품이 실제로 3210에서 돌고 있으면 테스트가 깨지는" 흔한 함정을 피했다 — 플레이키 회피가 설계·코드·EVAL 근거 모두에서 일관됨.
- 검증 Phase 라는 스스로의 제약을 코드 무수정(git status 확인)으로 실증했다 — "검증이 검증 대상을 고치지 않는다"는 원칙이 문서 주장이 아니라 관측 가능한 사실로 뒷받침됨.
- `node p-bellows/test/run-all.js` 123/123 통과, 종료 코드 0, 프로세스 매달림 없음(실측 재확인). `deploy-bellows.ps1 -DryRun` 정상 종료(실측 재확인).
- CONTINUATION.md의 이탈점 기록이 Foreman 쪽(work/010)이 잘못된 키로 조용히 빈 칸을 그리는 실패 모드를 구체적으로 겨냥하고 있다 — 계약 문서 자체(Foreman 소유)는 건드리지 않으면서도 인수인계가 완결됨.
- Phase 1~4 acceptance 기준 전체(122개 무회귀 + Phase 4 신규 1개)가 삭제·완화 없이 순증분으로 유지됨을 git history(`output/ACCEPTANCE.md`)와 실행 결과로 교차 확인.
- 004 전체가 003 의 `deriveDesired()`/STOP.json 불변 조항과 `lib/observation.js`·`lib/scrape.js` 를 한 줄도 건드리지 않고 HTTP 계약면만 순수하게 얹었다.

## How to Run

```bash
# 전체 테스트(hermetic, Chrome/claude.ai 불필요)
node p-bellows/test/run-all.js

# 배포 드라이런
powershell -NoProfile -ExecutionPolicy Bypass -File ./deploy-bellows.ps1 -DryRun

# 실제로 감시자를 띄워 눈으로 확인하려면 (USER_GATE, Chrome 필요):
powershell -NoProfile -ExecutionPolicy Bypass -File ./run-bellows.ps1
# 별도 터미널에서:
#   curl http://127.0.0.1:3210/api/health
#   curl http://127.0.0.1:3210/api/status
# 🔒 지금 고장난 측정 상태에서는 /api/status 의 state 가 "crit" 이어야 정상이다.
```

⚠️ `npm` 사용 금지 — `node` 를 직접 호출할 것.
⚠️ `node watch-loop.js` 단독 실행 금지 — Chrome 이 `--remote-debugging-port=9222` 로 떠 있어야 한다.
⚠️ 이 NNN 이 끝나도 화면상 변화는 없다 — Foreman 클라이언트가 아직 미구현이며, 이는 정상 종료 상태다.
