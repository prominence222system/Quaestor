# TEST_RESULT — 011 Phase 1 (`/api/health` 에 구현 중인 계약 버전 노출)

- **대상 모듈**: `p-quaestor/lib/control-server.js` (`CONTRACTS` 상수 선언 및 maintenance 주석 추가, `handleHealth` 및 `module.exports` 수정)
- **테스트 파일**: `p-quaestor/test/control-server.test.js` (011 Phase 1 신규 테스트 추가 및 회귀 검증)
- **검증 방식**: Node.js test runner(`node:test`), 실포트 기반 `fetch()` 및 `JSON.parse` 통신 검증

---

## 요약

- `node p-quaestor/test/run-all.js` 실행 결과: **265 tests, 265 pass, 0 fail**, Exit Code 0.
- 이전 라운드(001~010) 기존 259개 테스트 100% 무회귀 통과.
- 011 Phase 1 신규 테스트 **6건** 추가, 전건 PASS.
- 구현 버그: 없음 — 상수를 `control-server.js` 내부에 선언하고 유지보수 주석을 명시하였으며, 기존 소프트웨어 버전 축(`version: "0.1.0"`)과 계약 버전 축(`contracts: { "supervised-v1": "1.2.0" }`)을 분리하여 완벽 적용.

---

## Acceptance Criteria 검증 결과

출처: `output/ACCEPTANCE.md` (Phase 1 Acceptance Criteria) 및 `work/011-health-contracts-field.md`.

| 구분 | 수용 기준 | 결과 | 근거 테스트 |
|---|---|---|---|
| [SPEC] | 실제 포트를 열고 `fetch`로 `GET /api/health` 호출 후 `JSON.parse` 한 결과, 200 상태 코드와 최상위 `contracts` 객체가 있고 `contracts["supervised-v1"] === "1.2.0"` 이어야 한다. | PASS | `[SPEC] GET /api/health over real port returns top-level contracts object with contracts["supervised-v1"] === "1.2.0"` |
| [SPEC] | `contracts` 값은 숫자나 객체가 아닌 문자열이어야 한다. | PASS | `[SPEC] contracts field values are string types, not numbers or objects` |
| [SPEC] | 기존 응답 필드 `ok`, `id`, `version`, `startedAt` 이 그대로 존재하고 값이 011 이전과 동일해야 한다 (`id === "quaestor"`, `version === "0.1.0"`). | PASS | `[SPEC] existing GET /api/health fields (ok, id, version, startedAt) remain present and unchanged` |
| [SPEC] | 소프트웨어 버전 `version` 의 값과 계약 버전 `contracts["supervised-v1"]` 의 값이 서로 달라야 한다 (0.1.0 vs 1.2.0). | PASS | `[SPEC] software version (0.1.0) and contract version (1.2.0) are distinct axes and have different values` |
| [SPEC] | `/api/status` 응답이 011 작업 전과 완전히 동일해야 한다 (회귀 없음). | PASS | `[SPEC] GET /api/status response remains completely unchanged (no regression from 011)` |
| [SPEC] | 응답에 토큰, 프로필 경로, 쿠키, 계정 등 비밀 정보가 없어야 한다. | PASS | `[SPEC] GET /api/health response contains no secret tokens, profile paths, cookies, or account info` |
| [SPEC] | 객체를 직접 들여다보지 않고 반드시 실포트 통신(직렬화/역직렬화)을 통해 응답 형태를 검증해야 한다. | PASS | 위 모든 011 신규 테스트가 `startControlServer` 실포트 + `fetch()` 로 실측 |

---

## 전체 테스트 결과

```
node p-quaestor/test/run-all.js
...
ℹ tests 265
ℹ suites 0
ℹ pass 265
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

- 011 Phase 1 신규: 6건 (전건 PASS)
- 기존 테스트: 259건 (전건 PASS, 무회귀)

---

## How to Run

```bash
# 전체 단위·통합 테스트 실행 (npm 사용 금지 — node 직접 호출)
node p-quaestor/test/run-all.js
```

`/api/health` 헬스체크 응답을 직접 확인하려면:
```bash
# watch-loop 실행 후
curl http://127.0.0.1:3210/api/health
# 응답 예시: {"ok":true,"id":"quaestor","version":"0.1.0","contracts":{"supervised-v1":"1.2.0"},"startedAt":"..."}
```
