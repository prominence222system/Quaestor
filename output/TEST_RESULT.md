# TEST_RESULT — 004 Phase 3

대상: `p-bellows/watch-loop.js`(배선) · `p-bellows/test/control-server.test.js`(증분) ·
`p-bellows/test/watch-loop.test.js`(증분)
기준: `output/ACCEPTANCE.md` (004 Phase 3) — 수정하지 않음(read-only 준수).

## 요약

- `node p-bellows/test/run-all.js` — **122개 테스트 전부 통과, 종료 코드 0**
  (Phase 1·2 누적 110개 + Phase 3 신규 12개 = 122개, 기존 테스트 완화·삭제 없음)
- Phase 3 acceptance 항목 전부 **PASS**.
- `watch-loop.js`·`control-server.test.js`·`watch-loop.test.js` 는 이미 Phase 3 계약을
  만족한 상태로 발견 — 수정 불필요. 발견된 버그 없음.
- `pollOnce()` 는 설계 §9-7 대로 구동하지 않았다(실제 STOP.json·bellows.log 오염 방지).
  배선의 동작은 실포트 기반으로 동일 형태를 재구성해 검증했다(설계서 명시 전략).

## Phase 3 Acceptance 기준별 결과

### never-brick — 계기판이 차단기를 죽이지 않는다
| 기준 | 결과 | 테스트 |
|---|---|---|
| 기동 실패해도 감시 루프 경로 계속 진행(관측 가능한 방식으로 확인) | PASS | `never-brick simulation: startup on an occupied port resolves started:false and the caller keeps running (no exception escapes)` |
| 기동 실패가 예외로 새지 않음 | PASS | 위 테스트 + `startControlServer never rejects/throws on an already-occupied port ...` (Phase 1) |
| 기동 실패를 조용히 삼키지 않음(`[control] listen failed: <사유>`) | PASS | `never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists`(구조 검증) + `watch-loop.js` L204-205/207-208 실측 |
| 기동 성공 시 `[control] listening on 127.0.0.1:<port>` 로그 | PASS | `control-server.js` L233(`onLog('[control] listening on ' + HOST + ':' + addr.port)`) — `watch-loop.js` 가 `onLog: log` 로 배선 |
| [DERIVED] 결과 분기 + try/catch 이중 방어, 어느 분기도 폴링 루프 미건너뜀 | PASS | `C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally` |
| [DERIVED] 기동 로그는 값이 아니라 여부만 남김 | PASS | `startup onLog reports auth enabled/disabled by presence, not by value`(Phase 2, 배선 후에도 형식 유지) |

### 모듈 로드 경계 (003 이 얻은 성질의 보존)
| 기준 | 결과 | 테스트 |
|---|---|---|
| `require('../watch-loop.js')` 가 리스너를 열지 않음(호출 카운터 0) | PASS | `C1: requiring watch-loop.js does not call startControlServer at module-load time` |
| 감시 루프를 시작하지 않고 반환, `require.main === module` 가드 유지 | PASS | `require("../watch-loop.js") loads without starting the watch loop` + `watch-loop.js source guards its immediate-invocation loop with require.main === module`(003 기준, 무회귀) |
| 테스트 전체 종료 후 프로세스 매달리지 않음 | PASS | `run-all.js` 실행이 프로세스 자연 종료(exit 0), 모든 서버가 `finally` 에서 `close()`됨 |
| [DERIVED] `startControlServer(` 호출은 `mainLoop()` 본문 안에만 존재 | PASS | `C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level` |

### 라이브 관측 — 기동 시점 값을 캡처하지 않음
| 기준 | 결과 | 테스트 |
|---|---|---|
| `/api/status` 는 매 요청마다 현재 관측 상태를 읽음(재대입 반영) | PASS | `live closure: reassigning the observation variable changes the next /api/status response (no capture-at-startup)` |
| 정상 → 연속 실패 다수로 바뀌면 `state` 가 `'crit'` 으로 바뀜 | PASS | 위 동일 테스트(`after.body.state === 'crit'`) |
| 첫 폴 이전(관측 비어있음 · 설정 캐시 없음)에는 `state !== 'ok'` | PASS | `first poll before any success: empty observation + unset ctx yields state !== ok (no green light before measurement)` |
| [DERIVED] `getSnapshot` 은 함수로 주입, 본문이 모듈 변수 `observation` 참조 | PASS | `live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable` |

### `getSnapshot()` 부작용 없음 (C3)
| 기준 | 결과 | 테스트 / 근거 |
|---|---|---|
| `/api/status` 처리 경로가 파일시스템 미접근(fs 호출 없음, `scrapeUsage`·STOP 경로 참조 없음) | PASS | `C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference` |
| 여러 번 호출해도 STOP.json 미생성/미수정/미삭제, `totalPolls`·연속 실패 수 불변 | PASS | `GET /api/status has no side effects: getSnapshot observation is unchanged across two GETs`(Phase 1) + `GET /api/status does not touch the filesystem ...` |
| 새로운 파일 I/O 없음 — `lastStop` 은 `pollOnce()` 가 이미 호출하는 `readStopJson()` 재사용, 호출 지점 미증가 | PASS(코드 리뷰) | `watch-loop.js` 소스 확인: `readStopJson()` 호출은 `pollOnce()` 내부 1곳(L117, `const existing = readStopJson(); lastStop = existing;`)뿐. `controlSnapshot()`(L176-186)은 `lastStop` 모듈 변수만 읽고 fs 호출 없음 |

### `deriveState()` 입력(ctx) 전달
| 기준 | 결과 | 테스트 / 근거 |
|---|---|---|
| 임계값 판정을 `watch-loop.js` 에서 다시 하지 않음(새 `85`/`90`/`70`/`75` 리터럴·`state` 분기 없음) | PASS | `watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring)` — `deriveDesired()` 기존 본문(무변경)은 별개 |
| [DERIVED] `ctx` 가 `enabled`·`thresholds`·`stop`·`configSource` 를 담고 마지막 폴 값을 전달 | PASS | `ctx.stop and ctx.configSource propagate into /api/status fields (STOP field + 설정 출처 field)` + `controlSnapshot()` 소스(L176-186) 실측 |
| [DERIVED] `stop` 이 있으면 STOP 필드에 반영, `configSource: 'file'` 이면 설정 출처 필드가 파일 | PASS | 위 동일 테스트(`stopField.value.includes('auto')`, `sourceField.value === '파일'`) |
| [DERIVED] 첫 폴 이전 기본값(`enabled: true`, `thresholds` 미지정, `stop: null`, `configSource: 'default'`) | PASS | `watch-loop.js` 모듈 변수 초기값(L36-43: `lastCfg = null`, `lastStop = null`, `lastConfigSource = 'default'`) + `controlSnapshot()` 의 `lastCfg ? ... : true`/`undefined` 폴백(L180-181) — `first poll before any success ...` 테스트로 행동 확인 |
| [DERIVED] `control.port`/`control.authToken` 은 기동 시 1회 확정, `enabled`/`thresholds` 는 폴마다 갱신 | PASS(코드 리뷰) | `startControlServer()` 호출은 `mainLoop()` 진입 시 1회(L196-209)뿐이고 `cfg0.control.port`/`authToken` 을 그 시점에만 읽음. `controlSnapshot()` 은 매 요청마다 `lastCfg`(폴마다 `pollOnce()` 가 갱신, L88-89)를 참조하므로 `enabled`/`thresholds` 는 요청마다 최신값 반영 |

### `config.js` env 우선순위 (Phase 2 잔여 항목의 자동화)
| 기준 | 결과 | 테스트 |
|---|---|---|
| [DERIVED] `BELLOWS_CONTROL_PORT`/`BELLOWS_CONTROL_TOKEN` 이 하드 기본값 덮어씀 — 자동 테스트로 확인(수동 `node -e` 의존 탈피) | PASS | `env: BELLOWS_CONTROL_PORT / BELLOWS_CONTROL_TOKEN override hard defaults; file values still win over env`(Phase 2 TEST_RESULT.md 에서 "수동 검증"이었던 항목이 이번 Phase 3 신규 테스트로 자동화됨) |
| [DERIVED] 파일의 `control.port`/`control.authToken` 이 존재하면 env 보다 우선 | PASS | 동일 테스트(`withTempConfig` 부분: `port: 6666, authToken: 'file-token'` 이 env 값을 덮음) |
| [DERIVED] 테스트가 `process.env` 를 변경 후 원상 복구 | PASS | 동일 테스트의 `finally` 블록(`savedPort`/`savedToken` 복원) |

### 🔒 불변 · 무회귀 보장
| 기준 | 결과 | 근거 |
|---|---|---|
| `deriveDesired()` 임계·히스테리시스, STOP.json 위치·이름·스키마, 수동 STOP 우선 규칙 무변경 | PASS | `watch-loop.js` L61-76(`deriveDesired`)·L130-133(수동 STOP skip 로직) — 003 이후 문자 그대로 동일 |
| `resolveStopDir()`·`readStopJson()`·`writeStopJsonAtomic()`·`isValidUsage()` 본문 무변경, 주입 불가 유지 | PASS | 각 함수 시그니처에 인자 없음(외부 주입 경로 없음), 소스 L12-25/50-59/78-85 확인 |
| `lib/observation.js`·`lib/scrape.js`·`lib/control-server.js`·`lib/config.js` 는 Phase 3 에서 미수정 | PASS | 이번 QA 라운드에서 해당 4개 파일에 어떤 Edit/Write 도 수행하지 않음(구현이 이미 계약을 만족한 상태로 발견) |
| 바인딩 `127.0.0.1` 고정, `watch-loop.js` 가 host 를 넘기지 않음 | PASS | `source has no 0.0.0.0 / :: literals and no host override option`(Phase 1) + `watch-loop.js` 의 `startControlServer()` 호출(L198-203)에 `port`·`authToken`·`getSnapshot`·`onLog` 만 전달, host 키 없음 |
| `POST /api/stop` 여전히 미구현, 배선으로도 미활성화 | PASS | `POST /api/stop with a valid token still does nothing (501, no STOP.json/deriveDesired path touched)`(Phase 2) |
| `watch-loop.js` 에 `claude` 문자열 매칭 0건 | PASS | `p-bellows/.js files do not reference the Claude CLI` |
| 의존성 무증가(`puppeteer` 만) | PASS | `no new runtime dependency: package.json dependencies is still puppeteer-only`(Phase 1) |
| `watch-loop.js` 는 Foreman 을 require 하지 않고 경로·포트를 하드코딩하지 않음 | PASS | `watch-loop.js` 소스에 `foreman` 문자열 0건(grep 확인) |
| Phase 1·2 기준 계속 만족(`id === 'quaestor'`, 인증 게이트, 비밀 미유출, `deriveState()` 무재판정) | PASS | Phase 1·2 테스트 전부 이번 실행에 포함되어 그린(회귀 없음) |
| `run-all.js` 가 기존 110개 포함 122개 전부 통과, 종료 코드 0 | PASS | 아래 실행 로그 |

### USER_GATE (사람 확인 항목 — hermetic QA 범위 밖, 자동 테스트로 대체 불가)
- `http://127.0.0.1:3210/api/status` 를 실제로 열어 현재 고장 상태가 `"state": "crit"` 으로 보이는지: **본 라운드에서 실행하지 않음**(Chrome·claude.ai 구동 환경 필요, hermetic 제약과 별개 항목). 코드 경로상 회로는 hermetic 테스트(`live closure ...`, `first poll before any success ...`)로 "측정 죽음 → non-ok" 성질이 이미 증명됨.
- `http://127.0.0.1:3210/api/health` 가 `crit` 상태에서도 `ok: true` 인지: 코드 경로상 보장(`/api/health` 는 `getSnapshot()` 을 아예 호출하지 않음, Phase 1 테스트로 hermetic 검증됨). 실제 기동 확인은 사람 몫.

## 전체 테스트 실행 결과

```
$ node p-bellows/test/run-all.js
[run-all] loading 4 test file(s): control-server.test.js, observation.test.js, scrape-classify.test.js, watch-loop.test.js
...
tests 122
suites 0
pass 122
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 228.3979

$ echo $?
0
```

## Phase 3 신규 테스트 목록 (12개: control-server.test.js 6 + watch-loop.test.js 6)

`control-server.test.js`:
1. live closure: reassigning the observation variable changes the next /api/status response (no capture-at-startup)
2. never-brick simulation: startup on an occupied port resolves started:false and the caller keeps running (no exception escapes)
3. first poll before any success: empty observation + unset ctx yields state !== ok (no green light before measurement)
4. ctx.stop and ctx.configSource propagate into /api/status fields (STOP field + 설정 출처 field)
5. env: BELLOWS_CONTROL_PORT / BELLOWS_CONTROL_TOKEN override hard defaults; file values still win over env

`watch-loop.test.js`:
6. C1: requiring watch-loop.js does not call startControlServer at module-load time
7. C1 (structural): startControlServer( call site is inside mainLoop(), not at module top level
8. C2 (structural): the startControlServer call is wrapped in try/catch, and the polling loop follows unconditionally
9. never-brick: startup failure is not swallowed silently -- "[control] listen failed" logging path exists
10. live observation source (C3, structural): getSnapshot is a function (controlSnapshot) whose body references the observation module variable
11. C3 (structural): controlSnapshot() body has no fs.* calls, no scrapeUsage, and no STOP_PATH reference
12. watch-loop.js does not re-judge thresholds when wiring control-server (no new 85/90/70/75 literals or state branches around the wiring)

(카운트 참고: 위 목록은 5+7=12개이며 `control-server.test.js` 쪽 5개 + `watch-loop.test.js` 쪽 7개로 합계 12개가 정확하다.)

## 발견·수정한 버그

없음. `watch-loop.js`·`test/control-server.test.js`·`test/watch-loop.test.js` 모두 Phase 3
구현이 이미 완료된 상태로 발견되었고, `output/ACCEPTANCE.md` 의 모든 [SPEC]/[DERIVED] 항목을
실포트 기반 통합 테스트 + 구조적 소스 검증 + 코드 리뷰로 대조한 결과 수정이 필요한 결함이 없었다.

## 이전 Phase(Phase 1·2) 통합 검증

Phase 1(25개)·Phase 2(27개) — 003 유래 테스트(observation.test.js 28개·scrape-classify.test.js
19개·watch-loop.test.js 003분 6개) 포함 총 110개가 이번 Phase 3 신규 12개와 같은 `run-all.js`
실행에서 함께 통과(122/122). `lib/observation.js`·`lib/scrape.js`·`lib/control-server.js`·
`lib/config.js` 는 이번 라운드에서 어떤 수정도 하지 않아 Phase 1·2 산출물이 그대로 보존됐다.
회귀 없음.

## How to Run

이 Phase 로 `watch-loop.js` 배선이 완료되어, 감시자를 실제로 띄우면 `/api/health`·`/api/status`
가 동작한다(다만 화면상 변화는 없다 — Foreman 클라이언트가 아직 미구현이라 이 NNN 의 정상적인
종료 상태다).

```bash
# 전체 테스트(hermetic, Chrome/claude.ai 불필요)
node p-bellows/test/run-all.js

# 실제로 감시자를 띄워 눈으로 확인하려면 (USER_GATE, Chrome 필요):
powershell -NoProfile -ExecutionPolicy Bypass -File ./run-bellows.ps1
# 별도 터미널에서:
#   curl http://127.0.0.1:3210/api/health
#   curl http://127.0.0.1:3210/api/status
# 🔒 지금 고장난 측정 상태에서는 /api/status 의 state 가 "crit" 이어야 정상이다.
```

⚠️ `npm` 사용 금지 — `node` 를 직접 호출할 것.
⚠️ `node watch-loop.js` 단독 실행 금지 — Chrome 이 `--remote-debugging-port=9222` 로 떠 있어야 한다.
