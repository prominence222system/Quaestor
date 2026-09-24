# DESIGN — 016 로고: 상태 페이지 파비콘·머리글 마크 + 저장소 자산 `assets/icon.svg`

> 대상 NNN: `work/016-logo-favicon-and-header-mark.md`
> 기준 커밋(HEAD): `55f14ed`
> 실측 기준선: `node p-quaestor/test/run-all.js` → **432 tests / 432 pass / 0 fail / exitCode 0** (2026-09-24 재확인)
> **[CHANGED] 현재 상태(2026-09-24 재실행)**: **465 tests / 464 pass / 1 fail / exitCode 1**

---

## 0. 부분 재설계 (2026-09-24) — 무엇을 왜 고쳤나 **[CHANGED]**

직전 eval 의 판정은 **REDESIGN** 이고, 지목된 결함은 **구현이 아니라 기준 문장 한 줄**이다:
`output/ACCEPTANCE.md` Phase 2 의 "렌더된 HTML 에 `claude` 가 대소문자 무시 0개다" 가
**013 의 동결 동작(`엔진 범위: claude` 를 HTML 에 반드시 싣는다)과 논리적으로 양립 불가능**하다.
그래서 어떤 구현으로도 통과시킬 수 없고, 실제로 `control-server.test.js:2824` 한 개가 실패한다.

| 절 | 상태 | 내용 |
|---|---|---|
| §4 D3 표 | **[CHANGED]** | "단언이 보는 것(축)" 열 추가 — 소스 축과 HTML 축을 한 표에 섞어 둔 것이 결함의 발원지였다 |
| §4 **D3-1** | **신규 [CHANGED]** | `claude` 는 **소스 축**이지 HTML 축이 아니다. 충돌의 정확한 좌표와 폐기/대체 기준 |
| §8-7 | **[CHANGED]** | 실제 포트 단언 목록에서 `claude` 를 빼고, 6번(013 무회귀 + 016 추가분 결백)으로 대체 |
| §8-9 | **[CHANGED]** | 기준선 숫자를 실측으로 교정(456/456/0 → 465/464/1)하고 목표 상태를 명시 |
| §8-10 | **[CHANGED]** | 결함이 어느 커밋에서 들어와 어느 커밋에서 터졌는지 기록 |
| §9 | **[CHANGED]** | `claude` 0건 불변식에 **축**을 명시. 013 무회귀 불변식 추가 |
| 그 외 전부 | **불변** | §2 구조 · §3 디렉터리 · §4 D1·D2·D4~D7 · §5 데이터 흐름 · §6 Phase 분할 · §7 Phase 1 상세 — 실측 통과가 확인된 부분은 손대지 않는다 |

🔒 **이 재설계는 기존 단언을 하나도 완화하지 않는다.** `http://`·`https://`·`agy`·`st-*` 의
HTML 0건은 그대로고, 기존 테스트 432개 수정 허용도 **여전히 0건**이다. 폐기되는 단언 하나는
016 이 이번 라운드에 스스로 추가한 테스트이며, 빈자리로 두지 않고 더 강한 단언으로 대체한다.

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

**[CHANGED]** 표의 **축(axis) 열을 추가했다.** 이전 판은 "렌더된 HTML 을 보는 단언" 과
"소스 파일을 보는 단언" 을 한 표에 섞어 놓았고, 그것이 §4 D3-1 이 설명하는 결함의 발원지다.

| 확인 항목 | 단언이 보는 것(축) | 걸리는 기존 단언 | 결과 |
|---|---|---|---|
| `http://` · `https://` | **렌더된 HTML** | `status-page.test.js:151-152`, `control-server.test.js:1613-1614` | clear |
| `EXTERNAL_URL` = `/(src\|href)\s*=\s*["']https?:\/\/…/i` | **렌더된 HTML** | `status-page.test.js:150`, `control-server.test.js:1612` | clear (`href="data:…"` 는 `https?://` 가 아니다) |
| `agy` | **렌더된 HTML** | `status-page.test.js:390` (015 의 HTML `agy` 0개) | clear |
| `claude` (대소문자 무시) | 🔒 **`status-page.js` 소스 파일** — HTML 이 **아니다** | `status-page.test.js:231`, `control-server.test.js:2664` | clear |
| `st-` / `st-allowed` / `\bst-[a-z0-9_-]+\b` | **렌더된 HTML** | `status-page.test.js:97-106`, `450-465` | clear |
| `<link[^>]+rel=["']stylesheet["']` | **렌더된 HTML** | `status-page.test.js:170` | clear (`rel="icon"`) |
| `<script[^>]+src=` | **렌더된 HTML** | `status-page.test.js:171` | clear |

어느 행이든 016 이 새로 싣는 문자열(base64 페이로드 · `<link>` 껍데기 · `MARK_INLINE` ·
CSS 선택자 3개)은 clear 다. **그러나 `claude` 행만은 그 clear 가 "HTML 전체에 `claude` 가 0개"
를 뜻하지 않는다** — 016 의 추가분에 없다는 뜻일 뿐이다. 다음 절이 그 차이를 못 박는다.

또한 `lib/` 전체를 훑는 `scrape-classify.test.js:371` 은 `https://claude.ai` 를 찾으므로
`brand.js` 의 `http://www.w3.org/…` 에 걸리지 않는다. `watch-loop.test.js:63` 은 `p-quaestor/`
**최상위** `.js` 만 훑으므로 `lib/brand.js` 는 대상이 아니다. `env.test.js:227` 의 `.js` 순회는
`process.env.BELLOWS_` 만 찾는다.

### D3-1. 🔒 `claude` 는 **소스 축**이다 — 렌더된 HTML 축이 아니다 **[CHANGED]**

직전 라운드가 여기서 막혔다. `output/ACCEPTANCE.md` Phase 2 의 "외부 리소스 0건" 절에
**"렌더된 HTML 에 `claude` 가 대소문자 무시 0개다"** 가 들어갔고, 그 기준을 곧이곧대로 옮긴
테스트(`control-server.test.js:2824`, 이번 라운드 `9966a8f` 이 **새로 추가**한 것)가 실패했다.
구현 결함이 아니다 — **그 기준은 어떤 구현으로도 만족될 수 없다.**

두 요구가 정면으로 충돌한다. 실측으로 확인한 정확한 좌표다:

| | 요구 | 근거 |
|---|---|---|
| 013(동결·출시완료) | `GET /` HTML 에 `엔진 범위: claude` 가 **반드시 있다** | `lib/source.js:4` `ENGINE='claude'` → `lib/observation.js:303/311` 이 `usage.covers`/`allowance.covers` 를 **무조건** `[ENGINE]` 로 채움 → `lib/status-page.js:208` 이 `<div class="field">엔진 범위: …</div>` 로 렌더 |
| 013 의 동결 테스트 | `assert.ok(html.includes('<div class="field">엔진 범위: claude</div>'))` | `control-server.test.js:1529`(및 `1495`/`1509`/`1549`/`1572`) — **기존 432개에 속한다. 수정 허용 0건** |
| 016 의 결함 기준 | `assert.strictEqual((html.match(/claude/gi)\|\|[]).length, 0)` | `control-server.test.js:2829` — **016 이 이번 라운드에 만든 새 테스트** |

`html.includes('…claude…') === true` 와 `html.match(/claude/gi).length === 0` 은 동시에 참일 수
없다. 016 의 범위(파비콘·머리글 마크·CSS)를 어떻게 고쳐도 마찬가지다 — 두 문장 중 어느 쪽도
로고와 무관하기 때문이다.

**어느 쪽이 틀렸는가.** 016 쪽이다. MASTER Constraints 가 말하는 `claude` 0건은
**소스 코드**(`.js` 파일)에 대한 규율이고(`lib/source.js` 만 예외), 그 규율이 막는 것은
**CLI 호출**이지 화면에 찍히는 글자가 아니다. 013 은 그 반대편을 의도적으로 설계했다 —
"우리가 무엇을 재는지 응답에 적는다"가 013 의 본문이므로, 엔진 이름이 사람에게 **보이는 것이 기능**이다.
016 은 로고를 얹는 ADDITIVE 라운드이고 013 의 표시 문구를 재판정할 권한이 없다.

**결론 — 축을 분리한다.**

- ✅ **소스 축**(유지): `lib/brand.js`·`lib/status-page.js` 등 모든 `.js` 소스에 `claude` 0개.
  기존 `status-page.test.js:231`·`control-server.test.js:2664` 가 이미 지키고 있다. 016 도 이를 지킨다
- ✅ **HTML 축 — 016 자신의 추가분**(유지, 범위를 좁힘): 016 이 새로 싣는 문자열
  (`FAVICON_HREF` base64 페이로드 · `<link rel="icon" …>` · `MARK_INLINE` · 새 CSS 선택자 3개)에
  `claude` 가 0개다. 이것이 §4 D3 표의 `claude` 행이 실제로 보증하는 명제이고, 016 의 결백을
  기계적으로 증명하는 올바른 단언이다
- ❌ **HTML 축 — 페이지 전체**(폐기): "렌더된 HTML 전체에 `claude` 0개" 는 **요구하지 않는다.**
  013 이 `엔진 범위: claude` 를 싣는 것은 **정상**이며, 016 의 HTML 에 `claude` 가 **정확히 1회**
  나타나는 것이 기대값이다

🔒 **`http://`·`https://`·`agy`·`st-` 의 HTML 0건 단언은 그대로다.** 이 절은 그 넷을 완화하지
않는다 — `claude` **한 항목만** 애초에 다른 축에 속했다는 사실을 바로잡는다. 넷은 기존 테스트가
이미 HTML 축에서 단언하고 있었고(위 표), `claude` 만 그렇지 않았다.

🔒 **폐기되는 테스트는 016 자신의 것이다.** `control-server.test.js:2824` 는 `9966a8f` 이 추가한
새 테스트이므로, 이를 고치는 것은 "기존 테스트 432개 수정 허용 0건" 위반이 **아니다**(`git diff
9966a8f~1 9966a8f` 로 확인). 그 자리는 위 두 ✅ 중 016 추가분 단언으로 **대체**한다 — 삭제하고
비워 두지 않는다. 반증력을 잃지 않게, 대체 테스트는 `엔진 범위: claude` 가 HTML 에 **있음**을
먼저 단언한 뒤(013 이 살아 있음을 증명) 016 추가분에 `claude` 가 0개임을 센다.

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

## 8. Phase 2 상세 설계 — `lib/status-page.js` 파비콘 · 머리글 마크 · CSS

### 8-0. 이 Phase 의 위치

Phase 1 이 만든 상수를 **처음으로 소비**하는 구간이고, 기존 단언 8종(§4 D3 의 표)과
맞부딪히는 **유일한** 구간이다.

🔒 **손대는 소스 파일은 `lib/status-page.js` 하나뿐이다.** `lib/control-server.js` ·
`lib/brand.js` · `assets/icon.svg` · `watch-loop.js` · 런처 `.ps1` 은 무수정이다.
라우팅도 계약도 이 Phase 의 범위가 아니다 — 렌더러가 내놓는 **문자열**만 바뀐다.

### 8-1. 변경점 — 한 파일 · 네 지점

| # | 위치 | 전 | 후 |
|---|---|---|---|
| 1 | 모듈 상단(상수 선언부 앞) | — | `const { MARK_INLINE, FAVICON_HREF } = require('./brand');` |
| 2 | `renderStatusPage()` 의 `<head>` | `<title>…</title>\n` | 그 **바로 다음 줄**에 `<link rel="icon" type="image/svg+xml" href="' + FAVICON_HREF + '">\n` |
| 3 | `renderStatusPage()` 의 `<main>` 첫 자식 | `'<h1>Quaestor</h1>\n'` | `'<div class="brand">' + MARK_INLINE + '<h1>Quaestor</h1></div>\n'` |
| 4 | `styleBlock()` 반환 문자열 꼬리 | `'.field{margin:4px 0}'` 로 끝 | 그 뒤에 선택자 **3개를 이어 붙임**(§8-5) |

네 지점 모두 **무조건 실행**이다. 분기 · payload 읽기 · 판정이 없다.

### 8-2. import 표기 — 구조분해 2개만 가져온다

```
const { MARK_INLINE, FAVICON_HREF } = require('./brand');
```

🔒 `ICON_SVG` 와 `MARK_BODY` 는 **가져오지 않는다.** 렌더러가 쓰지 않기 때문이기도 하지만,
더 중요한 이유는 `ICON_SVG` 가 HTML 에 직접 실리면 `xmlns` 의 `http://` 때문에 기존 단언
(`status-page.test.js:151`, `control-server.test.js:1613`)이 **즉시 깨진다**는 것이다.
렌더 경로가 손에 쥘 수 있는 재료를 `MARK_INLINE`(`xmlns` 없음)과 `FAVICON_HREF`(base64) 둘로
제한하면 — **잘못 쓸 재료를 애초에 쥐어주지 않는 배치**가 된다. 방어는 규율이 아니라 구조가 한다.

`./brand` 는 상대경로이므로 `status-page.test.js:160` 의 "npm 패키지 `require` 0개" 단언을 통과한다.
이 Phase 가 추가하는 `require` 는 이 한 줄이 전부다.

### 8-3. `<head>` — `<title>` 바로 다음인 이유

1. **작업 파일이 지정한 위치다**(§Scope 3) — [SPEC].
2. **검증 가능한 순서가 된다.** 테스트가 `indexOf('</title>') < indexOf(link)` 로 위치를
   단언할 수 있다. "어딘가 `<head>` 안에" 보다 강한 진술이다.
3. `<style>` **앞**이므로 파비콘 해석이 인라인 CSS 파싱 뒤로 밀리지 않는다.

`sendHtml()` 은 `Content-Type: text/html; charset=utf-8` 과 `Cache-Control: no-store` 만
보내고 **CSP 헤더가 없다**(§4 D5 실측) — `data:` URI 파비콘이 정책에 막히지 않는다.

### 8-4. 머리글 — `<h1>` 을 지우지 않고 **감싼다**

```
<div class="brand"><svg class="mark" … aria-hidden="true" focusable="false">…6 shapes…</svg><h1>Quaestor</h1></div>
```

- 🔒 `<h1>Quaestor</h1>` 이 **부분문자열로 그대로 남는다.** 치환이 아니라 감싸기이므로
  이 문자열을 보는 기존/신규 단언이 모두 성립한다.
- 🔒 바로 윗줄 `<main class="…" data-sig="…"…>` 은 **한 글자도 바뀌지 않는다.**
  `signature()` 를 수정하지 않으므로 `data-sig` 값도, 그것을 비교하는 자동 새로고침 동작도 불변이다.
- 접근성: 접근 가능 이름은 `<h1>` 텍스트가 제공하고 마크는 `aria-hidden="true"` 로 감춰진다 —
  **중복 낭독 0**. Phase 1 이 `MARK_BODY` 에서 `<title>` 을 뺀 이유가 여기서 값을 한다(§7-1).

### 8-5. CSS — 추가 3개 · 기존 선택자 무수정

기존 규칙 뒤에 이어 붙이는 선택자는 정확히 셋이다.

| 선택자 | 선언 | 역할 |
|---|---|---|
| `.brand` | `display:flex;align-items:center;gap:8px;margin:0 0 16px` | 마크와 제목을 한 줄에 세로 중앙 정렬하고, **예전 `h1` 이 지던 아래 여백을 인계**한다 |
| `.brand h1` | `margin:0` | 자기 마진을 0 으로 — flex 항목의 마진 박스가 중앙 정렬을 틀어놓지 못하게 한다 |
| `.mark` | `flex-shrink:0` | 제목이 길어져도 마크가 찌그러지지 않는다 |

**세로 리듬 보존 산술**: 전에는 `h1{margin:0 0 16px}` 이 머리글 아래 16px 을 만들었다.
이제 `.brand` 가 같은 16px 을 만들고 `.brand h1` 이 0 을 만든다 — **합계가 동일**하므로
아래 badge · section 의 위치가 픽셀 단위로 그대로다.
🔒 기존 `h1{font-size:1.1rem;margin:0 0 16px;color:#57606a}` 규칙은 **값 하나도 바꾸지 않는다.**
덮어쓰기는 더 구체적인 선택자로 한다 — `.brand h1`(0,1,1)이 `h1`(0,0,1)을 이기고, 소스 순서상으로도 뒤다.

**§4 D6 초안과의 차이 — 최종 값은 여기 것이 정본이다.**

| 항목 | D6 초안 | 최종 | 사유 |
|---|---|---|---|
| `.mark` | `flex:0 0 auto;display:block` | `flex-shrink:0` | **계산값이 같다.** flex 항목의 `flex-grow` 기본값은 0, `flex-basis` 기본값은 `auto` 이므로 남은 한 축만 명시하면 충분하고, flex 항목은 blockification 되므로 `display:block` 은 적용될 일이 없는 **무효 선언**이었다 |
| `.brand` 의 `gap` | `10px` | `8px` | 순수 시각 조정. 외부 참조가 없는 [DERIVED] 값이다 |

🔒 **`st-` 접두어 금지(015 단언) 준수**: `.brand` · `.mark` 둘 다 `\bst-[a-z0-9_-]+\b` 에 걸리지 않는다.
🔒 `.st-allowed` · `.st-stale` 를 정적 `<style>` 에 쓰지 않는다는 010 의 규율도 그대로다 —
새 선택자 셋 중 어느 것도 상태를 말하지 않는다.

### 8-6. 데이터 흐름 — 로고는 payload 를 읽지 않는다

전체 흐름은 §5 와 같고, 이 Phase 가 더하는 것은 **payload 에 의존하지 않는 두 상수**뿐이다.

```
buildStatusPayload(ctx) ──▶ renderStatusPage(payload)
                                │
                                ├─ FAVICON_HREF   (상수 · payload 무관)
                                ├─ MARK_INLINE    (상수 · payload 무관)
                                └─ signature(payload) ──▶ data-sig   ← 016 이전과 동일한 계산
```

따라서:
- `allowance.allowed` 가 `true`/`false`/`null` 중 무엇이든 로고는 **똑같이** 그려진다.
  로고는 상태를 말하지 않는다 — 상태를 말하는 것은 badge 하나뿐이라는 010 의 규율을 유지한다.
- `usage`·`agy`·`state` 가 없거나 망가져도 로고 렌더는 던지지 않는다(문자열 상수 연결뿐).
- `payload.error` 로 500 이 나가는 경로는 애초에 HTML 을 만들지 않으므로 **완전히 무영향**이다.

### 8-7. 테스트 배치 — 두 층으로 나눈다

| 파일 | 성격 | 잡는 실패 |
|---|---|---|
| `test/status-page.test.js` (추가만) | 포트 없는 **순수 렌더** | 문자열 조립이 틀렸다 |
| `test/control-server.test.js` (추가만) | `startControlServer({ port: 0 })` **실제 왕복** | 조립은 맞는데 서버가 그것을 내보내지 않는다 |

두 실패는 서로 다르다. 렌더러 반환값만 보면 "서버가 이 렌더러를 부르긴 하는가" 를 증명하지 못하고,
실제 포트만 보면 실패 시 원인이 라우팅인지 조립인지 가려지지 않는다.

실제 포트 층이 단언하는 것(수용 기준 6):

1. `GET /` → 200, HTML 에 `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,` 가 있고
   **HTML 에서 잘라낸** href 를 디코드하면 `ICON_SVG` 와 같다
2. HTML 에 `<div class="brand"><svg class="mark"` 와 `<h1>Quaestor</h1>` 가 있다
3. HTML 에 `http://` · `https://` · `agy` 가 0개
4. `GET /favicon.ico` → 404 이고 본문이 JSON 으로 파싱된다(새 경로 없음)
5. `GET /api/health` 의 `contracts["supervised-v1"]` 가 `1.5.0` 그대로
6. **[CHANGED]** HTML 에 `엔진 범위: claude` 가 **있고**(013 무회귀), 016 이 새로 실은 문자열
   (`FAVICON_HREF` · `<link rel="icon" …>` · `MARK_INLINE` · 새 CSS 선택자 3개)에는 `claude` 가 0개다

🔒 **[CHANGED] 3번 목록에 `claude` 를 넣지 않는다.** `claude` 는 소스 축이고 HTML 축이 아니다 —
013 이 `엔진 범위: claude` 를 **반드시** 싣기 때문이다(§4 D3-1). 6번이 그 자리를 대신하며,
"016 의 추가분은 결백하다" 를 013 무회귀와 **한 테스트 안에서** 함께 증명한다.

🔒 **3번은 015 의 `ctx.agy` 스냅샷 픽스처를 채운 상태에서 확인한다.** 파비콘·마크 추가분과
Gemini 구역이 **함께 렌더된 HTML** 을 봐야 하기 때문이다. 그리고 0개를 단언하기 **전에**
`<h2>Gemini</h2>` 가 실제로 있음을 먼저 단언한다 — 그러지 않으면 "구역이 안 그려져서 `agy` 가 0개"
라는 **공허한 통과**가 가능하다. 빈 픽스처로 0개를 세는 것은 아무것도 재지 않는다.

### 8-8. 🔒 반증 가능성 — 통과만 하는 테스트는 근거가 아니다

실제 포트 경계 테스트는 **HEAD `55f14ed` 에서 반드시 실패해야 한다.** 그 시점의 HTML 에는
`<link rel="icon">` 도 `<div class="brand">` 도 없으므로 단언 1·2 가 즉시 깨진다.
`lib/status-page.js` 만 그 상태로 되돌려 실패를 **눈으로 확인**한 뒤 복원하는 절차를 밟는다.

**[CHANGED] 새 6번 단언도 같은 검사를 통과해야 한다.** 6번은 "013 무회귀" 와 "016 추가분 결백"
두 조각으로 되어 있는데, 013 조각만으로는 `55f14ed` 에서도 통과하므로 **반증력이 없다.**
016 조각이 그것을 준다 — `55f14ed` 의 HTML 에는 잘라낼 `<link rel="icon" …>`·`MARK_INLINE` 이
**존재하지 않으므로** "그 조각들을 HTML 에서 잘라낸다" 는 단계에서 실패한다.
🔒 그래서 6번은 **조각을 먼저 HTML 에서 찾아 잘라낸 뒤** 거기서 `claude` 를 세야 한다.
상수(`brand.js` 의 `FAVICON_HREF`·`MARK_INLINE`)를 직접 세는 방식으로 대신하면 `55f14ed` 에서도
통과해 버린다 — 그것은 Phase 1 의 단위 테스트가 할 일이지 경계 테스트가 할 일이 아니다.

### 8-9. Phase 2 가 기존 432개를 깨지 않는 이유

기존 테스트 파일 2개에 **추가만** 하고 한 줄도 수정하지 않는다. 새로 렌더되는 문자열이
기존 단언 8종(§4 D3 표)에 편입되지만 전부 clear 임이 Phase 1 에서 바이트로 확인됐고,
Phase 2 는 그 확인된 상수를 **그대로** 실을 뿐 새 문자열을 만들지 않는다.
유일한 신규 문자열은 `<link rel="icon" …>` 껍데기와 `<div class="brand">` 껍데기,
그리고 CSS 선택자 3개인데 셋 다 `http`·`agy`·`claude`·`st-` 를 담지 않는다.

**[CHANGED] 실측(2026-09-24, 이 재설계 시점 재실행)**: `node p-quaestor/test/run-all.js` →
**465 tests / 464 pass / 1 fail / exitCode 1**.

위의 "456/456/0" 은 직전 라운드의 **테스트 추가 커밋(`9966a8f`) 이전** 숫자였다. 그 커밋이
`status-page.test.js` 와 `control-server.test.js` 에 9개를 더해 465가 됐고, 그중 1개
(`control-server.test.js:2824`)가 §4 D3-1 의 명세 결함 때문에 실패한다. **유일한 실패다.**

🔒 **실패의 성격**: 회귀가 아니다. `lib/status-page.js` 의 구현은 이미 랜딩해 있고
(`<link rel="icon" …>` 는 `status-page.js:198`, `<div class="brand">` 는 `:203`) 나머지 464개가
전부 통과한다. 기존 432개도 한 개도 깨지지 않았다. 고쳐야 할 것은 **기준 문장 한 줄**이다.

**목표 상태**: `control-server.test.js:2824` 를 §8-7 6번의 단언으로 대체하면
**465 tests / 465 pass / 0 fail / exitCode 0**(1:1 대체이므로 총수 불변). 테스트를
쪼개 넣으면 총수는 늘 수 있다 — 고정하는 것은 **실패 0 / exitCode 0** 과
**기존 432개 무수정**이지 총 개수가 아니다.

### 8-10. 현황 기록

Phase 2 의 구현·테스트·평가는 이미 랜딩했고(`94b70b8` implement → `37fa9f4` test →
`a20d2d0` eval → `d809303` fix → `c8c2278` test → `be6972c` eval), 직전 eval 은
"Issues found: 없음" 으로 완료를 확인했다. 직전 라운드의 FIX 지적(경계 테스트가 015 의 agy
픽스처를 쓰지 않아 로고 추가분과 Gemini 구역의 **조합**을 한 번도 검증하지 못했다는 문제)은
§8-7 의 규율로 해소되어 `control-server.test.js:2736` 에 반영돼 있다.

남아 있던 결손은 **설계 산출물 쪽**이었다 — 본 §8 의 상세 설계와 `output/ACCEPTANCE.md` 의
Phase 2 기준 블록이 비어 있었다. 이 문서가 그것을 채운다. Phase Guard 가 지적한
`PROGRESS.md` 의 `2:PENDING` 표시는 구현 결손이 아니라 **상태 표기 미갱신**이다.

**[CHANGED] 그 채움이 결함을 하나 들여왔다.** `3212652`(design-next)가 쓴 `ACCEPTANCE.md`
Phase 2 "외부 리소스 0건" 절에 **"렌더된 HTML 에 `claude` 가 0개"** 가 섞여 들어갔고
(§4 D3 표가 소스 축과 HTML 축을 한 표에 섞어 둔 것이 발원지다), 다음 라운드 `9966a8f`(test)가
그 기준을 충실히 테스트로 옮기자 013 의 동결 동작과 충돌해 실패했다. `a20d2d0`/`be6972c` 이
"Issues found: 없음" 을 낸 것은 **그때는 이 기준이 테스트로 존재하지 않았기 때문**이다 —
기준을 쓴 라운드와 그것을 실행한 라운드가 갈라져 있었다.

이 재설계가 고치는 것은 **그 한 줄과 그 파급뿐**이다(§4 D3-1 · §8-7 6번 · 아래 §9).
`brand.js`·`assets/icon.svg`·`status-page.js` 의 설계(§2·§4 D1·D2·D4~D7·§7)와 Phase 1 전체는
실측으로 통과가 확인돼 있으므로 **한 글자도 바꾸지 않는다.** 재설계 범위를 여기서 넘기지 않는다.

---

## 9. 불변 · 금지

- `CONTRACTS = { 'supervised-v1': '1.5.0' }` 그대로. `/api/health`·`/api/status` 응답 불변
- **기존 테스트 432개 수정 허용 0건.** 깨지면 구현을 고친다
- 새 경로 0개 — `/favicon.ico` 는 계속 JSON 404
- 의존성 추가 금지(`dependencies` 는 `['puppeteer']` 그대로) · 외부 리소스 0건
- **[CHANGED]** `brand.js` 포함 모든 `.js` **소스 파일**에서 `claude` 0개(`lib/source.js` 만 예외).
  🔒 이것은 **소스 축**이다. **렌더된 HTML 에는 적용되지 않는다** — 013 이 `엔진 범위: claude` 를
  싣는 것이 정상이고, `GET /` HTML 의 `claude` 기대 개수는 0이 아니라 **1**이다(§4 D3-1).
  HTML 축에서 0건을 요구하는 것은 `http://`·`https://`·`agy`·`st-*` **넷뿐**이며, 그 넷은 완화하지 않는다
- **[CHANGED]** 013 무회귀: `GET /` HTML 은 `<div class="field">엔진 범위: claude</div>` 를 계속 낸다.
  016 은 `usage.covers`/`allowance.covers` 와 그 렌더 줄(`status-page.js:208`)을 건드리지 않는다
- 새 클래스에 `st-` 접두어 금지 · `<main>` 의 class·style·`data-sig` 불변 · `<h1>Quaestor</h1>` 부분문자열 유지
- 영문 코드/주석(한글은 페이지 표시 문구에만 — `brand.js` 에는 한글이 없다)
- `.profile` · `deploy.json` · Agora `icons/` · 다른 제품: 손대지 않는다
