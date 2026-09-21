## Verdict
PASS

## Verdict Criteria (current work file only)
- 012-threshold-write-api.md 의 Phase 1·2·3 이 output/PROGRESS.md 상 전부 DONE
- 독립 재실행 `node p-quaestor/test/run-all.js` 결과 **357 tests / 357 pass / 0 fail, exitCode 0**
  (`output/SMOKE_RESULT.md` 는 fix 커밋 575e265 이전(13:52:53)에 생성된 stale 산출물이며,
  현재 코드(575e265 이후)에는 포트 3210 probe 분기 수정이 반영돼 있음을 소스로 직접 확인)
- output/ACCEPTANCE.md Phase 1·2·3 의 전 [SPEC]/[DERIVED] 항목이 output/TEST_RESULT.md §3.5
  커버리지 매핑 표에 근거 테스트와 1:1 연결됨을 확인
- `lib/thresholds.js`·`lib/control-server.js` 의 PUT 핸들러를 직접 읽어 DESIGN.md 의 검증 순서(D5)·
  기준선 규칙(D2)·병합 대상(D3)·2단계 우회 차단(D7)이 코드에 그대로 구현돼 있음을 재확인

## Redesign Needed
NO

## Current Phase Evaluation
- Phase: 3 (마지막 Phase, 검증 전용)
- Feature: 실포트 왕복 통합 테스트 · 회귀 검증 · 커버리지/red-first 증적
- Complete: yes
- Issues found: 없음 (output/SMOKE_RESULT.md 의 1-fail 표기는 fix 커밋 직전 시점의 stale 스냅샷이며,
  이번 eval 의 독립 재실행으로 357/357/0, exitCode 0 을 재확인함)

## Work Detail
- Files created/modified (012 전체): `p-quaestor/lib/thresholds.js`(신규, 순수 검증/병합/로그 모듈),
  `p-quaestor/lib/control-server.js`(`PUT /api/thresholds` 라우트·403 토큰 게이트·원자적 파일 쓰기·
  `[thresholds]` 기록·`CONTRACTS` 1.3.0), `p-quaestor/watch-loop.js`(`refreshConfig` 추출·
  `onConfigChange` 배선), `p-quaestor/test/thresholds.test.js`(36건), `p-quaestor/test/control-server.test.js`
  (51건 신규 + 포트 3210 probe 안정화), `p-quaestor/test/thresholds-integration.test.js`(S1~S7),
  `p-quaestor/test/watch-loop.test.js`(W1~W4)
- Key changes summary: `PUT /api/thresholds` 가 방향(tighten/loosen) 판정, 히스테리시스 검증,
  무르기의 `expires_at` 강제(만료 없는 무르기 400 `loosen-requires-expiry`), 2단계 우회 차단
  (미래 만료 무르기 뒤 `expires_at:null` 만 보내는 요청도 거부), 토큰 기반 쓰기 게이트(403),
  원자적 파일 쓰기(`enabled`/`control.*` 보존), `[thresholds]` 로그 기록, `onConfigChange` 를 통한
  즉시 반영을 전부 구현. 계약 버전이 `1.2.0` -> `1.3.0` 으로 상승.

## Issues
- 없음. `output/SMOKE_RESULT.md` 가 fix 커밋(575e265, 13:54:51) 이전(13:52:53)에 생성된 산출물이라
  1-fail 로 남아 있으나, 현재 소스에는 이미 포트 3210 probe 분기 수정이 있고 독립 재실행에서
  357/357/0·exitCode 0 을 확인했으므로 실질적 결함이 아니다. 이 evaluator 는 매 라운드
  독립적으로 `node p-quaestor/test/run-all.js` 를 재실행해 산출물 문서의 수치를 그대로 신뢰하지
  않고 검증하는 것이 중요함을 기록해 둔다.

## Good Points
- 순수 판정 로직(`lib/thresholds.js`)을 HTTP/파일/시계와 완전히 분리해 Phase 1 에서 전 케이스를
  포트 없이 고정
- 무르기 안전선("expires_at 없이는 거부")을 2단계 우회(S3), 실제 시간 경과(S4), 5월 사건 재현(S5)
  까지 시나리오로 실증 — `validateThresholdRequest` 의 `expires_at: null` 처리가 `direction` 이 아닌
  `next` vs `HARD_DEFAULTS` 비교로 우회 경로를 구조적으로 닫음
- red-first 증적(R1/R2/R3)으로 세 안전선이 실제로 테스트에 물려 있음을 일시 무력화 → FAIL 재현 →
  복원으로 증명
- never-brick 규율(S7)로 쓰기 실패가 감시 루프·계기판에 전파되지 않음을 확인
- 005 의 26일 fixture, `deriveDesired()`, STOP.json 스키마, 상태 페이지 읽기 전용 등 불변식이
  전부 회귀 테스트로 지켜짐
- `output/TEST_RESULT.md` §3.5 커버리지 매핑, §3.6 red-first, §3.7 환경 이슈 해소 기록이 투명하게
  남아 있어 이 evaluator 가 독립 재현하기 쉬웠음

## How to Run

```bash
# 전체 단위·통합 테스트 (🔒 npm 금지 — node 직접 호출)
node p-quaestor/test/run-all.js
```

`PUT /api/thresholds` 를 직접 확인하려면 (watch-loop 실행 후, `.prominence\bellows-config.json`
에 `control.authToken` 설정 필요):

```bash
# 조이기 — 그대로 허용
curl -X PUT http://127.0.0.1:3210/api/thresholds \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"weekly_stop":85,"session_stop":90}'
# -> 200 {"ok":true,"direction":"tighten","applied":{...},"expires_at":null,"previous":{...}}

# 무르기 — expires_at 없으면 거부된다 (이것이 안전선이다)
curl -X PUT http://127.0.0.1:3210/api/thresholds \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"weekly_stop":99}'
# -> 400 {"ok":false,"reason":"loosen-requires-expiry",...}

# 무르기 + 미래 만료 — 허용되고, 그 시각이 지나면 저절로 하드 기본값(85/90)으로 돌아온다
curl -X PUT http://127.0.0.1:3210/api/thresholds \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"weekly_stop":99,"session_stop":99,"expires_at":"2026-09-09T00:00:00Z"}'

# 반영 확인
curl http://127.0.0.1:3210/api/status
curl http://127.0.0.1:3210/api/health   # contracts["supervised-v1"] === "1.3.0"
```


## Fix Loop Diagnosis
[fix-diag] attempts=2 identical=1/2 escalated=yes escalation-helped=yes


===========================================
NNN: 013-status-declares-engine-scope
Started: 2026-09-21T01:30:41Z
===========================================
