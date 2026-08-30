# TEST_RESULT — 010 Phase 2 (`GET /` 사용량 상태 웹 페이지 라우트)

- **대상 모듈**: `p-quaestor/lib/control-server.js` (`buildStatusPayload` 추출 + `GET /` 라우트), `p-quaestor/lib/status-page.js` (Phase 1, 무변경 소비)
- **테스트 파일**: `p-quaestor/test/control-server.test.js` (신규 010 Phase 2 섹션 추가), `p-quaestor/test/status-page.test.js` (Phase 1, 회귀 확인만), `p-quaestor/test/run-all.js`
- **검증 방식**: Node.js test runner(`node:test`), 실제 포트를 열고 `fetch()`/`http.request()` 로 실측 HTML·JSON 왕복

---

## 요약

- `node p-quaestor/test/run-all.js` 실행 결과: **259 tests, 259 pass, 0 fail**, Exit Code 0.
- Phase 1(001~009 및 010 Phase 1) 기존 245개 테스트 100% 무회귀 통과.
- Phase 2 신규 테스트 **14건** 추가, 전건 PASS.
- 구현 버그: 없음 — 설계(`output/DESIGN.md` 2.2)대로 `buildStatusPayload(ctx)` 를 추출해
  `handleStatus`/`handleIndex` 가 공유하도록 구현한 첫 시도가 전 테스트를 통과함.

---

## Acceptance Criteria 검증 결과 (Phase 2)

출처: `output/ACCEPTANCE.md` "Phase 1 범위 밖 (Phase 2 에서 검증)" 절 + `work/010-status-web-page.md` Acceptance(hermetic) 절.

| 구분 | 수용 기준 | 결과 | 근거 테스트 |
|---|---|---|---|
| [SPEC] | 실제 포트를 열고 `GET /` → 200 + `Content-Type: text/html; charset=utf-8` | PASS | `[SPEC] GET / -- real port round trip returns 200 and Content-Type text/html; charset=utf-8` |
| [SPEC] 🔒 | `allowed: null` 스냅샷 실측 HTML 에 "사용 가능" 류 긍정 문구 없음 + "모름" 표시 있음 + 초록 클래스(`st-allowed`) 없음 | PASS | `[SPEC] GET / with an allowed:null snapshot -- ...` |
| [SPEC] | `stale: true`(26일 경과) 스냅샷 실측 HTML 에 경과 시간(`일 전`) 노출 + `st-stale` 클래스, 신선한 스냅샷과 다른 표시 | PASS | `[SPEC] GET / with a 26-day-old measurement -- ...` |
| [SPEC] | `session_pct: null` 스냅샷 실측 HTML 에 `0%` 없음(경계 정규식으로 `70%` 등 오탐 배제), "측정 없음" 노출 | PASS | `[SPEC] GET / with a session_pct:null snapshot -- ...` |
| [SPEC] | HTML 전체에 `http://`/`https://` 외부 리소스 참조(`src=`/`href=`/`@import`/`fetch(`) 0건, 네트워크 대상은 `/api/status` 뿐 | PASS | `[SPEC] GET / -- fetched HTML has zero http(s):// resource references; ...` |
| [SPEC] | `/api/health`·`/api/status` 응답이 010 이전과 완전히 동일(회귀 없음) | PASS | `[SPEC] regression: GET /api/health and GET /api/status are byte-identical to their pre-010 shape ...` + 기존 Phase 2/008 회귀 테스트 전건 |
| [SPEC] | `GET /api/does-not-exist` 는 여전히 JSON 404(HTML 로 바뀌지 않음) | PASS | `[SPEC] GET /api/does-not-exist still returns JSON 404, not HTML, ...` |
| [SPEC] 🔒 | 경로 조립 없음 — `GET /../../etc/hosts` 류가 파일을 노출하지 않고 JSON 404 | PASS | `[SPEC] no path assembly -- GET /../../etc/hosts never exposes a file; ...` |
| [SPEC] | (부가) 점-세그먼트가 `/api/status` 로 정규화되는 경로도 파일시스템이 아닌 API 라우트로만 매칭 | PASS | `[SPEC] no path assembly -- a dot-segment path resolving onto /api/status ...` |
| [SPEC] | 토큰이 설정된 상태에서 `GET /` 는 401(화면만 여는 예외 없음) | PASS | `[SPEC] auth: token set -- GET / is 401, same as the API ...` |
| [SPEC] | 페이지 HTML 에 비밀(토큰·`.profile`·쿠키)이 없음 | PASS | `[SPEC] no secrets anywhere: GET / HTML never contains the auth token, .profile, or cookie` |
| [SPEC] 🔒 | 경계 검증: 실제 포트를 열고 `fetch('/')` 로 받은 실제 HTML 문자열을 검사(템플릿 함수 반환값만 보지 않음) | PASS | 위 모든 010 신규 테스트가 `startControlServer` 실포트 + `fetch()`/`http.request()` 로 실측 |
| [DERIVED] | `GET /` 와 `GET /api/status` 가 동일한 판정 지점(`buildStatusPayload`)을 공유 | PASS | `control-server.js source: GET / and GET /api/status both call buildStatusPayload -- a single judgement point` |
| [DERIVED] | 읽기 전용 — `POST /` 는 405 | PASS | `POST / -> 405 ok:false (read-only page, no write route)` |
| [DERIVED] 🔒 | never-brick — `getSnapshot` 실패 시에도 `GET /` 가 JSON 500 으로 안전 종료, `/api/health` 계속 응답 | PASS | `never-brick: GET / falls back to JSON 500 ... and the watch loop surface stays alive` |

Phase 1(렌더러 순수성·이스케이프·null 처리 등)의 세부 [SPEC]/[DERIVED] 항목은 `output/ACCEPTANCE.md` Phase 1 절 소관이며,
010 Phase 1 라운드에서 이미 전건 PASS 로 고정돼 있고 이번 실행에서도 무회귀로 재확인됨(아래 "전체 테스트 결과" 참조).

---

## 전체 테스트 결과

```
node p-quaestor/test/run-all.js
...
ℹ tests 259
ℹ suites 0
ℹ pass 259
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

- 010 Phase 2 신규: 14건 (전건 PASS)
- 그 외 245건(001~009, 010 Phase 1 포함): 전건 PASS, 무회귀

---

## 구현 버그 수정 내역

없음. `output/DESIGN.md` §2.2·§4(D1, D2, D10)의 설계를 그대로 구현:

- `buildStatusPayload(ctx)` 를 `handleStatus` 본문에서 추출 — `handleStatus`(JSON)와 `handleIndex`(HTML)가
  동일 객체에서 출발하므로 화면·API 불일치가 구조적으로 불가능.
- `handleStatus` 가 반환하는 JSON 의 키 순서·값은 추출 전과 완전히 동일(`{ ok, allowance, usage, summary, state, fields, updatedAt }`).
- `pathname === '/'` 정확 일치 라우트만 추가 — 파일 경로 조립 코드 없음(D1). `..` 방어 로직 자체가 불필요함을
  실측(`/../../etc/hosts`, `/../api/status`)으로 확인.
- 인증 게이트는 라우팅보다 먼저 실행되는 기존 순서를 그대로 유지(D2) — `GET /` 도 토큰 미충족 시 401.
- `handleIndex` 실패 시 HTML 형식을 지어내지 않고 JSON 500 으로 떨어짐(D10) — never-brick 유지.

---

## 이전 Phase 연동 검증 결과

- **Phase 1(`lib/status-page.js`) 호환성**: `renderStatusPage` 시그니처·순수성·null "측정 없음" 처리·이스케이프·
  인라인 CSS/JS 등 74개 단위 테스트 전건 무회귀 통과. Phase 2 는 이 렌더러를 오직 소비만 하며 한 줄도 수정하지 않음.
- **001~009 호환성**: `deriveState`/`deriveUsage`/`deriveAllowance`(007·008), 인증 게이트·비밀 비노출(Phase 2 of 004),
  005 의 26일 fixture 로그 복원, 006/009 의 개명 등 기존 계약 전건 무회귀.
- **`/api/health`·`/api/status` 바이트 동일성**: 신규 회귀 테스트로 키 셋·값·헤더(`Content-Type`, `Cache-Control`)가
  010 이전과 동일함을 별도로 고정.

---

## How to Run

```bash
# 전체 단위·통합 테스트 (npm 금지 — node 직접 호출)
node p-quaestor/test/run-all.js
```

서버를 직접 띄워 브라우저로 확인하려면 `watch-loop.js` 를 실행해 컨트롤 서버가 뜬 뒤(기본 포트 3210),
`http://127.0.0.1:3210/` 을 연다. 측정이 아직 없거나 낡았다면 배지가 **"모름"** 으로,
`stale` 이면 경과 시간과 함께 낡음 표시가 붙어야 한다(초록·"사용 가능" 이 보이면 회귀).


===========================================
NNN: 011-health-contracts-field
Started: 2026-08-30T07:10:39Z
===========================================
