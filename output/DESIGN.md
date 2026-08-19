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

## 8. USER_GATE (완료 시 사용자 확인 절차)

감시자를 띄운 뒤 `http://127.0.0.1:3210/api/status` 를 열어
**지금 이 고장난 상태가 `"state": "crit"` 으로 나오는지** 눈으로 확인한다.
🔒 여기서 `ok` 가 나오면 계약을 구현하면서 3주 침묵을 새 층에 재현한 것이다.
