# DESIGN — 010 사용량 상태 웹 페이지

## 1. 이 작업의 한 줄

`/api/status` 가 이미 내고 있는 판정을 **사람이 보는 HTML 한 장**으로 그린다.
판정은 추가하지 않는다. 007·008 이 만든 계약의 **소비자**를 하나 더 붙일 뿐이다.

🔒 **이 NNN 의 실패 조건은 화면이 거짓말하는 것이다.**
측정이 죽어 있는데(`allowance.allowed === null`) 초록불·"사용 가능"이 보이면 실패다.
이 제품은 3주간 측정 실패를 아무도 모른 채 살아 있었다. 그 침묵을 화면에서 재현하지 않는다.

## 2. 아키텍처

### 2.1 현재 구조(변경 없음)

```
watch-loop.js
  ├─ scrape.js / extract.js   측정
  ├─ observation.js           deriveState / deriveUsage / deriveAllowance  (순수)
  ├─ logparse.js              기동 시 이력 복원
  └─ control-server.js        node:http · 127.0.0.1 전용
        ├─ GET  /api/health   프로세스 생존만
        ├─ GET  /api/status   측정 건강 + usage + allowance
        └─ POST /api/stop     501 (의도적 미구현)
```

### 2.2 010 이 더하는 것

```
control-server.js
  ├─ buildStatusPayload(ctx)      ← handleStatus 에서 추출한 단일 판정 지점
  │      │
  │      ├──> handleStatus()      JSON 그대로 (응답 바이트 불변)
  │      └──> handleIndex()       payload -> renderStatusPage()
  │
  └─ GET /                        text/html; charset=utf-8      [신규]

lib/status-page.js                [신규 · 순수 함수]
  renderStatusPage(payload, opts) -> string
```

🔒 **핵심 구조 결정: 판정 지점은 하나다.**
`GET /` 와 `GET /api/status` 는 **완전히 동일한 payload 객체**에서 출발한다.
JSON 은 그것을 `JSON.stringify`, HTML 은 그것을 `renderStatusPage` 에 넣는다.
이렇게 하면 "화면과 API 가 다른 말을 하는" 사태가 구조적으로 불가능하고,
동시에 `/api/status` 응답이 010 전과 한 바이트도 달라지지 않는 것이 보장된다.

### 2.3 디렉토리

```
p-quaestor/
  lib/
    status-page.js        [신규] 스냅샷 payload -> HTML 문자열 (순수)
    control-server.js     [수정] buildStatusPayload 추출 + GET / 라우트
    observation.js        🔒 무변경
    config.js scrape.js extract.js logparse.js env.js   🔒 무변경
  test/
    status-page.test.js       [신규] 렌더러 단위 테스트 (Phase 1)
    control-server.test.js    [수정] 실포트 HTML 왕복 + 회귀 (Phase 2)
    run-all.js                [수정] 신규 테스트 등록
  watch-loop.js watch-once.js  🔒 무변경
```

## 3. 데이터 흐름

```
브라우저  GET /
            │
            ▼
   [인증 게이트]  토큰 설정 시 401 (라우팅보다 먼저 — 지금 순서 그대로)
            │
            ▼
   buildStatusPayload(ctx)
      ctx.getSnapshot() -> { observation, ctx }
      deriveState / deriveUsage / deriveAllowance      ← 판정은 전부 여기서만
            │
            ▼
   renderStatusPage(payload)   순수 · I/O 없음 · 판정 없음 · 그리기만
            │
            ▼
   200 text/html; charset=utf-8 · Cache-Control: no-store
            │
            ▼
   [인라인 JS] 30초마다 fetch('/api/status')
            │
            └─ 표시에 영향 주는 값이 바뀌었으면 location.reload()
               (라벨 문구는 전부 서버가 고른다 — 아래 D3)
```

## 4. 기술 결정

### D1. 정적 파일 서빙을 만들지 않는다 🔒[SPEC]

요청 경로로 파일 경로를 조립하는 코드를 **한 줄도 쓰지 않는다.**
자산은 알려진 하나(HTML 문자열)뿐이고 CSS·JS 는 그 안에 인라인된다.
`fs.readFile(join(root, req.url))` 류가 없으므로 `..` 방어 로직 자체가 불필요하다.

라우팅은 `pathname === '/'` 정확 일치 하나다. `GET /../../etc/hosts` 는
`new URL()` 이 `/etc/hosts` 로 정규화하고 어떤 분기에도 걸리지 않아 **JSON 404** 로 떨어진다.

### D2. 인증 게이트 순서 불변 🔒[SPEC]

기존 `requestListener` 는 라우팅 **이전에** `isAuthorized()` 를 부른다.
`GET /` 라우트는 그 뒤에 추가된다. 토큰이 설정돼 있으면 페이지도 **401** 이다.
"API 는 막고 화면만 여는" 예외를 만들지 않는다 — 화면이 더 많은 것을 보여주기 때문이다.

### D3. 서버 렌더 + 폴링은 "값 비교 후 reload" 🔒 핵심

**문제**: 페이지가 클라이언트에서 다시 그리려면 JS 안에 "사용 가능"·"차단됨"·"모름"
라벨 표가 들어가야 한다. 그러면 `allowed: null` 스냅샷의 HTML 에도 **"사용 가능" 문자열이
존재**하게 되어 이 NNN 의 핵심 조항이 문자 그대로 깨진다.

**결정**: 사람이 읽는 문구는 **전부 서버가 고른다.** 인라인 JS 는 30초마다
`fetch('/api/status')` 를 호출해 **표시에 영향을 주는 값만 비교**하고,
달라졌으면 `location.reload()` 로 서버가 다시 그리게 한다.

- JS 에 한국어 라벨 리터럴이 **0개** → null 스냅샷 HTML 에 긍정 문구가 물리적으로 없다
- 폴링 대상은 요구대로 `/api/status` 이고 GET 이라 **부작용 없음**(007 조항)
- 판정도 문구도 서버 한 곳 → 화면과 API 의 불일치가 불가능

비교 키는 `allowance.allowed` · `allowance.reason` · `usage.session_pct` ·
`usage.weekly_pct` · `usage.stale` · `usage.measured_at` · `state`.
이 값들을 서버가 루트 요소의 `data-sig` 속성에 **한 줄 서명 문자열**로 심어두고
JS 는 새 응답에서 같은 규칙으로 문자열을 만들어 비교만 한다(판정 아님, 동등 비교뿐).

fetch 가 실패하거나 401/500 이면 **아무것도 하지 않고** 다음 주기를 기다린다.
화면이 낡았다는 사실은 이미 `stale`·경과 시간으로 드러난다.

### D4. 3상태 배지 — null 은 3번째 상태다 🔒[SPEC]

| `allowance.allowed` | 배지 문구 | 상태 클래스 | 색 |
|---|---|---|---|
| `true`  | 사용 가능 | `st-allowed` | 초록 |
| `false` | 차단됨   | `st-blocked` | 빨강 |
| `null`  | **모름**  | `st-unknown` | 회색 |

🔒 **초록을 뜻하는 클래스 토큰은 `st-allowed` 하나뿐이다.**
`allowed !== true` 인 어떤 렌더 결과에도 `st-allowed` 가 나타나지 않는다.
이것이 "초록 상태 클래스가 붙지 않는다"를 기계적으로 검증 가능한 명제로 만든다.

`allowance.reason` 은 배지 아래 보조 문구로 원문(`unmeasurable`, `over-threshold`,
`manual-stop` 등)을 그대로 노출한다. 번역하면서 뜻을 바꾸지 않는다.

### D5. null 은 "측정 없음", 0 이 아니다 🔒[SPEC]

`0%` 는 "여유 만점"이라는 **정반대 뜻**이다. `-` 는 뜻이 없다.
`session_pct` · `weekly_pct` · `session_headroom` · `weekly_headroom` ·
`measured_at` · `age_sec` 가 `null` 이면 문자열 **"측정 없음"** 을 렌더한다.

- 퍼센트 렌더 함수는 `typeof v === 'number'` 일 때만 `v + '%'` 를 만든다
- 🔒 `null` 경로에서 숫자·`%`·`0` 을 **생성하지 않는다** (`0%` 가 HTML 에 등장할 여지 제거)
- 게이지 바도 값이 `null` 이면 **그리지 않는다**(width 0 인 바는 0% 로 읽힌다)

### D6. stale 은 눈에 보인다 🔒[SPEC]

`usage.stale === true` 면

1. 루트 요소에 `st-stale` 클래스가 붙는다(신선한 경우엔 없다)
2. 사용량 숫자 옆에 **"낡은 값"** 표시가 붙는다
3. 경과 시간(`age_sec` → "26일 전" 형태)과 `measured_at` 절대 시각이 함께 보인다

🔒 28일 전 숫자를 현재 값처럼 그리는 것을 막는 조항이다. 숫자를 숨기지는 않는다 —
숨기면 "왜 안 보이지" 가 되고, 낡았다는 사실 자체가 이 제품이 알려야 할 정보다.

경과 시간 포맷(`60초 미만 → "방금"`, 분/시간/일)은 `observation.js` 의
`relativeTime()` 과 같은 규칙을 쓰되 **입력이 `age_sec` 이므로 별도 구현**한다.
🔒 `observation.js` 는 손대지 않는다(008 이후 판정 모듈은 동결).

### D7. 외부 요청 0 🔒[SPEC]

- CSS 는 `<style>`, JS 는 `<script>` 로 **인라인**
- 웹폰트 금지 → `font-family: system-ui, sans-serif` 등 시스템 폰트만
- 원격 이미지·아이콘 금지 → 게이지·배지는 CSS 로만 그린다
- `<link rel="icon">` 을 넣지 않는다(브라우저의 `/favicon.ico` 요청은 JSON 404 로 무해)
- HTML 전체에서 `http://`·`https://` 로 시작하는 리소스 참조 **0건**.
  네트워크 대상은 상대 경로 `/api/status` 하나뿐
- 새 npm 패키지 0 (문자열 연결과 `node:http` 로 충분)

### D8. 이스케이프 — HTML 에 들어가는 모든 값

`reason`·STOP `reason`·실패 `kind`/`hint`·`summary` 는 설정 파일과 스크레이핑에서
온 값이다. 신뢰하지 않는다. `&`, `<`, `>`, `"`, `'` 를 엔티티로 치환하는 `esc()` 를
**모든 보간 지점**에 적용한다. 예외 없음(숫자도 `String()` 후 통과).

### D9. 비밀은 렌더하지 않는다 🔒[SPEC]

입력은 `/api/status` payload **하나뿐**이다. 그 payload 에는 004 설계상 토큰·쿠키·
프로필 경로·계정이 들어 있지 않다(`fields` 는 화이트리스트, `configSource` 는
`'file'|'default'` 로 축약). `renderStatusPage` 는 `ctx.authToken` 등 다른 어떤
값에도 접근하지 않는다 — 시그니처에 들어오지 않으므로 실수할 경로가 없다.

### D10. never-brick 🔒[SPEC]

- `renderStatusPage` 는 순수 함수라 I/O 로 죽지 않는다. 그럼에도 `handleIndex` 는
  `try/catch` 로 감싸고 실패 시 **JSON 500** 을 낸다(형식을 지어내지 않는다)
- `startControlServer` 의 "never rejects / never throws" 계약은 그대로다
- 🔒 페이지가 어떤 식으로 실패해도 `watch-loop` 는 계속 돈다. 차단기가 화면 때문에 죽지 않는다

### D11. 읽기 전용 · loopback 전용

- 폼·버튼·POST 없음. 임계값 편집·STOP 조작은 Out of Scope
  (`POST /api/stop` 을 의도적으로 비워둔 결정과 같은 이유)
- `HOST = '127.0.0.1'` 상수는 손대지 않는다. LAN 바인딩은 별도 결정

---

# Phase 1 상세 설계 — `lib/status-page.js`

## 목적

`/api/status` payload 객체 하나를 받아 **완결된 HTML 문서 문자열**을 반환하는 순수 함수.
I/O 없음, 판정 없음, 전역 상태 없음, 시계 읽기 없음.

## 시그니처

```js
// payload: GET /api/status 응답 본문과 동일한 형태의 객체
//   { ok, allowance, usage, summary, state, fields, updatedAt }
// opts:    { pollMs?: number }   기본 30000
// returns: string  (완결된 HTML 문서)
function renderStatusPage(payload, opts) { ... }

module.exports = { renderStatusPage, esc, formatPct, formatAge, statusClass, signature };
```

payload 가 `null`/비객체이거나 `allowance`/`usage` 가 없어도 **throw 하지 않는다.**
없는 값은 전부 `null` 로 취급 → 배지는 **"모름"**, 숫자는 **"측정 없음"**.
🔒 무지의 기본값은 언제나 "모름"이다. 결코 "사용 가능"이 아니다.

## 내부 헬퍼

| 함수 | 동작 |
|---|---|
| `esc(v)` | `String(v)` 후 `& < > " '` → 엔티티 |
| `formatPct(v)` | 숫자면 `"24%"`, 그 외 `"측정 없음"` |
| `formatHeadroom(v)` | 숫자면 `"61%p 남음"`, 그 외 `"측정 없음"` |
| `formatAge(sec)` | 숫자 아니면 `"측정 없음"`; `<60` → `"방금"`; 분/시간/일 |
| `statusClass(allowed)` | `true`→`st-allowed`, `false`→`st-blocked`, 그 외→`st-unknown` |
| `statusLabel(allowed)` | `true`→`사용 가능`, `false`→`차단됨`, 그 외→`모름` |
| `signature(payload)` | D3 의 비교 문자열 생성(값들을 `|` 로 연결) |
| `fieldValue(fields, label)` | `fields` 배열에서 라벨로 값 찾기(없으면 `null`) |

🔒 `statusLabel` 은 `allowed === true` 인 **정확히 그 경우에만** 긍정 문구를 만든다.
`==` 가 아니라 `===` 로 비교한다(`null == false` 류 함정 차단).

## 문서 구조

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quaestor — 사용량</title>
  <style> /* 인라인 · 시스템 폰트 · 원격 참조 0 */ </style>
</head>
<body>
  <main class="wrap {상태클래스} {st-stale?}" data-sig="...">
    <h1>Quaestor</h1>

    <!-- 1. 큰 배지 -->
    <div class="badge">사용 가능 | 차단됨 | 모름</div>
    <p class="reason">reason: unmeasurable</p>

    <!-- 2. 사용량 (stale 이면 '낡은 값' 배지 동반) -->
    <section class="usage">
      세션  24%  · 여유 66%p     [게이지 바 — 값이 null 이면 렌더 안 함]
      주간  99%  · 여유 0%p
    </section>

    <!-- 3. 임계값 -->
    <section>주간 정지 85 / 해제 70 · 세션 정지 90 / 해제 75</section>

    <!-- 4. 마지막 측정 -->
    <section>2026-08-01T… (26일 전)  [stale 이면 강조]</section>

    <!-- 5. STOP · 6. 실패 (fields 에서 라벨로 조회, 값이 '없음'이면 표시 생략) -->

    <!-- 7. 감시 상태 요약: state + summary -->
  </main>
  <script> /* 인라인 · 30초 폴링 · 라벨 리터럴 0개 */ </script>
</body>
</html>
```

## 인라인 스크립트(전문 수준의 의사코드)

```js
(function () {
  var el = document.querySelector('.wrap');
  var sig = el.getAttribute('data-sig');
  function sigOf(d) { /* D3 의 키들을 서버와 같은 순서로 '|' 연결 */ }
  setInterval(function () {
    fetch('/api/status', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && sigOf(d) !== sig) location.reload(); })
      .catch(function () { /* 조용히 무시 — 다음 주기에 재시도 */ });
  }, POLL_MS);
})();
```

🔒 이 스크립트에는 한국어 라벨도, 임계값 비교도, `allowed` 를 해석하는 분기도 없다.
동등 비교와 새로고침뿐이다.

## CSS 상태 클래스 규약 (테스트가 의존하는 계약)

| 토큰 | 의미 | 색 |
|---|---|---|
| `st-allowed` | 🔒 유일한 초록 | `#1a7f37` 계열 |
| `st-blocked` | 차단 | 빨강 계열 |
| `st-unknown` | 모름 | 회색 계열 |
| `st-stale`   | 낡은 값 | 경고 테두리/줄무늬 |

## Phase 1 이 하지 않는 것

- 라우팅·HTTP 헤더·포트 (Phase 2)
- `control-server.js` 수정 (Phase 2)
- 실포트 왕복 테스트 (Phase 2 — 🔒 경계 검증은 반드시 실포트로 한다)

## Phase 2 예고

1. `handleStatus` 에서 `buildStatusPayload(ctx)` 추출 — 🔒 JSON 응답 불변
2. `pathname === '/'` + `GET` 라우트 추가, 그 외 메서드는 405
3. 실포트 테스트: `GET /` 200/text-html, null·stale·null-pct 스냅샷 HTML 검사,
   외부 URL 0건, `/api/*` 회귀, `/api/does-not-exist` JSON 404,
   `/../../etc/hosts` JSON 404, 토큰 설정 시 `GET /` 401

## 검증

```
node p-quaestor/test/run-all.js      # 🔒 npm 금지 — node 직접 호출
```
