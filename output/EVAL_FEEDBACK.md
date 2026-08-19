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
- Phase: 3 (마지막 Phase — 004 전체 완료)
- Feature: `watch-loop.js` 컨트롤 서버 배선(never-brick) + `test/control-server.test.js`·
  `test/watch-loop.test.js` 실포트 통합 검증
- Complete: yes
- Issues found: 없음

## Acceptance-Criteria Integrity Check (output/ACCEPTANCE.md 존재 — 실행함)
- `output/ACCEPTANCE.md` 의 "004 Phase 3" 절 전 항목([SPEC]/[DERIVED])을 `output/TEST_RESULT.md`
  의 "Phase 3 Acceptance 기준별 결과" 표와 1:1 대조 — never-brick 6항목, 모듈 로드 경계 4항목,
  라이브 관측 4항목, `getSnapshot()` 부작용 없음(C3) 3항목, `ctx` 전달 5항목, env 우선순위 자동화
  3항목, 불변·무회귀 10항목, USER_GATE 2항목(사람 확인 전용 — 계약상 자동 대체 불가로 명시돼
  있어 갭 아님) 전부 대응 확인. 누락 없음.
- `p-bellows/watch-loop.js`(L176-215) 직접 대조 — `controlSnapshot()` 이 라이브 클로저로 모듈
  변수만 읽고(C3), `startControlServer()` 호출이 `mainLoop()` 본문에만 있으며(C1), 결과 분기 +
  `try/catch` 이중 방어 뒤 `while(true)` 무조건 진입(C2). 설계(§9)와 일치.
- 이전 iteration(Phase 1·2 ACCEPTANCE) 대비 [SPEC] 삭제·완화 없음 — 두 섹션 무변경으로 그대로
  존재.
- Synology `PROJECT_INTENT.md` 를 직접 열람해 `POST /api/stop` 영구 미구현 결정 기록(§"결정 —
  POST /api/stop 은 영구히 구현하지 않는다")이 실재함을 재확인.
- `node p-bellows/test/run-all.js` **직접 재실행**: **122/122 통과, 종료 코드 0**
  (Phase 1·2 누적 110 + Phase 3 신규 12). TEST_RESULT.md 의 수치와 일치.

## Work Detail
- 리뷰 대상: `p-bellows/watch-loop.js`(배선 — `mainLoop()` 진입부 컨트롤 서버 기동 +
  `lastCfg`/`lastStop`/`lastConfigSource` 모듈 변수 + `controlSnapshot()`),
  `p-bellows/lib/control-server.js`(Phase 1·2 완성, 이번 Phase 무수정),
  `p-bellows/lib/config.js`(Phase 2 완성, 이번 Phase 무수정),
  `p-bellows/test/control-server.test.js`·`p-bellows/test/watch-loop.test.js`(각 증분)
- `node p-bellows/test/run-all.js` 재실행 결과 122/122 pass, exit 0 — TEST_RESULT.md 의 로그와
  일치. 이번 라운드 코드 수정 없음(구현이 이미 계약을 만족한 상태로 발견) — 소스 대조로 확인.

## Issues
없음.

## Good Points
- never-brick 이 구조 검증(호출부 위치)과 행동 검증(점유 포트 시뮬레이션 후 후속 코드 실행 확인)
  양쪽으로 이중 고정 — Phase 3 의 유일한 위험("계기판이 차단기를 죽인다")을 정확히 겨냥해 막음.
- `controlSnapshot()` 이 값이 아니라 함수로 주입되어 매 요청마다 최신 `observation` 을 반영함을
  실포트 통합 테스트(재대입 → 다음 응답 반영)로 직접 증명 — "3주 침묵을 초록불로" 재현 위험을
  코드뿐 아니라 테스트로도 막음.
- `pollOnce()` 를 테스트에서 구동하지 않는 003 의 원칙을 Phase 3 도 그대로 지키면서, 배선의 동일
  형태를 테스트 안에서 재구성해 실제 STOP.json/bellows.log 오염 없이 검증.
- Phase 2 가 남긴 유일한 자동화 공백(env 우선순위 수동 검증)이 이번 Phase 3 에서 자동 테스트로
  스스로 메워짐.
- 004 전체가 003 의 `deriveDesired()`/STOP.json 불변 조항을 한 줄도 건드리지 않고 HTTP 계약면만
  순수하게 얹음 — `lib/observation.js`·`lib/scrape.js` 가 Phase 1 이후 전혀 무수정.

## How to Run

이 Phase 로 `watch-loop.js` 배선이 완료되어, 감시자를 실제로 띄우면 `/api/health`·`/api/status`
가 동작한다(다만 화면상 변화는 없다 — Foreman 클라이언트가 아직 미구현이라 이 NNN 의 정상적인
종료 상태다).

```bash
# 전체 테스트(hermetic, Chrome/claude.ai 불필요)
node p-bellows/test/run-all.js

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
