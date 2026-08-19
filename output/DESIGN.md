# DESIGN — 003 관측 상태 추적과 실패 분류

> 제품: **Quaestor** (폴더·저장소 이름은 아직 `Bellows`). 코드가 새로 내는 식별자 `id` 는 `quaestor`.
> 이 NNN 은 **ADDITIVE · never-brick** 이다. STOP.json 의 위치·이름·스키마,
> `deriveDesired()` 의 임계 판정과 히스테리시스, 수동 STOP 우선 규칙은 **건드리지 않는다.**

---

## 1. 문제 정의 (설계의 출발점)

이 감시자는 2026-07-28 11:58 이후 3주간 한 번도 측정에 성공하지 못했다.
프로세스는 15분마다 정상적으로 돌았고, 실패는 `bellows.log` 에만 3,658 건 쌓였다.

두 가지 결함이 겹쳐 있다.

| 결함 | 증상 | 이 NNN 의 대응 |
|---|---|---|
| **가시성 없음** | "돌고 있다"와 "작동한다"가 다른데 그 차이를 볼 수 없다 | 관측 이력을 구조체로 들고 `state` 로 판정 (Phase 1) |
| **원인 미분류** | `Waiting failed: 20000ms exceeded` 한 줄이 최소 2가지 원인에서 나온다 | 실패에 `kind` 태그 + `hint` 진단 (Phase 2) |

🔒 **이 설계 전체를 관통하는 조항: 측정이 죽어 있는데 `ok` 로 보이면 실패다.**
판정 근거는 프로세스 생존이 아니라 **측정의 신선도**다.

---

## 2. 전체 아키텍처

```
                        [ 순수 영역 · I/O 없음 · 테스트 가능 ]
                        ┌──────────────────────────────────┐
                        │  lib/observation.js              │
                        │    createObservation()           │
                        │    recordSuccess(obs,usage,now)  │
                        │    recordFailure(obs,k,d,now)    │
                        │    deriveState(obs,ctx,now)      │
                        └──────────────────────────────────┘
                              ▲ 기록            │ 판정
                              │                 ▼
  claude.ai/settings/usage    │        { state, summary, fields }
        │                     │                 │
        │ puppeteer           │                 └──▶ (004) /api/status
        ▼                     │
  lib/scrape.js ──성공: usage─┤
    err.kind 부착             │
    anchor-timeout 진단       │
        │                     │
        └──실패: err{kind,detail{hint}}
                              │
                        watch-loop.js  ── 기존 경로 (불변) ──▶ deriveDesired()
                          pollOnce()                              │
                          require.main 가드                       ▼
                                                        .prominence\STOP.json
```

**두 갈래는 서로 간섭하지 않는다.**
왼쪽(차단기: `deriveDesired` → STOP.json)은 기존 그대로 흐르고,
오른쪽(계기판: `deriveState` → state/fields)이 그 옆에 새로 붙는다.

⚠️ `deriveDesired()`(STOP 여부, 기존)와 `deriveState()`(화면 표시, 신규)는 **다른 함수다.**
전자는 차단기, 후자는 계기판. 합치지 않는다.

---

## 3. 디렉터리 구조

```
p-bellows/
├─ package.json
├─ watch-loop.js          [수정] 관측 배선 + require.main 가드
├─ watch-once.js          (변경 없음)
├─ lib/
│   ├─ config.js          (변경 없음 — readConfig 재구현 금지)
│   ├─ extract.js         (변경 없음 — 이 NNN 은 앵커를 고치지 않는다)
│   ├─ scrape.js          [수정] err.kind + anchor-timeout 진단
│   └─ observation.js     [신규] 순수 모듈 · Phase 1
└─ test/                  [신규]
    ├─ run-all.js         하네스 · 실패 시 비-0 종료
    ├─ observation.test.js   Phase 1
    ├─ scrape-classify.test.js  Phase 2
    └─ boot.test.js          Phase 3 (경계를 건너는 검증)
```

런타임 산출물은 저장소 밖 그대로 유지한다 —
`<Drive>:\SynologyDrive\Obsidian\Automatic\.prominence\{STOP.json, bellows.log, bellows-config.json}`.

---

## 4. 기술 결정과 근거

| # | 결정 | 근거 |
|---|---|---|
| D1 | `observation.js` 는 **I/O·부작용 0, `Date.now()` 호출 0**. 시각은 인자 `now`(epoch ms)로 주입 | 3주 침묵을 잡으려면 판정 로직이 Chrome·네트워크 없이 hermetic 하게 검증돼야 한다 |
| D2 | `record*` 는 입력을 **변형하지 않고 새 객체를 반환**한다 | 순수성이 모듈 전체에 일관되게 적용되어 테스트에서 이전 상태와 비교 가능 |
| D3 | 절대 시각 표기는 **`toISOString()` 기반 UTC** | 로컬 타임존 포맷팅은 환경 의존 → "같은 입력 → 같은 출력"이 깨진다 |
| D4 | `fields` 에는 **숫자·분류 태그·설정값만** 싣는다. 스크레이핑 원문 문자열(리셋 문구, 페이지 텍스트 200자)은 싣지 않는다 | Foreman 이 값을 그대로 화면에 그린다. 원문에 계정 이메일이 섞일 수 있다 |
| D5 | `detail`(원문 200자)은 **관측 구조체에는 보관하되 `deriveState` 결과에는 절대 나가지 않는다.** 로그로만 흐른다 | 진단은 필요하고 노출은 위험하다 — 경로를 분리한다 |
| D6 | `deriveState` 의 2번째 인자는 `thresholds` 가 아니라 **컨텍스트 객체 `ctx`** | `fields` 가 요구하는 STOP 상태·enabled·설정 출처는 thresholds 에 없다. 이 세 값을 순수 함수 안에서 읽으면 I/O 가 되므로 주입한다 |
| D7 | 의존성 추가 없음. 테스트는 `node:test` + `node:assert` | 제약 조항. 현재 의존성은 puppeteer 하나뿐 |
| D8 | `run-all.js` 는 테스트 파일을 **`require` 로 로드**한다 (spawn·`--test` 플래그 아님) | Node 버전별 CLI 플래그 차이를 타지 않는다. `node:test` 가 실패 시 `process.exitCode` 를 알아서 1로 세운다 |
| D9 | 설정 출처(`파일`/`기본값`) 는 **watch-loop 이 계산**해 `ctx` 로 넘긴다. `config.js` 는 손대지 않는다 | 재구현 금지 조항 준수 + 파싱 실패·만료 시 실효값이 기본값이라는 사실을 호출부가 안다 |
| D10 | 새 `.js` 어디에도 `claude` 문자열을 넣지 않는다 (도메인 URL 예외) | 제약: `claude` grep 매칭 0건. 감시자가 토큰을 쓰면 감시 대상이 된다 |
| D11 | 테스트 하네스를 **Phase 1 에 포함** | MASTER 의 Work Verify(`node p-bellows/test/run-all.js`)가 Phase 1 완료 시점부터 성립해야 한다 |

---

## 5. 데이터 흐름

### 5.1 성공 주기

```
pollOnce()
  cfg = readConfig(CONFIG_PATH)          (기존)
  usage = await scrapeUsage(...)         (기존)
  isValidUsage(usage) === true           (기존)
  obs = recordSuccess(obs, usage, Date.now())        ← 신규
  ── 이하 기존 경로 그대로 ──
  deriveDesired(usage, cfg.thresholds) → STOP.json 쓰기/지우기
```

### 5.2 실패 주기

```
pollOnce()
  scrapeUsage() throws err { kind, detail }          ← Phase 2
  log('[poll error] kind=anchor-timeout hint=login-expired ...')   ← kind·hint 를 로그에
  obs = recordFailure(obs, err.kind, err.detail, Date.now())        ← 신규
  return   (STOP.json 은 손대지 않는다 — 기존 동작 불변)
```

🔒 측정 실패 시 STOP.json 을 자동으로 쓰거나 지우지 **않는다.** 기존 동작이며 이 NNN 은 유지한다.

### 5.3 판정 흐름

```
obs (누적 이력) ─┐
ctx              ├─▶ deriveState(obs, ctx, now) ─▶ { state, summary, fields }
now              ┘                                        │
                                                          └─▶ (004) GET /api/status
```

---

## 6. Phase 분할

| Phase | 내용 | 의존 |
|---|---|---|
| **1** | `lib/observation.js` 순수 모듈 + `test/run-all.js` 하네스 + `observation.test.js` | 없음 (hermetic) |
| **2** | `lib/scrape.js` 실패 분류(`err.kind`) + `anchor-timeout` 진단(`hint`) + 가짜 page 주입 테스트 | Phase 1 의 kind 어휘 |
| **3** | `watch-loop.js` 배선 + `require.main` 가드 + 모듈 로드 경계 검증 | Phase 1·2 |

의존도가 낮은 순수 모듈부터 시작해, 부작용이 있는 배선을 마지막에 둔다.

---

# Phase 1 상세 설계 — `lib/observation.js` + 테스트 하네스

## P1.1 관측 구조체

```js
createObservation()
// →
{
  lastSuccessAt:       null,   // number (epoch ms) | null.  null = 한 번도 성공 없음
  lastUsage:           null,   // { session_pct, weekly_pct, session_reset, weekly_reset } | null
  consecutiveFailures: 0,      // 연속 실패. 성공 시 0 으로 리셋
  lastFailure:         null,   // { kind, detail, at } | null
  totalPolls:          0,      // 누적 시도
  totalFailures:       0       // 누적 실패
}
```

### `recordSuccess(obs, usage, now) → newObs`

| 필드 | 변화 |
|---|---|
| `lastSuccessAt` | `now` |
| `lastUsage` | `usage` 에서 `session_pct`·`weekly_pct`·`session_reset`·`weekly_reset` 만 복사 |
| `consecutiveFailures` | **0** |
| `totalPolls` | +1 |
| `totalFailures` | 변화 없음 |
| `lastFailure` | **유지** (과거 실패 이력은 지우지 않는다 — 사람이 직전 원인을 되짚을 수 있어야 한다) |

입력 `obs` 는 변형하지 않는다.

### `recordFailure(obs, kind, detail, now) → newObs`

| 필드 | 변화 |
|---|---|
| `consecutiveFailures` | +1 |
| `totalPolls` | +1 |
| `totalFailures` | +1 |
| `lastFailure` | `{ kind, detail, at: now }` |
| `lastSuccessAt`·`lastUsage` | **유지** (마지막 성공 시각은 실패로 지워지지 않는다) |

`kind` 가 falsy 하면 `'unknown'` 으로 정규화한다. 🔒 추측해서 다른 값을 넣지 않는다.

### `kind` 어휘 (Phase 2 에서 `scrape.js` 가 실제로 붙인다)

`chrome-unreachable` · `anchor-timeout` · `invalid-extraction` · `nav-failed` · `unknown`

## P1.2 `deriveState(obs, ctx, now)`

### 시그니처

```js
deriveState(obs, ctx, now) → { state, summary, fields }

ctx = {
  enabled:       boolean,        // cfg.enabled
  thresholds:    { weekly_stop, weekly_release, session_stop, session_release },
  stop:          null | { source: 'auto'|'manual', reason: string },  // STOP.json 요약
  configSource:  'file' | 'default'
}
```

🔒 **[SPEC] 순수 함수다.** `Date.now()`·`fs`·`process` 를 읽지 않는다. 시각은 `now` 만 쓴다.
`ctx` 의 필드가 없으면 안전한 기본값(`enabled=true`, `stop=null`, `configSource='default'`,
`thresholds` = `config.js` 의 `HARD_DEFAULTS.thresholds`)으로 취급하고 던지지 않는다.

### 경계 상수 — [DERIVED] (폴링 주기 15분 기준)

```js
STALE_WARN_MS = 45 * 60 * 1000    // 3주기
STALE_CRIT_MS = 120 * 60 * 1000   // 2시간
FAIL_CRIT_COUNT = 4               // 연속 실패
NEAR_RATIO = 0.9                  // stop 선의 90% 이상이면 임계 접근
```

### 판정 규칙 — 위에서부터 첫 일치 (first-match-wins)

| # | 조건 | state | summary 예 |
|---|---|---|---|
| R1 | `ctx.enabled === false` | `idle` | `감시 꺼짐` |
| R2 | `consecutiveFailures >= 4` | `crit` | `측정 실패 12회 연속 · 마지막 성공 3일 전` |
| R3 | `lastSuccessAt !== null` 이고 `now - lastSuccessAt > 2시간` | `crit` | `측정이 멈춤 · 마지막 성공 3일 전` |
| R4 | `lastSuccessAt === null` | `warn` | `첫 측정 대기 중` |
| R5 | `now - lastSuccessAt > 45분` | `warn` | `측정이 밀림 · 마지막 성공 1시간 전` |
| R6 | 신선함 + (`weekly_pct >= 0.9*weekly_stop` 또는 `session_pct >= 0.9*session_stop`) | `warn` | `감시 중 · 주간 79%` |
| R7 | 신선함 + 여유 | `ok` | `감시 중 · 주간 24%` |

🔒 **[SPEC] `ok` 는 R7 에서만 나온다.** 측정 실패 중이거나 이력이 없으면 `ok` 가 될 수 없다.
🔒 **[SPEC] 정보 부재를 성공으로 승격시키지 않는다** — R4 가 `warn` 인 이유다.

**R2 를 R4 보다 위에 두는 이유** — 한 번도 성공하지 못한 채 4회 이상 연속 실패한 상태는
"첫 측정 대기 중"(warn)이 아니라 **고장(crit)** 이다. 이것이 정확히 지난 3주의 상태였다.
성공 이력이 없으면 summary 는 `... · 성공 이력 없음` 으로 적는다.

**`state` 열거값** — `ok` | `warn` | `crit` | `idle` (계약 문서 그대로. 그 외 값은 Foreman 이 idle 취급).

### `summary` 구성 규칙

- 실패/지연 계열(R2·R3·R5)은 `측정 실패 N회 연속` 또는 `측정이 밀림` 뒤에
  ` · 마지막 성공 <상대시각>` 을 붙인다. `lastFailure.detail.hint` 가 있으면 ` · <hint>` 를 덧붙인다.
- 정상 계열(R6·R7)은 `감시 중 · 주간 N%` 로 적고, 세션이 더 높으면 `감시 중 · 세션 N%` 로 적는다.
- 🔒 summary 에도 원문 텍스트·이메일·경로를 넣지 않는다. `hint` 는 고정 어휘라 안전하다.

### 상대 시각 포맷 — [DERIVED] · 순수

`now - t` 기준: `< 60초` → `방금`, `< 60분` → `N분 전`, `< 24시간` → `N시간 전`, 그 외 → `N일 전`.
모두 내림(`Math.floor`). `t === null` → `없음`.

절대 시각: `new Date(t).toISOString().replace('T',' ').slice(0,19) + ' UTC'` (D3).

## P1.3 `fields` 구성

계약의 `fields[]` 형식 그대로 — `{ label, value }` 또는 `{ label, value, state }`.
Foreman 은 해석하지 않고 **순서대로 그린다.**

| # | label | value 예 | state |
|---|---|---|---|
| 1 | `마지막 성공 측정` | `2026-07-28 02:58:11 UTC (22일 전)` / `없음` | 신선 `ok` · 45분 초과 `warn` · 2시간 초과·없음 `crit` |
| 2 | `세션 사용량` | `37%` / `—` | stop 선 이상 `crit` · 90% 이상 `warn` · 그 외 없음 |
| 3 | `주간 사용량` | `24%` / `—` | 위와 동일 |
| 4 | `연속 실패` | `0회` / `3658회` | `>=4` → `crit`, `1~3` → `warn`, `0` → 없음 |
| 5 | `마지막 실패` | `anchor-timeout · login-expired` / `없음` | 없음 |
| 6 | `STOP` | `없음` / `auto · weekly_threshold` / `manual · <reason>` | `manual`·`auto` → `warn` |
| 7 | `임계값` | `주간 85/70 · 세션 90/75` (stop/release) | 없음 |
| 8 | `설정 출처` | `파일` / `기본값` | 없음 |

### 🔒 [SPEC] 담지 않는 것

`.profile` 경로 · 쿠키 · 계정/이메일 · Chrome 디버그 URL(`127.0.0.1:9222`) · `authToken` 값 ·
`lastFailure.detail` 의 페이지 원문 200자 · 스크레이핑한 리셋 문구 원문.

**5번 필드가 싣는 것은 `kind` 와 `hint` 뿐이다.** 둘 다 고정 어휘(closed vocabulary)라
자유 텍스트가 섞일 여지가 없다 — 이것이 유출 방지의 구조적 근거다.

`detail` 을 통째로 넣고 정규식으로 지우는 방식은 **쓰지 않는다.** 화이트리스트가 블랙리스트보다 안전하다.

## P1.4 테스트 하네스 `test/run-all.js`

```
node p-bellows/test/run-all.js      # 저장소 루트에서 실행 (MASTER 의 Work Verify)
```

- `__dirname` 기준으로 `*.test.js` 를 읽어 **이름 오름차순**으로 `require` 한다
  (경로는 실행 위치에 의존하지 않는다).
- `node:test` 가 실패를 감지하면 `process.exitCode` 를 1 로 세운다 — 🔒 **비-0 종료.**
- `require` 자체가 던지면(문법 오류·모듈 로드 실패) 잡아서 출력하고 `process.exitCode = 1`.
  🔒 이 경로가 "단위테스트는 다 통과하는데 실제로는 로드조차 안 되던" 결함 계열을 잡는다.
- 테스트 파일이 0개면 실패로 취급한다(비-0). 하네스가 조용히 성공하는 것을 막는다.
- ⚠️ `npm` 을 쓰지 않는다. `node` 를 직접 부른다.

### `observation.test.js` 가 덮는 것 (Phase 1)

순수성 · 정보 부재 비승격 · 연속 실패 리셋 · crit 판정 · 비밀 미유출 문자열 검사 ·
입력 불변성 · `ctx` 결손 시 무예외.

## P1.5 Phase 1 이 건드리지 않는 것

- `watch-loop.js` — Phase 3
- `lib/scrape.js` — Phase 2
- `lib/config.js` · `lib/extract.js` · `watch-once.js` · `run-bellows.ps1` · `deploy-bellows.ps1`
- 🔒 STOP.json 스키마·경로 · `deriveDesired()` · `isValidUsage()` · `writeStopJsonAtomic()` ·
  `readConfig()` · `resolveStopDir()`
- HTTP 노출 (`/api/health`·`/api/status`) → **004**
- 로케일 독립 앵커 전환 → 별도 NNN (이 NNN 은 **구분**까지만)

---

# Phase 2 상세 설계 — `lib/scrape.js` 실패 분류와 진단 (CURRENT)

## P2.0 이 Phase 가 없애는 것

지금 로그에 남는 유일한 단서는 이것뿐이다.

```
[poll error] scrape failed: Waiting failed: 20000ms exceeded
```

이 한 줄은 **최소 두 가지 원인**에서 똑같이 나온다 — 로그인 세션 만료 / UI 문구·로케일 변경.
🔒 **둘을 못 가르면 사람이 재로그인하러 갔다가 헛걸음한다.** 이 Phase 는 그 갈림길만 만든다.
**고치지 않는다 — 구분까지만 한다.** 재로그인은 사람의 일, 앵커 수리는 별도 NNN 이다.

## P2.1 현재 `scrapeUsage()` 의 실패 지점 (실측)

| # | 지점 | 지금 던지는 것 | 이 Phase 가 붙일 `kind` |
|---|---|---|---|
| F1 | `puppeteer.connect()` | 감싼 새 `Error` (메시지에 debugUrl 포함) | `chrome-unreachable` |
| F2 | `browser.newPage()` | 원본 오류 그대로 | `chrome-unreachable` |
| F3 | `page.goto(...)` | 원본 오류 그대로 (구분 없음) | `nav-failed` |
| F4 | `page.waitForFunction(...)` | `Waiting failed: 20000ms exceeded` | **`anchor-timeout`** ← 3주째 이것 |
| F5 | `page.evaluate(extractUsage)` | 원본 오류 그대로 | `invalid-extraction` |

⚠️ 표의 `invalid-extraction`(F5, 추출 함수 자체가 던짐)과
`watch-loop.js` 의 `isValidUsage()` 실패(추출은 됐는데 값이 이상함)는 **같은 `kind` 어휘를 공유**한다.
후자의 배선은 Phase 3 이다 — 이 Phase 는 `scrape.js` 안쪽만 담당한다.

## P2.2 오류 태깅 규약

```js
err.kind   = 'anchor-timeout'                    // 고정 어휘 5종 중 하나
err.detail = { url, textHead, hint }             // anchor-timeout 일 때만. 그 외에는 null 또는 미부착
throw err                                        // 🔒 원본 오류 객체를 그대로 다시 던진다
```

🔒 **[SPEC] 원본 오류를 새 `Error` 로 갈아끼우지 않는다.** 기존 필드(`message`·`stack`)를 보존한 채
속성만 얹는다. `e.message` 에 의존하는 기존 호출부(`watch-once.js`, `watch-loop.js` 의 로그)가
**한 글자도 바뀌지 않아야 한다** — never-brick.

- F1 만 예외적으로 기존 코드가 이미 새 `Error` 를 만든다. 🔒 **그 메시지 문구는 변경하지 않고**
  `kind` 속성만 얹는다 (사람이 3주간 봐 온 문구를 흔들지 않는다).
- `kind` 를 정할 수 없는 경로가 있으면 `'unknown'` 이다. 🔒 추측해서 다른 값을 쓰지 않는다.
- `scrapeUsage()` 의 **시그니처·성공 반환값은 변경 없음.**

## P2.3 신규 export — 순수/주입 가능 단위

Chrome 없이 검증하려면 진단 로직이 puppeteer 뒤에 숨으면 안 된다. 세 조각으로 가른다.

```js
hintFrom({ url, textHead })      // 순수. I/O 0. → 'login-expired' | 'anchor-missing' | 'unknown'
collectDiagnostics(page)         // async. 주입된 page 만 만짐. 🔒 절대 던지지 않는다.
                                 //   → { url, textHead, hint }
scrapeUsage(profileDir, opts)    // 기존. 위 둘을 F4 catch 안에서 호출
FAILURE_KINDS, HINTS             // 고정 어휘 상수 (Phase 1·3 이 참조)
```

### `hintFrom(diag)` 판정 — first-match-wins

| # | 조건 | hint | 사람이 할 일 |
|---|---|---|---|
| H1 | `url` 이 문자열이 아니거나 빈 문자열 | `unknown` | 판단 보류 |
| H2 | `url` 이 로그인 경로 접두사로 시작 | `login-expired` | **재로그인** |
| H3 | `url` 이 대상 오리진으로 시작 + `textHead` 가 비어 있지 않은 문자열 | `anchor-missing` | **앵커 수리** (별도 NNN) |
| H4 | 그 외 전부 (타 도메인 리다이렉트 · 본문 비어 있음 · 수집 실패) | `unknown` | 판단 보류 |

🔒 **[SPEC] H4 가 기본값이다.** 근거가 없으면 `unknown` 이며, `login-expired` 쪽으로 기울지 않는다.
**잘못된 확신이 사람을 헛걸음시킨 것이 이 NNN 의 출발점이다.**

**H3 가 오리진을 요구하는 이유** — SSO·점검 페이지 등 **제3 도메인으로 튄 경우**는
로그인 화면도 아니고 대상 페이지도 아니다. 여기서 `anchor-missing` 이라고 말하면
멀쩡한 앵커를 뜯으러 보내게 된다. 판정 불가는 판정 불가로 남긴다(H4).

**H1·H4 가 본문 유무를 따지는 이유** — 본문이 비었다는 것은 렌더가 안 됐다는 뜻이지
앵커가 없어졌다는 뜻이 아니다.

### 상수 — [DERIVED]

```js
TEXT_HEAD_LEN = 200          // 🔒 [SPEC] 작업지시서가 지정한 앞 200자
ORIGIN        = '<대상 사이트 오리진>'
LOGIN_PREFIX  = ORIGIN + '/login'
USAGE_URL     = ORIGIN + '/settings/usage'      // 기존 리터럴을 상수로 승격
HINTS         = ['login-expired', 'anchor-missing', 'unknown']       // Phase 1 KNOWN_HINTS 와 동일
FAILURE_KINDS = ['chrome-unreachable', 'anchor-timeout', 'invalid-extraction', 'nav-failed', 'unknown']
```

🔒 도메인 문자열은 **기존에 이미 있던 URL 한 곳을 상수로 올릴 뿐** 새로 늘리지 않는다
(제약: `.js` 의 `claude` grep 0건, 도메인 URL 만 예외).
URL 매칭은 `indexOf(prefix) === 0` 접두사 비교로 한다 — `URL` 파서를 쓰면 잘못된 문자열에서 던진다.

### `collectDiagnostics(page)` — 🔒 절대 던지지 않는다

```
url      = try { page.url() }                        catch → null
textHead = try { await page.evaluate(<본문 텍스트>) } catch → null
           문자열이면 Node 쪽에서 TEXT_HEAD_LEN 으로 자른다 (자르는 곳은 한 군데)
hint     = hintFrom({ url, textHead })
→ { url, textHead, hint }
```

🔒 **[SPEC] 진단 수집의 실패가 원래 오류를 삼키면 안 된다.** `page.url()` 이 던지든
`evaluate` 가 타임아웃 나든, 결과는 `hint: 'unknown'` 인 진단이지 **새로운 예외가 아니다.**
"왜 실패했는지 알아보다가 왜 실패했는지도 잃는" 것이 이 Phase 의 최악의 결과다.

**page 객체 계약(테스트 주입용)** — `collectDiagnostics` 가 만지는 것은 `url()` 과 `evaluate(fn)` 둘뿐이다.
따라서 아래 형태의 가짜 객체로 Chrome 없이 전 경로를 돈다.

```js
{ url: () => '<로그인 경로 URL>', evaluate: async () => '로그인 화면 본문...' }
```

**본문 절단을 Node 쪽에서 하는 이유** — 페이지 콜백 안에서 자르면 가짜 page 는 그 콜백을
실행하지 않으므로 200자 상한이 검증되지 않는다. 자르는 지점이 하나여야 상한이 보장된다.

## P2.4 `scrapeUsage()` 제어 흐름

```
connect ──실패─▶ (기존 메시지 그대로) err.kind='chrome-unreachable' ─▶ throw
   │
   ▼
newPage ──실패─▶ err.kind='chrome-unreachable' ─▶ throw
   │
   ▼
goto ─────실패─▶ err.kind='nav-failed'         ─▶ throw
   │
   ▼
waitForFunction ──실패─▶ err.kind='anchor-timeout'
   │                     err.detail = await collectDiagnostics(page)   ← 🔒 page 가 살아 있을 때
   │                     ─▶ throw
   ▼
evaluate ─실패─▶ err.kind='invalid-extraction'  ─▶ throw
   │
   ▼
 usage 반환 (기존과 동일)
        │
        └─▶ finally: page.close() · browser.disconnect()   (기존 그대로 · browser 는 닫지 않는다)
```

🔒 **진단 수집은 `finally` 보다 먼저, F4 의 catch 안에서 일어난다.**
`finally` 가 `page.close()` 를 하고 나면 `page.url()` 도 `evaluate` 도 읽을 것이 없다.
이 순서가 이 Phase 의 유일한 타이밍 제약이다.

`waitForFunction` 이 내는 오류는 **타임아웃 여부를 따지지 않고 전부 `anchor-timeout`** 으로 본다 [DERIVED] —
그 지점에서 실패했다는 사실 자체가 "앵커에 도달하지 못했다"이고, 사람이 할 일도 같다.

## P2.5 puppeteer 지연 로드 — [DERIVED] D12

현재 `lib/scrape.js` 는 파일 최상단에서 `require('puppeteer')` 한다.
그러면 `scrape-classify.test.js` 가 순수 함수 하나를 부르려고 브라우저 드라이버 전체를 끌어온다.

**`require('puppeteer')` 를 `puppeteer.connect()` 직전으로 옮긴다.**

- 테스트가 hermetic 하고 가벼워진다 (`node_modules/puppeteer` 부재에도 순수 경로는 돈다)
- 런타임 동작은 동일하다 — 첫 `scrapeUsage()` 호출에서 로드되고 이후 캐시된다
- 🔒 Phase 3 의 `require('../watch-loop.js')` 경계 검증에도 유리하다

## P2.6 Phase 1 과의 접합

```
scrape.js:  err.kind ─────────────┐        err.detail.hint ─────────┐
                                  ▼                                 ▼
watch-loop (Phase 3): recordFailure(obs, err.kind, err.detail, now)
                                  │
                                  ▼
observation.js (Phase 1): lastFailure = { kind, detail, at }
                                  │
                       deriveState ─┤─ pickHint(): KNOWN_HINTS 화이트리스트 통과분만 채택
                                    └─ fields[5] '마지막 실패' = "anchor-timeout · login-expired"
                                       🔒 detail.url · detail.textHead 는 여기까지 오지 않는다
```

🔒 **[SPEC] 어휘가 두 파일에서 갈리면 조용히 고장난다.**
`scrape.js` 의 `HINTS` 는 `observation.js` 의 `KNOWN_HINTS`(`login-expired`·`anchor-missing`·`unknown`)와
**정확히 같아야 한다.** 다르면 `pickHint()` 가 `null` 을 돌려주고, 3주를 들여 알아낸 원인이
화면에서 사라진다 — 증상은 "그냥 안 보임"이라 눈치채기 어렵다. 이 일치를 테스트로 고정한다.

## P2.7 유출 경계

| 값 | 로그(`bellows.log`) | `err.detail` | `fields`/`summary` |
|---|---|---|---|
| `kind` | ✅ | ✅ | ✅ |
| `hint` | ✅ | ✅ | ✅ |
| `url` (전체) | ⚠️ Phase 3 이 판단 | ✅ | ❌ |
| `textHead` (본문 200자) | ❌ | ✅ | ❌ |

⚠️ **수집한 본문 200자에는 계정 이메일이 섞일 수 있다.** 그래서 `detail` 은 진단용으로만 존재하고,
🔒 **`fields` 에 실리는 것은 `hint` 뿐이다**(Phase 1 P1.3 의 화이트리스트가 이미 이것을 보장한다).
Phase 2 는 `detail` 을 **만들되 노출 경로에는 넣지 않는다.**

## P2.8 테스트 `test/scrape-classify.test.js`

전부 hermetic — Chrome·네트워크·대상 사이트 없이 돈다.

| 그룹 | 덮는 것 |
|---|---|
| `hintFrom` 순수 판정 | 로그인 URL → `login-expired` · 오리진+본문 → `anchor-missing` · 판정 불가 4종(빈 url·타 도메인·빈 본문·`null`) → `unknown` |
| `collectDiagnostics` 주입 | 가짜 page 로 세 hint 전부 재현 · `url()` 이 던져도 예외가 새어나오지 않음 · 본문 200자 상한 |
| 어휘 일치 | `HINTS` 가 `observation.js` 의 hint 어휘와 동일 · `FAILURE_KINDS` 5종 |
| 회귀 | `scrapeUsage` 가 여전히 export 되고 함수다 · 모듈 로드에 Chrome 이 필요 없다 |

## P2.9 Phase 2 가 건드리지 않는 것

- `lib/extract.js` — 🔒 **앵커를 고치지 않는다.** 이 NNN 은 구분까지만이다
- `lib/observation.js`(Phase 1 완료) · `lib/config.js` · `watch-once.js`
- `watch-loop.js` — Phase 3 (`kind` 를 실제로 소비하는 배선)
- 🔒 STOP.json 스키마·경로 · `deriveDesired()` · `isValidUsage()` · `writeStopJsonAtomic()` · `readConfig()`
- `scrapeUsage()` 의 시그니처·성공 반환값·기존 오류 메시지 문구
- HTTP 노출 → **004**

---

## 7. Phase 3 예고 (상세 설계는 해당 Phase 에서)

- **Phase 3** — `pollOnce()` 배선, 실패 로그에 `kind`·`hint` 동반 출력,
  파일 맨 아래 즉시실행 루프를 `require.main === module` 가드로 감싼다.
  🔒 `require('../watch-loop.js')` 가 감시 루프를 시작하지 않고 반환하는지 검증(경계 통과).

---

## 8. 위험과 완화

| 위험 | 완화 |
|---|---|
| `deriveState` 가 로컬 타임존에 의존해 환경마다 다른 출력 | D3 — UTC ISO 고정 |
| `fields` 에 계정 이메일 유출 | D4·P1.3 화이트리스트 + 문자열 검사 테스트(`@`·`cookie`·`authToken`·`.profile`) |
| Phase 3 의 `require.main` 가드 누락으로 테스트가 무한 루프 | Phase 3 의 경계 검증이 정확히 이것을 잡는다 |
| 하네스가 테스트 0개인데 성공 종료 | P1.4 — 0개면 비-0 |
| `npm` 사용으로 Windows `.cmd` shim 실패 → clean eval 전복 | 모든 검증은 `node` 직접 호출 |
