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


===========================================
NNN: 012-threshold-write-api
Started: 2026-09-03T03:51:38Z
===========================================

# TEST_RESULT — Phase 1: `lib/thresholds.js` 순수 모듈

## 대상
Phase 1 — 방향 판정(tighten/loosen) · 검증(미지 키·범위·히스테리시스·만료) · 설정 병합 · 로그 줄 생성

## 실행
```
node p-quaestor/test/run-all.js
```
결과: **301개 중 300 PASS, 1 FAIL(Phase 1 범위 밖 — 하단 참고)**

`p-quaestor/test/thresholds.test.js` 34개 테스트 전부 PASS.

## Acceptance 기준별 결과 (output/ACCEPTANCE.md Phase 1)

### 순수성·모듈 형태
| 기준 | 결과 |
|---|---|
| `THRESHOLD_KEYS`/`ALLOWED_KEYS`/`validateThresholdRequest`/`mergeIntoConfig`/`formatThresholdLog` export | PASS |
| `fs`/`http`/`net` require 없음, `Date.now()` 미호출 (`nowMs` 주입) | PASS |
| `claude` 문자열 미등장 | PASS |

### 방향 판정
| 기준 | 결과 |
|---|---|
| 둘 다 안 커지면 tighten | PASS |
| 어느 한쪽이라도 커지면 loosen | PASS |
| `{99,70,99,75}` + `{85,90}` → tighten, ok | PASS |
| 완전 동일 요청 → tighten | PASS |
| release 만 변경 → tighten | PASS |

### 무르기 만료 규칙
| 기준 | 결과 |
|---|---|
| 무르기 + expires_at 없음 → 400 loosen-requires-expiry | PASS |
| 무르기 + 미래 expires_at → ok, direction loosen, expiresAt 일치 | PASS |
| 무르기 + 과거 expires_at → 400 expiry-in-past | PASS |
| expires_at 파싱 불가 → 400 invalid-expiry | PASS |
| expires_at 생략 + 기존 값 미래 → 허용, 기존값 반환 | PASS |
| expires_at 생략 + 기존 null/과거 → loosen-requires-expiry | PASS |
| expires_at:null + 두 stop 모두 HARD_DEFAULTS 이하 → 허용 | PASS |
| expires_at:null + stop 초과 → loosen-requires-expiry | PASS |
| 거부 메시지에 "하드 기본값/임시 파일" 문구 포함 | PASS |

### 히스테리시스
| 기준 | 결과 |
|---|---|
| weekly_stop ≤ weekly_release → 400 hysteresis-violation | PASS |
| session_stop ≤ session_release → 400 | PASS |
| release 미포함 요청도 병합 결과로 판정 (`weekly_stop:60` vs 적용 release 70) | PASS |
| stop === release 도 위반 | PASS |

### 값·키 검증
| 기준 | 결과 |
|---|---|
| 비정수(85.5), 비숫자("85"/null/true) → invalid-value | PASS |
| 범위 밖(<0, >100) → invalid-value | PASS |
| ALLOWED_KEYS 밖 키 → unknown-key | PASS |
| `enabled`/`control` 포함 → unknown-key | PASS |
| null/배열/비객체 본문 → invalid-body | PASS |
| 빈 객체 `{}` → invalid-body | PASS |

### 부분 요청
| 기준 | 결과 |
|---|---|
| 부분 요청 시 나머지 3개 `next` 에서 불변 | PASS |
| `previous`/`next` 4개 전부 반환 | PASS |

### 병합
| 기준 | 결과 |
|---|---|
| `enabled`/`control.*`/기타 키 보존 | PASS |
| `thresholds` 는 `next` 와 정확히 일치 | PASS |
| `expires_at` 인자값과 일치 | PASS |
| `rawConfig` 원본 미변형 | PASS |
| `thresholds` 없거나 비객체여도 `next` 온전 반영 | PASS |

### 로그 줄
| 기준 | 결과 |
|---|---|
| `[thresholds] ` 접두어 + direction + `key from->to` + `expires_at=<iso|none>` | PASS |
| 생성 줄 + ISO 타임스탬프 → `parseLogTail` 이 `null` 반환 | PASS |
| `session=`/`weekly=`/`%` 미등장 | PASS |
| 미변경 축은 로그에서 생략 | PASS |

### 회귀
| 기준 | 결과 |
|---|---|
| `config.js`/`observation.js`/`control-server.js`/`logparse.js`/`watch-loop.js` Phase 1 에서 미수정 | PASS — `git show --stat 8c29bc6` 확인: 구현 커밋은 `lib/thresholds.js`, `test/thresholds.test.js` 두 파일만 추가 |
| `run-all.js` 기존 전체 테스트(005 의 26일 fixture 포함) 무손상 | PASS — 26일 fixture 테스트 통과 확인 |

## 수정한 버그
없음 — 구현이 이전 iteration 에서 이미 완료돼 있었고 모든 Phase 1 기준을 통과했다.

## 이전 Phase 통합 검증
`node p-quaestor/test/run-all.js` 전체 실행 결과 301개 중 300 PASS.

**1건 FAIL — Phase 1 범위 밖, 환경 충돌:**
```
control-server.test.js:91 "omitting opts.port uses DEFAULT_PORT (3210)"
  Expected started:true, got started:false
```
원인: 이 개발 머신에 `node.exe`(PID 6944)가 이미 포트 3210 을 점유 중 — 실제로 동작 중인
Quaestor watch-loop 인스턴스로 추정된다(`netstat` 확인). 실사용량 감시자일 수 있으므로
QA 목적으로 종료하지 않았다. 이 테스트는 `control-server.js`(Phase 2/3 영역) 소관이며
`lib/thresholds.js` 와 무관하고, `git status` 상 `p-quaestor/` 에 미커밋 변경 없음 —
Phase 1 작업이 유발한 회귀가 아니다.

## 결론

**Phase 1 PASS.** `output/ACCEPTANCE.md` 의 모든 [SPEC]/[DERIVED] 기준을 충족한다.
