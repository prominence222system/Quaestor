# TEST_RESULT — 004 Phase 2

대상: `p-bellows/lib/control-server.js`(인증 · 비밀 미유출) · `p-bellows/lib/config.js`(`control` 블록) ·
`p-bellows/test/control-server.test.js`(증분) · `PROJECT_INTENT.md`(기록)
기준: `output/ACCEPTANCE.md` (004 Phase 2) — 수정하지 않음(read-only 준수).

## 요약

- `node p-bellows/test/run-all.js` — **110개 테스트 전부 통과, 종료 코드 0**
  (Phase 1까지 83개 + Phase 2 신규 27개 = 110개, 기존 테스트 완화·삭제 없음)
- Phase 2 acceptance 항목 전부 **PASS**.
- 구현 코드(`control-server.js`·`config.js`)는 이미 Phase 2 계약을 만족한 상태로 발견 —
  수정 불필요. 발견된 버그 없음.
- `PROJECT_INTENT.md` 는 저장소 밖(Synology 스펙 디렉터리:
  `1. Project\products\Bellows\PROJECT_INTENT.md`)에 이미 §"결정 — `POST /api/stop` 은
  영구히 구현하지 않는다" 절로 작성돼 있음을 직접 읽어 확인.

## Phase 2 Acceptance 기준별 결과

### 인증 — `Authorization: Bearer`
| 기준 | 결과 | 테스트 |
|---|---|---|
| 헤더 없음 → 401 | PASS | `auth: token set, no Authorization header -> 401 ok:false` |
| 틀린 토큰 → 401 | PASS | `auth: token set, wrong token -> 401` |
| 맞는 토큰 → 200 | PASS | `auth: token set, correct token -> 200` |
| 토큰 미설정 → 200 | PASS | `auth: token not set (current on-disk default), no header -> 200` |
| 401 본문에 기대 토큰 값 없음 | PASS | `auth: 401 body never contains the expected token value` |
| 401 `ok === false` | PASS | 위 401 테스트들에 포함 |
| "헤더 없음"·"불일치" 응답 구분 불가 | PASS | `auth: "missing header" and "wrong token" responses are indistinguishable` |
| `timingSafeEqual` 길이 무관 상수시간, 예외 없이 401 | PASS | `auth: constant-time compare does not throw on very different token lengths (1 char / 500 chars)` |
| 소스에 `===`/`==`/`startsWith`/`indexOf`/길이 분기 없음, `timingSafeEqual` 사용 | PASS | `source: no ===/==/startsWith/indexOf token comparison, and no length-based branch` |
| 인증 게이트가 라우팅보다 먼저(`/api/nope` → 401) | PASS | `auth: gate runs before routing -- unknown path with token set returns 401, not 404` |
| `POST /api/stop` 도 인증 게이트 적용 | PASS | `auth: gate applies to POST /api/stop -- 401 before 501 when header missing` |
| [DERIVED] `Bearer` 대소문자 무시 | PASS | `auth: Bearer scheme match is case-insensitive` |
| [DERIVED] `WWW-Authenticate: Bearer`, 값에 경로/토큰/계정 없음 | PASS | `auth: 401 has WWW-Authenticate: Bearer header with no path/token/account in its value` |
| [DERIVED] `Basic`/깨진 헤더 → 401(500 아님) | PASS | `auth: malformed / other-scheme Authorization header -> 401, not 500` |

### `config.js` — `control` 블록
| 기준 | 결과 | 테스트 |
|---|---|---|
| `readConfig()` never-throw (파일없음/깨진JSON/타입오류/만료) | PASS | `config: readConfig() never throws on malformed input ...` |
| 반환값에 `control.port`(number)·`control.authToken`(string\|null) 항상 존재 | PASS | `config: readConfig() always has control.port ...` |
| 기존 필드(`enabled`·`thresholds`·`expires_at`·`_parseError`·`_expired`) 무변경 | PASS | `config: existing fields (enabled/thresholds/expires_at) are unaffected by the control block addition` |
| [DERIVED] 기본 포트 3210, 1..65535 정수만 덮어씀 | PASS | `config: file control.port overrides default ...` / `... out of range or wrong type falls back to default` |
| [DERIVED] 빈 문자열/공백 authToken → `null` | PASS | `config: file control.authToken sets the token; empty/whitespace normalizes to null` |
| [DERIVED] 최상위 `authToken` 폴백, `control.authToken` 우선 | PASS | `config: top-level authToken is a fallback only ...` |
| [DERIVED] 만료/파싱실패 시 `control` 도 기본값 복귀 | PASS | `config: expired config or parse-error config resets control to defaults (auth off)` |
| [DERIVED] `BELLOWS_CONTROL_PORT`/`BELLOWS_CONTROL_TOKEN` 환경변수, 파일이 우선 | PASS (수동 검증) | 전용 자동 테스트 없음(DERIVED). `node -e`로 `readConfig(null)`이 env 값(`port:9999, authToken:'env-token'`)을 반영함을 확인. `envDefaults()`가 base 를 만들고 파일 병합 단계(`merged.control.port/authToken` 대입)가 그 위에 override 하는 구조라 파일 우선이 코드상 성립 |

### 비밀 미유출 (응답 전체 관점)
| 기준 | 결과 | 테스트 |
|---|---|---|
| 200/401/404/405/501/500 모든 응답에 토큰 값 없음 | PASS | `secrets never leak: 200/401/404/405/501/500 bodies never contain the token, .profile, cookie, or the raw Authorization header` |
| 모든 응답에 `.profile`·`cookie`·`Authorization` 원문 없음 | PASS | 위와 동일 테스트 |
| 스택트레이스·절대경로·설정파일경로·계정명 없음 | PASS | Phase 1 `response bodies are valid JSON with no stack traces, HTML, or internal file paths` + 위 secrets 테스트 |
| 예외 메시지가 본문에 실리지 않음(고정 문구만) | PASS | secrets-never-leak 테스트의 `getsnapshot boom` 미포함 단언 |
| [DERIVED] 응답 헤더에 토큰·경로 없음, `Set-Cookie` 없음 | PASS (코드 리뷰) | `sendJson()`은 `Content-Type`·`Cache-Control`만 설정(401 시 `WWW-Authenticate` 추가); 소스 전체에 `Set-Cookie` 쓰는 경로 없음 |
| [DERIVED] `onLog` 인증 로그에 토큰값 없음, 기동 로그는 여부만 | PASS | `onLog never receives the received or expected token on an auth failure` / `startup onLog reports auth enabled/disabled by presence, not by value` |

### `POST /api/stop` — 의도적 미구현 명문화
| 기준 | 결과 | 근거 |
|---|---|---|
| STOP.json 생성/수정/삭제 없음, `deriveDesired()` 미실행 | PASS | Phase 1 `control-server.js source never references STOP.json / scrapeUsage / writeStopJsonAtomic` + `POST /api/stop with a valid token still does nothing (501, ...)` |
| 소스에 미구현 사유 주석 | PASS | `control-server.js source documents why POST /api/stop is intentionally unimplemented`(`handleStop()` 상단 주석에 "intentionally"·`PROJECT_INTENT.md` 참조 확인) |
| `PROJECT_INTENT.md` 에 동일 결정·근거 기록 | PASS (직접 확인) | `products/Bellows/PROJECT_INTENT.md` §"결정 — `POST /api/stop` 은 영구히 구현하지 않는다" 절 실측 확인 |
| [DERIVED] 인증 통과 후 `POST /api/stop` → 501, 미구현 표시 | PASS | `POST /api/stop -> 501, intentionally-unimplemented marker present` |

### 경계 · 무변경 보장
| 기준 | 결과 | 근거 |
|---|---|---|
| `lib/observation.js` · `lib/scrape.js` 무수정 | PASS | `git diff --stat HEAD -- p-bellows/lib/observation.js p-bellows/lib/scrape.js p-bellows/watch-loop.js` 결과 없음(diff 0) |
| `watch-loop.js` 무수정(배선은 Phase 3) | PASS | 위와 동일 확인 |
| `127.0.0.1` 고정, 인증 도입이 완화하지 않음 | PASS | Phase 1 바인딩 테스트 + `source has no 0.0.0.0 / :: literals and no host override option` |
| 의존성 무증가(`puppeteer` 만) | PASS | `no new runtime dependency: package.json dependencies is still puppeteer-only` |
| `claude` 문자열 없음(`control-server.js`·`config.js`) | PASS | `control-server.js does not reference the Claude CLI` + `p-bellows/.js files do not reference the Claude CLI`(전체 파일 스캔, `config.js` 포함) |
| Foreman `require`/경로 하드코딩 없음 | PASS | `control-server.js does not depend on Foreman (no require, no hardcoded path)` |
| Phase 1 기준 계속 만족 | PASS | Phase 1 테스트 25개 전부 그린(회귀 없음) |
| `run-all.js` 전체 통과, 종료코드 0, 매달림 없음 | PASS | 아래 실행 로그, 모든 테스트가 `finally`에서 `close()` 호출 |

## 전체 테스트 실행 결과

```
$ node p-bellows/test/run-all.js
[run-all] loading 4 test file(s): control-server.test.js, observation.test.js, scrape-classify.test.js, watch-loop.test.js
...
tests 110
pass 110
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 192.4358

$ echo $?
0
```

## Phase 2 신규 테스트 목록 (control-server.test.js, 27개)

1. auth: token set, no Authorization header -> 401 ok:false
2. auth: token set, wrong token -> 401
3. auth: token set, correct token -> 200
4. auth: token not set (current on-disk default), no header -> 200
5. auth: "missing header" and "wrong token" responses are indistinguishable
6. auth: 401 body never contains the expected token value
7. auth: constant-time compare does not throw on very different token lengths (1 char / 500 chars)
8. source: no ===/==/startsWith/indexOf token comparison, and no length-based branch
9. auth: gate runs before routing -- unknown path with token set returns 401, not 404
10. auth: gate applies to POST /api/stop -- 401 before 501 when header missing
11. auth: Bearer scheme match is case-insensitive
12. auth: malformed / other-scheme Authorization header -> 401, not 500
13. auth: 401 has WWW-Authenticate: Bearer header with no path/token/account in its value
14. secrets never leak: 200/401/404/405/501/500 bodies never contain the token, .profile, cookie, or the raw Authorization header
15. onLog never receives the received or expected token on an auth failure
16. startup onLog reports auth enabled/disabled by presence, not by value
17. POST /api/stop with a valid token still does nothing (501, no STOP.json/deriveDesired path touched)
18. control-server.js source documents why POST /api/stop is intentionally unimplemented
19. config: readConfig() always has control.port (number) and control.authToken (string|null), even with no file
20. config: HARD_DEFAULTS.control matches the documented default (port 3210, authToken null)
21. config: readConfig() never throws on malformed input (missing file / broken JSON / wrong types / expired)
22. config: file control.port overrides default when a valid 1..65535 integer
23. config: file control.port out of range or wrong type falls back to default
24. config: file control.authToken sets the token; empty/whitespace normalizes to null
25. config: top-level authToken is a fallback only when control.authToken is absent; control.authToken wins when both present
26. config: expired config or parse-error config resets control to defaults (auth off)
27. config: existing fields (enabled/thresholds/expires_at) are unaffected by the control block addition

## 발견·수정한 버그

없음. `lib/control-server.js`·`lib/config.js`·`p-bellows/test/control-server.test.js` 모두
Phase 2 구현이 이미 완료된 상태로 발견되었고, `output/ACCEPTANCE.md`의 모든 [SPEC]/[DERIVED]
항목을 코드 리뷰 + 실제 포트 기반 통합 테스트로 대조한 결과 수정이 필요한 결함이 없었다.

## 이전 Phase(Phase 1 / 003) 통합 검증

Phase 1 의 25개 테스트, 003 유래 `observation.test.js`(28개)·`scrape-classify.test.js`(19개)·
`watch-loop.test.js`(11개) — 총 83개가 이번 Phase 2 신규 27개와 같은 `run-all.js` 실행에서
함께 통과(110/110). `git diff --stat HEAD -- p-bellows/lib/observation.js p-bellows/lib/scrape.js
p-bellows/watch-loop.js`로 세 파일이 이번 Phase에서 수정되지 않았음을 확인. 회귀 없음.

## How to Run

이 Phase는 라이브러리 계층(HTTP 서버 코어 + 설정 파서)만 다룬다. `watch-loop.js` 배선은
Phase 3 미착수 상태라 화면·프로세스 동작 변화는 없다(정상).

```bash
# 전체 테스트(hermetic, Chrome/claude.ai 불필요)
node p-bellows/test/run-all.js

# 서버를 직접 띄워 눈으로 확인하려면 (예: node REPL 또는 스크립트)
node -e "
const { startControlServer } = require('./p-bellows/lib/control-server');
startControlServer({ port: 3210 }).then(r => {
  console.log('started:', r.started, 'port:', r.port);
  // curl http://127.0.0.1:3210/api/health
  // curl http://127.0.0.1:3210/api/status
});
"
```

⚠️ `npm` 사용 금지 — `node` 를 직접 호출할 것.
