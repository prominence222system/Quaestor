# DESIGN — 016 로고: 상태 페이지 파비콘·머리글 마크 + 저장소 자산 `assets/icon.svg`

> 대상 NNN: `work/016-logo-favicon-and-header-mark.md`
> 기준 커밋(HEAD): `55f14ed`
> 실측 기준선: `node p-quaestor/test/run-all.js` → **432 tests / 432 pass / 0 fail / exitCode 0** (2026-09-24 재확인)

---

## 1. 이 라운드의 성격

**ADDITIVE · never-brick · 계약 불변.** 사용자가 고른 로고 시안 **C(두 계기와 정지선)** 를
두 표면에 얹는다.

| 표면 | 이 NNN 의 역할 |
|---|---|
| Agora `icons/Quaestor.svg` | 범위 밖 (세션이 이미 같은 바이트로 교체함) |
| Armory 카탈로그(`deploy.json` 의 `icon`) | **가리킬 파일만 만든다** — `p-quaestor/assets/icon.svg`. `deploy.json` 자체는 저장소에 없다 |
| 상태 페이지 `GET /` | **본체** — 탭 파비콘 + 머리글 마크 |

🔒 상태 페이지는 감독 계약(`supervised-v1`)의 일부가 **아니다.** `/api/health`·`/api/status`
응답은 한 바이트도 바뀌지 않고 `CONTRACTS = { 'supervised-v1': '1.5.0' }` 도 그대로다.
그래서 이 라운드에서 `lib/control-server.js` 는 **전혀 손대지 않는다.**

---

## 2. 전체 구조 — 로고 문자열의 단일 출처

```
                  ┌─────────────────────────────────────────────┐
                  │  p-quaestor/lib/brand.js   (순수 · require 0) │
                  │                                             │
                  │   MARK_BODY  (도형 6개 · 429 bytes)           │
                  │      │                                      │
                  │      ├──▶ ICON_SVG      (정본 574 bytes)      │
                  │      │        │                             │
                  │      │        └──▶ FAVICON_HREF              │
                  │      │             = 'data:image/svg+xml;    │
                  │      │                base64,' + b64(ICON)   │
                  │      └──▶ MARK_INLINE   (xmlns 없음 · 28px)   │
                  └───────┬───────────────────┬─────────────────┘
                          │                   │
          (바이트 동일 · 테스트가 잠금)          │
                          ▼                   ▼
        p-quaestor/assets/icon.svg   p-quaestor/lib/status-page.js
                  │                    renderStatusPage(payload)
                  │                      ├─ <head>  <link rel="icon" href=FAVICON_HREF>
                  ▼                      ├─ <main>  <div class="brand">MARK_INLINE<h1>Quaestor</h1></div>
        deploy.json 의 "icon"             └─ <style> styleBlock() + .brand / .brand h1 / .mark
        (랜딩 후 세션이 한 줄 추가 — 범위 밖)                │
                                                          ▼
                                       control-server.js handleIndex()  ← 무수정
                                                          ▼
                                            GET /  →  200 text/html
```

핵심은 **화살표가 한 방향뿐**이라는 것이다. `MARK_BODY` 라는 하나의 문자열에서 세 표기
(`ICON_SVG`·`FAVICON_HREF`·`MARK_INLINE`)가 파생되고, 디스크의 `assets/icon.svg` 는 그 파생물의
사본이며 그 사본됨을 **테스트가 단언**한다. 로고를 고칠 곳이 한 군데뿐이 되게 하는 것이 이 구조의 목적이다.

---

## 3. 디렉터리 구조 (변경분만)

```
p-quaestor/
├─ assets/                     ← 신규 디렉터리
│   └─ icon.svg                ← 신규. ICON_SVG 와 바이트 동일 (574 B, 끝 줄바꿈 없음)
├─ lib/
│   ├─ brand.js                ← 신규. 로고 문자열의 유일한 출처
│   └─ status-page.js          ← 수정 (3곳: <head> · 머리글 · styleBlock)
└─ test/
    ├─ brand.test.js           ← 신규 (수용 기준 1~5)
    ├─ status-page.test.js     ← 추가만 (렌더 단위 테스트)
    └─ control-server.test.js  ← 추가만 (실제 포트 경계 테스트, 수용 기준 6)
```

손대지 않는 것: `lib/control-server.js`, `lib/observation.js`, `lib/agy-usage.js`,
`watch-loop.js`, `package.json`, `.gitignore`, 런처 `.ps1` 2개, **기존 테스트 432개의 모든 줄**.

---

## 4. 기술 결정과 근거

### D1. 로고 문자열은 `lib/brand.js` 에만 둔다

`status-page.js` 에 SVG 를 직접 쓰면 `xmlns="http://www.w3.org/2000/svg"` 의 주소 문자열이 그
소스로 들어온다. 지금 `control-server.test.js:2665` 가 단언하는 것은 `status-page.js` 소스의
`https://` 0개이므로 `http://` 는 당장 걸리지 않지만 — **한 글자 차이로 통과하는 배치는 설계가 아니다.**
게다가 로고 문자열이 두 파일에 살면 언젠가 갈라진다. 별 모듈로 뽑아 `status-page.js` 는
`require('./brand')` 한 줄만 갖는다(상대 경로이므로 `status-page.test.js:160` 의 "npm 패키지
require 0개" 단언을 통과한다).

`brand.js` 는 **순수하다**: `require` 0개, I/O 0개, 전역 `Buffer` 하나만 쓴다. 렌더 경로에
파일 읽기를 끌어들이지 않는다.

### D2. 조립 방향 — `MARK_BODY` 가 원본, `ICON_SVG` 가 파생

두 가지 선택지가 있었다.

| 안 | 방식 | 판정 |
|---|---|---|
| A | `ICON_SVG` 를 리터럴로 두고 `MARK_BODY` 를 `indexOf('</title>')`/`lastIndexOf('</svg>')` 로 잘라낸다 | ✗ |
| B | `MARK_BODY` 를 리터럴로 두고 래퍼를 앞뒤로 붙여 `ICON_SVG`·`MARK_INLINE` 을 만든다 | ✅ 채택 |

A 안은 런타임 문자열 탐색에 의존해 표기가 조용히 어긋날 수 있다. B 안은 **"`MARK_BODY` 가 양쪽에
들어 있다"(수용 기준 4)를 문법적으로 보장**한다 — 조립식이므로 어긋날 수가 없다.
B 안의 유일한 위험은 래퍼 오타인데, 그것은 `ICON_SVG` 의 **sha256 단언(수용 기준 1)** 이 잡는다.
즉 B 안 + 해시 단언 조합이 양방향을 다 막는다.

세션이 실측으로 확인한 사실:

```
MARK_BODY 길이 = 429,  도형 = <rect> 5 + <line> 1 = 6개
'<svg xmlns="…" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Quaestor">'
  + '<title>Quaestor</title>' + MARK_BODY + '</svg>'   ===   정본   → true
sha256 = 9d37e924332295cc860c6231bcd75a139435acd95d4f9de321e04e8ae8397e72   → 일치
byteLength = 574,  strLength = 574 (전부 ASCII),  \n·\r = 0개
```

### D3. 🔒 파비콘은 base64 data URI — 우회가 아니라 두 조건을 동시에 지키는 유일한 표기

파비콘은 `<img>` 와 같은 **단독 SVG 문서**로 해석되므로 `xmlns="http://www.w3.org/2000/svg"`
가 없으면 이미지로 그려지지 않는다. 그런데 기존 단언 두 개가 렌더된 HTML 에 `http://`
**문자열 0개**를 요구한다:

- `test/status-page.test.js:151-152` — `!html.includes('http://')`, `!html.includes('https://')`
- `test/control-server.test.js:1613-1614` — 실제 포트로 받아온 HTML 에 같은 단언

`xmlns` 는 요청 대상이 아니라 이름공간 **식별자**이므로 "외부 요청 0건" 이라는 원래 뜻은 어기지 않는다.
base64 로 실으면 **문자열 단언과 원래 뜻이 둘 다** 지켜진다.
🔒 **기존 단언을 완화하지 않는다. 깨지면 구현을 고친다.**

세션이 실제 바이트로 미리 검증한 결과 — base64 페이로드
(`PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdC…`, 768자)에는 다음이 **전부 0개**다:

| 확인 항목 | 걸리는 기존 단언 | 결과 |
|---|---|---|
| `http://` · `https://` | `status-page.test.js:151-152`, `control-server.test.js:1613-1614` | clear |
| `EXTERNAL_URL` = `/(src\|href)\s*=\s*["']https?:\/\/…/i` | `status-page.test.js:150`, `control-server.test.js:1612` | clear (`href="data:…"` 는 `https?://` 가 아니다) |
| `agy` | `status-page.test.js:390` (015 의 HTML `agy` 0개) | clear |
| `claude` (대소문자 무시) | `status-page.test.js:231`, `control-server.test.js:2664` | clear |
| `st-` / `st-allowed` / `\bst-[a-z0-9_-]+\b` | `status-page.test.js:97-106`, `450-465` | clear |
| `<link[^>]+rel=["']stylesheet["']` | `status-page.test.js:170` | clear (`rel="icon"`) |
| `<script[^>]+src=` | `status-page.test.js:171` | clear |

또한 `lib/` 전체를 훑는 `scrape-classify.test.js:371` 은 `https://claude.ai` 를 찾으므로
`brand.js` 의 `http://www.w3.org/…` 에 걸리지 않는다. `watch-loop.test.js:63` 은 `p-quaestor/`
**최상위** `.js` 만 훑으므로 `lib/brand.js` 는 대상이 아니다. `env.test.js:227` 의 `.js` 순회는
`process.env.BELLOWS_` 만 찾는다.

### D4. `assets/icon.svg` 는 **사본이지 참조가 아니다**

Armory 는 디스크의 파일을 읽고, 서버는 메모리의 상수를 렌더한다. 두 소비자가 서로 다른 경로로
같은 그림을 얻는다. `brand.js` 가 이 파일을 `fs.readFileSync` 로 읽게 하면 순수성이 깨지고
(요청 경로에 I/O 유입) 파일이 없을 때 서버가 못 뜨는 새 실패 모드가 생긴다 — never-brick 위반이다.

그래서 **코드는 두 표현을 잇지 않고, 테스트가 잇는다**(수용 기준 2: 파일 바이트의 sha256 ===
`ICON_SVG` 의 sha256). 갈라지면 스위트가 빨개진다.

🔒 **끝 줄바꿈을 넣지 않는다.** `echo` 는 `\n` 을 붙이므로 쓰기에 쓰면 안 된다
(`printf '%s'` 또는 `fs.writeFileSync` 로 정확한 바이트를 쓴다).
🔒 파일에 줄바꿈이 0개인 것은 **git 의 CRLF 변환이 건드릴 것을 없애려는 의도**다 —
그래서 `.gitattributes` 를 새로 두지 않아도 안전하다.

### D5. 새 경로를 만들지 않는다

`<link rel="icon">` 이 있으면 브라우저는 그것을 쓰고 `/favicon.ico` 를 따로 찾지 않는다.
`control-server.js` 의 라우팅은 알려진 5경로 뒤 `sendJson(res, 404, {ok:false,error:'not found'})`
로 떨어지므로 `GET /favicon.ico` 는 지금처럼 **JSON 404** 다. 라우터에 한 줄도 넣지 않는다.

부수 확인: `sendHtml` 은 `Content-Type: text/html; charset=utf-8` 과 `Cache-Control: no-store`
만 보내고 **CSP 헤더가 없다** — `data:` URI 파비콘이 정책에 막히지 않는다(실측 확인).

### D6. CSS 는 추가만 — 기존 선택자의 값은 하나도 바꾸지 않는다

머리글을 `<div class="brand">마크 + <h1></div>` 로 감싸면 정렬 문제가 하나 생긴다:
기존 규칙 `h1{font-size:1.1rem;margin:0 0 16px;color:#57606a}` 의 **아래쪽 16px 마진**이
flex 항목의 마진 박스에 포함되므로, `align-items:center` 로 중앙을 맞추면 글자가 마크보다
약 8px 위로 뜬다. 🔒 기존 `h1{}` 규칙은 값 하나도 못 바꾸므로, **더 구체적인 새 선택자**로 덮는다.

추가하는 선택자 3개 (기존 규칙 뒤에 이어 붙인다):

```
.brand{display:flex;align-items:center;gap:10px;margin:0 0 16px}
.brand h1{margin:0}
.mark{flex:0 0 auto;display:block}
```

세로 리듬이 보존된다: 전에는 `h1` 이 아래 16px 을 만들었고, 이제 `.brand` 가 같은 16px 을
만들고 `.brand h1` 이 0 을 만든다 — **간격 합계가 동일**하다.
`.mark` 의 `flex:0 0 auto` 는 제목이 길어져도 마크가 줄지 않게 한다.
🔒 새 클래스에 `st-` 접두어를 쓰지 않는다(015 단언). `.brand`·`.mark` 둘 다 무관하다.

### D7. 판정을 다시 하지 않는다

`brand.js` 는 상수만 갖고 payload 를 보지 않는다. `status-page.js` 의 세 변경점은 전부
**무조건 렌더**이며 `allowance`·`usage`·`agy`·`state` 를 읽지 않는다. 따라서
`signature()`/`data-sig`/`<main>` 의 class·style 은 **불변**이고, 자동 새로고침 동작도 그대로다.
로고는 상태를 말하지 않는다 — 상태를 말하는 것은 badge 하나뿐이라는 010 의 규율을 유지한다.

---

## 5. 데이터 흐름 (요청 1회)

```
GET /  ──▶ requestListener → isAuthorized → pathname === '/' → handleIndex(res, ctx)
                                                                    │
                                        buildStatusPayload(ctx)  ───┘   (무수정)
                                                                    │
                                        renderStatusPage(payload) ───┘
                                          │
                                          ├─ <head>: <title>…</title>
                                          │          <link rel="icon" type="image/svg+xml"
                                          │                href="data:image/svg+xml;base64,…">   ← FAVICON_HREF (상수)
                                          │          <style>styleBlock()</style>                  ← .brand/.brand h1/.mark 추가
                                          │
                                          └─ <main class="wrap …" data-sig="…">   ← 불변
                                               <div class="brand">
                                                 <svg class="mark" …>MARK_BODY</svg>   ← MARK_INLINE (상수)
                                                 <h1>Quaestor</h1>                     ← 부분문자열 유지
                                               </div>
                                               … 기존 badge / section 전부 불변 …
                                          │
                              sendHtml(res, 200, html)  ──▶ 200 text/html; charset=utf-8
```

payload → 로고 사이에 **의존이 없다**. 로고는 payload 가 무엇이든(오류·`null`·stale) 똑같이 그려지고,
`payload.error` 로 500 이 나가는 경로에서는 애초에 HTML 이 만들어지지 않는다 — 기존 동작 그대로다.

---

## 6. Phase 분할

| Phase | 내용 | 근거 |
|---|---|---|
| 1 | `lib/brand.js` + `assets/icon.svg` + `test/brand.test.js` | 의존 0. 아무도 소비하지 않으므로 기존 432개에 영향이 원리적으로 불가능하다 |
| 2 | `lib/status-page.js` 3개 변경점 + 렌더 단위 테스트 + 실제 포트 경계 테스트 + 전체 스위트 | Phase 1 의 상수를 소비한다. 기존 단언 8종과 맞부딪히는 유일한 구간 |

Phase 1 이 깨지면 Phase 2 가 그 위에 서지 않는다. 특히 정본 바이트(sha256·574·줄바꿈 0)를
Phase 1 에서 못 박은 뒤에야 Phase 2 의 "HTML 에서 잘라낸 href 를 디코드하면 `ICON_SVG` 와 같다"
는 단언이 의미를 갖는다.

---

## 7. Phase 1 상세 설계

### 7-1. `p-quaestor/lib/brand.js`

```
'use strict';
// Single source of truth for the Quaestor logo (work/016).
// Pure: zero requires, zero I/O. The only global used is Buffer.
//
// Concept C -- "two gauges and a stop line": two rounded bars (session,
// weekly) over a dark rounded square, the lower one filled amber up to a
// light vertical stop line.
//
// 🔒 MARK_BODY is the primitive. ICON_SVG and MARK_INLINE are both built
// from it, so the two surfaces can never drift apart. The canonical bytes
// are pinned by sha256 in test/brand.test.js -- do not edit either the
// body or the wrappers without updating that hash, and do not relax the
// hash instead of fixing the string.
//
// 🔒 FAVICON_HREF is base64 on purpose, not as a workaround. A favicon is
// a standalone SVG document, so it needs xmlns="http://..." to render at
// all -- but the rendered HTML is asserted to contain zero "http://"
// substrings (test/status-page.test.js:151, control-server.test.js:1613).
// xmlns is a namespace identifier, not a fetch target, so base64 honours
// both the assertion and its original "zero external requests" intent.
```

| export | 값 / 규격 |
|---|---|
| `MARK_BODY` | 도형 6개 문자열 리터럴. 429바이트. `<rect>` 5개 + `<line>` 1개. `http` 0개 |
| `ICON_SVG` | `SVG_OPEN + '<title>Quaestor</title>' + MARK_BODY + '</svg>'`. 결과 574바이트, sha256 = `9d37e924…97e72` |
| `MARK_INLINE` | `'<svg class="mark" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" focusable="false">' + MARK_BODY + '</svg>'`. **`xmlns` 없음** |
| `FAVICON_HREF` | `'data:image/svg+xml;base64,' + Buffer.from(ICON_SVG, 'utf8').toString('base64')` (총 794자) |

여기서 `SVG_OPEN` 은 모듈 내부 상수
`'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Quaestor">'`
이며 export 하지 않는다(외부에서 이 조각만 써서 `xmlns` 를 HTML 로 끌어들일 길을 두지 않는다).

접근성 규약:
- **단독 문서**(`ICON_SVG`) 는 그림이 유일한 내용이므로 `role="img"` + `aria-label` + `<title>` 을 갖는다.
- **인라인**(`MARK_INLINE`) 은 바로 옆에 `<h1>Quaestor</h1>` 이라는 같은 뜻의 텍스트가 있으므로
  `aria-hidden="true"` + `focusable="false"` 로 보조기술에서 **감춘다**(중복 낭독 방지).
  `role`·`aria-label`·`<title>` 을 넣지 않는다 — `MARK_BODY` 가 `<title>` 밖의 도형만 담는 이유가 이것이다.

### 7-2. `p-quaestor/assets/icon.svg`

- 내용 = `ICON_SVG` 와 **바이트 동일**. 574바이트, BOM 없음, 줄바꿈 0개, **끝 줄바꿈 없음**
- Agora 볼트 `icons/Quaestor.svg` 와 같은 바이트(세션이 이미 그 바이트로 넣었다)
- `deploy.json` 은 건드리지 않는다 — 저장소에 없는 데이터 파일이고, 랜딩 후 세션이
  `"icon": "p-quaestor/assets/icon.svg"` 한 줄을 넣는다

### 7-3. `p-quaestor/test/brand.test.js` (신규 · 수용 기준 1~5)

`node:test` + `node:assert`, `node:crypto`(코어)로 해시, `node:fs`/`node:path` 로 자산 파일 읽기.
검증 축 5개:

1. **정본 고정** — `ICON_SVG` 의 sha256·바이트길이 574·`\n`/`\r` 0개
2. **자산 동일성** — `assets/icon.svg` 의 바이트 sha256 === `ICON_SVG` 의 sha256 (끝 줄바꿈 불허)
3. **파비콘 왕복** — `FAVICON_HREF` 접두어 검사 → base64 디코드 === `ICON_SVG`,
   디코드 결과에 `xmlns="http://www.w3.org/2000/svg"` **있음**,
   `FAVICON_HREF` 자체에 `agy`·`http://`·`https://` **없음**
4. **출처 단일성** — `MARK_INLINE` 에 `xmlns`·`http` 0개 + `aria-hidden="true"` 포함,
   그리고 `MARK_BODY` 가 `ICON_SVG` 와 `MARK_INLINE` **양쪽에** 포함
5. **아이콘 안전검사(Agora 와 동일 조건)** — `ICON_SVG` 에 `<script`·`onload=`·`onerror=`·
   `<foreignObject`·`href=` 0개, 65536바이트 이하

### 7-4. Phase 1 이 기존 432개를 건드릴 수 없는 이유

Phase 1 은 **새 파일 3개만** 만든다. 기존 파일 수정 0건이므로 회귀 경로가 없다.
`lib/` 전체를 훑는 유일한 순회(`scrape-classify.test.js:371`, `https://claude.ai` 탐색)와
저장소 전체를 훑는 순회(`launcher-rename.test.js:100`, `run-bellows`/`deploy-bellows` 탐색)에
새 파일이 편입되지만 둘 다 해당 문자열이 없다(실측 확인). 기대 결과는
**432 + 신규, 실패 0**.

---

## 8. Phase 2 개요 (상세 설계는 Phase 1 완료 후 갱신)

- `lib/status-page.js`: `require('./brand')`, `<head>` 의 `<title>` 줄 **바로 다음**에 `<link rel="icon">`,
  `'<h1>Quaestor</h1>\n'` → `'<div class="brand">' + MARK_INLINE + '<h1>Quaestor</h1></div>\n'`,
  `styleBlock()` 에 D6 의 선택자 3개 추가
- `test/status-page.test.js` 에 렌더 단위 테스트 **추가만**
- `test/control-server.test.js` 에 실제 포트 경계 테스트 **추가만** — `startControlServer({ port: 0, … })`,
  015 의 `ctx.agy` 스냅샷 픽스처를 써서 Gemini 구역이 함께 렌더되는 상태에서도
  HTML 에 `agy`·`http://`·`https://` 가 0개임을 확인
- 🔒 **경계 테스트의 반증 가능성 확인**: `lib/status-page.js` 만 HEAD(`55f14ed`) 상태로 되돌린 뒤
  새 경계 테스트를 돌려 **실패함을 눈으로 확인**하고 복원한다. 통과만 하는 테스트는 아무것도 증명하지 않는다

---

## 9. 불변 · 금지

- `CONTRACTS = { 'supervised-v1': '1.5.0' }` 그대로. `/api/health`·`/api/status` 응답 불변
- **기존 테스트 432개 수정 허용 0건.** 깨지면 구현을 고친다
- 새 경로 0개 — `/favicon.ico` 는 계속 JSON 404
- 의존성 추가 금지(`dependencies` 는 `['puppeteer']` 그대로) · 외부 리소스 0건
- `brand.js` 포함 모든 `.js` 에서 `claude` 0개
- 새 클래스에 `st-` 접두어 금지 · `<main>` 의 class·style·`data-sig` 불변 · `<h1>Quaestor</h1>` 부분문자열 유지
- 영문 코드/주석(한글은 페이지 표시 문구에만 — `brand.js` 에는 한글이 없다)
- `.profile` · `deploy.json` · Agora `icons/` · 다른 제품: 손대지 않는다
