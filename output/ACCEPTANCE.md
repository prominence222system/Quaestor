## Phase 1 Acceptance Criteria

### 정본 바이트 고정
- [SPEC] `lib/brand.js` 의 `ICON_SVG` 는 UTF-8 바이트 길이가 **정확히 574** 이고 sha256 이 `9d37e924332295cc860c6231bcd75a139435acd95d4f9de321e04e8ae8397e72` 다.
- [SPEC] `ICON_SVG` 에는 `\n` 과 `\r` 이 **0개**이고 선행 BOM 이 없다(한 줄 · git 의 CRLF 변환이 건드릴 대상이 없음).
- [SPEC] `MARK_BODY` 는 `<title>…</title>` 을 포함하지 않는 도형 구간이며 `<rect>` 5개 + `<line>` 1개 = **도형 6개**를 담는다.

### 자산 파일 동일성
- [SPEC] `p-quaestor/assets/icon.svg` 파일을 바이너리로 읽은 바이트가 `Buffer.from(ICON_SVG, 'utf8')` 와 동일하다(sha256 비교). 끝 줄바꿈 1바이트라도 붙으면 실패다.
- [SPEC] `assets/icon.svg` 는 기존 `.gitignore` 규칙(`node_modules/`, `.profile/`, `*.log`)에 걸리지 않고 저장소에 커밋되며, 이를 위해 `.gitignore` 를 수정하지 않는다.

### 파비콘 표기 (base64 data URI)
- [SPEC] `FAVICON_HREF` 는 `'data:image/svg+xml;base64,'` 로 시작하고, 접두어 뒤를 base64 디코드한 결과가 `ICON_SVG` 와 **문자열 동일**하다(왕복 항등).
- [SPEC] 그 디코드 결과에는 `xmlns="http://www.w3.org/2000/svg"` 가 **있다** — 단독 SVG 문서로 실제 렌더됨의 보증이다.
- [SPEC] `FAVICON_HREF` 문자열 자체에는 `agy` · `http://` · `https://` 가 **각각 0개**다.
- [SPEC] `FAVICON_HREF` 는 기존 정규식 `/(src|href)\s*=\s*["']https?:\/\/|@import\s+["']?https?:\/\/|fetch\(\s*["']https?:\/\//i` 에 `href="…"` 속성으로 실렸을 때 매칭되지 않는다.

### 출처 단일성 · 인라인 표기
- [SPEC] `MARK_INLINE` 에는 `xmlns` 와 `http` 가 **0개**이고 `aria-hidden="true"` 가 포함된다.
- [SPEC] `MARK_INLINE` 의 여는 태그는 `<svg class="mark" viewBox="0 0 64 64" width="28" height="28" aria-hidden="true" focusable="false">` 이고 `</svg>` 로 닫힌다.
- [SPEC] `MARK_BODY` 는 `ICON_SVG` 와 `MARK_INLINE` **양쪽 모두의 부분문자열**이다(그림의 출처가 하나임의 기계적 증거).
- [SPEC] `MARK_INLINE` 에는 `\bst-[a-z0-9_-]+\b` 패턴이 0개다(015 의 `st-*` 격리 단언 보호).

### 아이콘 안전검사 (Agora 와 동일 조건)
- [SPEC] `ICON_SVG` 에 `<script` · `onload=` · `onerror=` · `<foreignObject` · `href=` 가 **각각 0개**다.
- [SPEC] `ICON_SVG` 의 바이트 길이가 65536 이하다.

### 제약 준수 · 회귀 0
- [SPEC] `lib/brand.js` 소스에 `claude` 가 대소문자 무시 **0개**다(MASTER Constraints — `lib/source.js` 만 예외).
- [SPEC] `lib/brand.js` 에는 `require(` 가 **0개**이고 `package.json` 의 `dependencies` 키 배열은 `['puppeteer']` 그대로다.
- [SPEC] Phase 1 은 기존 파일을 **한 줄도 수정하지 않는다**(신규 3개 파일만 추가) — `lib/control-server.js` · `lib/status-page.js` · `watch-loop.js` · 기존 테스트 432개 전부 무수정.
- [SPEC] `node p-quaestor/test/run-all.js` 가 **432 + 신규** 테스트를 돌려 실패 0 / exitCode 0 을 낸다(기준선 432/432/0 유지).
- [SPEC] `lib/` 전체를 순회하는 기존 단언(`test/scrape-classify.test.js:371`, `https://claude.ai` 정확히 1회)이 `brand.js` 편입 후에도 통과한다 — `brand.js` 의 `http://www.w3.org/…` 는 해당 문자열이 아니다.
- [SPEC] 저장소 전체를 순회하는 기존 단언(`test/launcher-rename.test.js:100`, `run-bellows`/`deploy-bellows` 0건)이 `assets/icon.svg` 편입 후에도 통과한다.
- [SPEC] `/api/health` 의 `contracts["supervised-v1"]` 는 `1.5.0` 그대로이고 `/api/health`·`/api/status` 응답 형태는 변하지 않는다.

### 설계 선택 (외부 참조 없음 — 더 나은 자기일관적 대안이 나오면 개정 가능)
- [DERIVED] `MARK_BODY` 가 리터럴 원본이고 `ICON_SVG`·`MARK_INLINE` 은 그것을 앞뒤 래퍼로 감싸 조립한다(런타임 문자열 절단 `indexOf`/`slice` 방식을 쓰지 않는다). 래퍼 오타는 sha256 단언이 잡는다.
- [DERIVED] `xmlns` 를 품은 여는 태그는 모듈 **내부 상수**로 두고 export 하지 않는다 — 외부에서 그 조각만 가져다 HTML 에 `http://` 를 끌어들일 길을 만들지 않는다.
- [DERIVED] `lib/brand.js` 는 `assets/icon.svg` 를 읽지 않는다(`fs` 미사용). 순수성을 지키고 "파일이 없으면 서버가 못 뜬다" 는 새 실패 모드를 만들지 않으며, 두 표현의 동일성은 코드가 아니라 **테스트**가 잇는다.
- [DERIVED] 단독 문서(`ICON_SVG`)는 `role="img"`+`aria-label`+`<title>` 로 이름을 갖고, 인라인(`MARK_INLINE`)은 옆의 `<h1>Quaestor</h1>` 과 중복 낭독되지 않도록 `aria-hidden="true"`+`focusable="false"` 로 보조기술에서 감춘다.
- [DERIVED] 새 테스트는 `test/brand.test.js` 한 파일에 모으고, `node:test`/`node:assert`/`node:crypto`/`node:fs`/`node:path` 만 쓴다.

## Phase 2 Acceptance Criteria

### 파비콘 `<link>` 주입
- [SPEC] 렌더된 HTML 의 `<head>` 안에 `<link rel="icon" type="image/svg+xml" href="{FAVICON_HREF}">` 가 정확히 그 형태로 존재한다.
- [SPEC] 그 `<link>` 는 `</title>` **뒤**에 온다(작업 파일 §Scope 3 "`<title>` 줄 바로 다음"). 문자열 위치 비교로 확인 가능해야 한다.
- [SPEC] `href` 속성값을 **렌더된 HTML 에서 잘라내** base64 디코드한 결과가 `lib/brand.js` 의 `ICON_SVG` 와 문자열 동일하다(상수를 다시 읽어 비교하는 것이 아니라 실제 출력 바이트에서 왕복한다).
- [SPEC] 그 `<link>` 의 `rel` 은 `icon` 이며 `stylesheet` 가 아니다 — 기존 단언 `/<link[^>]+rel=["']stylesheet["']/` 0건이 유지된다.

### 머리글 브랜드 마크
- [SPEC] `<main>` 안에 `<div class="brand"><svg class="mark"` 로 시작하는 머리글 블록이 있고, 그 안에 `MARK_INLINE` 전체가 실린다.
- [SPEC] `<h1>Quaestor</h1>` 부분문자열이 HTML 에 그대로 남는다 — 치환이 아니라 감싸기다.
- [SPEC] `<main class="…" data-sig="…"…>` 줄은 class · style · `data-sig` 가 016 이전과 동일하다. `signature()` 는 수정되지 않는다.
- [SPEC] 인라인 마크는 `aria-hidden="true"` 와 `focusable="false"` 를 갖는다 — 옆의 `<h1>` 과 접근 가능 이름이 중복 낭독되지 않는다.
- [SPEC] 로고는 payload 를 읽지 않는다: `allowance.allowed` 가 `true`/`false`/`null` 중 무엇이든, `usage`·`agy`·`state` 가 없거나 망가져도 파비콘과 머리글 마크는 동일하게 렌더되고 예외를 던지지 않는다.

### CSS — 추가만
- [SPEC] `styleBlock()` 은 선택자를 **추가만** 하고 기존 선택자의 선언값을 하나도 바꾸지 않는다(예: 기존 `.badge{…}` 규칙 문자열이 016 이전과 동일하게 출력된다).
- [SPEC] 새 클래스 이름에 `st-` 접두어가 없다 — 015 의 `\bst-[a-z0-9_-]+\b` 격리 단언이 유지된다.
- [SPEC] 새 선택자 중 어느 것도 상태를 말하지 않는다 — `.st-allowed`·`.st-stale` 토큰은 정적 `<style>` 블록에 여전히 등장하지 않는다(010 의 규율).
- [DERIVED] 추가 선택자는 `.brand`(마크와 제목의 가로 정렬) · `.brand h1`(자체 마진 0) · `.mark`(축소 금지) 3개다.
- [DERIVED] 머리글 아래 여백의 **총합이 016 이전과 같다** — 예전에 `h1` 규칙이 만들던 아래 마진을 `.brand` 가 그대로 인계하고 `.brand h1` 이 자기 마진을 0 으로 만든다. 구체 픽셀 값은 기존 `h1` 규칙에서 가져온 파생값이며 개정 가능하다.
- [DERIVED] 기존 `h1` 규칙을 수정하는 대신 더 구체적인 `.brand h1` 로 덮는다(선택자 구체성 + 소스 순서 양쪽으로 이긴다).
- [DERIVED] `.mark` 는 `flex-shrink:0` 한 줄로 충분하다 — flex 항목의 `flex-grow` 기본값이 0, `flex-basis` 기본값이 `auto` 이고 flex 항목은 blockification 되므로 DESIGN §4 D6 초안의 `flex:0 0 auto;display:block` 과 계산값이 같다.

### 외부 리소스 0건 — 기존 단언을 완화하지 않고 통과
- [SPEC] 렌더된 HTML 에 `http://` 와 `https://` 가 **각각 0개**다(`test/status-page.test.js` · `test/control-server.test.js` 의 기존 단언 — 완화 금지).
- [SPEC] 렌더된 HTML 이 기존 외부 URL 가드 정규식 `/(src|href)\s*=\s*["']https?:\/\/|@import\s+["']?https?:\/\/|fetch\(\s*["']https?:\/\//i` 에 매칭되지 않는다.
- [SPEC] 렌더된 HTML 에 `agy` 가 대소문자 무시 **0개**다(015 단언 유지).
- [SPEC] 그 `agy` 0건 확인은 **Gemini 구역이 실제로 렌더된 상태**에서 이루어진다 — 015 형식의 `ctx.agy` 스냅샷 픽스처를 채우고, 0개를 세기 **전에** `<h2>Gemini</h2>` 가 HTML 에 있음을 먼저 단언한다. 빈 픽스처로 센 0건은 근거가 아니다.
- **[CHANGED]** [SPEC] **016 이 새로 싣는 문자열**(`FAVICON_HREF` 의 base64 페이로드 · `<link rel="icon" …>` 껍데기 · `MARK_INLINE` · 새 CSS 선택자 3개)에 `claude` 가 대소문자 무시 **0개**다. 🔒 **실제 포트 경계 테스트에서는 그 조각들을 렌더된 HTML 에서 찾아 잘라낸 뒤 거기서 센다** — `brand.js` 의 상수를 직접 세면 HEAD `55f14ed` 에서도 통과해 반증력을 잃는다(DESIGN §8-8). 상수를 직접 세는 것은 Phase 1 단위 테스트의 몫이다.
- **[CHANGED]** [SPEC] 🔒 **렌더된 HTML *전체*에 대해서는 `claude` 0건을 요구하지 않는다.** 013 이 `<div class="field">엔진 범위: claude</div>` 를 **반드시** 싣기 때문이다(`lib/source.js:4` `ENGINE='claude'` → `observation.js:303/311` 이 `covers` 를 무조건 `[ENGINE]` 로 채움 → `status-page.js:208` 이 렌더, 동결 테스트 `control-server.test.js:1529`·`1572`). MASTER Constraints 의 `claude` 0건은 **`.js` 소스 파일 축**이며(기존 단언 `status-page.test.js:231`·`control-server.test.js:2664` 가 지킨다) HTML 축이 아니다. DESIGN §4 D3-1 참조.
- **[CHANGED]** [SPEC] 013 무회귀: 렌더된 HTML 에 `<div class="field">엔진 범위: claude</div>` 가 **있다.** 016 은 `covers` 계산도 그 렌더 줄도 건드리지 않는다.
- **[CHANGED]** [SPEC] `lib/status-page.js` 소스에 `claude` 가 대소문자 무시 0개이고, `lib/brand.js` 소스도 마찬가지다(소스 축 — 완화 금지).

### 경계 — 실제 포트 왕복
- **[CHANGED]** [SPEC] `startControlServer({ port: 0, … })` 로 띄운 실제 서버의 `GET /` 가 200 을 내고, 위 파비콘·머리글·0건 단언이 **HTTP 왕복을 거친 응답 본문**에서 성립한다(렌더러 반환값이 아니라 네트워크로 받은 문자열). 🔒 여기서 "0건 단언" 은 `http://`·`https://`·`agy`·`st-*` 넷과 위의 **016 추가분 한정** `claude` 단언을 가리킨다 — **HTML 전체의 `claude` 0건은 포함하지 않는다.**
- **[CHANGED]** [SPEC] 그 같은 응답 본문에서 `엔진 범위: claude` 가 **먼저** 확인된 뒤에 016 추가분의 `claude` 0건을 센다 — 013 이 살아 있음을 증명하지 않은 채 센 0건은 근거가 아니다(§ `agy` 의 `<h2>Gemini</h2>` 선행 단언과 같은 규율).
- **[CHANGED]** [SPEC] 직전 라운드가 추가한 `control-server.test.js:2824` (`real server GET / HTML has zero "claude" occurrences`)는 위 두 줄의 단언으로 **대체**된다. 🔒 이 테스트는 `9966a8f` 이 만든 **016 자신의 산출물**이므로 대체가 "기존 테스트 432개 수정 허용 0건" 을 위반하지 않는다. 삭제하고 빈자리로 두지 않는다.
- [SPEC] `GET /favicon.ico` 는 404 이고 본문이 JSON 으로 파싱되며 `ok === false` 다. 본문에 `<html` 이 없다 — 새 경로를 만들지 않았다.
- [SPEC] `GET /api/health` 의 `contracts["supervised-v1"]` 가 `1.5.0` 그대로다.
- [SPEC] 실제 포트 경계 테스트는 `lib/status-page.js` 가 HEAD `55f14ed` 상태일 때 **실패한다**(그 시점 HTML 에 `<link rel="icon">`·`<div class="brand">` 가 없다). 통과만 하는 테스트는 근거로 인정하지 않는다.

### 회귀 0 · 제약 준수
- [SPEC] Phase 2 는 소스 파일 중 `lib/status-page.js` **하나만** 수정한다 — `lib/control-server.js` · `lib/brand.js` · `assets/icon.svg` · `watch-loop.js` · 런처 `.ps1` 은 무수정이다.
- [SPEC] 기존 테스트 432개를 **한 줄도 수정하지 않는다.** `test/status-page.test.js` 와 `test/control-server.test.js` 에는 **추가만** 한다.
- [SPEC] `/api/health` · `/api/status` 의 응답 형태와 바이트가 016 이전과 동일하다. 계약 버전은 `1.5.0` 그대로다.
- [SPEC] 의존성 추가 0건이고, `status-page.js` 가 새로 갖는 `require` 는 상대경로 `./brand` 하나뿐이다 — 기존 "npm 패키지 `require` 0개" 단언이 유지된다.
- **[CHANGED]** [SPEC] `node p-quaestor/test/run-all.js` 가 **실패 0 / exitCode 0** 을 낸다. 432(기준선) + Phase 1 신규 + Phase 2 신규가 모두 통과한다. 재설계 직전 실측은 **465 / 464 pass / 1 fail / exitCode 1** 이었고, 그 1건이 위에서 대체되는 `control-server.test.js:2824` 다. 1:1 대체 시 465/465/0 이 되며, 🔒 고정하는 것은 **실패 0 · exitCode 0 · 기존 432개 무수정**이지 총 개수가 아니다.
- [DERIVED] `status-page.js` 는 `brand.js` 에서 `MARK_INLINE` 과 `FAVICON_HREF` **둘만** 가져온다. `ICON_SVG`·`MARK_BODY` 를 가져오지 않음으로써 `xmlns` 의 `http://` 를 HTML 에 실을 수 있는 재료를 렌더 경로가 아예 쥐지 못하게 한다.
- [DERIVED] 새 테스트는 순수 렌더층(`test/status-page.test.js`)과 실제 포트층(`test/control-server.test.js`)으로 나눠 넣는다 — 문자열 조립 실패와 전달 실패는 서로 다른 실패이므로 서로 다른 층에서 잡는다.
