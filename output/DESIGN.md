# DESIGN — 012 임계값 쓰기 API (`PUT /api/thresholds`)

## 0. 이 NNN 이 푸는 문제

임계값은 지금 **읽기만** 된다. 바꾸려면 `.prominence\bellows-config.json` 을 손으로 편집해야 하고,
그 결과 정지선이 양쪽 다 `99` 인 채로 넉 달이 흘렀다(파일 수정일 2026-05-04, 하드 기본값은 85/90).
차단기가 사실상 풀린 상태였고 측정이 죽어 있던 36일 동안 아무도 몰랐다.

`lib/config.js` 에는 **이미 자동 만료 장치**(`isExpired`)가 있다. 5월에 그걸 썼다면 저절로 풀렸다.
**장치가 있는데 안 쓴 것**이 사건의 본질이므로, 이 NNN 은 쓰기 창구를 열되
**무르는 방향의 변경에는 만료를 구조적으로 강제**한다.

핵심 한 줄:

> 🔒 **조이기는 그대로 허용, 무르기는 `expires_at` 없이는 거부(400).**

## 1. 소유권 경계

```
Foreman    화면 + 호출자     ->  PUT /api/thresholds
Quaestor   소유자 + 검증자   ->  방향 판정 · 히스테리시스 검사 · 만료 규칙
                                 · 원자적 쓰기 · 기록
                                 🔒 bellows-config.json 은 Quaestor 만 만진다
```

🔒 Foreman 이 남의 설정 파일 경로를 자기 코드에 박게 하지 않는다. 그것이 감독 계약이 없애려던
바로 그 결합이다(`run-foreman.ps1` 의 `$bellowsRoot` 가 조용히 깨졌던 유형).
`/api/status` 를 Foreman 이 **표시만** 하고 판정은 Quaestor 가 하는 것과 같은 모양을 유지한다.

⚠️ 계약이 **"Foreman 은 확인 없이 호출한다"** 고 못박고 있다. 화면에서 값을 밀면 즉시 나간다.
🔒 **그러므로 안전선은 전부 서버 쪽에 있다.** UI 의 확인 대화상자에 기대는 설계는 없다.

## 2. 전체 아키텍처 (012 이후)

```
                          ┌───────────────────────────────────────┐
   claude.ai/usage        │            watch-loop.js              │
        │  scrape         │  pollOnce() 15분 루프                 │
        ▼                 │    readConfig(CONFIG_PATH)            │
   lib/scrape.js  ───────►│    deriveDesired()  🔒 불변           │
   lib/extract.js         │    writeStopJsonAtomic()              │
                          │    log() -> bellows.log               │
                          │  lastCfg / lastStop / observation     │
                          └──────┬──────────────────────▲─────────┘
                                 │ controlSnapshot()    │ onConfigChange()
                                 ▼                      │ (012 신규)
                          ┌──────────────────────────────────────┐
                          │        lib/control-server.js         │
                          │  GET  /            (010, 읽기 전용)  │
                          │  GET  /api/health  (011, contracts)  │
                          │  GET  /api/status  (004/007/008)     │
                          │  POST /api/stop    501 (의도적)      │
                          │  PUT  /api/thresholds   ◄── 012 신규 │
                          └──────┬───────────────────────────────┘
                                 │ 검증 위임 (순수)
                                 ▼
                          ┌──────────────────────────────────────┐
                          │        lib/thresholds.js  (신규)     │
                          │  방향 판정 · 검증 · 병합             │
                          │  🔒 I/O 없음 · Date.now() 주입       │
                          └──────────────────────────────────────┘
                                 │ 병합 결과 객체
                                 ▼
                    .prominence\bellows-config.json  (임시 파일 -> rename)
```

## 3. 디렉터리 구조 (012 에서 바뀌는 부분만 표시)

```
p-quaestor/
├─ watch-loop.js                 [수정] onConfigChange 배선 + configPath 전달
├─ watch-once.js
├─ lib/
│  ├─ config.js                  [불변] readConfig · isExpired · HARD_DEFAULTS 재사용
│  ├─ control-server.js          [수정] PUT 라우트 · 토큰 게이트 · 원자적 쓰기 · 기록
│  ├─ thresholds.js              [신규] 순수 검증/방향/병합 모듈
│  ├─ observation.js             [불변]
│  ├─ status-page.js             [불변]
│  ├─ logparse.js                [불변] 🔒 005 가 읽는 로그 형식은 건드리지 않는다
│  ├─ scrape.js / extract.js / env.js   [불변]
└─ test/
   ├─ thresholds.test.js         [신규] Phase 1 순수 단위 테스트
   ├─ control-server.test.js     [수정] Phase 3 실포트 왕복 테스트
   └─ (나머지 전부 불변 — 회귀 증거)
```

## 4. 기술적 결정과 근거

### D1. 순수 판정을 `lib/thresholds.js` 로 분리한다

이 제품이 이미 지키는 규율이다 — `logparse.js`(005), `observation.js`(003)가 그렇다.
방향 판정·히스테리시스·범위·미지 키·병합은 **전부 순수 함수**이고, 파일·소켓·시계는 만지지 않는다.
`Date.now()` 는 인자로 주입한다(과거 `expires_at` 테스트를 시계 조작 없이 쓰기 위해).

이유: 이 NNN 의 🔒 핵심 조항("무르기는 거부")은 **논리**이지 HTTP 가 아니다.
논리를 순수 함수로 고정하면 Phase 1 에서 포트 없이 전 케이스를 못박을 수 있고,
Phase 3 의 실포트 테스트는 "그 논리가 실제로 배선됐는가"만 확인하면 된다.

### D2. "현재 적용값"은 `readConfig()` 의 결과다 — 파일 원문이 아니다

방향(조이기/무르기) 판정의 기준선은 **지금 차단기가 실제로 쓰고 있는 값**이어야 한다.
`readConfig()` 는 만료·파싱 실패·범위 위반을 이미 처리해 env/하드 기본값으로 내려앉는다.
파일 원문의 `99` 를 기준으로 삼으면, **이미 만료돼서 85 로 동작 중인데 90 으로 바꾸는 요청**이
"조이기"로 통과한다 — 실제로는 무르기다.

🔒 그러므로 `applied = readConfig(configPath).thresholds` 를 기준선으로 쓴다.
🔒 `isExpired` 를 재구현하지 않는다. 이미 있는 장치를 그대로 부른다.

### D3. 병합 대상은 **파일 원문 JSON** 이다 — `readConfig()` 결과가 아니다

기준선(D2)과 쓰기 대상은 서로 다른 객체다.
`readConfig()` 의 출력에는 `_expired` 같은 내부 플래그와 env 기본값이 섞여 있고,
파일에만 있던 미지의 키는 사라져 있다. 그것을 그대로 되쓰면 🔒 **`enabled`·`control.*` 및
운영자가 넣어 둔 다른 키가 날아간다.**

→ 쓰기 경로는 `fs.readFileSync` 로 원문을 읽어 `JSON.parse` 한 뒤,
**`thresholds` 4개와 `expires_at` 만 갈아끼우고 나머지 키는 손대지 않는다.**

- 파일이 없으면: `{}` 에서 시작(신규 생성).
- 🔒 파일이 있는데 **파싱 불가**면: **쓰지 않고 거부**한다(`500 config-unreadable`).
  깨진 파일을 조용히 덮어쓰는 것은 운영자가 손으로 넣은 내용을 파괴하는 행위다.
  (읽기 경로의 never-brick 과 방향이 반대인 것이 맞다 — 읽기는 계속 살아야 하고,
  쓰기는 확신이 없으면 멈춰야 한다.)

### D4. 🔒 쓰기는 토큰이 있어야 한다 — 기본 거부

기존 `isAuthorized()` 는 "토큰 미설정 → 전부 통과"다. loopback bind 를 방어선 삼는 읽기 정책이고,
이건 그대로 둔다(회귀 금지). 쓰기는 그 위에 한 겹을 더 얹는다:

| `control.authToken` | 요청 | 결과 |
|---|---|---|
| 미설정 | `GET /api/status` | 200 (변화 없음) |
| 미설정 | `PUT /api/thresholds` | 🔒 **403** `write-requires-token` |
| 설정 | Bearer 없음/불일치 | 401 (기존 전역 게이트가 먼저 잡는다) |
| 설정 | Bearer 일치 | 검증 단계로 진행 |

기존 전역 게이트가 **라우팅보다 먼저** 돌기 때문에 401 은 자동으로 얻어진다.
403 검사는 PUT 핸들러 진입 직후에 둔다 — 순서상 401 이 항상 403 보다 먼저다.

운영자가 토큰을 두는 행위 자체가 **쓰기 허용의 명시적 선택**이 된다.

### D5. 검증 순서를 고정한다 (결정론적 `reason`)

같은 요청이 여러 규칙을 동시에 위반할 수 있으므로, 어떤 `reason` 이 나오는지 못박는다:

```
1. 토큰 게이트        -> 401 (전역) / 403 write-requires-token
2. 본문 파싱          -> 400 invalid-json / invalid-body   (객체가 아니거나 배열)
3. 미지 키            -> 400 unknown-key
4. 값 타입·범위       -> 400 invalid-value      (정수 아님, 0~100 밖)
5. expires_at 형식    -> 400 invalid-expiry / expiry-in-past
6. 히스테리시스       -> 400 hysteresis-violation   (병합 결과 기준)
7. 방향 + 만료 강제   -> 400 loosen-requires-expiry
8. 파일 병합·쓰기     -> 500 config-unreadable / write-failed
9. 성공               -> 200 + 기록 + 스냅샷 갱신
```

🔒 6번은 **요청값이 아니라 병합 결과**를 본다. 부분 요청(`weekly_stop` 만)으로도 히스테리시스가
깨질 수 있기 때문이다(`weekly_stop: 60`, 기존 `weekly_release: 70`).

### D6. 방향 판정은 `*_stop` 두 축만 본다

```
loosen  <=>  next.weekly_stop > applied.weekly_stop
             || next.session_stop > applied.session_stop
tighten <=>  그 외 전부 (같음 포함, 내려감 포함, release 만 바뀜 포함)
```

작업 지시서의 표를 글자 그대로 따른다. `*_release` 변경은 방향을 만들지 않는다 —
정지선(멈추는 선)이 안전장치의 본체이고, 해제선은 히스테리시스 검사(D5-6)가 지킨다.

### D7. `expires_at` 의 세 가지 입력 ([DERIVED] 규칙 포함)

| 요청의 `expires_at` | 처리 |
|---|---|
| **없음** | 파일의 기존 값을 **그대로 보존**(부분 요청 원칙). 무르기 강제 검사에는 기존 값이 미래일 때만 유효한 만료로 인정 |
| **ISO8601 문자열** | 파싱·미래 검사 후 저장. 방향 불문 허용 |
| **`null` (명시적 해제)** | [DERIVED] 병합 결과의 두 `*_stop` 이 모두 `HARD_DEFAULTS` 이하일 때만 허용. 그렇지 않으면 400 `loosen-requires-expiry` |

세 번째 줄의 이유: 🔒 **"오늘 만료를 달고 무른 뒤, 내일 만료만 지운다"** 는 경로를 막지 않으면
이 NNN 의 안전선이 두 번의 호출로 우회된다 — 그것이 정확히 5월에 일어난 일의 결과 상태다.
영구히 무르고 싶으면 **코드의 하드 기본값을 바꾸는 것이 맞는 자리**이고,
거부 메시지가 그 사실을 담는다.

### D8. 원자적 쓰기 — `writeStopJsonAtomic` 과 같은 방식

`tmp 파일 write -> fs.renameSync` 를 쓴다. 같은 드라이브 안이므로 rename 은 원자적이다.
`.tmp` 접미사는 STOP.json 과 동일한 관례를 따른다(`bellows-config.json.tmp`).

🔒 **never-brick**: 쓰기 실패는 `500 write-failed` 로 끝나고 **감시 루프는 영향받지 않는다.**
PUT 핸들러는 `observation` 도 `getSnapshot()` 도 만지지 않는다.

### D9. 쓰기 직후 `/api/status` 가 새 값을 내야 한다

`pollOnce()` 가 폴마다 `readConfig()` 를 다시 하므로 다음 폴이면 자연히 반영되지만,
수용 기준은 **쓰기 직후**를 요구한다. 15분을 기다리게 하지 않는다.

→ `startControlServer({ onConfigChange })` 콜백을 추가한다.
watch-loop 는 `lastCfg = readConfig(CONFIG_PATH)` 한 줄로 응답한다.
🔒 제어 서버가 watch-loop 의 변수를 직접 만지지 않는다 — 스냅샷이 단방향인 기존 구조를 유지한다.

### D10. 기록 — 5월 사건의 진짜 피해는 "기록 없음"이었다

```
[thresholds] loosen: weekly_stop 85->99 session_stop 90->99 expires_at=2026-09-09T00:00:00Z
```

- 접두어 `[thresholds]` 는 005 의 `parseLogTail` 이 보는 어떤 패턴과도 겹치지 않는다:
  `session=NN%` / `weekly=NN%` (등호+퍼센트 필요), `[poll error]`, ISO 접두 타임스탬프.
  🔒 이 줄은 `weekly_stop 85->99` 처럼 **등호도 퍼센트도 쓰지 않으므로** 성공 폴로 오인되지 않는다.
- 변경된 축만 나열한다. `expires_at=` 는 값이 없으면 `none`.
- `onLog` 는 이미 주입돼 있다(`watch-loop.js` 의 `log()` 가 ISO 타임스탬프를 앞에 붙인다).
- 🔒 기존 로그 형식(`[poll start]`·`session=NN%`·`[restore]`·`[stop]`·`[config]`)은 불변.

### D11. 계약 버전 `1.3.0`

011 이 만든 결합대로 `CONTRACTS['supervised-v1']` 를 `1.2.0` -> `1.3.0` 으로 올린다.
새 엔드포인트 추가는 하위호환 확장이므로 minor 상승이 맞다.
🔒 `package.json` 의 `version`(소프트웨어 축)은 건드리지 않는다 — 두 축을 섞으면 영구 `drifted` 다.

### D12. 범위 밖 (명시적으로 하지 않는 것)

- 웹 페이지의 편집 UI — 🔒 페이지는 읽기 전용 유지(010). 화면은 Foreman 몫
- `POST /api/stop` — 여전히 501
- `enabled` 토글 쓰기 — 감시 자체를 끄는 것이라 별개 판단
- `deriveDesired()` — 🔒 한 글자도 건드리지 않는다. 바꾸는 것은 그 판정이 **쓰는 값**이다
- `_guides\SUPERVISED_TOOL_CONTRACT.md` — Foreman 소유

## 5. 데이터 흐름 (`PUT /api/thresholds` 한 번)

```
Foreman
  │ PUT /api/thresholds
  │ Authorization: Bearer <token>
  │ { "weekly_stop": 85, "session_stop": 90 }
  ▼
requestListener()            토큰 설정 & 불일치 -> 401 (기존 전역 게이트)
  ▼
handlePutThresholds()
  ├─ ctx.authToken 없음 ------------------------> 403 write-requires-token
  ├─ 본문 수집(상한 초과 -> 413) · JSON.parse --> 400 invalid-json
  ├─ applied = readConfig(configPath).thresholds        ← D2 (기준선)
  ├─ rawFile = JSON.parse(readFileSync)  실패 -> 500 config-unreadable   ← D3
  │
  ├─ lib/thresholds.js  (순수)
  │    validateThresholdRequest(body, applied, currentExpiresAt, nowMs)
  │      -> { ok:false, status, reason, error }        -> 그대로 응답
  │      -> { ok:true, direction, next, previous, expiresAt }
  │
  ├─ merged = mergeIntoConfig(rawFile, next, expiresAt) ← 다른 키 전부 보존
  ├─ 임시 파일 write -> rename                 실패 -> 500 write-failed
  ├─ onLog('[thresholds] ...')                         ← D10
  ├─ onConfigChange()   -> watch-loop: lastCfg 갱신    ← D9
  ▼
200 { ok:true, direction, applied:{4개}, expires_at, previous:{4개} }
  ▼
이후 GET /api/status 의 usage.thresholds 가 즉시 새 값
다음 pollOnce() 의 deriveDesired() 가 새 값으로 판정
```

---

# Phase 1 상세 설계 — `lib/thresholds.js` (순수 모듈)

Phase 1 은 **HTTP 를 전혀 건드리지 않는다.** 파일도, 포트도, 시계도 만지지 않는다.
이 NNN 의 🔒 핵심 조항 전부를 순수 함수 하나에 고정하는 것이 목표다.

## 1.1 공개 API

```js
// 4개 임계 키. 순서 고정 — 로그 줄과 응답 필드 순서가 이 배열을 따른다.
const THRESHOLD_KEYS = ['weekly_stop', 'weekly_release', 'session_stop', 'session_release'];

// 요청 본문에 허용되는 키 전부. 이 밖은 전부 거부(unknown-key).
const ALLOWED_KEYS = [...THRESHOLD_KEYS, 'expires_at'];

/**
 * 순수. I/O 없음, Date.now() 호출 없음(nowMs 주입).
 *
 * @param body              파싱된 요청 본문(임의 값)
 * @param applied           현재 적용 중인 4개 값 (readConfig().thresholds)
 * @param currentExpiresAt  파일의 기존 expires_at (string|null)
 * @param nowMs             현재 시각 ms
 *
 * 실패: { ok:false, status:400, reason:'...', error:'사람이 읽는 한국어 설명' }
 * 성공: { ok:true, direction:'tighten'|'loosen',
 *         next:{4개}, previous:{4개},
 *         expiresAt: string|null,      // 병합 후 최종값
 *         changed:[{key, from, to}] }  // 로그 줄 재료
 */
function validateThresholdRequest(body, applied, currentExpiresAt, nowMs)

/**
 * 순수. 파일 원문 객체 위에 임계값과 expires_at 만 얹은 새 객체를 만든다.
 * 🔒 입력 객체를 변형하지 않는다(shallow copy).
 * 🔒 thresholds/expires_at 외의 모든 키(enabled, control, 미지의 키)를 보존한다.
 */
function mergeIntoConfig(rawConfig, next, expiresAt)

/** 로그 한 줄 생성. 순수. */
function formatThresholdLog(direction, changed, expiresAt)
```

## 1.2 검증 규칙 (D5 의 순서를 그대로 구현)

**(1) 본문 형태**
- `null`, 배열, 객체 아님 → `400 invalid-body`
- 키가 하나도 없는 빈 객체 `{}` → `400 invalid-body`
  ([DERIVED] 아무것도 바꾸지 않는 쓰기는 기록만 더럽힌다. 명시적으로 거부한다.)

**(2) 미지 키**
- `ALLOWED_KEYS` 밖의 키가 하나라도 있으면 → `400 unknown-key`
  🔒 조용히 무시하지 않는다. `error` 에 문제의 키 이름을 담는다.

**(3) 값 타입·범위** (각 임계 키에 대해, 존재할 때만)
- `typeof !== 'number'` / `NaN` / `Number.isInteger` 아님 → `400 invalid-value`
- `< 0` 또는 `> 100` → `400 invalid-value`

**(4) `expires_at`** (키가 존재할 때만)
- `null` → 해제 요청으로 표시(§1.4)
- 문자열이 아님 → `400 invalid-expiry`
- `Date.parse` 가 `NaN` → `400 invalid-expiry`
- 파싱값 `<= nowMs` → `400 expiry-in-past`

**(5) 병합 후 히스테리시스** — 🔒 `next = { ...applied, ...요청의 임계값 }` 에 대해
- `next.weekly_stop > next.weekly_release` 여야 한다
- `next.session_stop > next.session_release` 여야 한다
- 하나라도 깨지면 → `400 hysteresis-violation`
  (같아도 위반이다. 등호에서는 경계가 풀리지 않아 영원히 잠긴다.)

**(6) 방향 + 만료 강제** — 🔒 이 NNN 의 본체
- `direction` = D6 의 정의
- `direction === 'loosen'` 인데 **유효한 미래 만료가 없으면** → `400 loosen-requires-expiry`
  - 유효한 만료 = 요청이 준 미래 ISO, 또는 요청이 만료를 안 줬고 `currentExpiresAt` 이 미래인 경우
- `error` 메시지는 🔒 **"영구히 무르려면 코드의 하드 기본값을 바꾸는 것이 맞는 자리다.
  이 파일은 임시 덮어쓰기용이다"** 는 사실을 담는다

## 1.3 방향 판정

```js
const loosen = next.weekly_stop  > applied.weekly_stop
            || next.session_stop > applied.session_stop;
```

- 같음 → `tighten`
- 한쪽만 올라가도 → `loosen`
- `*_release` 만 바뀜 → `tighten` (D6)

## 1.4 `expires_at` 결정표 (D7 구현)

| 요청 | 결과 `expiresAt` | 추가 검사 |
|---|---|---|
| 키 없음 | `currentExpiresAt` 그대로 | 무르기면 `currentExpiresAt` 이 미래여야 함 |
| 미래 ISO | 그 값 | — |
| 과거/파싱불가 ISO | — | `400 expiry-in-past` / `invalid-expiry` |
| `null` | `null` | [DERIVED] 두 `*_stop` 이 모두 `HARD_DEFAULTS` 이하일 때만 허용, 아니면 `400 loosen-requires-expiry` |

## 1.5 `mergeIntoConfig` 의 보존 규칙

```js
// 개념
{
  ...rawConfig,                                  // 🔒 enabled, control, 미지의 키 전부 보존
  thresholds: { ...(rawConfig.thresholds), ...next },  // 4개만 갈아끼움
  expires_at: expiresAt                          // null 이면 null 로 명시 저장
}
```

- `rawConfig.thresholds` 가 객체가 아니면 `{}` 로 취급하고 `next` 4개를 쓴다.
- 🔒 `rawConfig` 와 그 하위 객체를 **변형하지 않는다**(호출 전후로 원본이 동일해야 한다).

## 1.6 로그 줄 형식

```
[thresholds] <direction>: <key> <from>-><to> [...] expires_at=<iso|none>
```

예:
```
[thresholds] loosen: weekly_stop 85->99 session_stop 90->99 expires_at=2026-09-09T00:00:00Z
[thresholds] tighten: weekly_stop 99->85 expires_at=none
```

🔒 `=` 와 `%` 를 임계값 표기에 쓰지 않는다 — 005 의 `parseLogTail` 이 성공 폴로 오인하지 않게.
변경이 없는 키는 나열하지 않는다.

## 1.7 Phase 1 테스트 범위 (`test/thresholds.test.js`)

포트도 파일도 쓰지 않는 순수 단위 테스트. `nowMs` 를 고정값으로 주입한다.
방향/히스테리시스/미지 키/범위/만료 4종/보존/불변성/로그 형식 + 🔒 005 오인 방지
(생성된 로그 줄을 `parseLogTail` 에 실제로 먹여 `null` 이 나오는지 확인).

## 1.8 Phase 1 이 하지 않는 것

- HTTP 라우팅, 토큰 게이트, 상태 코드 전송 → Phase 2
- 파일 읽기/쓰기, `readConfig` 호출 → Phase 2
- `CONTRACTS` 버전 상승 → Phase 2
- 실포트 왕복 검증 → Phase 3

---

# Phase 2 상세 설계 — `PUT /api/thresholds` 배선

Phase 1 이 만든 순수 모듈을 **HTTP·파일·로그·스냅샷에 연결한다.**
🔒 Phase 2 는 판정 논리를 하나도 새로 만들지 않는다 — 전부 `lib/thresholds.js` 에 위임하고,
이 Phase 가 소유하는 것은 **토큰 게이트 · 본문 수집 · 파일 원문 읽기 · 원자적 쓰기 · 기록 · 스냅샷 갱신**뿐이다.

## 2.0 이 Phase 가 만지는 파일

| 파일 | 변경 |
|---|---|
| `lib/control-server.js` | PUT 라우트 · 403 게이트 · 본문 수집 · 파일 I/O · `CONTRACTS` 1.3.0 |
| `watch-loop.js` | `configPath`·`onConfigChange` 주입, `refreshConfig()` 추출 |
| `lib/thresholds.js` | 🔒 **불변** (Phase 1 산출물) |
| `lib/config.js` · `observation.js` · `status-page.js` · `logparse.js` | 🔒 **불변** |

## 2.1 `startControlServer(opts)` 의 새 옵션

```js
startControlServer({
  port, authToken, getSnapshot, onLog,   // 기존 — 형태·의미 불변
  configPath,       // [신규] string|null. bellows-config.json 의 절대 경로
  onConfigChange    // [신규] function|noop. 쓰기 성공 후 동기 호출
});
```

- 두 옵션 모두 **선택적**이다. 기존 호출부(테스트 포함)가 주지 않아도 서버는 그대로 뜬다.
  🔒 이것이 회귀 없음의 기계적 보장이다 — `ctx` 에 두 필드가 추가될 뿐 기존 경로는 한 줄도 안 바뀐다.
- `configPath` 가 문자열이 아니면 `ctx.configPath = null`.
- `onConfigChange` 가 함수가 아니면 기존 `noop` 을 쓴다 (`onLog` 와 동일한 관례).

`ctx` 최종 형태:
```js
const ctx = { getSnapshot, version, startedAt, authToken, configPath, onConfigChange };
```

## 2.2 라우팅 — 기존 게이트 순서를 그대로 쓴다

```
requestListener()
  ├─ URL 파싱 실패            -> 404
  ├─ isAuthorized(ctx, req)   -> 401 unauthorized      🔒 라우팅보다 먼저 (기존, 불변)
  ├─ '/'            GET  아니면 405
  ├─ '/api/health'  GET  아니면 405
  ├─ '/api/status'  GET  아니면 405
  ├─ '/api/stop'    POST 아니면 405 -> 501 (의도적 미구현, 불변)
  ├─ '/api/thresholds'  [신규]  PUT 아니면 405
  │      -> handlePutThresholds(req, res, ctx)
  └─ 그 외 -> 404
```

🔒 **401 이 403 보다 반드시 먼저다.** 전역 `isAuthorized()` 가 라우팅 앞에 있으므로
"토큰이 설정돼 있는데 Bearer 가 틀린" 요청은 PUT 핸들러에 도달조차 하지 않는다 —
수용 기준의 401/403 분기가 코드 순서로 보장된다.

⚠️ 신규 경로 추가로 `/api/thresholds` 의 존재가 401 이전에 노출되지 않는지 확인할 것:
게이트가 먼저이므로 토큰 설정 상태에서 미인증 요청은 경로 불문 401 이다. 기존 규율 유지.

## 2.3 `handlePutThresholds(req, res, ctx)` — 단계별

```
(a) 토큰 게이트 (쓰기 전용, 기본 거부)
    if (!ctx.authToken) -> 403 { ok:false, reason:'write-requires-token', error:'...' }
    🔒 읽기 정책(isAuthorized 의 "미설정 -> 통과")은 건드리지 않는다. 여기서 한 겹만 더 얹는다.

(b) 쓰기 대상 경로
    if (!ctx.configPath) -> 500 { reason:'config-unavailable' }
    (서버가 configPath 없이 떠 있는 경우 — 옛 호출부·단위 테스트)

(c) 본문 수집  (async)
    req.on('data') 누적, 상한 65536 바이트
      초과 -> 413 { reason:'body-too-large' }, req.destroy()
    req.on('error') -> 400 { reason:'invalid-body' }
    req.on('end'):
      JSON.parse 실패(빈 본문 포함) -> 400 { reason:'invalid-json' }

(d) 기준선 = readConfig(ctx.configPath).thresholds          ← D2
    🔒 파일 원문이 아니라 "지금 차단기가 실제로 쓰는 값". isExpired 재구현 없음.

(e) 파일 원문 = readRawConfigFile(ctx.configPath)           ← D3
    없음        -> {}          (신규 생성)
    읽기 실패   -> 500 { reason:'config-unreadable' }
    JSON.parse 실패 / 객체 아님 -> 500 { reason:'config-unreadable' }
    🔒 깨진 파일을 조용히 덮어쓰지 않는다.

(f) 검증 (순수 위임)
    validateThresholdRequest(body, applied, rawFile.expires_at ?? null, Date.now())
      ok:false -> sendJson(res, r.status, { ok:false, reason:r.reason, error:r.error })
      🔒 Date.now() 는 여기서 딱 한 번 읽어 넘긴다. 판정 안에서는 시계를 읽지 않는다.

(g) 병합 + 원자적 쓰기
    merged = mergeIntoConfig(rawFile, r.next, r.expiresAt)
    writeConfigAtomic(ctx.configPath, merged)   // tmp -> renameSync
      실패 -> 500 { reason:'write-failed' } + onLog('[thresholds] write failed: ...')

(h) 기록
    onLog(formatThresholdLog(r.direction, r.changed, r.expiresAt))

(i) 스냅샷 즉시 갱신
    try { ctx.onConfigChange(); } catch (e) { onLog('[thresholds] refresh failed: ...') }
    🔒 콜백이 던져도 200 이다 — 파일은 이미 커밋됐고, 다음 폴이 어차피 readConfig 를 다시 한다.

(j) 200
    { ok:true, direction, applied:r.next, expires_at:r.expiresAt, previous:r.previous }
```

⚠️ 응답의 `applied` 는 **적용된 새 값**(= `r.next`)이다. (d) 의 기준선 변수명과 겹치므로
코드에서는 기준선을 `appliedNow`, 응답 필드를 `applied: result.next` 로 구분해 쓴다.

### never-brick 재확인
- 이 핸들러는 `ctx.getSnapshot()` 도 `observation` 도 만지지 않는다.
- 모든 실패 경로가 **응답을 보내고 끝난다.** 예외는 `requestListener` 의 기존 try/catch 가 받아
  `500 internal error` 가 된다 — 감시 루프는 별도 실행 흐름이므로 영향이 없다.
- 🔒 쓰기 실패가 폴링을 멈추는 경로는 존재하지 않는다.

## 2.4 파일 헬퍼 두 개 (control-server.js 지역 함수)

```js
// 원문 읽기. config.js 의 BOM 처리 관례를 그대로 따른다(PS 5.1 이 BOM 을 붙인다).
// 반환: { ok:true, raw:object } | { ok:false }   -- 없으면 { ok:true, raw:{} }
function readRawConfigFile(configPath)

// 원자적 쓰기. writeStopJsonAtomic 과 같은 방식(D8).
//   tmp = configPath + '.tmp' -> writeFileSync(JSON.stringify(obj, null, 2)) -> renameSync
// 반환: null(성공) | Error
function writeConfigAtomic(configPath, obj)
```

- 🔒 BOM(`0xFEFF`) 를 벗기고 파싱한다. 벗기지 않으면 운영자가 PowerShell 로 만든 파일이
  `config-unreadable` 로 거부돼, 고치려는 창구가 정확히 고쳐야 할 상황에서 잠긴다.
- 쓰기는 BOM 없는 UTF-8. `readConfig` 는 양쪽 다 읽으므로 형식 변경이 아니다.
- `.tmp` 접미어는 STOP.json 관례와 동일. 같은 디렉터리이므로 rename 은 원자적이다.
- `require('node:fs')` 를 control-server.js 에 새로 들인다. 🔒 새 **의존성**은 아니다(코어 모듈).

## 2.5 응답 스키마 (성공/실패 공통 규약)

```jsonc
// 200
{ "ok": true, "direction": "tighten",
  "applied":  { "weekly_stop":85, "weekly_release":70, "session_stop":90, "session_release":75 },
  "expires_at": null,
  "previous": { "weekly_stop":99, "weekly_release":70, "session_stop":99, "session_release":75 } }

// 4xx/5xx  -- 항상 reason 을 담는다(기계가 분기할 수 있게)
{ "ok": false, "reason": "loosen-requires-expiry", "error": "사람이 읽는 설명" }
```

기존 엔드포인트의 오류 응답(`{ok:false, error}`)에는 `reason` 이 없었다.
🔒 **기존 응답에 `reason` 을 소급 추가하지 않는다** — 회귀 금지. 신규 엔드포인트만 이 규약을 쓴다.

`reason` 전체 목록(D5 순서 고정):
`write-requires-token`(403) · `config-unavailable`(500) · `body-too-large`(413) ·
`invalid-json`(400) · `invalid-body`(400) · `unknown-key`(400) · `invalid-value`(400) ·
`invalid-expiry`(400) · `expiry-in-past`(400) · `hysteresis-violation`(400) ·
`loosen-requires-expiry`(400) · `config-unreadable`(500) · `write-failed`(500)

## 2.6 계약 버전 상승 (D11)

```js
const CONTRACTS = Object.freeze({
  'supervised-v1': '1.3.0'   // 1.2.0 -> 1.3.0 : PUT /api/thresholds 추가(하위호환 확장)
});
```

🔒 `package.json` 의 `version`(`0.1.0`)은 손대지 않는다. 두 축을 섞으면 Agora 022 기준으로
영원히 `drifted` 다. 011 이 남긴 주석(“이 값을 바꾸는 시점 = Agora 등록 문서를 바꾸는 시점”)을
갱신해 1.3.0 의 근거를 남긴다.

## 2.7 `watch-loop.js` 배선

현재 `pollOnce()` 의 처음 세 줄이 설정 갱신을 담당한다(90–98행). 그 블록을 **함수로 추출**해
PUT 핸들러와 폴 루프가 같은 코드를 공유하게 한다.

```js
// pollOnce() 의 기존 3줄 + 로그 2줄을 그대로 옮긴 것. 동작 동일.
function refreshConfig() {
  const cfg = readConfig(CONFIG_PATH);
  lastCfg = cfg;
  lastConfigSource = (fs.existsSync(CONFIG_PATH) && !cfg._parseError && !cfg._expired) ? 'file' : 'default';
  if (cfg._parseError) log('[config] parse error, using defaults: ' + cfg._parseError);
  if (cfg._expired)    log('[config] expires_at past, using defaults');
  return cfg;
}
```

- `pollOnce()` 는 `const cfg = refreshConfig();` 한 줄로 바뀐다.
  🔒 **로그 줄·순서·조건이 전부 동일**하므로 005 의 복원 입력에 변화가 없다.
- `startControlServer` 호출에 두 줄 추가:
  ```js
  configPath:     CONFIG_PATH,
  onConfigChange: refreshConfig
  ```
- 🔒 제어 서버가 `lastCfg` 를 직접 대입하지 않는다. 스냅샷은 여전히 **단방향**이고,
  갱신 요청만 콜백으로 들어온다(D9).

### 쓰기 직후 `/api/status` 가 새 값을 내는 경로

```
PUT 성공 -> renameSync 완료 -> onConfigChange()
   -> watch-loop: lastCfg = readConfig(CONFIG_PATH)   (새 파일을 다시 읽음)
   -> controlSnapshot().ctx.thresholds 가 새 값
   -> GET /api/status 의 usage.thresholds 가 즉시 새 값       ✅ 15분 대기 없음
   -> 다음 pollOnce() 의 deriveDesired() 도 새 값으로 판정   (🔒 deriveDesired 자체는 불변)
```

## 2.8 🔒 이 Phase 가 건드리지 않는 것 (회귀 경계)

- `isAuthorized()` 본문 — 읽기 정책 불변. 403 은 PUT 핸들러 안에만 있다
- `handleHealth` / `handleStatus` / `handleIndex` / `buildStatusPayload` / `handleStop`
- `sendJson` / `sendHtml` / `tokensMatch` / `bearerFrom` — 🔒 토큰 비교의 `===` 금지 규율 유지
- `HOST` 상수(loopback 고정) · `startControlServer` 의 never-reject 계약
- `deriveDesired()` · STOP.json 의 위치·이름·스키마 · 수동 STOP 우선 규칙
- 기존 로그 줄 형식 전부(`[poll start]` · `session=NN%` · `[restore]` · `[stop]` · `[config]` · `[control]`)
- 상태 웹 페이지(010) — 🔒 편집 UI 없음, 읽기 전용 유지

## 2.9 Phase 2 가 하지 않는 것

- 실포트 왕복 테스트 작성 → Phase 3
- `POST /api/stop` 구현 → 여전히 501
- `enabled` · `control.*` 쓰기 → 범위 밖 (요청 본문에 오면 `unknown-key` 로 400)
- Agora 등록 문서 갱신 → 사람이 랜딩 후 수행
