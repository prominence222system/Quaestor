## Verdict
PASS

## Verdict Criteria (current work file only)
- PASS: 004-control-http-contract.md 의 모든 Phase(1~5)가 DONE 이고 테스트가 통과한다. forge 는 다음 work file 로 넘어간다.

## Redesign Needed
NO

## Current Phase Evaluation
- Phase: 5 (역경로·강건성 매트릭스 — 004의 마지막 계획 Phase)
- Feature: 응답 형식 매트릭스(I1~I5) 직접 단언 승격 · 역경로 매트릭스(경로 변형·미지 메서드·비정상 인증 헤더) · 복원력(R1~R5: 동시 요청·소켓 강제종료·비HTTP 바이트·uncaught/unhandled 0회·STOP.json 불변)
- Complete: yes
- Issues found: 없음

## Acceptance-Criteria Integrity Check (output/ACCEPTANCE.md 존재 — 실행함)
- "004 Phase 5" 절의 전 항목([SPEC]/[DERIVED])을 `output/TEST_RESULT.md` 의 대조표와 1:1 확인 — 응답 형식 매트릭스 7항목, 역경로 매트릭스 8항목, 복원력 7항목, 무회귀·경계 11항목, USER_GATE 2항목(사람 확인 전용 — 계약상 자동 대체 불가로 명시돼 있어 갭 아님) 전부 대응됨. 누락 없음.
- `p-bellows/test/control-server.test.js` 의 Phase 5 신규 코드(라인 900-1186)를 직접 읽고 대조 —
  - `response shape matrix` 테스트: 선언 배열(`cases`) + 공통 단언 함수 `assertCommonInvariants` 가 7개 상태 코드(200×2/401/404/405/500/501) 전부에 대해 `JSON.parse` 직접 성공(I1)·`ok` boolean 및 비2xx→`false`(I3)·토큰/`.profile`/cookie/스택트레이스/절대경로 부재(I4)·직후 `/api/health` 200(I5)·헤더(I2)를 그 자리에서 단언 — Phase 4 eval 이 남긴 "간접 논증" 지적을 정확히 해소.
  - `adversarial paths`/`dot-segment`/`HEAD`/`~8KB path`/`duplicate Authorization`/`multi-KB Bearer`/`body-on-GET`/`text-xml-on-stop` — 각 역경로 [SPEC] 항목마다 전용 테스트 1개씩 존재, 기대 코드·생존·부작용 없음을 개별 단언.
  - `resilience R1-R5` — `net.connect` 원시 소켓으로 R2(강제 종료)·R3(비HTTP 바이트)를, `process.on('uncaughtException'/'unhandledRejection')` 리스너로 R4 를, `Promise.all(25건)` 로 R1 을, 임시 STOP 파일 mtime 불변으로 R5 를 각각 실측 — 문서(TEST_RESULT.md)와 코드가 정확히 일치.
- 무회귀·경계 — `git show --stat d931507`(Phase 5 implement 커밋)를 직접 확인: `test/control-server.test.js` 348줄 추가뿐, `lib/*`·`watch-loop.js` 변경 0. `git status --short` 로 워킹트리도 `.p-forge/` 외 dirty 없음 확인(§11-2 자기 구속 실증).
- `node p-bellows/test/run-all.js` **직접 재실행**: **133/133 통과, 종료 코드 0**, fail/cancelled 0, TEST_RESULT.md 수치와 일치.
- 이전 iteration(Phase 1~4 ACCEPTANCE) 대비 [SPEC] 삭제·완화 없음 — ACCEPTANCE.md 전체를 통독해 Phase 1~5 절이 순증분으로만 이어짐을 확인, "## Superseded" 필요한 이탈 없음.

## Work Detail
- Files created/modified: `p-bellows/test/control-server.test.js` (+348줄, 순증분 테스트 10개 → 총 133개)
- `lib/control-server.js` · `lib/config.js` · `lib/observation.js` · `lib/scrape.js` · `watch-loop.js` — 이 Phase 에서 **무수정**(검증 Phase 자기 구속, git 실증)
- 004 전체 요약: Phase 1(코어 라우팅/health/status) → Phase 2(인증+config.js control 블록) → Phase 3(watch-loop.js never-brick 배선) → Phase 4(계약 기본 주소 3210 실바인딩 종단 검증 + 계약 대조표 인수인계) → Phase 5(역경로·복원력 검증) 로 5개 Phase 모두 DONE.

## Issues
없음. Phase 5 로 004 의 계획된 마지막 검증 공백(간접 논증 승격, 비정상 요청 앞 생존)이 모두 메워졌다.

## Good Points
- Phase 5 는 검증 전용이라는 자기 구속을 실제로 지켰다 — implement 1회 실행 만에 133/133 통과, `lib/*` 무수정을 git 으로 실증.
- I1(JSON 파싱 가능) 근거를 "다른 테스트가 우연히 커버"에서 "그 자리에서 직접 단언"으로 정확히 승격 — Phase 4 eval 의 유일한 지적을 해소.
- `node:net` 원시 소켓으로 `fetch` 로는 낼 수 없는 연결 강제종료·비HTTP 바이트 시나리오까지 실증하고, 프로세스 레벨 `uncaughtException`/`unhandledRejection` 을 직접 관측했다 — "계기판이 차단기를 죽이지 않는다"는 조항의 마지막 미검증 면을 채움.
- 계약 기본 포트(3210)를 Phase 5 프로브가 전혀 쓰지 않아(전부 `port: 0`) Phase 4 의 조립 경로 검증과 자원 경합이 없다 — 설계에서 예고한 격리가 실제로 지켜짐.
- 라우팅 관대화(후행 슬래시·`HEAD` 지원 등)를 추가하지 않겠다는 자기 구속을 지켜 계약면을 넓히지 않았다.
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
# /api/health 는 별개로 ok:true 여야 한다 — 둘은 다른 질문에 답한다.
```

⚠️ `npm` 사용 금지 — `node` 를 직접 호출할 것.
⚠️ `node watch-loop.js` 단독 실행 금지 — Chrome 이 `--remote-debugging-port=9222` 로 떠 있어야 한다.
⚠️ Foreman 쪽 클라이언트(products\Foreman\work\010)는 아직 미구현이므로, 감시자를 띄워도 Foreman 화면상 변화는 없다 — 정상이다.


===========================================
NNN: 005-restore-observation-on-boot
Started: 2026-08-23T07:01:13Z
===========================================
