# 016 — 로고: 상태 페이지 파비콘·머리글 마크 + 저장소 자산 `assets/icon.svg`

## Project Type

제품 진화(Quaestor) · Node · **ADDITIVE** · never-brick.
🔒 **계약 버전 불변(`supervised-v1` 1.5.0).** 상태 페이지(`GET /`)는 감독 계약의 일부가 아니다.
`/api/*` 응답은 한 바이트도 바뀌지 않는다.

## Project Goal

사용자가 로고 시안 **C — "두 계기와 정지선"**(세션·주간 막대 두 개, 하나가 정지선에 닿음)을 골랐다.
같은 그림이 서야 할 표면이 셋이다:

| 표면 | 누가 | 이 NNN |
|---|---|---|
| Agora `icons/Quaestor.svg` (제품 정체) | 세션이 이미 교체함 | 범위 밖 |
| Armory 카탈로그 (`deploy.json` 의 `icon`) | 세션이 랜딩 후 한 줄 넣는다 — `deploy.json` 은 **저장소에 없는 데이터 파일**이다 | **가리킬 파일만 만든다**: `p-quaestor/assets/icon.svg` |
| 상태 페이지 `GET /` (탭 파비콘 + 머리글) | — | **본체** |

## 🔒 정본 SVG — 한 글자도 바꾸지 말 것

574바이트, **한 줄**(줄바꿈 0개 — git 의 CRLF 변환이 건드릴 것이 없게), BOM 없음, 끝 줄바꿈 없음.
sha256 = `9d37e924332295cc860c6231bcd75a139435acd95d4f9de321e04e8ae8397e72`

```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Quaestor"><title>Quaestor</title><rect x="2" y="2" width="60" height="60" rx="14" fill="#1f2430"/><rect x="11" y="18" width="42" height="9" rx="4.5" fill="#3a4152"/><rect x="11" y="37" width="42" height="9" rx="4.5" fill="#3a4152"/><rect x="11" y="18" width="20" height="9" rx="4.5" fill="#f2f4f8"/><rect x="11" y="37" width="33" height="9" rx="4.5" fill="#e0a33e"/><line x1="44" y1="12" x2="44" y2="52" stroke="#f2f4f8" stroke-width="3" stroke-linecap="round"/></svg>
```

`<title>…</title>` 뒤부터 `</svg>` 앞까지(도형 6개)가 **`MARK_BODY`** 다.

## Scope

### 1) `p-quaestor/lib/brand.js` — 로고의 유일한 출처 (순수, `require` 0개)

| export | 값 |
|---|---|
| `MARK_BODY` | 도형 6개 문자열(위 정본의 해당 구간 그대로) |
| `ICON_SVG` | 위 정본. `MARK_BODY` 로 조립해도 되지만 **결과는 정본과 바이트 동일** |
| `MARK_INLINE` | `<svg class="mark" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" focusable="false">` + `MARK_BODY` + `</svg>` — **`xmlns` 없음**(HTML5 인라인 SVG 는 필요 없다) |
| `FAVICON_HREF` | `'data:image/svg+xml;base64,' + Buffer.from(ICON_SVG, 'utf8').toString('base64')` |

🔒 **왜 base64 인가 — 우회가 아니라 두 조건을 동시에 지키는 유일한 표기다.**
파비콘은 **단독 SVG 문서**라 `xmlns="http://www.w3.org/2000/svg"` 가 없으면 이미지로 그려지지 않는다.
그런데 기존 테스트가 렌더된 HTML 에 `http://` **문자열 0개**를 단언한다
(`test/status-page.test.js:151-152`, `test/control-server.test.js:1613-1614`). `xmlns` 는 요청이 아니라
이름공간 식별자이므로 "외부 요청 0건" 이라는 원래 뜻은 어기지 않는다. base64 로 실으면 문자열 단언과
원래 뜻이 **둘 다** 지켜진다. 🔒 **기존 단언을 완화하지 말 것.**
✅ 세션이 미리 계산해 확인했다: 이 정본의 base64 에는 `agy`·`http`·`https` 가 **0개**다(015 의
"HTML 에 `agy` 0개" 단언 `test/status-page.test.js:390` 이 파비콘 때문에 깨지지 않는다).

🔒 **SVG 문자열은 `brand.js` 에만 둔다.** `status-page.js` 에 두면 `xmlns` 의 주소 문자열이 그 소스에
들어온다(`control-server.test.js:2665` 는 `status-page.js` 소스의 `https://` 0개를 단언한다 — 지금은
`http://` 라 안 걸리지만, 로고 문자열이 두 곳에 살면 언젠가 갈라진다).

### 2) `p-quaestor/assets/icon.svg` — Armory 카탈로그용 파일

- 내용 = `ICON_SVG` 와 **바이트 동일**(sha256 위와 같음). 끝 줄바꿈 넣지 말 것
- 🔒 Agora 볼트의 `icons/Quaestor.svg` 와 **같은 바이트**다(세션이 이미 이 바이트로 넣었다). **사본이지 참조가 아니다**
- `deploy.json` 은 건드리지 않는다(저장소에 없다 — 랜딩 후 세션이 `"icon": "p-quaestor/assets/icon.svg"` 를 넣는다)

### 3) `p-quaestor/lib/status-page.js` — 파비콘과 머리글 마크

- `<head>` 의 `<title>` 줄 **바로 다음**에:
  `'<link rel="icon" type="image/svg+xml" href="' + FAVICON_HREF + '">\n'`
- `<main …>` 안의 `'<h1>Quaestor</h1>\n'` 을
  `'<div class="brand">' + MARK_INLINE + '<h1>Quaestor</h1></div>\n'` 로 바꾼다.
  🔒 `<h1>Quaestor</h1>` **부분 문자열은 그대로 남는다.** `<main class="…" data-sig="…">` 는 불변
- CSS(`styleBlock()`): `.brand`(가로 정렬, 마크와 제목 사이 간격)와 `.mark`(줄어들지 않음)를 **추가만** 한다.
  기존 선택자는 값 하나도 바꾸지 않는다. 🔒 새 클래스에 `st-` 접두어 금지(015 단언)
- 🔒 **새 경로를 만들지 않는다.** `GET /favicon.ico` 는 지금처럼 **JSON 404** 다 — `<link rel="icon">` 이 있으면
  브라우저는 그것을 쓰고 `/favicon.ico` 를 따로 찾지 않는다

## 🔒 불변

- `CONTRACTS` = `{ 'supervised-v1': '1.5.0' }` 그대로. `/api/health`·`/api/status` 응답 불변
- **기존 테스트 432개를 한 줄도 고치지 않고 통과한다.** 이 NNN 에서 허용된 기존 테스트 수정은 **없다** —
  깨지면 구현을 고친다
- 의존성 추가 금지 · 외부 리소스 0건 · `brand.js` 포함 모든 `.js` 에서 `claude` 0개(MASTER Constraints)
- 영문 코드/주석

## 수용 기준 — 새 테스트 (`test/brand.test.js` + 기존 파일에 **추가만**)

1. `ICON_SVG`: sha256 = `9d37e924…97e72`, 길이 574, `\n`·`\r` 0개
2. `assets/icon.svg` 파일 바이트 === `Buffer.from(ICON_SVG, 'utf8')` (sha256 비교, 끝 줄바꿈 허용 안 함)
3. `FAVICON_HREF` 를 base64 디코드하면 `ICON_SVG` 와 같다. 디코드 결과에 `xmlns="http://www.w3.org/2000/svg"` 가
   **있다**(단독 문서로 그려짐을 보증). `FAVICON_HREF` 자체에는 `agy`·`http://`·`https://` 가 **없다**
4. `MARK_INLINE`: `xmlns`·`http` 0개, `aria-hidden="true"` 포함. `MARK_BODY` 가 `ICON_SVG` 와 `MARK_INLINE`
   **양쪽에** 들어 있다(출처가 하나)
5. Agora 아이콘 안전검사와 같은 조건: `ICON_SVG` 에 `<script`·`onload=`·`onerror=`·`<foreignObject`·`href=` 0개,
   65536바이트 이하
6. 🔒 **경계 테스트 — 실제 포트**(`startControlServer({ port: 0, … })`, 015 의 agy 스냅샷 픽스처 사용):
   - `GET /` → 200, HTML 에 `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,` 가 있고,
     그 href 를 **HTML 에서 잘라내 디코드한 값**이 `ICON_SVG` 와 같다
   - HTML 에 `<div class="brand"><svg class="mark"` 와 `<h1>Quaestor</h1>` 가 있다
   - HTML 에 `http://`·`https://`·`agy` 가 **0개**
   - `GET /favicon.ico` → 404 이고 본문이 JSON 으로 파싱된다(새 경로 없음)
   - 🔒 이 테스트는 **HEAD `55f14ed` 에서 실패해야 한다**(그때는 `<link rel="icon">` 이 없다).
     통과만 하는 테스트는 아무것도 증명하지 않는다
7. 전체 스위트 `node p-quaestor/test/run-all.js`: **432 + 신규**, 실패 0

## Phases

1. `lib/brand.js` + `assets/icon.svg` + `test/brand.test.js`(기준 1~5)
2. `lib/status-page.js` 파비콘·머리글·CSS + 렌더 단위 테스트 + 실제 포트 경계 테스트(기준 6), 전체 스위트(기준 7)

## 범위 밖

- `deploy.json` 의 `icon` 한 줄(저장소 밖 — 세션이 한다)
- Agora `icons/`(세션이 이미 교체) · 계약 문서 · 다른 제품
- 트레이·Gate 쪽 아이콘(Gate 는 제품 아이콘을 쓰지 않는다 — 2026-09-24 코드 확인)
