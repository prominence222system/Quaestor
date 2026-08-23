# TEST_RESULT — 004 Phase 5 (역경로·강건성 매트릭스)

대상: `p-bellows/lib/control-server.js`(무수정) · `p-bellows/test/control-server.test.js`(증분, +348 lines)
검증 방식: hermetic, 실제 포트(`port: 0`) 실바인딩 + 실제 HTTP/원시 소켓 요청.

## 요약

- `node p-bellows/test/run-all.js` → **133 tests, 133 pass, 0 fail, exit code 0**, 프로세스 매달림 없음.
- 이전 Phase 4 종료 시점(123개) 대비 **+10개 순증분**, 기존 123개 전부 무회귀로 통과.
- `implement` 단계에서 이미 올바르게 작성되어 **구현 코드 수정 없이 1회 실행에 전부 통과** — 발견된 버그 없음.
- `git show --stat HEAD` 로 실증: 이번 커밋(`d931507`, Phase 5 implement)은 `test/control-server.test.js` 348줄 추가뿐, `lib/*`·`watch-loop.js` 변경 0.
  `lib/control-server.js` 마지막 수정 커밋은 `d1b2ddd`(Phase 3) — Phase 4·5 를 관통해 무수정 유지.

## Phase 5 Acceptance Criteria 대조

### 응답 형식 매트릭스
| 기준 | 결과 | 근거 테스트 |
|---|---|---|
| [SPEC] 200(health)·200(status)·401·404·405·500·501 전부 실요청으로 유발, 그 자리에서 JSON.parse 직접 단언 | PASS | `response shape matrix: every reachable status code (200/200/401/404/405/500/501) is directly asserted for I1-I5` (7-case 선언 배열 루프) |
| [SPEC] 모든 경로 `ok` 존재·boolean, 2xx 아니면 `ok:false` | PASS | 위 테스트 `assertCommonInvariants` I3 |
| [SPEC] 모든 경로 본문에 토큰·`.profile`·`cookie`·스택트레이스·절대경로 없음(대소문자 무시) | PASS | 위 테스트 I4 |
| [SPEC] 각 경로 직후 `GET /api/health` 200 | PASS | 위 테스트 I5(followUp) |
| [DERIVED] 응답 헤더 `Content-Type`/`Cache-Control` | PASS | 위 테스트 I2 |
| [DERIVED] 매트릭스는 선언 배열 + 공통 단언 루프 | PASS | `cases` 배열 + `for (const c of cases)` 구조로 확인 |
| [DERIVED] I1 적용 범위는 well-formed 요청 한정(주석 명문화) | PASS | 테스트 파일 헤더 주석에 명문화, R3 에서 별도 취급 |

### 역경로 매트릭스 (well-formed 이지만 비정상)
| 기준 | 결과 | 근거 테스트 |
|---|---|---|
| [SPEC] 후행 슬래시·이중 슬래시·대문자·퍼센트인코딩 → 유효 JSON 거부 + 생존 | PASS | `adversarial paths: route variants and unknown methods are rejected as valid JSON without harming the server` |
| [SPEC] `/api/../api/status` 정규화 경로가 200 받아도 fs 미접근 | PASS | `adversarial: a dot-segment path normalizes to /api/status ...` + 기존 소스 정적 검사(`control-server.js source never references STOP.json / scrapeUsage / writeStopJsonAtomic`) |
| [SPEC] 계약 경로에 대한 미지 메서드(PATCH/DELETE/OPTIONS, `/api/stop` 에 GET) → 유효 JSON 거부, 500·프로세스 종료 없음 | PASS | 위 `adversarial paths` 테스트의 case 목록에 포함 |
| [SPEC] 중복 `Authorization` 헤더, 수 KB Bearer 토큰 → 401, 예외 없음 | PASS | `adversarial: duplicate Authorization headers ...`, `adversarial: a multi-KB Bearer token does not throw ...` |
| [SPEC] 요청 본문 실린 `GET /api/status` → 200, 부작용 없음(본문 미독) | PASS | `adversarial: GET /api/status with a request body is still 200 and has no side effects` |
| [DERIVED] 경로 변형 기대값 404, 미지 메서드 405 | PASS | 위 두 테스트의 case 별 `status` 필드 |
| [DERIVED] `HEAD /api/health` → 405, 헤더만 확인 | PASS | `adversarial: HEAD /api/health -> 405, headers-only assertion` |
| [DERIVED] ~8KB 긴 경로 → 정확한 코드 불문, 4xx + 생존만 요구 | PASS | `adversarial: an ~8KB request path draws a 4xx ...` |

### 복원력 (never-brick 마지막 미검증 면)
| 기준 | 결과 | 근거 테스트 |
|---|---|---|
| [SPEC] 소켓 강제 종료 후에도 생존, 직후 `/api/health` 200 | PASS | `resilience R1-R5 ...` 내 R2 구간 |
| [SPEC] HTTP 파싱 불가 바이트열에도 생존, 응답 형식 불문 | PASS | 동 테스트 R3 구간 (`sendRawAndWaitClose`) |
| [SPEC] 전 프로브 구간 `uncaughtException`/`unhandledRejection` 0회 | PASS | 동 테스트 R4 구간(리스너 등록·해제, 배열 길이 0 단언) |
| [SPEC] 25건 동시 `/api/status` 전부 200·유효 JSON, 관측 객체 불변 | PASS | 동 테스트 R1 구간(`Promise.all`, before/after 문자열 비교) |
| [SPEC] 전 구간 STOP.json 미변경, 스크래핑 미유발 | PASS | 동 테스트 R5 구간(임시 STOP 파일 mtime 불변 단언) |
| [DERIVED] 401·404·405 경로에서 `getSnapshot()` 호출 0 | PASS(구조적) | 404/405 는 `snapshotCalls` 카운터로 직접 확인. 401 은 별도 카운터는 없으나, 인증 게이트가 라우팅보다 먼저 실행되고 `getSnapshot` 은 `handleStatus` 내부에서만 호출되는 구조(기존 `auth: gate runs before routing` 테스트로 순서 확정)로 behavior-equivalent 하게 성립 — [DERIVED] 항목이므로 이 수준의 근거로 충분하다고 판단 |
| [DERIVED] 동시 요청 수는 성능 벤치마크 아닌 소수(25) | PASS | 동 테스트, `Array.from({ length: 25 }, ...)` |

### 🔒 무회귀·경계
| 기준 | 결과 | 근거 |
|---|---|---|
| [SPEC] `lib/control-server.js` 등 5개 동작 파일 이 Phase 에서 미수정 | PASS | `git show --stat HEAD` — 테스트 파일만 변경, [SPEC] 위반으로 인한 소스 수정 0건 |
| [SPEC] 계약면 확장 없음(새 엔드포인트·메서드·라우팅 규칙 없음) | PASS | 소스 무수정으로 자동 성립 |
| [SPEC] 바인딩 `127.0.0.1` 고정, `POST /api/stop` 여전히 미구현 | PASS | 기존 Phase 1·2 테스트 재통과 + Phase 5 501 케이스 |
| [SPEC] `deriveDesired()` 임계·히스테리시스, STOP.json 스키마, 수동 STOP 우선 규칙 무변경 | PASS | `watch-loop.js`·`observation.js` 무수정 |
| [SPEC] `run-bellows.ps1`·`deploy-bellows.ps1`·`deploy.json`·계약 원문·Foreman 저장소 미수정 | PASS | `git status` 확인 — 이 NNN 관련 변경 없음 |
| [SPEC] Phase 1·2·3·4 기준 전부 계속 만족, 삭제·완화 없음 | PASS | 기존 123개 테스트 전부 통과 유지(신규 10개는 순증분) |
| [SPEC] `run-all.js` 133개 전부 통과, exit 0, 프로세스 안 매달림 | PASS | 위 요약 참조 |
| [SPEC] 의존성 미증가(`puppeteer` 유일) | PASS | `no new runtime dependency` 기존 테스트 재확인 |
| [SPEC] `p-bellows` `.js` 파일에 `claude` 매칭 0(도메인 URL 예외) | PASS | `control-server.js`·`watch-loop.js` grep 0건 직접 확인(도메인 URL 은 `lib/scrape.js` 기존 예외, 테스트 파일 내 언급은 부재 검증용) |
| [DERIVED] 프로브 전부 `port: 0`, `try/finally` close | PASS | 소스 확인 — Phase 5 신규 테스트 전부 `port: 0` + `finally { await r.close(); }` |
| [DERIVED] `deploy-bellows.ps1 -DryRun` exit 0 | PASS | 직접 실행 확인, exit code 0 |

### USER_GATE (자동화 불가 — 사람 확인 필요)
- `http://127.0.0.1:3210/api/status` 를 실제로 열어 `state: "crit"` 확인, `/api/health` 는 `ok` 확인 — **자동 테스트 대상 밖**. Phase 4 에서와 동일하게 실제 감시자 기동 후 사람이 확인해야 하는 항목이며, 이번 Phase 도 이를 자동 검증 스위트에 포함하지 않는다(설계 의도와 일치 — 아래 "How to Run" 참고).

## 전체 테스트 목록 (133개, Phase 5 신규 10개 발췌)

1. `response shape matrix: every reachable status code (200/200/401/404/405/500/501) is directly asserted for I1-I5`
2. `adversarial paths: route variants and unknown methods are rejected as valid JSON without harming the server`
3. `adversarial: a dot-segment path normalizes to /api/status and matches the contract shape (no filesystem access)`
4. `adversarial: HEAD /api/health -> 405, headers-only assertion (HTTP forbids a HEAD response body)`
5. `adversarial: an ~8KB request path draws a 4xx (exact code left to the Node parser layer) and the server keeps running`
6. `adversarial: duplicate Authorization headers do not throw -- Node keeps the first value, a mismatch still yields 401`
7. `adversarial: a multi-KB Bearer token does not throw -- 401, not 500`
8. `adversarial: GET /api/status with a request body is still 200 and has no side effects (the body is never read)`
9. `adversarial: POST /api/stop with Content-Type: text/xml is still 501 (the body is never parsed)`
10. `resilience R1-R5: concurrency, abrupt disconnects, and malformed bytes never crash the server, leak side effects, or throw unhandled errors`

나머지 123개는 Phase 1~4 기존 테스트(무회귀 재통과, 상세 목록은 `test/run-all.js` 실행 로그 참조).

## 구현 코드에서 수정한 버그

없음. Phase 5 는 검증 전용 Phase 로, `implement` 단계에서 작성된 테스트가 **1회 실행 만에 133/133 통과**했다.
`lib/*`·`watch-loop.js` 어느 파일도 이 단계에서 수정하지 않았다(`git show --stat HEAD` 로 실증 — 변경분은 테스트 파일 348줄 추가뿐).

## 이전 Phase 통합 검증 결과

- Phase 1(코어 라우팅/health/status) — 재통과.
- Phase 2(인증/`config.js` control 블록/비밀 미유출) — 재통과.
- Phase 3(watch-loop.js never-brick 배선/라이브 관측) — 재통과.
- Phase 4(조립 경로 `readConfig()` → `startControlServer()` 계약 기본 주소 3210 실바인딩) — 재통과. Phase 5 신규 프로브는 전부 `port: 0` 을 사용해 계약 기본 포트(3210)를 점유하지 않으므로 Phase 4 테스트와 자원 경합이 없다(파일 내 배치 순서상 Phase 4 조립-경로 테스트가 앞서고, Phase 5 어드버서리얼/복원력 테스트는 그 뒤에 추가돼 있으며 각각 독립 포트를 사용한다).
- `require('../watch-loop.js')` 모듈 로드 경계(003 성질) — 재통과.

## How to Run

```
node p-bellows/test/run-all.js
```

- 사전 준비 불필요(hermetic, Chrome·네트워크 불필요). `npm` 대신 `node` 를 직접 호출할 것.
- 실제 감시자를 띄워 계약면을 눈으로 확인하려면:
  ```
  powershell -NoProfile -ExecutionPolicy Bypass -File ./run-bellows.ps1
  ```
  기동 후 브라우저로 `http://127.0.0.1:3210/api/health` 와 `http://127.0.0.1:3210/api/status` 를 열어
  USER_GATE 항목(현재 고장난 측정 상태가 `state: "crit"` 로 보이는지)을 사람이 직접 확인한다.


===========================================
NNN: 005-restore-observation-on-boot
Started: 2026-08-23T07:01:13Z
===========================================
