# TEST_RESULT — 004 Phase 4 (종단 통합 검증 · 계약 원문 대조)

검증일: 2026-08-19 · 대상: `p-bellows/test/control-server.test.js`(증분) · `CONTINUATION.md`(Synology)
기준: `output/ACCEPTANCE.md` (004 Phase 4) — 수정하지 않음(read-only 준수).

## 요약

- `node p-bellows/test/run-all.js` → **123개 테스트 전부 통과, 종료 코드 0**
  (Phase 1·2·3 누적 122개 + Phase 4 신규 1개 = 123개, 기존 테스트 완화·삭제 없음)
- `deploy-bellows.ps1 -DryRun` → **종료 코드 0**
- Phase 4 acceptance 항목 전부 **PASS**(USER_GATE 2건은 정의상 사람 몫 — 아래 참조).
- `lib/control-server.js`·`lib/config.js`·`lib/observation.js`·`lib/scrape.js`·`watch-loop.js` 는
  이번 QA 라운드에서 **어떤 수정도 하지 않았다** — Phase 4 는 검증·문서 Phase 이며(설계 §10-2),
  조립 경로 테스트(`control-server.test.js`)와 인수인계 문서(`CONTINUATION.md`·`PROJECT_INTENT.md`)가
  이미 계약을 만족한 상태로 발견되었다. 발견된 버그 없음.

## Phase 4 Acceptance 기준별 결과

### 조립 경로 종단 검증 (readConfig → startControlServer → 계약 주소)
| 기준 | 결과 | 테스트 / 근거 |
|---|---|---|
| 계약 기본 주소 `http://127.0.0.1:3210` — 설정 파일 부재 시 `readConfig()` 의 `control.port===3210`, 그 값으로 기동 성공 시 `port===3210`·`address==='127.0.0.1'` | PASS | `assembly path: readConfig() -> startControlServer() binds the contract default address (127.0.0.1:3210)` |
| 테스트에 넘기는 포트 값이 `readConfig()` 반환값에서 옴(3210 리터럴로 직접 띄우지 않음) | PASS | 소스 확인: `startControlServer({ port: cfg.control.port, ... })` — `3210` 리터럴은 `assert.strictEqual(cfg.control.port, 3210, '...')` 기대값 쪽에만 등장 |
| 기동 성공 시 `/api/health`(200·`id==='quaestor'`)·`/api/status`(200·`summary`/`state`/`fields`/`updatedAt` 존재)를 **계약 주소에서** 확인 | PASS | 동일 테스트 내 `getJson(3210, '/api/health')`·`getJson(3210, '/api/status')` |
| 계약 기본 포트 점유 시에도 예외 없이 `started:false`+비어있지 않은 `error` 로 resolve, 이후 테스트 코드 계속 실행 | PASS | 동일 테스트의 `else` 분기(`assert.strictEqual(typeof r.error, 'string')`, `assert.ok(r.error.length > 0)`) |
| 두 갈래(성공 시 계약 형식 왕복 / 실패 시 무예외 보고) 중 어느 쪽도 아닌 결과는 실패 판정 | PASS | if/else 이지선다 구조 — 그 외 경로(throw, `started` 부재, 포트·주소 불일치)는 assert 실패 또는 uncaught 로 테스트 자체가 실패하게 되어 있음 |
| `try/finally` 로 `close()` 보장 — 계약 포트를 붙잡은 채 종료하지 않음 | PASS | 소스: `try { ... } finally { await r.close(); }` |
| [DERIVED] `close()` 이후 같은 포트 재바인딩 가능(핸들 누수 배제) | PASS | `if (r.started) { const again = await startControlServer(...); assert.strictEqual(again.started, true, ...); await again.close(); }` |
| [DERIVED] 계약 기본 포트 테스트가 파일 내 마지막에 위치(임의 포트 테스트와 자원 미충돌) | PASS | 소스상 마지막 실포트 테스트. 뒤이은 `env: BELLOWS_CONTROL_PORT ...` 테스트는 포트를 열지 않는 순수 `readConfig()` 호출뿐 |

### 계약 원문 대조 · 인수인계 기록
| 기준 | 결과 | 근거 |
|---|---|---|
| 계약 §"도구 쪽 체크리스트" 전 항목 1:1 대조표(충족/의도적 미구현/대상 밖), 미판정 항목 없음 | PASS | `CONTINUATION.md` "계약 '도구 쪽 체크리스트' 대조표" — 8행 전부 판정됨(✅5·🔒1·⛔2) |
| `POST /api/stop` = 의도적 미구현으로 분류 + 근거("계약이 확인 없는 호출을 허용하므로 안전장치를 이 경로에 붙이지 않는다") 기록 | PASS | `CONTINUATION.md` 대조표 3행 + `PROJECT_INTENT.md` 전체 문서(별도 결정 문서) |
| 이탈점 두 곳 기록: `supervised[].id` = `"bellows"`(계약) vs `"quaestor"`(구현), `control.tokenFrom` = `control.authToken` 우선(최상위 `authToken` 폴백) | PASS | `CONTINUATION.md` "🔒 계약 문서와의 이탈점 — Foreman 쪽이 알아야 할 것" 표 |
| `_guides\SUPERVISED_TOOL_CONTRACT.md` 미수정(Foreman 소유 문서) | PASS | 이번 세션에서 Read 만 수행, Edit/Write 없음 |
| Foreman 저장소·`foreman-config.json` `supervised[]` 미수정(대상 밖 분류만) | PASS | 접근하지 않음. `CONTINUATION.md` 대조표에서 "⛔ 대상 밖" 으로 명시 |
| [DERIVED] 기록 위치 = Synology `CONTINUATION.md`, `baseUrl`·1회 확정·`deploy.json` 사람 몫 기재 | PASS | `CONTINUATION.md` 하단 "추가로 남길 것" 단락 |

### 계약 §"부재 규칙" 중 이 제품이 지는 몫
| 기준 | 결과 | 근거 |
|---|---|---|
| 모든 응답 경로(200/401/404/405/500/501)가 항상 파싱 가능한 JSON | PASS | Phase 2 `secrets never leak: 200/401/404/405/501/500 bodies never contain the token, .profile, cookie, or the raw Authorization header` 재통과(무회귀) — 6개 상태 코드 모두 `JSON.parse()` 성공을 전제로 검증됨 |
| 컨트롤 서버가 아예 뜨지 못한 상태에서도 감시 루프는 계속 돈다(Phase 3 never-brick 무회귀) | PASS | `C2 (structural)`·`never-brick: startup failure is not swallowed silently ...`·`never-brick simulation: ...` 재통과 |

### 🔒 무회귀 · 경계 (검증 Phase 의 자기 구속)
| 기준 | 결과 | 근거 |
|---|---|---|
| `lib/control-server.js`·`lib/config.js`·`lib/observation.js`·`lib/scrape.js`·`watch-loop.js` 이 Phase 미수정 | PASS | `git status --porcelain` 확인 — 5개 파일 dirty 아님(이번 세션에서 Edit/Write 미수행) |
| `run-bellows.ps1`·`deploy-bellows.ps1`·`deploy.json` 미수정(범위 밖) | PASS | 동일 |
| `deriveDesired()` 임계·히스테리시스, STOP.json 위치·이름·스키마, 수동 STOP 우선 규칙 무변경 | PASS | 소스 미수정 + `watch-loop.test.js` 기존 테스트 재통과 |
| `watch-loop.js` 를 자식 프로세스로 띄우는 통합 테스트를 만들지 않음 | PASS | 코드 검토 — `child_process`/`spawn` 미사용, `pollOnce()` 미구동(설계 §10-3(c) 원칙 유지) |
| Phase 1·2·3 모든 기준이 계속 만족되며 순증분(삭제·완화 없음) | PASS | 전체 스위트 123/123 pass — 기존 122개 테스트명 그대로 존재 |
| `node p-bellows/test/run-all.js` 가 기존 122개를 포함해 전부 통과, 종료 코드 0, 매달림 없음 | PASS | 아래 "전체 테스트 실행 결과" 참조 |
| 의존성 불변(`puppeteer` 단일), 새 테스트는 내장 `node:test`/`node:assert`/`fetch` 만 사용 | PASS | `Object.keys(package.json.dependencies) === ['puppeteer']`, 신규 테스트 소스에 외부 require 없음 |
| `p-bellows` 의 `.js` 파일에 `claude` 매칭 0건(도메인 URL 상수 예외) | PASS | grep 결과 — 전부 `claude.ai` 도메인 상수/테스트 픽스처, CLI 참조 없음 |
| [DERIVED] `deploy-bellows.ps1 -DryRun` 종료 코드 0(PS 5.1 파싱 0 errors) | PASS | 아래 "deploy-bellows.ps1 실행 결과" 참조 |

### USER_GATE (사람 확인 — 자동 테스트로 대체 불가, Phase 3 기준의 재확인)
| 기준 | 결과 |
|---|---|
| 실제 감시자 기동 후 `http://127.0.0.1:3210/api/status` 가 `"state":"crit"` | ⏸ **미확인(사람 몫)** — 정의상 자동 QA 범위 밖(Chrome·claude.ai 구동 환경 필요). 동일 회로 성질은 hermetic 테스트(`assembly path: ...`·`live closure ...`·`first poll before any success ...`)가 이미 행동으로 증명함 |
| 같은 주소의 `/api/health` 가 `{"ok":true,"id":"quaestor",...}`(`/api/status` 가 crit 이어도) | ⏸ **미확인(사람 몫)** — `/api/health` 가 `getSnapshot()` 을 호출하지 않는 성질은 Phase 1 테스트(`GET /api/health -- ... does not touch getSnapshot`)로 hermetic 검증됨. 실기동 확인은 사람 몫 |

두 USER_GATE 항목은 설계·수용 기준이 명시적으로 "자동 테스트로 대체 불가" 로 규정한다.
QA 자동화가 대신 증명한 것은 "코드 경로가 그 성질을 갖고 있다"이고, 사람이 확인할 것은
"이 기계의 지금 이 순간 실제 값" 이다 — 둘은 다른 질문이라 자동화로 후자를 대신할 수 없다.

## 전체 테스트 실행 결과

```
$ node p-bellows/test/run-all.js
[run-all] loading 4 test file(s): control-server.test.js, observation.test.js, scrape-classify.test.js, watch-loop.test.js
...
tests 123
suites 0
pass 123
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 210.3732

$ echo $?
0
```

## deploy-bellows.ps1 실행 결과

```
$ powershell -NoProfile -ExecutionPolicy Bypass -File ./deploy-bellows.ps1 -DryRun
Deploy Bellows
  Source: F:\SynologyDrive\Obsidian\Automatic\1. Project\products\Bellows
  Dest:   F:\Workspace\Automatic\projects\Bellows
  (dry run)
...
Deploy Bellows complete.

$ echo $?
0
```

## Phase 4 신규 테스트 (1개)

`control-server.test.js`:
1. `assembly path: readConfig() -> startControlServer() binds the contract default address (127.0.0.1:3210)`

(참고: `env: BELLOWS_CONTROL_PORT / BELLOWS_CONTROL_TOKEN override hard defaults; file values still win over env`
는 Phase 3 산출물이며 이번 Phase 에서 재작성하지 않았다 — 파일 내 위치상 assembly path 테스트
뒤에 있으나 신규 테스트가 아니다. 122 → 123 증가분은 assembly path 테스트 1개뿐이다.)

## 발견·수정한 버그

없음. `control-server.test.js`(Phase 4 증분)·`CONTINUATION.md`·`PROJECT_INTENT.md` 모두 이미
Phase 4 계약을 만족한 상태로 발견되었고, `output/ACCEPTANCE.md` 의 모든 [SPEC]/[DERIVED] 항목을
실포트 통합 테스트 + 문서 대조 + 코드 리뷰(`git status`)로 확인한 결과 수정이 필요한 결함이 없었다.

## 이전 Phase(1·2·3) 통합 검증

Phase 1(25개)·Phase 2(27개)·Phase 3(12개) — 003 유래 테스트(`observation.test.js` 28개·
`scrape-classify.test.js` 19개·`watch-loop.test.js` 003분 6개) 포함 총 122개가 이번 Phase 4
신규 1개와 같은 `run-all.js` 실행에서 함께 통과(123/123). `lib/control-server.js`·`lib/config.js`·
`lib/observation.js`·`lib/scrape.js`·`watch-loop.js` 는 이번 라운드에서 어떤 수정도 하지 않아
Phase 1·2·3 산출물이 그대로 보존됐다. 회귀 없음.

## How to Run

이 Phase 는 검증·문서 Phase 라 동작에 변화가 없다. `run-bellows.ps1` 로 감시자를 띄우면
`/api/health`·`/api/status` 가 계약이 지정한 `http://127.0.0.1:3210` 에서 동작한다(화면상
변화는 여전히 없다 — Foreman 클라이언트가 아직 미구현이라 이 NNN 의 정상적인 종료 상태다).

```bash
# 전체 테스트(hermetic, Chrome/claude.ai 불필요)
node p-bellows/test/run-all.js

# 배포 드라이런
powershell -NoProfile -ExecutionPolicy Bypass -File ./deploy-bellows.ps1 -DryRun

# 실제로 감시자를 띄워 눈으로 확인하려면 (USER_GATE, Chrome 필요):
powershell -NoProfile -ExecutionPolicy Bypass -File ./run-bellows.ps1
# 별도 터미널에서:
#   curl http://127.0.0.1:3210/api/health
#   curl http://127.0.0.1:3210/api/status
# 🔒 지금 고장난 측정 상태에서는 /api/status 의 state 가 "crit" 이어야 정상이다.
```

⚠️ `npm` 사용 금지 — `node` 를 직접 호출할 것.
⚠️ `node watch-loop.js` 단독 실행 금지 — Chrome 이 `--remote-debugging-port=9222` 로 떠 있어야 한다.
