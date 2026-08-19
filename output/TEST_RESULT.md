# TEST_RESULT — 004 Phase 1

대상: `p-bellows/lib/control-server.js` · `p-bellows/test/control-server.test.js`
기준: `output/ACCEPTANCE.md` (004 Phase 1) — 수정하지 않음(read-only 준수).

## 요약

- `node p-bellows/test/run-all.js` — **83개 테스트 전부 통과, 종료 코드 0**
  (기존 58개 + 이번 Phase 1 신규 25개 = 83개, 기존 테스트 완화·삭제 없음)
- Phase 1 acceptance 항목은 전부 **PASS**.
- 구현 코드(`control-server.js`) 자체는 수정 불필요 — 이미 계약을 만족했다.
  버그는 **테스트 파일 쪽**(직전 편집이 남긴 문법 오류) 1건, 즉시 수정.

## 발견/수정한 버그

| 항목 | 내용 | 조치 |
|---|---|---|
| 테스트 파일 구문 오류 | `control-server.test.js` 에 새 테스트를 추가하는 편집 과정에서 `});` 뒤에 `------` 잔재가 남아 `SyntaxError: Invalid left-hand side expression in prefix operation` 발생 → `run-all.js` 가 파일 로드 자체를 실패시켜 control-server 테스트 25개가 통째로 스킵됐다(다른 파일 58개만 통과로 보임). | 잔재 제거. 재실행 후 83개 전부 통과 확인. |

구현 코드(`lib/control-server.js`) 결함은 없었다.

## Acceptance 기준별 결과

### 바인딩 · 기동 계약
| 기준 | 결과 | 테스트 |
|---|---|---|
| 바인딩 주소 `127.0.0.1` (server.address + 반환값) | PASS | `binds to 127.0.0.1 and reports it in the resolved value` |
| 소스에 `0.0.0.0`/`::`/호스트 오버라이드 옵션 없음 | PASS | `source has no 0.0.0.0 / :: literals and no host override option` |
| 점유된 포트 → 예외 없이 `started:false` | PASS | `startControlServer never rejects/throws on an already-occupied port...` |
| `started:false` 여도 `close` 는 안전한 no-op 함수 | PASS | 위 테스트 내 `b.close()` 검증 |
| 기동 실패 시 `error` 는 비어있지 않은 문자열 | PASS | 위 테스트 내 `b.error` 검증 |
| `close()` 후 포트 재바인딩 가능, 프로세스 안 매달림 | PASS | `after close(), the port is bindable again (no lingering handle)` |
| [DERIVED] `opts.port` 생략 시 3210, `port:0` 시 OS 할당 | PASS | `omitting opts.port uses DEFAULT_PORT (3210)` + 다수 테스트의 `port:0` 사용 |
| [DERIVED] `EADDRINUSE` 이후 늦은 `error` 이벤트가 이미 해결된 Promise 를 재해결해도 죽지 않음 | PASS (신규 테스트 추가) | `concurrent binds to the same port: one succeeds, the other resolves started:false without throwing` |

### `GET /api/health`
| 기준 | 결과 | 테스트 |
|---|---|---|
| 200 + `id === 'quaestor'` | PASS | `GET /api/health -- 200, id=quaestor, ...` |
| `ok`·`version`·`startedAt` 모두 존재 | PASS | 위 동일 |
| `version` 이 `package.json` 과 일치 | PASS | 위 동일 (`PKG.version` 비교) |
| `startedAt` ISO 파싱 가능, 두 번 요청해도 불변 | PASS | `GET /api/health startedAt is constant across two requests` |
| `/api/health` 는 `getSnapshot()` 호출 안 함(횟수 0) | PASS | `GET /api/health ...` 내 `calls === 0` 검증 |

### `GET /api/status`
| 기준 | 결과 | 테스트 |
|---|---|---|
| 200 + `summary`·`state`·`fields` 존재 | PASS | `GET /api/status -- 200, state matches deriveState()...` |
| `state` 가 `deriveState()` 반환값과 정확히 동일(crit 픽스처) | PASS | 위 동일 (`state === 'crit'`, `!== 'ok'`) |
| `summary`·`fields` 깊은 비교 동일 | PASS | 위 동일 (`deepStrictEqual`) |
| `updatedAt` ISO 파싱 가능 | PASS | 위 동일 |
| 부작용 없음 — observation 필드(`totalPolls` 등) 불변 | PASS | `GET /api/status has no side effects: getSnapshot observation is unchanged across two GETs` |
| 부작용 없음 — 스크래핑/STOP.json 미접근 | PASS (신규 테스트 추가) | `GET /api/status does not touch the filesystem -- an unrelated temp file stays unchanged` + `control-server.js source never references STOP.json / scrapeUsage / writeStopJsonAtomic` |
| 응답에 `authToken`·`.profile`·`cookie` 없음 | PASS | `response JSON never contains authToken value, .profile, or cookie` |
| `getSnapshot()` throw 시 `ok:true` 아님 | PASS | `GET /api/status: getSnapshot throwing does not yield ok:true` |

### 라우팅 · 응답 형식
| 기준 | 결과 | 테스트 |
|---|---|---|
| 유효 JSON, 스택 트레이스·HTML·내부 경로 미노출 | PASS (신규 테스트 추가) | `response bodies are valid JSON with no stack traces, HTML, or internal file paths` |
| 핸들러 예외 발생해도 서버 계속 응답(health 200 유지) | PASS | `handler exception is caught: after a throwing getSnapshot call, /api/health still responds 200` |
| [DERIVED] 알 수 없는 경로 → 404 `ok:false` | PASS | `unknown path -> 404 ok:false` |
| [DERIVED] GET 아닌 메서드 → 405 `ok:false` | PASS | `non-GET on /api/health and /api/status -> 405 ok:false` |
| [DERIVED] `POST /api/stop` → 501 + 의도적 미구현 표시 | PASS | `POST /api/stop -> 501, intentionally-unimplemented marker present` |
| [DERIVED] 쿼리스트링 무시 | PASS | `query string is ignored -- /api/status?x=1 matches /api/status shape` |
| [DERIVED] `Content-Type: application/json; charset=utf-8` + `Cache-Control: no-store` | PASS | `response headers: Content-Type json + Cache-Control no-store` |

### 경계 · 무변경 보장
| 기준 | 결과 | 확인 방법 |
|---|---|---|
| `lib/observation.js` 이 Phase 에서 미수정, 임계값 복제 없음 | PASS | `git status`/`git diff` 로 미수정 확인 + `control-server.js does not re-implement observation thresholds or state judgement`(85/90/70/75 리터럴 부재 검증) |
| `watch-loop.js` 미수정(Phase 1 범위 아님) | PASS | `git status`/`git diff` 로 미수정 확인 |
| Foreman 미의존(require/경로 하드코딩 없음) | PASS | `control-server.js does not depend on Foreman (no require, no hardcoded path)` |
| 의존성 미증가(`puppeteer` 단일 유지) | PASS | `no new runtime dependency: package.json dependencies is still puppeteer-only` |
| `claude` 문자열 미포함 | PASS | `control-server.js does not reference the Claude CLI` |
| `node p-bellows/test/run-all.js` 기존 58개 포함 전부 통과, 종료 코드 0 | PASS | 전체 실행 로그(83/83 pass), `echo $?` → 0 |

## 전체 테스트 목록 (control-server.test.js, 25개)

1. binds to 127.0.0.1 and reports it in the resolved value
2. source has no 0.0.0.0 / :: literals and no host override option
3. startControlServer never rejects/throws on an already-occupied port; started=false, error is a non-empty string
4. after close(), the port is bindable again (no lingering handle)
5. omitting opts.port uses DEFAULT_PORT (3210)
6. concurrent binds to the same port: one succeeds, the other resolves started:false without throwing (late error-event safety) — 신규
7. GET /api/health -- 200, id=quaestor, ok/version/startedAt present, does not touch getSnapshot
8. GET /api/health startedAt is constant across two requests
9. GET /api/status -- 200, state matches deriveState() exactly, no re-judgement (crit fixture)
10. GET /api/status has no side effects: getSnapshot observation is unchanged across two GETs
11. GET /api/status: getSnapshot throwing does not yield ok:true
12. handler exception is caught: after a throwing getSnapshot call, /api/health still responds 200
13. response JSON never contains authToken value, .profile, or cookie
14. GET /api/status does not touch the filesystem -- an unrelated temp file stays unchanged (mtime + existence) — 신규
15. control-server.js source never references STOP.json / scrapeUsage / writeStopJsonAtomic — 신규
16. response bodies are valid JSON with no stack traces, HTML, or internal file paths — 신규
17. unknown path -> 404 ok:false
18. non-GET on /api/health and /api/status -> 405 ok:false
19. POST /api/stop -> 501, intentionally-unimplemented marker present
20. query string is ignored -- /api/status?x=1 matches /api/status shape
21. response headers: Content-Type json + Cache-Control no-store
22. control-server.js does not re-implement observation thresholds or state judgement
23. control-server.js does not depend on Foreman (no require, no hardcoded path)
24. control-server.js does not reference the Claude CLI
25. no new runtime dependency: package.json dependencies is still puppeteer-only

전체 실행 결과: `tests 83 / pass 83 / fail 0 / cancelled 0 / skipped 0`, 종료 코드 0.

## 이전 Phase(003) 통합 검증

`observation.test.js`(구 003), `scrape-classify.test.js`, `watch-loop.test.js` — 58개 테스트 전부
control-server 테스트와 같은 `run-all.js` 실행에서 함께 통과. `git status`/`git diff` 로
`lib/observation.js`·`watch-loop.js`·`package.json` 이 이번 Phase 에서 수정되지 않았음을 확인.
회귀 없음.
