# DESIGN — 004 감독 대상 HTTP 계약면 (`/api/health` · `/api/status`)

작성일: 2026-08-19 · 대상 NNN: `work/004-control-http-contract.md`

---

## 1. 이 NNN 이 만드는 것 (한 문단)

003 이 만든 **관측 상태**(`lib/observation.js` 의 `deriveState()`)를 `node:http` 로 노출한다.
Foreman 이 대상별 특수 코드 없이 읽어갈 수 있게 하는 **대상 쪽 절반**이다.
🔒 **판정을 새로 하지 않는다** — 이미 있는 순수 함수의 결과를 계약 형식으로 감싸 낼 뿐이다.
🔒 **감시 루프가 본체고 HTTP 는 부가 기능이다** — HTTP 가 어떻게 실패해도 루프는 계속 돈다.

⚠️ 이 NNN 이 끝나도 화면 변화는 없다(Foreman 클라이언트 미구현). 그것이 정상이다.

---

## 2. 전체 아키텍처

```
                     ┌──────────────────────── watch-loop.js (본체) ───────────────────────┐
                     │                                                                     │
 claude.ai  ──scrape──▶ pollOnce()  ──recordSuccess/recordFailure──▶  observation (모듈 변수) │
                     │        │                                              │              │
                     │        └── deriveDesired() ──▶ .prominence\STOP.json  │              │
                     │            🔒 불변 · HTTP 가 건드리지 않는다             │              │
                     └──────────────────────────────────────────────┼─────────────────────┘
                                                                    │ getSnapshot() (읽기 전용)
                                                                    ▼
                                            ┌───────── lib/control-server.js ─────────┐
                                            │  node:http · 127.0.0.1:3210 (기본)       │
                                            │  Bearer 인증(설정 시) · 상수시간 비교      │
                                            │   GET /api/health  → 생존·정체           │
                                            │   GET /api/status  → deriveState() 투영  │
                                            │   POST /api/stop   → 🔒 의도적 미구현     │
                                            └──────────────────────┬──────────────────┘
                                                                   │ HTTP (일방향)
                                                                   ▼
                                                          Foreman (미구현, 없어도 무방)
```

### 🔒 의존 방향

`Bellows(Quaestor) → Foreman` 방향의 의존이 **0** 이어야 한다.
`require('foreman')` 없음, Foreman 호출 없음, Foreman 부재 시에도 완전 정상 동작.
접점은 HTTP 응답 형식 하나뿐이다.

### 🔒 계층 분리 — 절대 합치지 않는 두 값

| 값 | 위치 | 의미 | 오해하면 생기는 일 |
|---|---|---|---|
| `ok` | `/api/health` | **HTTP 면이 살아있다** | 측정이 3주 죽어도 초록불 |
| `state` | `/api/status` | **측정이 건강하다** | — 이쪽이 진실이다 |

`/api/health` 는 `observation` 을 **읽지 않는다.** 읽는 순간 두 값이 뒤섞이기 시작한다.
`/api/status` 의 `ok` 는 "이 응답이 유효한 상태 보고인가"만 뜻하며(인증 실패 시 `false`),
측정 건강은 오직 `state` 가 말한다.

---

## 3. 디렉터리 구조

```
p-bellows/
├─ package.json                     (version 원천 — /api/health 의 version)
├─ watch-loop.js                    [수정] 컨트롤 서버 배선(never-brick)
├─ watch-once.js                    (무변경)
├─ lib/
│  ├─ config.js                     [수정] control 블록(port·authToken) 정규화 통과
│  ├─ observation.js                (무변경 — 🔒 데이터 원천, 재구현 금지)
│  ├─ scrape.js                     (무변경)
│  └─ control-server.js             [신규] 리스너 + 라우팅 + 인증 + 직렬화
└─ test/
   ├─ run-all.js                    (무변경 — *.test.js 자동 로드)
   ├─ observation.test.js           (무변경)
   ├─ scrape-classify.test.js       (무변경)
   ├─ watch-loop.test.js            (무변경/증분)
   └─ control-server.test.js        [신규] 실포트 통합 검증
```

🔒 저장소 밖(무변경): `<Drive>:\SynologyDrive\Obsidian\Automatic\.prominence\{STOP.json, bellows.log, bellows-config.json}`
🔒 `deploy.json` 갱신은 이 NNN 의 몫이 아니다(데이터 파일 — 사람이 직접 쓴다).

---

## 4. 기술 결정과 근거

| # | 결정 | 근거 |
|---|---|---|
| D1 | `node:http` 만 사용. 프레임워크·의존성 추가 없음 | MASTER 제약(의존성 puppeteer 하나뿐). 라우트 2개에 라우터는 과잉 |
| D2 | `host = '127.0.0.1'` 를 **인자로 받지 않고 상수로 박는다** | 🔒 설정으로 뚫릴 수 있으면 언젠가 뚫린다. 로컬 제어면이지 서비스가 아니다 |
| D3 | 기본 포트 **3210** (`control.port` 로 덮어쓰기) | 실측 공백. 3000 Foreman · 3100 Armory · 3200 Gate 와 무충돌 |
| D4 | `startControlServer()` 는 **Promise 를 reject 하지 않는다.** 항상 `{ started, port, error, close() }` 로 해결 | 🔒 never-brick. 호출자에게 예외가 새면 루프가 죽는다 |
| D5 | 상태 원천은 **주입된 `getSnapshot()` 콜백** | 서버가 `watch-loop` 를 `require` 하면 순환 의존 + 루프 기동 위험. 방향은 루프 → 서버 한쪽뿐 |
| D6 | `/api/status` 는 `deriveState()` 를 **호출만** 한다. 임계·상태 판정 로직 0줄 | 🔒 판정이 두 곳에 있으면 반드시 갈라진다 |
| D7 | `fields` 는 `deriveState()` 가 준 배열을 **그대로** 싣는다(재가공 없음) | 003 이 이미 화이트리스트로 비밀을 차단했다. 여기서 다시 만들면 그 보호가 깨진다 |
| D8 | 토큰 비교는 `crypto.timingSafeEqual`, **길이 무관 상수시간**(양쪽을 고정 길이 SHA-256 다이제스트로 만들어 비교) | 🔒 `timingSafeEqual` 은 길이가 다르면 throw 한다. 길이 자체가 누설되면 안 된다 |
| D9 | `POST /api/stop` **의도적 미구현** → `501` + 이유 있는 본문 | 계약상 선택 조항. 이 제품의 정지는 안전장치를 끄는 것이라 "확인 없이 호출" 되면 안 된다. 🔒 코드 주석 + `PROJECT_INTENT.md` 에 근거를 남긴다 |
| D10 | `Cache-Control: no-store` | 감독 대시보드가 낡은 상태를 초록불로 그리면 3주 침묵의 재현이다 |
| D11 | 서버 소켓에 `unref()` 를 걸지 **않는다**, 대신 `close()` 를 반환 | 테스트가 명시적으로 닫아 매달림을 증명한다(§Acceptance) |
| D12 | 인증 검사는 **라우팅보다 먼저** | 존재하지 않는 경로에 대한 404/401 순서가 경로 존재 여부를 누설하지 않게 |

### 🔒 손대지 않는 것 (재확인)

- `STOP.json` 의 위치·이름·스키마 — HTTP 는 읽지도 쓰지도 않는다
- `deriveDesired()` 의 임계(85/90, 70/75)와 히스테리시스
- 수동 STOP(`source === 'manual'`) 우선 규칙
- `lib/observation.js` 본문 — 이 NNN 은 소비자일 뿐이다

### 계약 문서와의 불일치 처리

계약 원문은 예시에서 `"id": "bellows"` 이고 `tokenFrom: "bellows-config.json#authToken"` 이다.
작업지시서 §2·§5 가 이를 덮는다 → **`id` 는 `"quaestor"`**, 토큰은 **`control.authToken`**.
다만 계약의 `#authToken` 프래그먼트 표기를 고려해 **최상위 `authToken` 도 폴백으로 인정**한다
(`control.authToken` 우선). 이는 [DERIVED] 결정이며, 어느 쪽도 응답에 실리지 않는다.

---

## 5. 데이터 흐름

### 5-1. `GET /api/health` (observation 무접촉)

```
요청 ─▶ 인증 게이트 ─▶ 라우트 ─▶ { ok:true, id:'quaestor', version:<package.json>, startedAt:<서버 기동 ISO> }
                                   ▲ 프로세스 기동 시 1회 캡처한 상수. 관측 상태를 읽지 않는다
```

### 5-2. `GET /api/status` (읽기 전용 투영)

```
요청 ─▶ 인증 게이트 ─▶ getSnapshot()  ── { observation, ctx: {enabled, thresholds, stop, configSource} }
                              │
                              ▼
                     deriveState(obs, ctx, Date.now())      ← 🔒 순수 함수. 부작용 0
                              │  { state, summary, fields }
                              ▼
        { ok:true, summary, state, fields, updatedAt: <응답 생성 ISO> }
```

- 🔒 GET 이 **폴링을 유발하지 않는다** — `scrapeUsage()` 를 부르지 않는다
- 🔒 GET 이 **STOP.json 을 읽거나 쓰지 않는다** — `writeStopJsonAtomic`/`fs.unlinkSync` 경로에 닿지 않는다
- 🔒 GET 이 `observation` 을 **변형하지 않는다** — `totalPolls` 가 변하면 위반

### 5-3. 인증 게이트

```
authToken 미설정(현재 실측 상태) ─▶ 통과. 방어선은 127.0.0.1 바인딩
authToken 설정 ─┬─ Authorization 헤더 없음        ─▶ 401
                ├─ 'Bearer ' 접두 없음/형식 불일치 ─▶ 401
                ├─ 토큰 불일치(상수시간 비교)      ─▶ 401
                └─ 일치                          ─▶ 통과
401 본문: { ok:false, error:'unauthorized' }   🔒 기대 토큰·힌트·길이 없음. 🔒 ok 는 false
```

### 5-4. `watch-loop.js` 배선 (never-brick)

```
기동 ─▶ cfg = readConfig(CONFIG_PATH)
     ─▶ startControlServer({ port: cfg.control.port, authToken: cfg.control.authToken,
                             getSnapshot: () => ({ observation, ctx: {...} }) })
        ├─ started === true  ─▶ log('[control] listening on 127.0.0.1:<port>')
        └─ started === false ─▶ log('[control] listen failed: <msg>')   🔒 조용히 삼키지 않는다
     ─▶ ★ 어느 쪽이든 mainLoop() 진입 ★
```

🔒 `EADDRINUSE`·권한 거부·핸들러 내부 예외 중 무엇이 나도 감시 루프는 계속 돈다.
핸들러 예외는 서버 내부에서 잡아 **500** 으로 응답하고, 프로세스를 죽이지 않는다.

---

## 6. Phase 분할

| Phase | 내용 | 의존 |
|---|---|---|
| 1 | `lib/control-server.js` 코어 — 리스너(127.0.0.1 고정) · 라우팅 · `/api/health` · `/api/status` · never-throw 기동 계약 | 003 의 `observation.js` |
| 2 | 인증(Bearer · 상수시간 비교) + `config.js` 의 `control` 블록 + 비밀 미유출 검증 + `POST /api/stop` 미구현 명문화 | Phase 1 |
| 3 | `watch-loop.js` 배선(never-brick) + `test/control-server.test.js` 실포트 통합 검증 | Phase 1·2 |
| 4 | 종단 통합 검증(조립 경로 → 계약 기본 주소 실바인딩) + 계약 원문 대조·이탈점 인수인계 기록 | Phase 1·2·3 |
| 5 | 역경로·강건성 매트릭스(모든 응답 경로의 JSON 직접 단언 + 비정상 요청 + 연결 중단·동시 요청 앞의 프로세스 생존) | Phase 1·2·3·4 |

⚠️ 작업지시서는 "예상 phase 3" 이었다. Phase 4·5 는 기능을 더하는 Phase 가 **아니라**
승격 유예 라운드를 써서 남은 검증 공백을 갚는 **검증 Phase** 다.
동작 코드는 한 줄도 바뀌지 않는다(§10-2 · §11-2).

---

## 7. Phase 1 상세 설계

### 7-1. 목표

**실제 포트에서 실제로 뜨고, 실제 요청에 계약 형식으로 답하는** HTTP 면을 만든다.
인증과 루프 배선은 아직 없다. 다만 **기동 실패가 예외로 새지 않는 계약**은 Phase 1 에서 확정한다 —
never-brick 은 나중에 덧대는 것이 아니라 API 모양 그 자체이기 때문이다.

### 7-2. 공개 API — `lib/control-server.js`

```js
// 서버를 띄운다. 🔒 어떤 경우에도 reject 하지 않는다.
async function startControlServer(opts) -> {
  started: boolean,          // 실제로 listen 에 성공했는가
  port:    number | null,    // 실제 바인딩된 포트(0 요청 시 OS 할당 결과)
  address: string | null,    // 실측용. 항상 '127.0.0.1'
  error:   string | null,    // started===false 일 때 사람이 읽는 한 줄
  close:   () => Promise<void>  // 항상 존재. started===false 여도 호출 안전(no-op)
}
```

`opts`:

| 키 | 타입 | 기본 | 설명 |
|---|---|---|---|
| `port` | number | `3210` | `0` 이면 OS 가 빈 포트 할당(테스트용) |
| `getSnapshot` | fn | 필수 | `() => { observation, ctx }`. 부작용 없이 현재 상태를 돌려준다 |
| `version` | string | `package.json` 의 `version` | `/api/health` 의 `version` |
| `startedAt` | Date/number | 호출 시각 | `/api/health` 의 `startedAt` |
| `authToken` | string\|null | `null` | **Phase 2 에서 사용.** Phase 1 은 자리만 둔다 |
| `onLog` | fn | `null` | 서버 내부 이벤트 한 줄 로그(주입). 없으면 침묵 |

🔒 `host` 는 opts 에 없다. `'127.0.0.1'` 상수다.

### 7-3. 상수

```js
const HOST         = '127.0.0.1';   // 🔒 [SPEC] 변경·설정화 금지
const DEFAULT_PORT = 3210;          // control.port 로 덮어쓰기 가능
const SERVICE_ID   = 'quaestor';    // 🔒 [SPEC] 폴더는 Bellows 지만 제품 id 는 quaestor
```

### 7-4. 라우팅 표 (Phase 1)

| 메서드 | 경로 | 응답 |
|---|---|---|
| GET | `/api/health` | 200 · `{ ok:true, id:'quaestor', version, startedAt }` |
| GET | `/api/status` | 200 · `{ ok:true, summary, state, fields, updatedAt }` |
| POST | `/api/stop` | 501 · `{ ok:false, error:'not implemented', note:'...' }` (Phase 2 에서 사유 주석 명문화) |
| GET | 그 외 | 404 · `{ ok:false, error:'not found' }` |
| GET 아닌 것 | `/api/health`·`/api/status` | 405 · `{ ok:false, error:'method not allowed' }` |

공통 헤더: `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store`.
쿼리스트링은 무시한다(`/api/status?x=1` 도 동일 응답). 경로 비교는 `new URL(req.url, 'http://127.0.0.1').pathname` 기준.

### 7-5. `/api/status` 조립 절차

```
1. snap = getSnapshot()            // 없거나 throw 하면 → 6번으로
2. st   = deriveState(snap.observation, snap.ctx, Date.now())
3. body = { ok: true, summary: st.summary, state: st.state,
            fields: st.fields, updatedAt: new Date().toISOString() }
4. 🔒 st 의 필드를 재해석·재판정하지 않는다. 문자열 재조립도 하지 않는다
5. 200 으로 직렬화
6. 실패 시 500 · { ok:false, error:'status unavailable' }  ← 🔒 ok:true 로 내지 않는다
```

`state` 는 `'ok' | 'warn' | 'crit' | 'idle'` 중 하나이며 `deriveState()` 가 정한다.
🔒 **관측이 죽어 있으면 `ok` 가 나올 수 없다** — 003 이 이미 그렇게 판정한다.
이 계층은 그 판정을 **덮어쓰지도, 완화하지도** 않는다.

### 7-6. 오류·예외 처리

- 핸들러 내부 어떤 예외도 `try/catch` 로 잡아 **500 JSON** 으로 답한다. 프로세스 종료 금지
- `server.on('error')` 는 기동 단계에서 한 번만 `resolve({started:false,...})` 로 흡수한다
  (`resolve` 중복 호출 방지 래치 필요 — `EADDRINUSE` 후 늦은 이벤트가 또 올 수 있다)
- 기동 성공 이후의 `server.on('error')` 는 `onLog` 한 줄만 남기고 무시한다
- 응답 본문은 항상 JSON. HTML 오류 페이지·스택 트레이스 노출 금지

### 7-7. Phase 1 검증 방식

`test/control-server.test.js` 를 새로 만들고 `run-all.js` 가 자동으로 집어간다(무수정).
🔒 **주입 픽스처만으로 끝내지 않는다** — `port: 0` 으로 실제 리스너를 띄우고
`fetch('http://127.0.0.1:' + port + '/api/health')` 로 실제 요청을 보낸다.
각 테스트는 `try/finally` 로 `close()` 를 보장해 프로세스가 매달리지 않게 한다.

부작용 부재는 **관측 가능한 방식**으로 증명한다:
`getSnapshot` 호출 횟수를 세고, 그것이 반환한 `observation` 객체가 두 번의 GET 전후로
깊은 동등(특히 `totalPolls`·`totalFailures`)임을 확인한다. STOP.json 경로는 아예 참조되지 않는다.

### 7-8. Phase 1 이 하지 않는 것

- 인증(Phase 2) · `config.js` 의 `control` 블록(Phase 2)
- `watch-loop.js` 수정(Phase 3)
- `POST /api/stop` 의 실제 구현 — 🔒 영구히 하지 않는다(D9)
- `deploy.json` 갱신 · Foreman 쪽 무엇도

---

## 8. Phase 2 상세 설계

### 8-1. 목표

Phase 1 이 만든 HTTP 면에 **문을 단다.** 세 가지를 끝낸다.

1. `bellows-config.json` 의 `control` 블록(`port` · `authToken`)을 `config.js` 가 정규화해 내놓는다
   — Phase 3 의 `watch-loop.js` 배선이 읽어갈 **유일한 원천**이 된다
2. `Authorization: Bearer` 게이트를 **라우팅보다 먼저** 통과시킨다. 비교는 길이 무관 상수시간
3. 🔒 응답 전체에 비밀이 없음을 **테스트로 고정**하고, `POST /api/stop` 미구현 사유를
   코드 주석과 `PROJECT_INTENT.md` 에 남긴다

⚠️ **실측 전제:** `bellows-config.json` 은 지금 디스크에 없다. 즉 이 Phase 를 끝낸 뒤에도
기본 동작은 **토큰 미설정 = 인증 없이 허용**이며, 방어선은 `127.0.0.1` 바인딩 하나다.
🔒 그것이 작업지시서 §5 의 표가 정한 규칙이므로 "안전하게" 기본값을 인증 필수로 바꾸지 않는다 —
바꾸면 Foreman 클라이언트가 붙는 순간 401 만 보게 된다.

### 8-2. 수정 파일

| 파일 | 변경 |
|---|---|
| `lib/config.js` | `control` 블록 정규화 추가 (**additive** — 기존 `enabled`/`thresholds`/`expires_at` 의미 무변경) |
| `lib/control-server.js` | 인증 게이트 + 상수시간 비교 + 기동 로그에 auth 여부. `POST /api/stop` 사유 주석 확정 |
| `test/control-server.test.js` | 인증 케이스 4종 + 비밀 미유출 + `config.control` 정규화 케이스 증분 |
| `PROJECT_INTENT.md` (Synology) | `POST /api/stop` 의도적 미구현 결정 기록 |

🔒 무변경: `lib/observation.js` · `lib/scrape.js` · `watch-loop.js`(Phase 3 몫) · `deploy.json`.

### 8-3. `config.js` — `control` 블록

`HARD_DEFAULTS` 에 다음을 더한다.

```js
control: { port: 3210, authToken: null }
```

`envDefaults()` 는 두 환경변수를 인정한다(기존 `envInt` 재사용).

| 키 | 환경변수 | 파일 경로 | 검증 |
|---|---|---|---|
| `control.port` | `BELLOWS_CONTROL_PORT` | `control.port` | 정수 · `1..65535` 범위 밖이면 **무시하고 기본값** |
| `control.authToken` | `BELLOWS_CONTROL_TOKEN` | `control.authToken` → 없으면 최상위 `authToken` | 문자열 · `trim()` 후 빈 문자열이면 `null` |

- 🔒 **정규화 실패는 예외가 아니라 기본값이다.** `readConfig()` 는 지금도 어떤 입력에도
  throw 하지 않는다 — 그 성질을 유지한다. 설정 파일 오타로 감시 루프가 죽으면 never-brick 위반이다
- 최상위 `authToken` 폴백은 계약 원문의 `bellows-config.json#authToken` 표기를 받는
  **[DERIVED]** 결정이다(§4 "계약 문서와의 불일치 처리"). `control.authToken` 이 우선한다
- 🔒 **`_parseError` · `_expired` 경로도 `control` 기본값을 포함한다.** 즉 설정이 깨졌거나
  만료되면 토큰도 함께 사라져 **인증이 꺼진다.** 이는 의도된 것이다 — `readConfig()` 의
  기존 계약("파일이 못 믿을 상태면 통째로 기본값")을 인증 하나 때문에 바꾸지 않는다.
  방어선은 `127.0.0.1` 이고, 잠기는 쪽으로 바꾸면 설정 오타가 감독 화면을 전부 401 로 만든다
- 🔒 `readConfig()` 는 토큰을 **로그·리턴 문자열에 요약하지 않는다.** 값 그대로 담아 돌려주고,
  그 값이 응답에 새지 않도록 막는 책임은 `control-server.js` 에 있다(§8-5)

### 8-4. 인증 게이트 — `lib/control-server.js`

```js
const crypto = require('node:crypto');

// 길이 무관 상수시간 비교. timingSafeEqual 은 길이가 다르면 throw 하므로
// 양쪽을 고정 길이(32B) SHA-256 다이제스트로 만들어 비교한다.
function sha256(s) { return crypto.createHash('sha256').update(String(s), 'utf8').digest(); }
function tokensMatch(expected, provided) {
  return crypto.timingSafeEqual(sha256(expected), sha256(provided));
}

// 'Bearer <token>' 에서 토큰만 뽑는다. 스킴은 RFC 7235 대로 대소문자 무시.
function bearerFrom(headerValue) -> string | null

// authToken 이 null 이면 항상 통과. 설정돼 있으면 Bearer 일치만 통과.
function isAuthorized(ctx, req) -> boolean
```

`requestListener` 안의 순서:

```
req ─▶ pathname 파싱 ─▶ ① isAuthorized()  ──false──▶ 401 { ok:false, error:'unauthorized' }
                              │ true
                              ▼
                       ② 라우팅(health / status / stop / 404 / 405)
```

- 🔒 **① 이 ② 보다 먼저다**(D12). 토큰이 설정된 상태에서 존재하지 않는 경로를 찔러도
  404 가 아니라 **401** 이 나와야 한다 — 경로 존재 여부를 누설하지 않는다
- 401 헤더에 `WWW-Authenticate: Bearer` 를 붙인다(realm 없음 — realm 문자열에 경로가 실릴 여지를 만들지 않는다)
- 🔒 **401 본문에 기대 토큰·길이·접두사·"토큰이 틀렸다/누락됐다" 구분이 없다.**
  헤더 없음과 값 불일치는 **동일한 응답**이다
- 🔒 **401 의 `ok` 는 `false` 다.** 정보 부재는 성공이 아니다
- 🔒 인증 실패를 `onLog` 에 남길 때도 받은 토큰을 찍지 않는다. 남길 수 있는 것은 경로와 결과뿐

#### 상수시간 비교를 이렇게 하는 이유

`timingSafeEqual(a, b)` 은 `a.length !== b.length` 면 즉시 `RangeError` 를 던진다.
길이로 갈라 먼저 `false` 를 돌려주면 **길이 자체가 타이밍으로 누설**되고, 던지면 500 이 된다.
양쪽을 SHA-256 다이제스트(항상 32바이트)로 정규화하면 길이 분기가 사라진다.
🔒 `expected === provided` 같은 `===`/`==` 단축 비교를 남기지 않는다 — 하나만 남아도 상수시간이 깨진다.

### 8-5. 비밀 차단 — 응답 전체 관점

003 은 `fields` 화이트리스트로 비밀을 막았다. 이 Phase 는 그 검사를 **응답 JSON 전체**로 넓힌다.

| 새는 경로 | 차단 |
|---|---|
| `authToken` 값 | 서버는 토큰을 `ctx` 에만 보관하고 어떤 응답 본문·헤더에도 싣지 않는다 |
| `.profile` 경로 · 쿠키 · 계정 | `/api/status` 는 `deriveState()` 결과만 싣는다(D7 — 재가공 없음) |
| 예외 메시지 | `getSnapshot()`/`deriveState()` 예외는 고정 문구 `'status unavailable'` 로만 답한다(Phase 1 확정) |
| 설정 파일 경로 | `error` 문자열에 경로를 넣지 않는다. 기동 실패 메시지는 `onLog` 쪽(응답 아님)에만 간다 |

🔒 검증은 **응답 전체를 문자열화해 부분 문자열을 찾는 방식**으로 한다 —
필드별 화이트리스트 점검은 새 필드가 추가될 때 조용히 통과한다.

### 8-6. `POST /api/stop` — 🔒 영구 미구현 명문화

Phase 1 이 이미 501 + 주석을 심었다. Phase 2 가 확정하는 것:

- 코드 주석에 **근거**를 남긴다: 계약이 "확인 없이 호출한다"고 규정하므로,
  안전장치를 끄는 동작을 이 경로에 붙이면 확인 없이 차단기가 꺼진다
- `PROJECT_INTENT.md`(Synology 스펙 폴더)에 같은 결정을 남긴다 —
  다음 사람이 "계약에 있는데 왜 없지?" 하고 무심코 추가하지 않도록
- 🔒 인증 게이트는 이 경로에도 **동일하게** 적용된다(토큰 설정 시 401 이 501 보다 먼저)

### 8-7. 데이터 흐름 (Phase 1 → 2 통합)

```
bellows-config.json (없을 수도 있음)
        │  readConfig()   ← [Phase 2 추가] control 블록 정규화
        ▼
{ enabled, thresholds, expires_at, control: { port, authToken } }
        │
        │ (Phase 3 이 배선한다 — 이 Phase 는 값을 만들 뿐)
        ▼
startControlServer({ port: cfg.control.port, authToken: cfg.control.authToken, getSnapshot, onLog })
        │
        ▼
  ctx = { getSnapshot, version, startedAt, authToken }   🔒 authToken 은 여기서 끝. 응답에 안 나간다
        │
   요청 ─▶ isAuthorized(ctx, req) ─┬─ false ─▶ 401 { ok:false, error:'unauthorized' }
                                  └─ true  ─▶ Phase 1 의 라우팅 그대로
```

기동 로그(값이 아니라 **여부**만):

```
[control] listening on 127.0.0.1:3210
[control] auth: enabled        // 또는  auth: disabled (loopback only)
```

### 8-8. Phase 2 검증 방식

Phase 1 과 동일하게 **실제 포트를 열고 실제 요청**을 보낸다(`port: 0` + `fetch`, `try/finally` 로 `close()`).

- 토큰 설정 서버 1개 + 미설정 서버 1개를 각각 띄워 4가지 조합을 확인한다
  (헤더 없음 / 틀린 토큰 / 맞는 토큰 / 미설정+헤더 없음)
- 상수시간 성질은 **시간 측정으로 증명하지 않는다**(플레이키). 대신
  ① 길이가 크게 다른 토큰으로도 throw 없이 401 이 나오는지,
  ② 소스에 `===`/`==` 토큰 비교와 길이 분기가 없는지로 고정한다
- 비밀 미유출은 응답 본문 전체 문자열에 대한 부분 문자열 부재로 확인한다
- `config.control` 정규화는 임시 JSON 파일을 써서 `readConfig()` 를 직접 호출해 확인한다
  (HTTP 없이 — 순수 함수 경계)

### 8-9. Phase 2 가 하지 않는 것

- `watch-loop.js` 수정 — Phase 3
- `POST /api/stop` 실제 구현 — 🔒 영구히 하지 않는다(D9)
- `deploy.json` 갱신 · Foreman 쪽 무엇도
- 레이트리밋 · HTTPS · CORS — 로컬 루프백 제어면에 불필요하고, 계약이 요구하지 않는다

---

## 9. Phase 3 상세 설계 (DONE)

### 9-1. 목표

Phase 1·2 가 만든 HTTP 면을 **본체(감시 루프)에 배선**한다. 이 Phase 가 끝나야
`run-bellows.ps1` 로 띄운 감시자가 실제로 `127.0.0.1:3210` 에 응답한다(USER_GATE 의 대상).

🔒 **이 Phase 의 유일한 위험은 하나다: 계기판이 차단기를 죽이는 것.**
지금까지 `watch-loop.js` 는 HTTP 를 몰랐고, 그래서 HTTP 가 어떻게 고장 나도 폴링은 돌았다.
배선하는 순간 그 성질이 깨질 수 있다. 아래 설계의 절반은 그것을 막는 데 쓰인다.

### 9-2. 수정 파일

| 파일 | 변경 |
|---|---|
| `watch-loop.js` | 컨트롤 서버 배선(**additive**) + `getSnapshot` 원천 캐시(`lastCfg`/`lastStop`/`lastConfigSource`) |
| `test/watch-loop.test.js` | 배선 검증 증분 — 모듈 로드 경계(리스너 미기동) · never-brick 구조 |
| `test/control-server.test.js` | 배선 **형태**의 통합 검증 증분(라이브 클로저 · 기동 실패 후 진행) + env 우선순위 자동화 |

🔒 무변경: `lib/control-server.js`(Phase 1·2 에서 완성) · `lib/observation.js` · `lib/scrape.js` ·
`lib/config.js` · `run-bellows.ps1` · `deploy-bellows.ps1` · `deploy.json`.

⚠️ Phase 2 평가가 남긴 [DERIVED] 공백 하나를 이 Phase 에서 갚는다:
`BELLOWS_CONTROL_PORT` / `BELLOWS_CONTROL_TOKEN` 우선순위가 수동 `node -e` 검증에만 의존했다.
자동 테스트로 승격한다(§9-8).

### 9-3. 🔒 배선의 3대 제약 (설계의 골격)

| # | 제약 | 이유 | 코드에 나타나는 모양 |
|---|---|---|---|
| C1 | **모듈 로드 시 포트를 열지 않는다** | `require('../watch-loop.js')` 하는 테스트가 3210 을 점유하고 열린 핸들로 매달린다. 003 이 `require.main` 가드로 얻은 성질을 HTTP 가 깨뜨리면 안 된다 | `startControlServer()` 호출은 **`mainLoop()` 안**에만 있다. 모듈 최상위에 없다 |
| C2 | **HTTP 기동 실패가 루프에 닿지 않는다** | never-brick. 차단기가 계기판 때문에 죽으면 안 된다 | `await` 결과를 분기해 로그만 남기고, 그 뒤 `while(true)` 로 **무조건** 진입 |
| C3 | **`getSnapshot()` 은 I/O 를 하지 않는다** | GET 이 부작용을 만들면 안 된다. 특히 STOP.json 을 건드리면 🔒 불변 위반 | 폴링이 이미 읽은 값을 모듈 변수에 **캐시**하고, 스냅샷은 메모리만 읽는다 |

### 9-4. `watch-loop.js` 배선 — 구체 설계

#### (a) 새 모듈 변수 (관측 원천의 나머지 절반)

`observation` 은 003 이 이미 모듈 변수로 들고 있다. `deriveState(obs, ctx, now)` 의 **`ctx`** 쪽
(`enabled` · `thresholds` · `stop` · `configSource`)이 아직 어디에도 남지 않는다 —
`pollOnce()` 가 지역 변수로 읽고 버린다. 그래서 세 개를 추가한다.

```js
let observation = createObservation();   // 기존
let lastCfg = null;                      // 마지막 폴에서 읽은 config (enabled/thresholds)
let lastStop = null;                     // 마지막 폴에서 관측한 STOP.json 내용 (또는 null)
let lastConfigSource = 'default';        // 'file' | 'default'
```

- 🔒 **`lastStop` 은 새 파일 읽기를 만들지 않는다.** `pollOnce()` 가 **이미 호출하는**
  `readStopJson()` 의 결과와, 이미 아는 write/unlink 결과를 그대로 대입할 뿐이다.
  fs 호출 횟수가 늘면 이 설계를 잘못 구현한 것이다
- `lastConfigSource` 는 `pollOnce()` 가 `readConfig()` 를 부른 **그 자리에서** 정한다:
  파일이 존재하고 `_parseError`·`_expired` 가 없으면 `'file'`, 아니면 `'default'`.
  `readConfig()` 를 바꾸지 않는다(🔒 Phase 2 에서 확정된 순수 경계)
- 초기값의 의미: 첫 폴 이전에는 `lastCfg === null` → `getSnapshot()` 이 `ctx.enabled` 를
  기본값(`true`)으로 넘긴다 → `observation.lastSuccessAt === null` 이므로
  `deriveState()` 가 `warn`(첫 측정 대기 중)을 낸다. 🔒 **`ok` 가 아니다.** 의도된 결과다

#### (b) `getSnapshot()` — 라이브 클로저

```js
function controlSnapshot() {
  return {
    observation: observation,          // 🔒 캡처가 아니라 현재 값 참조
    ctx: {
      enabled:      lastCfg ? lastCfg.enabled : true,
      thresholds:   lastCfg ? lastCfg.thresholds : undefined,  // undefined -> observation 이 기본값 적용
      stop:         lastStop,
      configSource: lastConfigSource
    }
  };
}
```

🔒 **기동 시점의 값을 캡처해 넘기면 안 된다.** `observation` 은 `pollOnce()` 가
`recordSuccess`/`recordFailure` 로 **재대입**하는 변수다. 값을 한 번 넘겨두면 서버는
영원히 기동 직후의 빈 관측을 보여준다 — 정확히 "3주 침묵을 초록불로" 재현하는 형태다.
매 호출마다 모듈 변수를 다시 읽는 **함수**여야 한다.

`thresholds` 를 `undefined` 로 넘기는 것은 안전하다 — `normalizeThresholds()` 가
`DEFAULT_THRESHOLDS`(85/70/90/75)를 채운다. 🔒 임계값을 이 파일에서 다시 쓰지 않는다.

#### (c) 기동 배선 — `mainLoop()` 진입부

```
mainLoop()
  ├─ log('[start] ...')                       (기존)
  ├─ cfg0 = readConfig(CONFIG_PATH)           ← 포트·토큰 결정용 1회 읽기
  ├─ try {
  │    r = await startControlServer({
  │          port:      cfg0.control.port,
  │          authToken: cfg0.control.authToken,
  │          getSnapshot: controlSnapshot,
  │          onLog: log
  │        })
  │    r.started ? (onLog 가 이미 남김)
  │              : log('[control] listen failed: ' + r.error)
  │  } catch (e) { log('[control] listen failed: ' + e.message) }   ← C2 이중 방어
  └─ ★ 어느 쪽이든 while(true) 진입 ★
```

- `onLog: log` 를 주입하므로 성공 시 `[control] listening on 127.0.0.1:<port>` 와
  `[control] auth: enabled|disabled (loopback only)` 가 `bellows.log` 에 남는다(Phase 2 형식 그대로)
- 🔒 **`try/catch` 는 중복 방어다.** `startControlServer()` 는 계약상 throw 하지 않지만,
  `require` 실패·계약 회귀·주입 콜백의 동기 예외까지 루프에 닿지 않게 한다.
  중복이라도 남긴다 — 여기서 새는 예외의 대가는 "감시자가 조용히 죽는 것"이다
- 🔒 반환된 `close()` 를 붙잡아 두지 않는다. 감시자는 상시 프로세스이고,
  종료 경로가 없으므로 종료 훅을 새로 만들지 않는다(범위 밖)

#### (d) 설정 갱신 정책 — [DERIVED]

`control.port` 와 `control.authToken` 은 **기동 시 1회** 확정한다. 폴마다 재읽기하지 않는다.

- 근거: 포트를 런타임에 바꾸려면 리스너를 닫고 다시 열어야 하고, 그 과정 자체가
  never-brick 을 위협하는 새 실패 지점이다. 계기판 설정 하나 때문에 만들 위험이 아니다
- `enabled`·`thresholds` 는 지금처럼 폴마다 갱신된다(`lastCfg` 를 통해 `/api/status` 에 반영)
- 변경 방법은 **재시작**이다. `PROJECT_INTENT.md`/EVAL 의 How to Run 에 남긴다

#### (e) 🔒 손대지 않는 것 (재확인)

`resolveStopDir()` · `readStopJson()` · `writeStopJsonAtomic()` · `deriveDesired()` ·
`isValidUsage()` · STOP.json 스키마 · 임계·히스테리시스 · 수동 STOP 우선 규칙 ·
`require.main === module` 가드 — **전부 무변경**. 이 Phase 는 그 사이에 대입문 몇 개와
기동부 한 블록을 끼워 넣을 뿐이다.

### 9-5. 데이터 흐름 (배선 완료 후)

```
                      ┌──────────── watch-loop.js (프로세스 1개) ────────────┐
 기동 ─▶ readConfig ─▶ startControlServer(port, authToken, controlSnapshot, log)
                      │        │                                              │
                      │        └─ started=false ─▶ log('[control] listen failed: …')
                      │                                    │                  │
                      │        ★ 어느 쪽이든 ★ ────────────┘                  │
                      ▼                                                       │
       while(true) pollOnce()                                                 │
            ├─ readConfig()      ─▶ lastCfg, lastConfigSource                 │
            ├─ scrapeUsage()     ─▶ recordSuccess/recordFailure ─▶ observation│
            ├─ readStopJson()    ─▶ lastStop                                  │
            └─ write/unlink STOP ─▶ lastStop 갱신   🔒 로직 무변경             │
                      └───────────────────────────────────────────────────────┘
                                        │ 모듈 변수 (메모리)
                                        ▼
      GET /api/status ─▶ controlSnapshot() ─▶ deriveState() ─▶ 200 JSON
                          🔒 fs 접근 0 · 스크랩 0 · STOP.json 접근 0
```

### 9-6. 실패 모드 표 (배선이 만들어낼 수 있는 사고)

| 시나리오 | 요구 동작 | 어떻게 보장하나 |
|---|---|---|
| 3210 을 다른 프로세스가 점유 | 로그 1줄 + 폴링 계속 | `started:false` 분기 → 루프 진입 |
| 감시자를 두 번 띄움 | 두 번째도 폴링은 돈다(HTTP 만 없음) | 위와 동일 |
| `getSnapshot` 내부 예외 | 500 응답, 프로세스 생존 | Phase 1 의 `try/catch` + `'status unavailable'` |
| 첫 폴 이전에 `/api/status` 호출 | `warn`(첫 측정 대기 중). 🔒 `ok` 아님 | `observation.lastSuccessAt === null` |
| 측정이 3주째 실패 중 | `crit` | 003 의 `deriveState()` 그대로 — 이 층은 덮지 않는다 |
| `bellows-config.json` 이 깨짐 | 기본 포트·인증 없음으로 기동, 폴링 계속 | `readConfig()` never-throw(Phase 2) |
| 테스트가 watch-loop 을 require | 포트를 열지 않고 즉시 반환 | C1 — 호출이 `mainLoop()` 안에만 존재 |

### 9-7. 통합 검증 전략 — 무엇을 어디서 증명하나

⚠️ **제약 실측:** `watch-loop.js` 는 모듈 로드 시 `resolveStopDir()` 로 **실제** Synology
`.prominence` 를 잡고, 없으면 `process.exit(1)` 한다. 이는 🔒 불변(MASTER.md)이고 주입 가능하게
바꾸지 않는다. 따라서 **`pollOnce()` 를 테스트에서 구동하지 않는다** — 구동하면 이 기계의
진짜 STOP.json 과 bellows.log 를 건드린다. 003 의 `watch-loop.test.js` 가 이미 채택한 원칙이고,
Phase 3 도 그대로 따른다.

그래서 검증을 두 곳으로 나눈다.

| 대상 | 어디서 | 방식 |
|---|---|---|
| **배선의 존재와 형태** | `watch-loop.test.js` | 소스 구조 검증 + 모듈 로드 경계 행동 검증 |
| **배선의 동작(라이브성·never-brick)** | `control-server.test.js` | 배선과 **동일한 형태**를 테스트 안에서 재구성해 실포트로 검증 |

🔒 **소스 grep 만으로 끝내지 않는다.** "wiring shape" 를 실제로 돌려 본다 — 즉
`let obs = createObservation(); const snap = () => ({observation: obs, ctx});` 로 서버를 띄우고,
`obs = recordFailure(obs, ...)` 로 **재대입**한 뒤 `/api/status` 가 새 값을 보는지 확인한다.
이것이 (b) 의 "캡처 금지" 조항을 행동으로 고정하는 유일한 방법이다.

#### C1(모듈 로드 시 리스너 미기동) 검증 방법

`watch-loop.test.js` 상단에서 `require('../lib/control-server')` 를 먼저 가져와
`startControlServer` 를 호출 횟수 카운터로 교체한 뒤 `require('../watch-loop.js')` 한다.
`watch-loop.js` 는 로드 시점에 구조분해하므로 교체본을 집는다.
🔒 **로드 직후 카운터가 `0` 이어야 한다.** 테스트 종료 시 원본을 복구한다.

(보조) 소스 구조 검증: `startControlServer(` 호출이 `mainLoop` 함수 본문 안에 있고,
모듈 최상위 실행 경로에 없다.

### 9-8. Phase 3 테스트 항목 (신규분 개요)

**`watch-loop.test.js` 증분**
1. 모듈 로드 시 `startControlServer` 호출 0회 (C1, 행동)
2. `startControlServer(` 호출이 `mainLoop()` 본문 안에 존재 (C1, 구조)
3. `getSnapshot`(=`controlSnapshot`)이 **함수로** 주입되고, 그 본문이 `observation` 모듈 변수를 참조 (라이브성, 구조)
4. 기동 실패 문자열 `'[control] listen failed'` 가 소스에 존재 (§4 "조용히 삼키지 않는다")
5. `startControlServer` 호출부가 `try`/결과 분기로 감싸여 있고, 그 뒤에 폴링 루프가 온다 (C2, 구조)
6. `controlSnapshot()` 본문에 `fs.` 호출·`scrapeUsage`·`STOP_PATH` 참조가 없다 (C3, 구조)
7. 기존 6개(무회귀): `require.main` 가드 · 관측 배선 · kind/hint 로그 · 불변 헬퍼 잔존 · `claude` 0건

**`control-server.test.js` 증분**
8. **라이브 클로저**: 서버 기동 후 `observation` 을 재대입하면 다음 `/api/status` 가 새 `state` 를 낸다
   (예: `ok`/`warn` → 연속 실패 5회 주입 → `crit`)
9. **never-brick 시뮬레이션**: 점유된 포트로 기동 → `started === false` → 그 뒤 코드가 계속 실행됨
   (루프 대역 카운터 증가로 확인). 예외가 새지 않는다
10. **첫 폴 이전 상태**: 빈 `createObservation()` + `ctx` 미설정으로 `/api/status` → `state !== 'ok'`
    (🔒 측정 전 초록불 금지)
11. **`ctx` 전달 검증**: `lastStop` 에 해당하는 값을 넣으면 `fields` 의 `STOP` 항목이 그것을 반영,
    `configSource: 'file'` 이면 `설정 출처` 필드가 `파일`
12. **env 우선순위 자동화**(Phase 2 잔여): `BELLOWS_CONTROL_PORT`/`BELLOWS_CONTROL_TOKEN` 이
    기본값을 덮고, 파일 값이 있으면 파일이 이긴다 — `process.env` 를 세팅/복구하며 `readConfig()` 직접 호출
13. 모든 신규 서버는 `try/finally` 로 `close()` — 프로세스 매달림 없음

### 9-9. Phase 3 가 하지 않는 것

- `POST /api/stop` 구현 — 🔒 영구히 하지 않는다(D9)
- `run-bellows.ps1` / `deploy-bellows.ps1` / `deploy.json` 수정 — 범위 밖(데이터·배포 계약은 사람 몫)
- `resolveStopDir()` 를 주입 가능하게 만들기 — 🔒 불변. hermetic 하게 만들려고 안전장치의 경로 해석을 흔들지 않는다
- 런타임 설정 리로드(포트·토큰 hot reload) — §9-4(d)
- Foreman 쪽 무엇도 · 폴더/저장소 개명

---

## 10. Phase 4 상세 설계 (DONE — 종단 통합 검증 · 계약 대조)

### 10-0. 이 Phase 가 왜 있나

Phase 3 은 eval 에서 완료 판정(122/122, exit 0)을 받았지만 Phase Guard 로 승격이 유예됐다.
그 유예를 그냥 소비하지 않고, 004 를 닫기 전에 **아직 한 번도 검증되지 않은 이음매 하나**를 갚는다.

🔒 **지금까지의 모든 실포트 통합 테스트는 `port: 0`(OS 임의 할당)으로 돌았다.**
계약 원문(`_guides\SUPERVISED_TOOL_CONTRACT.md` §부팅층)이 못 박은 주소는
`"baseUrl": "http://127.0.0.1:3210"` 이고, Foreman 은 **그 주소로만** 찾아온다.
즉 **계약이 지정한 바로 그 포트에 실제로 뜨는가**는 이 제품에서 한 번도 확인된 적이 없다.
`readConfig()` 의 기본 포트 3210 은 단위 테스트가, 리스너는 임의 포트 테스트가 각각 확인했을 뿐이고,
**둘을 잇는 조립 경로**(`readConfig() → startControlServer() → 3210 바인딩)는 공백이다.

이것은 003 이 남긴 교훈의 같은 모양이다 — **격리 통과 · 통합 실패.**
부품은 각각 옳았고 3주 동안 아무도 몰랐다. 그 형태를 다시 만들지 않는다.

### 10-1. 목표 (3가지, 전부 검증·문서)

1. **조립 경로 종단 검증** — `readConfig()` 가 내놓은 값 그대로 `startControlServer()` 에 넘겨
   계약이 지정한 기본 주소에 실제로 바인딩하고 `/api/health`·`/api/status` 왕복을 확인한다
2. **계약 원문 1:1 대조** — 계약의 "도구 쪽 체크리스트" 전 항목에 대해
   충족 / 의도적 미구현 / 대상 밖을 명시한 대조표를 남긴다
3. **이탈점 인수인계** — 계약 예시와 이 구현이 다른 두 곳(`id`, `tokenFrom`)을 기록해
   Foreman 쪽 절반(`products\Foreman\work\010`)이 잘못된 키로 붙지 않게 한다

### 10-2. 🔒 이 Phase 가 수정하지 않는 것

| 대상 | 이유 |
|---|---|
| `lib/control-server.js` · `lib/config.js` · `lib/observation.js` · `lib/scrape.js` | Phase 1·2 에서 계약을 만족한 상태로 확정됐다. 검증 Phase 가 동작 코드를 건드리면 검증의 의미가 사라진다 |
| `watch-loop.js` | Phase 3 에서 배선 완료. 🔒 불변 헬퍼·STOP.json 경로·`require.main` 가드 전부 무변경 |
| `run-bellows.ps1` · `deploy-bellows.ps1` · `deploy.json` | 범위 밖(§7 — 데이터·배포 계약은 사람 몫) |
| `_guides\SUPERVISED_TOOL_CONTRACT.md` | 🔒 **남의 제품(Foreman)이 소유한 계약 문서다.** "구현 현황" 표가 이 제품을 아직 ❌ 로 적고 있어도 이 NNN 이 고치지 않는다 — 계약은 Foreman 이 정의하고 대상이 맞춘다(의존 방향) |
| `work/` · `MASTER.md` | forge 규칙상 불변 |

즉 **변경 파일은 테스트 1개와 인수인계 문서뿐이다.**

| 파일 | 변경 |
|---|---|
| `p-bellows/test/control-server.test.js` | 조립 경로 종단 검증 증분(§10-3) |
| `CONTINUATION.md` (Synology) | 계약 대조표 + 이탈점 기록(§10-4·10-5) |

### 10-3. 조립 경로 종단 검증 — 설계

#### (a) 검증 대상 이음매

```
bellows-config.json (없음 — 실측)
        │  readConfig(CONFIG_PATH)          ← Phase 2
        ▼
  cfg.control = { port: 3210, authToken: null }
        │  ★ 이 대입이 이번 Phase 의 검증 대상 ★     ← Phase 3 의 배선과 동일한 형태
        ▼
  startControlServer({ port: cfg.control.port, ... })   ← Phase 1
        ▼
  실제 리스너 : 127.0.0.1:3210                 ← 계약의 baseUrl
        ▼
  fetch('http://127.0.0.1:3210/api/health')  → 200 · id==='quaestor'
  fetch('http://127.0.0.1:3210/api/status')  → 200 · summary·state·fields
```

🔒 **`3210` 을 테스트에 리터럴로 다시 적어 넣고 그것으로 서버를 띄우면 이 검증은 무의미하다.**
포트 값은 반드시 `readConfig()` 가 돌려준 값에서 와야 한다. 테스트가 확인하는 것은
"3210 에서 서버가 뜨는가" 가 아니라 **"설정 경로가 계약 주소를 만들어내는가"** 이다.
계약 리터럴 `3210` 은 오직 **기대값 쪽**(assert 우변)에만 등장한다.

#### (b) 🔒 포트 점유는 실패가 아니다 — 플레이키 회피 설계

3210 은 실측상 비어 있지만, **감시자가 실제로 돌고 있으면 점유돼 있다.**
그 경우 테스트를 빨갛게 만들면 "제품이 정상 동작 중일 때 테스트가 깨지는" 형태가 된다.

그래서 이 테스트의 판정은 **이지선다(二枝選多)** 로 쓴다:

```
r = await startControlServer({ port: cfg.control.port, getSnapshot, ... })

r.started === true  ─▶ r.port === 3210 이고 r.address === '127.0.0.1' 이며
                       /api/health·/api/status 왕복이 계약 형식으로 성공한다
r.started === false ─▶ r.error 가 비어 있지 않고, 예외가 새지 않았으며,
                       그 뒤 테스트 코드가 계속 실행된다 (never-brick 재확인)
```

🔒 **두 가지 중 어느 쪽도 아닌 경우(throw · `started` 부재 · `port` 불일치)만 실패다.**
이것은 기준을 무르게 하는 것이 아니라, 계약이 요구하는 성질(never-brick)을
검증 자체에 반영하는 것이다. `started === true` 경로가 이 기계의 정상 상태이며
CI 없이 로컬에서 도는 이 프로젝트에서는 사실상 항상 그 경로를 탄다.

#### (c) 왜 `watch-loop.js` 를 자식 프로세스로 띄우지 않는가

가장 강한 통합은 `node watch-loop.js` 를 실제로 돌려 3210 을 찌르는 것이다. **하지 않는다.**

- 🔒 `watch-loop.js` 는 모듈 로드 시 `resolveStopDir()` 로 **이 기계의 실제** `.prominence` 를 잡고,
  루프가 돌면 진짜 `STOP.json` 과 `bellows.log` 를 쓴다. 테스트가 안전장치의 실물을 오염시킨다
- Chrome 이 `--remote-debugging-port=9222` 로 떠 있어야 해 hermetic 이 깨진다
- 003·Phase 3 이 이미 채택한 원칙(`pollOnce()` 를 테스트에서 구동하지 않는다)을 뒤집게 된다

대신 **배선과 동일한 형태**(`readConfig()` → 같은 인자 조립 → `startControlServer()`)를
테스트 안에서 재구성한다. Phase 3 의 구조 검증이 "`mainLoop()` 이 이 형태를 쓴다"를 이미 고정했고,
이번 Phase 가 "그 형태가 계약 주소를 만든다"를 고정한다. 둘이 만나면 종단이 닫힌다.

#### (d) 정리 조항

- `try/finally` 로 `close()` 보장. 🔒 **테스트가 3210 을 붙잡은 채 끝나면 그 다음 실행이
  전부 `started:false` 가 되어 이 검증이 스스로를 무력화한다**
- `close()` 이후 같은 포트가 다시 바인딩 가능함을 확인해 핸들 누수를 배제한다
- 이 테스트는 파일에서 **마지막**에 두어, 앞선 임의 포트 테스트들과 자원이 겹치지 않게 한다

### 10-4. 계약 원문 대조표 (산출물)

계약 §"도구 쪽 체크리스트" 를 그대로 옮겨 현재 상태를 못 박는다.

| 계약 체크리스트 | 이 제품 | 근거 |
|---|---|---|
| `GET /api/health` 노출 (최소 `{ok, id}`) | ✅ 충족 | Phase 1. `id='quaestor'`·`version`·`startedAt` 포함 |
| `GET /api/status` — `summary`·`state`·`fields` | ✅ 충족 | Phase 1. `deriveState()` 무재판정 투영 |
| `POST /api/stop` | 🔒 **의도적 미구현(501)** | 계약상 선택 조항. "Foreman 은 확인 없이 호출한다" → 안전장치를 확인 없이 끌 수 없다(D9) |
| `Authorization: Bearer` 확인 | ✅ 충족 | Phase 2. 상수시간 비교. 미설정 시 통과 |
| 응답에 비밀 없음 | ✅ 충족 | Phase 2. 응답 전체 문자열 부분검사로 고정 |
| Foreman `supervised[]` 에 항목 추가 | ⛔ **대상 밖** | Foreman 저장소의 설정. 🔒 이쪽에서 건드리면 의존 방향이 뒤집힌다 |
| 이관 시 `roots` 앞에 새 경로 추가 | ⛔ **대상 밖** | 동상 |
| 도구가 Foreman 을 `require` 하지 않는다 | ✅ 충족 | 전 Phase. Foreman 참조 0건 |

계약 §"부재 규칙" 중 **이 제품이 책임지는 행**:

| 상황 | 계약 요구 | 이 제품의 보장 |
|---|---|---|
| 응답 JSON 이 깨짐 | Foreman 은 "형식 오류" 표시 후 화면 유지 | 🔒 모든 경로(200/401/404/405/500/501)가 **항상 유효한 JSON** 을 낸다 — HTML 오류 페이지·스택 트레이스 없음 |
| HTTP 응답 없음 | Foreman 은 "응답 없음" 표시 | 서버가 안 떠도(never-brick) 감시 루프는 돈다. 대상 부재가 Foreman 을 깨뜨리지 않는 것은 Foreman 쪽 책임 |
| `control` 이 없음 | "계약 미구현" 표시 | 해당 없음(구현함) |

### 10-5. 🔒 계약 문서와의 이탈점 — 인수인계 기록

계약 원문의 예시와 이 구현이 **의도적으로 다른 두 곳**이 있다.
이 둘이 기록되지 않으면 Foreman 쪽 절반(`work\010`)이 잘못된 키로 붙어 조용히 빈 칸을 그린다.

| 위치 | 계약 원문 예시 | 이 구현 | 근거 · Foreman 이 해야 할 일 |
|---|---|---|---|
| `supervised[].id` | `"bellows"` | **`"quaestor"`** | 작업지시서 §2 가 계약 예시를 덮는다(제품명 확정). Foreman 설정의 키를 `quaestor` 로 적어야 한다 |
| `control.tokenFrom` | `"bellows-config.json#authToken"` | **`control.authToken`** 우선, 최상위 `authToken` 폴백 | §4 "계약 문서와의 불일치 처리". 🔒 **폴백을 남겨 뒀으므로 계약 원문 표기대로 써도 동작한다** — 이탈이 파손을 만들지 않는 형태로 흡수돼 있다 |

추가 기록 사항:
- `baseUrl` 은 `http://127.0.0.1:3210` — 🔒 이 Phase 가 **실제 바인딩으로 확인**한 값이다
- 포트·토큰은 **기동 시 1회** 확정된다. 변경은 재시작(§9-4(d))
- `deploy.json` 의 포트 반영은 사람 몫(§7) — 이 기록이 그 근거가 된다

기록 위치는 `CONTINUATION.md`(Synology 스펙 폴더)다.
🔒 `_guides\SUPERVISED_TOOL_CONTRACT.md` 는 고치지 않는다 — 남의 제품이 소유한 문서다.

### 10-6. Phase 4 검증 방식

| 무엇 | 어디서 | 방식 |
|---|---|---|
| 조립 경로 종단 | `test/control-server.test.js` | `readConfig()` → `startControlServer()` → 실바인딩 → `fetch` 왕복. `try/finally` close |
| 무회귀 | `node p-bellows/test/run-all.js` | 기존 122개 전부 통과 · 종료 코드 0 · 프로세스 미매달림 |
| 엔트리포인트 | `deploy-bellows.ps1 -DryRun` | 종료 코드 0 (PS 5.1 파싱 0 errors) |
| 계약 대조 | 문서 | §10-4 표가 `CONTINUATION.md` 에 남는다 |
| USER_GATE | 사람 | §11 |

🔒 **기존 122개 중 어느 하나도 삭제·완화하지 않는다.** 이 Phase 는 순증분이다.

### 10-7. Phase 4 가 하지 않는 것

- `POST /api/stop` 구현 — 🔒 영구히 하지 않는다(D9)
- `lib/*` · `watch-loop.js` 의 동작 코드 수정 — §10-2
- `_guides` 의 계약 문서 수정 · Foreman 저장소의 무엇도 — 🔒 의존 방향
- `deploy.json` · `run-bellows.ps1` · `deploy-bellows.ps1` 수정 — 범위 밖
- `watch-loop.js` 를 자식 프로세스로 띄우는 통합 테스트 — §10-3(c)
- 폴더·저장소 개명(`Bellows` → `Quaestor`) — 별도 시스템 스펙

---

## 11. Phase 5 상세 설계 (CURRENT — 역경로·강건성 매트릭스)

### 11-0. 이 Phase 가 왜 있나

Phase 4 도 완료 판정(123/123, exit 0)을 받았지만 Phase Guard 로 승격이 유예됐다.
그 라운드를 다시 검증 공백에 쓴다. 갚을 것이 정확히 두 개 남아 있고, 둘 다 **추측이 아니라
실제 지적·실제 구조에서** 나왔다.

**① Phase 4 eval 이 남긴 지적 (유일한 미해결 Issue).**
"모든 응답 경로(200/401/404/405/500/501)가 파싱 가능한 JSON" 이라는 §10-4 의 보장은
**직접 단언된 적이 없다.** eval 이 스스로 적었듯, 다른 테스트들이 `res.body.ok` 를 참조하다가
파싱이 깨졌으면 `null.ok` 에서 터졌을 것이라는 **간접 논증**으로 커버되어 있을 뿐이다.
🔒 우연한 커버리지는 커버리지가 아니다 — 그 테스트들이 나중에 리팩터링되면 조용히 사라진다.

**② 지금까지의 모든 HTTP 검증은 `fetch` 가 보내는 선량한 요청뿐이었다.**
`control-server.test.js` 의 60여 개 테스트 중 비정상 클라이언트를 흉내 내는 것은 하나도 없다.
그런데 이 제품은 **상시 프로세스**이고, 작업지시서 §4 의 조항은
"핸들러 예외가 나도 감시 루프는 계속 돈다" 이다. 지금 검증된 것은
"기동 실패해도 루프가 돈다"(Phase 3)까지이며, **뜬 뒤에 들어오는 이상한 요청**이
프로세스를 죽이지 않는가는 004 를 통틀어 한 번도 확인된 적이 없다.

이 둘은 003 이 남긴 교훈의 같은 모양이다 — **부품은 각각 옳고, 아무도 실물을 찔러보지 않았다.**

### 11-1. 목표 (3가지, 전부 검증)

1. **응답 형식 매트릭스 직접 단언** — 도달 가능한 모든 상태 코드를 실제로 유발하고,
   각각에 대해 본문 파싱·헤더·`ok` 타입·비밀 부재를 **그 자리에서** 단언한다
2. **역경로 매트릭스** — well-formed 이지만 비정상인 요청들(경로 변형·미지 메서드·중복 헤더·
   본문 있는 GET)에 대해 계약면이 무너지지 않음을 고정한다
3. **복원력** — 동시 요청, 응답 도중 연결 중단, HTTP 파서를 깨는 바이트열 앞에서
   **프로세스가 살아남고 다음 요청이 정상 처리됨**을 확인한다

### 11-2. 🔒 이 Phase 가 수정하지 않는 것 (검증 Phase 의 자기 구속)

| 대상 | 이유 |
|---|---|
| `lib/control-server.js` · `lib/config.js` · `lib/observation.js` · `lib/scrape.js` · `watch-loop.js` | Phase 1~3 에서 확정. 🔒 검증 Phase 가 검증 대상을 고치면 검증의 의미가 사라진다 |
| `run-bellows.ps1` · `deploy-bellows.ps1` · `deploy.json` | 범위 밖(§7) |
| `_guides\SUPERVISED_TOOL_CONTRACT.md` · Foreman 저장소 | 🔒 남의 제품 소유. 의존 방향 |
| `work/` · `MASTER.md` | forge 규칙상 불변 |

**변경 파일은 `p-bellows/test/control-server.test.js` 하나뿐이다.**

⚠️ 단 하나의 예외: 프로브가 **실제 [SPEC] 위반**(예: 어떤 요청 하나로 프로세스가 죽는다)을
드러내면 그것은 결함이므로 최소 수정한다. 그 경우 **무엇이 왜 바뀌었는지를 TEST_RESULT.md 에
명시**한다. 🔒 "테스트를 통과시키려고" 소스를 고치는 것과는 다르다 — 기대값을 소스에 맞춰
느슨하게 고치는 방향의 수정은 금지다.

### 11-3. 응답 형식 매트릭스 — 무엇을 어떻게 유발하나

각 행을 실제 요청으로 유발하고, 아래 **공통 불변식 I1~I5** 를 전부 단언한다.

| 상태 | 유발 방법 | 서버 구성 |
|---|---|---|
| 200 (health) | `GET /api/health` | 토큰 미설정 |
| 200 (status) | `GET /api/status` | 토큰 미설정 |
| 401 | `GET /api/status`, `Authorization` 없음 | 토큰 설정 |
| 404 | `GET /api/nope` | 토큰 미설정 |
| 405 | `POST /api/health` | 토큰 미설정 |
| 500 | `GET /api/status`, `getSnapshot` 이 throw | 토큰 미설정 |
| 501 | `POST /api/stop` | 토큰 미설정 |

**공통 불변식**

| # | 불변식 |
|---|---|
| I1 | 본문이 `JSON.parse()` 로 파싱된다 — 빈 본문·HTML·평문이 아니다 |
| I2 | `Content-Type: application/json; charset=utf-8` · `Cache-Control: no-store` |
| I3 | `typeof body.ok === 'boolean'` 이고, 2xx 가 아니면 `ok === false` (🔒 정보 부재는 성공이 아니다) |
| I4 | 본문 전체 문자열에 토큰 값 · `.profile` · `cookie` · 스택 트레이스(`at `·`.js:`) · 절대 경로가 없다 |
| I5 | 응답 직후 같은 서버에 `GET /api/health` 를 보내면 여전히 200 이다 (경로가 서버를 상하게 하지 않았다) |

🔒 **표를 데이터로 두고 루프를 돌린다.** 상태 코드마다 손으로 쓴 개별 테스트를 늘리면
새 경로가 생겼을 때 조용히 빠진다. 유발 방법과 기대 상태를 배열로 선언하고 같은 단언 묶음을 적용한다.

### 11-4. 역경로 매트릭스 — well-formed 이지만 비정상인 요청

🔒 **여기서 확인하는 것은 "관대함" 이 아니라 "무너지지 않음" 이다.**
아래 대부분은 404/405 로 끝나는 것이 **정상**이며, 그것을 200 으로 만드는 변경은 하지 않는다.

| 프로브 | 기대 | 성격 |
|---|---|---|
| `GET /api/status/` (후행 슬래시) | 404 · I1~I5 | [DERIVED] 계약은 정확한 경로를 쓴다. 정규화를 추가하지 않는다 |
| `GET //api/status` | 404 · I1~I5 | [DERIVED] 동상 |
| `GET /API/STATUS` (대문자) | 404 · I1~I5 | [DERIVED] 경로 비교는 대소문자 구분 |
| `GET /api/%73tatus` (퍼센트 인코딩) | 404 · I1~I5 | [DERIVED] 디코딩해 매칭하지 않는다 |
| `GET /api/../api/status` | 200 · 계약 형식 | Node `URL` 이 `/api/status` 로 정규화한다. 🔒 이 제품은 경로를 파일시스템에 쓰지 않으므로 traversal 위험이 아니다 — 다만 **그 사실을 테스트로 못 박는다** |
| `PATCH` / `DELETE` / `OPTIONS` on `/api/health`·`/api/status` | 405 · I1~I5 | [DERIVED] |
| `GET /api/stop` (메서드 반대) | 405 · I1~I5 | [DERIVED] |
| `HEAD /api/health` | 405, **I1 면제** | 🔒 HTTP 상 HEAD 응답에 본문이 없다. 이것은 결함이 아니다 — HEAD 를 지원하려고 라우팅을 바꾸지 않는다. 상태 코드와 헤더만 단언한다 |
| 매우 긴 경로(약 8KB) | 4xx · 프로세스 생존 | [DERIVED] 정확한 코드를 못 박지 않는다(Node 파서 계층). 성질만 요구 |
| `Authorization` 헤더 2개(중복) | 401 · I1~I5 · throw 없음 | 토큰 설정 서버. Node 가 값을 합치므로 불일치 → 401 |
| 수 KB 짜리 Bearer 토큰 | 401 · throw 없음 | 500 이 아니다(상수시간 비교가 길이에 안 걸린다) |
| 본문이 실린 `GET /api/status` | 200 · 부작용 없음 | 🔒 요청 본문을 읽지 않는다 |
| `Content-Type: text/xml` 인 `POST /api/stop` | 501 · I1~I5 | 본문을 파싱하지 않으므로 영향 없다 |

### 11-5. 복원력 — 프로세스가 죽지 않는가

| # | 프로브 | 요구 성질 | 방법 |
|---|---|---|---|
| R1 | `/api/status` 동시 25건 | 전부 200 · 각각 유효 JSON · 🔒 관측 객체의 `totalPolls`·`totalFailures` 불변 | `Promise.all` |
| R2 | 요청 도중 클라이언트가 소켓을 끊음 | 서버 생존 · 직후 `/api/health` 200 | `node:net` 로 요청줄만 보내고 즉시 `destroy()` |
| R3 | HTTP 로 파싱 불가능한 바이트열 | 🔒 **응답 형식을 규정하지 않는다.** 프로세스 생존 + 직후 정상 요청 200 만 요구 | `node:net` 으로 `"NOT-HTTP\r\n\r\n"` 전송 |
| R4 | 위 전 프로브 구간 | `uncaughtException` · `unhandledRejection` 이 **0회** | 테스트 시작 시 리스너 등록, `finally` 에서 제거 |
| R5 | 위 전 프로브 이후 | STOP.json·임시 파일 무변경 · `getSnapshot` 호출 횟수가 status 경로 수와 정확히 일치(401/404/405 경로는 0) | 카운터 + mtime 비교 |

🔒 **R3 이 평문 400 을 받는 것은 위반이 아니다.** Node 의 `clientError` 기본 처리는
HTTP 파서 계층이지 이 제품의 라우팅 계층이 아니며, 계약 클라이언트(Foreman)는 이 경로에
닿지 않는다. **그것을 JSON 으로 만들려고 `server.on('clientError')` 를 새로 붙이지 않는다** —
§11-2 의 무수정 원칙이고, 계약이 요구하지도 않는다. I1 의 적용 범위는
**well-formed HTTP 요청에 대한 이 제품의 응답**으로 한정된다. 이 한정을 설계에 미리 박아 두는 이유는,
구현자가 "모든 경로가 JSON" 을 문자 그대로 읽고 파서 계층까지 손대는 것을 막기 위해서다.

### 11-6. 데이터 흐름 (이 Phase 는 흐름을 바꾸지 않는다)

```
비정상 클라이언트 ──▶ node:http 파서 ──▶ requestListener(ctx)
                          │                    │
                          │                    ├─ 인증 게이트 → 401  ┐
                          │                    ├─ 라우팅 → 404/405   ├─ 전부 sendJson()
                          │                    ├─ handleStatus → 200/500 │  = JSON + no-store
                          │                    ├─ handleStop → 501       ┘
                          │                    └─ catch(e) → 500 'internal error'
                          │
                          └─ 파싱 실패(R3) ──▶ Node 기본 clientError  🔒 이 제품의 계층이 아니다
                                                     │
                     어느 경우에도 ─────────────────▶ 프로세스 생존 · 감시 루프 무영향
```

이 Phase 가 추가하는 것은 **화살표가 아니라 그 화살표를 실제로 지나가 보는 프로브**뿐이다.

### 11-7. 검증 방식

| 무엇 | 어디서 | 방식 |
|---|---|---|
| 응답 매트릭스(I1~I5) | `test/control-server.test.js` | 선언 배열 + 공통 단언 루프. `port: 0` 실서버, `try/finally` `close()` |
| 역경로 | 동상 | `fetch` 로 보낼 수 없는 것(중복 헤더 등)은 `node:http.request` 사용 |
| 복원력 R2·R3 | 동상 | `node:net` 원시 소켓 |
| 무회귀 | `node p-bellows/test/run-all.js` | 기존 123개 전부 통과 · 종료 코드 0 · 미매달림 |
| 무수정 실증 | `git status --porcelain` | `lib/*`·`watch-loop.js` 가 dirty 가 아니다 |
| 엔트리포인트 | `deploy-bellows.ps1 -DryRun` | 종료 코드 0 |

🔒 **계약 기본 포트 3210 은 이 Phase 의 프로브에 쓰지 않는다** — 전부 `port: 0` 이다.
Phase 4 의 조립 경로 테스트가 그 포트를 쓰므로, 프로브가 그것과 자원을 다투면
Phase 4 의 검증이 `started:false` 갈래로 흘러 무력화된다.

### 11-8. Phase 5 가 하지 않는 것

- 라우팅 관대화 — 후행 슬래시·대소문자·퍼센트 디코딩·`HEAD` 지원을 **추가하지 않는다**
- `server.on('clientError')` 핸들러 추가 — §11-5 R3
- 레이트리밋 · 요청 크기 제한 · CORS · HTTPS — 로컬 루프백 제어면에 불필요하고 계약이 요구하지 않는다
- 성능 벤치마크 — R1 의 25건은 **성질 검증**이지 부하 시험이 아니다
- `POST /api/stop` 구현 — 🔒 영구히 하지 않는다(D9)
- `watch-loop.js` 를 자식 프로세스로 띄우는 통합 테스트 — §10-3(c) 와 동일한 이유
- 폴더·저장소 개명 · Foreman 쪽 무엇도

---

## 12. USER_GATE (완료 시 사용자 확인 절차)

감시자를 띄운 뒤 `http://127.0.0.1:3210/api/status` 를 열어
**지금 이 고장난 상태가 `"state": "crit"` 으로 나오는지** 눈으로 확인한다.
🔒 여기서 `ok` 가 나오면 계약을 구현하면서 3주 침묵을 새 층에 재현한 것이다.
