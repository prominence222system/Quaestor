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

## 7. Phase 2·3 예고 (상세 설계는 해당 Phase 에서)

- **Phase 2** — `scrapeUsage()` 의 각 실패 지점에 `err.kind` 부착.
  `anchor-timeout` 일 때만 `page.url()` 과 `document.body.innerText` 앞 200자를 읽어
  `err.detail = { url, textHead, hint }` 를 만든다.
  `hint` 는 `login-expired` | `anchor-missing` | `unknown` 중 하나.
  🔒 **판정 근거가 없으면 `unknown`.** 잘못된 확신이 사람을 헛걸음시킨 것이 이 NNN 의 출발점이다.
  진단 수집 자체가 실패해도 원래 오류를 삼키지 않는다.
  page 객체를 주입 가능하게 만들어 Chrome 없이 검증한다.
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
