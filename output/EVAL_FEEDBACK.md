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
- Phase: 2
- Feature: `lib/control-server.js` 에 `PUT /api/thresholds` 배선 (토큰 게이트 · 본문 파싱 · `readConfig()` 기준선 · 원자적 파일 쓰기 · `[thresholds]` 기록 · `onConfigChange` 즉시 반영 · `contracts` 1.3.0)
- Complete: yes
- Issues found: 없음

## Acceptance-criteria integrity check
`output/ACCEPTANCE.md` Phase 2 섹션의 모든 [SPEC]/[DERIVED] 항목이 `output/TEST_RESULT.md` 표에
근거 테스트와 함께 1:1 매핑돼 있고, 코드 직독으로 실제 구현을 재확인함:

- 라우팅(존재/405/getSnapshot 미호출) — 커버, `control-server.js:394` 이하 확인
- 토큰 게이트(403 write-requires-token / 같은 상태 GET 200 / 401 이 403 보다 항상 먼저 / 올바른 Bearer 통과) — 커버,
  `handlePutThresholds` 진입 직후 403(`:271`), 전역 `isAuthorized` 가 라우팅보다 먼저(`:369`)
- 무르기+만료 HTTP 왕복(누락→400/미래→200/과거→400/조이기→200/거부시 파일 불변) — 커버
- 검증 위임(히스테리시스·미지키·`validateThresholdRequest` 위임·시계 1회 주입·invalid-json·413) — 커버
- 기준선=`readConfig().thresholds`(파일 원문 아님), `isExpired` 재구현 없음 — 커버, `:305`
- 파일 쓰기(원자적·`enabled`/`control.*` 보존·부분요청 나머지 불변·파일없음→{}·파싱불가→500·BOM·쓰기실패→500) — 커버
- never-brick(쓰기 실패가 폴 루프에 전파 안 함·`startControlServer` 미거부·콜백 예외에도 200) — 커버
- 기록(`[thresholds]` 정확히 한 줄·ISO 타임스탬프에도 parseLogTail 오인 없음·기존 로그 형식 불변·거부 시 로그 없음) — 커버
- 즉시 반영(`onConfigChange`→`refreshConfig`, 옵션 선택적, configPath 없으면 500) — 커버
- 계약 버전(1.3.0, package.json 불변, `/api/health` getSnapshot 미호출) — 커버
- 회귀 없음(status 응답 형태·읽기전용 페이지·501·deriveDesired 무관·토큰 비교 규율·claude 미등장·신규 의존성 없음) — 커버

이전 iteration(Phase 1 PASS)과 비교해 삭제·완화된 [SPEC] 항목 없음.

## Work Detail
- Files created/modified (Phase 2):
  - `p-quaestor/lib/control-server.js` — `PUT /api/thresholds` 라우트, `handlePutThresholds`,
    `readRawConfigFile`, `writeConfigAtomic`, `collectBody`(413 소켓 파괴 버그 수정 포함),
    `CONTRACTS` → `1.3.0`, `startControlServer` 옵션에 `configPath`/`onConfigChange` 추가
  - `p-quaestor/watch-loop.js` — `refreshConfig()` 추출(기존 3줄+로그 2줄 동일 이동),
    `startControlServer` 호출에 `configPath`/`onConfigChange` 배선
  - `p-quaestor/test/control-server.test.js` — `PUT /api/thresholds` 전용 신규 테스트 다수 추가
  - `p-quaestor/lib/thresholds.js`·`config.js`·`observation.js`·`status-page.js`·`logparse.js`:
    🔒 미수정 확인(git diff --stat)
- Key changes summary: Phase 1 의 순수 판정 모듈을 HTTP/파일/로그/스냅샷에 배선. 판정 로직 재구현 없이
  전부 `validateThresholdRequest`/`mergeIntoConfig`/`formatThresholdLog` 에 위임.

## Issues
없음.

## Good Points
- 설계(D1~D12) 그대로 구현 — 특히 D2(기준선=`readConfig` 결과)와 D3(병합 대상=파일 원문)의 구분을
  `appliedNow` vs `rawFile` 두 변수로 코드에서 명확히 분리.
- QA 과정에서 `collectBody()` 의 실제 버그(413 응답이 `req.destroy()` 로 인한 소켓 파괴로 클라이언트에
  도달 못하던 문제)를 발견해 최소 수정으로 고치고, TEST_RESULT.md 에 원인·근거를 명시함.
- `node p-quaestor/test/run-all.js` 를 직접 실행해 재현: 344개 중 343 PASS. 유일한 실패
  (`omitting opts.port uses DEFAULT_PORT (3210)`)는 `netstat` 로 포트 3210 을 점유 중인 기존 프로세스
  (PID 6944)와의 환경 충돌임을 확인 — Phase 2 변경과 무관, 회귀 아님.
- never-brick, 401/403 순서, 히스테리시스 불변식 등 🔒 표시된 핵심 조항이 코드와 테스트 양쪽에
  일관되게 반영됨.

## Test result unrelated failure
`control-server.test.js:91` 포트 3210 점유 실패는 개발 머신에서 실행 중인 별도 프로세스(PID 6944)와의
충돌이며 Phase 2 변경과 무관(`git diff --stat` 상 해당 테스트 미변경). Phase 3 통합 검증에서 재확인 필요.
