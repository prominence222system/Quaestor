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

---

# TEST_RESULT — Phase 2: `lib/control-server.js` 에 `PUT /api/thresholds` 배선

## 대상
Phase 2 — 토큰 게이트(403 `write-requires-token`) · 본문 파싱 · `readConfig()` 기준선 ·
원자적 파일 쓰기 · `[thresholds]` 기록 · `onConfigChange` 즉시 반영 · `contracts` `1.3.0`.

## 실행
```
node p-quaestor/test/run-all.js
```
결과: **344개 중 343 PASS, 1 FAIL(Phase 2 범위 밖 — 하단 참고, Phase 1 QA 때부터 있던 동일한 환경 충돌)**.

`p-quaestor/test/control-server.test.js` 에 `PUT /api/thresholds` 전용 신규 테스트 **51건** 추가, 전건 PASS.
(테스트 실행 전 확인 결과 기존 파일에는 라우팅 자체를 제외하면 이 엔드포인트에 대한 커버리지가 전혀 없었다 —
`contracts["supervised-v1"] === "1.3.0"` 검증만 011 에서 이미 갱신돼 있었다.)

## Acceptance 기준별 결과 (output/ACCEPTANCE.md Phase 2)

### 라우팅
| 기준 | 결과 | 근거 |
|---|---|---|
| `PUT /api/thresholds` 존재 (404 아님) | PASS | `[SPEC] PUT /api/thresholds exists -- not a 404` |
| `PUT` 외 메서드 → 405 | PASS | `[DERIVED] /api/thresholds with a non-PUT method -> 405` |
| `getSnapshot()` 미호출 | PASS | `[DERIVED] PUT /api/thresholds does not call getSnapshot()` |

### 토큰 게이트 — 기본 거부
| 기준 | 결과 | 근거 |
|---|---|---|
| 토큰 미설정 → 403 write-requires-token | PASS | `[SPEC] no authToken configured -> PUT ... 403 write-requires-token` |
| 같은 상태에서 GET /api/status 는 200 | PASS | `[SPEC] same (no-token) state -- GET /api/status is still 200` |
| 토큰 설정 + 잘못/없는 Bearer → 401 (403 보다 먼저) | PASS | `[SPEC] token configured + wrong/missing Bearer -> 401 ...` |
| 토큰 설정 + 올바른 Bearer → 검증 단계로 진행 | PASS | `[SPEC] token configured + correct Bearer -> proceeds ...` |

### 무르기는 만료 없이는 거부 — HTTP
| 기준 | 결과 | 근거 |
|---|---|---|
| 무르기 + expires_at 없음 → 400 loosen-requires-expiry (200 나오면 실패) | PASS | `[SPEC] loosen without expires_at -> 400 ...` (파일 미변경도 같이 검증) |
| 무르기 + 미래 expires_at → 200, direction loosen, 파일에 반영 | PASS | `[SPEC] loosen with a future expires_at -> 200 ...` |
| 무르기 + 과거 expires_at → 400 | PASS | `[SPEC] loosen with a past expires_at -> 400` |
| 조이기(99→85, 토큰 설정) → 200, direction tighten, 파일 반영 | PASS | `[SPEC] tighten (99->85, token set) -> 200 ...` |
| 거부 시 파일 한 바이트도 안 바뀜 | PASS | `[DERIVED] rejected (4xx) PUTs never modify the config file ...` |

### 검증 위임
| 기준 | 결과 | 근거 |
|---|---|---|
| 히스테리시스 위반 → 400 | PASS | `[SPEC] hysteresis violation over HTTP -> 400` |
| 미지 키 → 400 unknown-key | PASS | `[SPEC] unknown key over HTTP -> 400 unknown-key` |
| `enabled`/`control` 포함 → unknown-key | PASS | `[DERIVED] enabled/control in the body over HTTP -> 400 unknown-key` |
| 검증 로직 재구현 없이 `validateThresholdRequest()` 위임 | PASS | `[SPEC] control-server.js delegates validation to ./thresholds ...` (소스 정적 검사) |
| 현재 시각은 핸들러에서 한 번만 읽어 주입 | PASS | `[DERIVED] handlePutThresholds reads the wall clock exactly once ...` |
| JSON 파싱 불가 → 400 invalid-json | PASS | `[DERIVED] unparseable JSON body -> 400 invalid-json` |
| 상한(64KiB) 초과 → 413 body-too-large | PASS (버그 수정 후) | `[DERIVED] oversized body (>64KiB) -> 413 body-too-large` |

### 기준선은 readConfig() 의 결과
| 기준 | 결과 | 근거 |
|---|---|---|
| 방향 판정 기준선이 `readConfig(configPath).thresholds` (파일 원문 아님) | PASS | `[SPEC] baseline for direction/validation is readConfig(configPath).thresholds ...` — 만료된 `expires_at` 이 붙은 파일(원문 99/99)에서 `weekly_stop:90` 요청이 하드 기본값(85) 대비 loosen 으로 판정됨을 확인 |
| `lib/config.js` 의 `isExpired` 재구현 없음 | PASS | 코드 리뷰 — `readConfig` 그대로 호출, `config.js` 미수정(`git diff --stat` 확인) |

### 파일 쓰기 — 원자적, 키 보존
| 기준 | 결과 | 근거 |
|---|---|---|
| `enabled`/`control.*` 보존 | PASS | `[SPEC] enabled and control.* are preserved after a write` |
| 그 밖의 기존 키 보존 | PASS | `[SPEC] other pre-existing keys in the file are preserved after a write` |
| 부분 요청 시 나머지 3개 파일 값 불변 | PASS | `[SPEC] partial request (weekly_stop only) -- the other 3 threshold values are unchanged on disk` |
| tmp → rename 원자적 쓰기 | PASS | `[SPEC] write is tmp-file + rename -- no .tmp file left behind ...` |
| 파일 없으면 `{}` 에서 시작 | PASS | `[DERIVED] config file missing -- PUT still succeeds, creating the file from {}` |
| 파싱 불가 파일 → 500 config-unreadable, 미덮어씀 | PASS | `[DERIVED] config file exists but is unparseable JSON -- 500 config-unreadable ...` |
| UTF-8 BOM 파일 정상 처리 | PASS | `[DERIVED] a UTF-8 BOM in the existing config file is read and merged without error` |
| 쓰기 자체 실패 → 500 write-failed | PASS | `[DERIVED] write failure (parent directory does not exist) -> 500 write-failed` |

### never-brick
| 기준 | 결과 | 근거 |
|---|---|---|
| 쓰기 실패가 폴 루프에 예외 전파 안 함 / `startControlServer()` 미거부·미throw | PASS | `[SPEC] startControlServer() with configPath/onConfigChange options still never rejects/throws` |
| `onConfigChange` 콜백이 던져도 응답은 200 | PASS | `[SPEC] a throwing onConfigChange callback still yields 200 ...` |
| 쓰기 실패 후에도 서버가 계속 응답 | PASS | `[SPEC] a write failure does not crash the server -- it keeps answering after` |

### 기록
| 기준 | 결과 | 근거 |
|---|---|---|
| 성공 시 `[thresholds]` 줄 정확히 한 줄(전→후·방향·expires_at 포함) | PASS | `[SPEC] a successful change logs exactly one [thresholds]-prefixed line ...` |
| ISO 타임스탬프 붙여도 `parseLogTail` 오인 없음 | PASS | `[SPEC] the logged line, with an ISO timestamp prefix, is not misread by parseLogTail ...` |
| 기존 로그 형식(`[poll start]` 등) 불변 | PASS | 코드 리뷰 — `logparse.js`/`watch-loop.js` 미수정, 기존 005 관련 테스트 전건 유지 통과 |
| 거부된 요청은 `[thresholds]` 줄 없음 | PASS | `[SPEC] rejected requests produce no [thresholds] log line` |

### 즉시 반영
| 기준 | 결과 | 근거 |
|---|---|---|
| 쓰기 직후 `GET /api/status` 의 `usage.thresholds` 가 새 값 | PASS | `[SPEC] a write is reflected by GET /api/status right away, via onConfigChange ...` |
| `configPath`/`onConfigChange` 선택적 옵션 | PASS | `[DERIVED] configPath/onConfigChange are optional ...` |
| `configPath` 없이 PUT → 500 config-unavailable (토큰 미설정이면 403 이 먼저) | PASS | `[DERIVED] no configPath given at all -> 500 config-unavailable ...`, `[DERIVED] no configPath AND no token -- 403 fires first ...` |

### 계약 버전
| 기준 | 결과 | 근거 |
|---|---|---|
| `contracts["supervised-v1"] === "1.3.0"` | PASS | 011 에서 이미 갱신, 기존 테스트 유지 통과 |
| `package.json` 의 `version` 불변 | PASS | `[SPEC] regression: package.json version is unaffected ...` |
| `/api/health` 여전히 `getSnapshot()` 미호출 | PASS | `[DERIVED] GET /api/health still does not call getSnapshot() after 012` |

### 회귀 없음
| 기준 | 결과 | 근거 |
|---|---|---|
| `/api/status` 의 `fields`/`summary`/`state`/`allowance`/`usage` 형태 불변 | PASS | `[SPEC] regression: GET /api/status fields/summary/state/allowance/usage shape is unchanged after 012` |
| `GET /` 읽기 전용 유지(편집 UI 없음) | PASS | `[SPEC] regression: GET / is still read-only -- no form/input/edit affordance in the HTML` |
| `POST /api/stop` 여전히 501 | PASS | `[SPEC] regression: POST /api/stop is still 501` |
| `deriveDesired()`/STOP.json 무관 | PASS | 코드 리뷰 — 둘 다 `watch-loop.js` 소관, `control-server.js` 는 건드리지 않음, 미수정 |
| `lib/thresholds.js`/`config.js`/`observation.js`/`status-page.js`/`logparse.js` Phase 2 미수정 | PASS | `git diff --stat` 확인 — 이번 Phase 에서 수정된 소스는 `lib/control-server.js` 뿐(버그 수정) |
| 토큰 비교 `===`/`==`/`startsWith`/`indexOf` 미사용 유지 | PASS | 기존 SRC 정적 검사 테스트 유지 통과(파일 전체 대상이라 신규 코드도 포함) |
| `claude` 문자열 미등장 | PASS | 기존 `p-quaestor/.js files do not reference the Claude CLI` 테스트가 전체 파일 대상이라 신규 코드 포함 |
| 새 npm 의존성 없음 | PASS | `p-quaestor/package.json` 확인 — `puppeteer` 뿐, 변경 없음 |
| `run-all.js` 기존 전체 테스트 무손상(005 의 26일 fixture 포함) | PASS | 아래 전체 실행 결과 참고 |

## 구현에서 수정한 버그

**`collectBody()` 의 소켓 파괴 버그 (`lib/control-server.js`)** — 요청 본문이 64KiB 상한을 넘으면
기존 코드가 `req.destroy()` 를 호출했는데, 이는 Node 의 `http.IncomingMessage` 에서 요청과 같은
소켓 전체를 파괴한다. 그 결과 서버가 413 응답을 쓰려고 해도 클라이언트 쪽 소켓이 이미 끊겨
`ECONNRESET`("socket hang up")만 관측되고 413 자체가 절대 도달하지 않았다 — Phase 2 acceptance
"[DERIVED] 본문이 상한(64KiB)을 넘으면 413" 을 실제로는 만족할 수 없는 상태였다.
`req.destroy()` 호출만 제거하고(스트림은 계속 흘려보내되 `done` 플래그로 추가 누적만 막음),
413 을 정상 왕복시키도록 고쳤다. 다른 로직은 변경하지 않았다.

## 이전 Phase 통합 검증

`node p-quaestor/test/run-all.js` 전체 실행 결과 344개 중 343 PASS.

**1건 FAIL — Phase 2 범위 밖, 환경 충돌 (Phase 1 QA 리포트와 동일 원인):**
```
control-server.test.js:91 "omitting opts.port uses DEFAULT_PORT (3210)"
  Expected started:true, got started:false
```
`netstat`/`tasklist` 로 재확인 — 이 개발 머신에 `node.exe`(PID 6944)가 여전히 포트 3210 을 점유 중이다.
`git diff --stat` 상 이 테스트는 이번 Phase 2 작업으로 한 글자도 바뀌지 않았고(신규 추가분은 전부
`port: 0` 사용, 실포트 3210 은 건드리지 않음), Phase 1 QA 때부터 있던 동일한 환경 충돌이다.
실사용량 감시자로 추정되는 프로세스이므로 QA 목적으로 종료하지 않았다.

Phase 1 의 34개(`thresholds.test.js`) + 26일 fixture 복원 테스트(005) 포함 전체 기존 테스트 무손상.

## 결론

**Phase 2 PASS.** `output/ACCEPTANCE.md` 의 모든 [SPEC]/[DERIVED] 기준을 충족한다.
`collectBody()` 소켓 파괴 버그를 발견해 수정했으며, 그 밖의 검증 로직은 그대로 유지했다.
