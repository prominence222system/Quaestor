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
