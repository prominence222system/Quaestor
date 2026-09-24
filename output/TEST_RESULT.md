# TEST_RESULT — 016-logo-favicon-and-header-mark.md

## 대상 Phase

Phase 1 + Phase 2 (둘 다 PROGRESS.md 상 DONE으로 표기됨 — 이번 QA 실행은 두 Phase의
수용 기준 전체를 최종 확인한다).

## 실행 요약

- 실행 명령: `node p-quaestor/test/run-all.js`
- 결과: **465 tests / 465 pass / 0 fail / cancelled 0 / exitCode 0**
- 기준선(432) + Phase 1 신규(`test/brand.test.js`, 17개) + Phase 2 신규
  (`test/status-page.test.js` 11개 + `test/control-server.test.js` 5개, 대체 1건 포함) = 465. 정확히 일치.
- 구현 코드 수정 **없음** — 이번 QA 회차에서 발견된 실패나 버그가 없었다.

## Phase 1 — `lib/brand.js` + `assets/icon.svg` + `test/brand.test.js`

| 기준 | 상태 |
|---|---|
| `ICON_SVG` 574바이트 / sha256 정확 일치 | PASS |
| `ICON_SVG` 에 `\n`·`\r`·BOM 0개 | PASS |
| `MARK_BODY` = 도형 6개(`<rect>`×5 + `<line>`×1), `<title>` 미포함 | PASS |
| `assets/icon.svg` 바이트 === `Buffer.from(ICON_SVG,'utf8')` (sha256+길이+`Buffer.compare` 3중 확인) | PASS |
| `.gitignore` 무수정, `assets/icon.svg` 가 `node_modules/`·`.profile/`·`*.log` 규칙에 안 걸림(`git check-ignore` exit 1 = 비무시 확인) | PASS |
| `FAVICON_HREF` 왕복 항등(`data:image/svg+xml;base64,` 접두어 → 디코드 === `ICON_SVG`, `xmlns="http://www.w3.org/2000/svg"` 포함) | PASS |
| `FAVICON_HREF` 자체에 `agy`/`http://`/`https://` 0개 | PASS |
| `FAVICON_HREF` 가 외부 URL 가드 정규식에 비매칭 | PASS |
| `MARK_INLINE`: `xmlns`/`http` 0개, `aria-hidden="true"` 포함, 여는/닫는 태그 정확 | PASS |
| `MARK_BODY` 가 `ICON_SVG`·`MARK_INLINE` 양쪽의 부분문자열 | PASS |
| `MARK_INLINE` 에 `st-*` 토큰 0개 | PASS |
| 아이콘 안전검사: `<script`/`onload=`/`onerror=`/`<foreignObject`/`href=` 0개, ≤65536바이트 | PASS |
| `lib/brand.js` 소스 `claude` 0개(대소문자 무시) · `require(` 0개 | PASS |
| `package.json` dependencies === `['puppeteer']` | PASS |
| 기존 파일 무수정(Phase 1 diff = `assets/icon.svg`·`lib/brand.js`·`test/brand.test.js` 신규 3개뿐, `git diff --stat` 로 확인) | PASS |
| `test/scrape-classify.test.js` 의 `https://claude.ai` 정확히 1회 단언 유지 | PASS (전체 스위트 그린으로 확인) |
| `test/launcher-rename.test.js` 의 `run-bellows`/`deploy-bellows` 0건 단언, `assets/icon.svg` 편입 후에도 유지 | PASS |
| `/api/health` `contracts["supervised-v1"] === '1.5.0'` 불변 | PASS |

## Phase 2 — `lib/status-page.js` 파비콘·머리글 마크·CSS

| 기준 | 상태 |
|---|---|
| `<head>` 에 `<link rel="icon" type="image/svg+xml" href="{FAVICON_HREF}">` 정확한 형태로 존재, `</title>` 뒤에 위치 | PASS |
| `href` 를 렌더된 HTML 에서 잘라내 디코드 → `ICON_SVG` 와 문자열 동일 | PASS |
| `rel="icon"`(≠ `stylesheet`) | PASS |
| `<main>` 안 `<div class="brand"><svg class="mark"…` 블록에 `MARK_INLINE` 전체(잘린 접두어 아님) 포함 | PASS |
| `<h1>Quaestor</h1>` 부분문자열 그대로 보존(치환 아닌 감싸기) | PASS |
| `<main class="…" data-sig="…">` 태그가 016 이전과 바이트 동일(`signature()` 무수정) | PASS |
| 인라인 마크 `aria-hidden="true"` + `focusable="false"` | PASS |
| 로고는 payload 를 안 읽음 — `null`/누락/손상 입력 10종에 대해 예외 없이 동일 렌더 | PASS |
| `styleBlock()` 은 선택자 추가만, 기존 선택자 값 불변(`.badge{…}` 등 바이트 비교) | PASS |
| 새 클래스에 `st-` 접두어 없음, 정적 `<style>` 에 `st-allowed`/`st-stale` 여전히 0개 | PASS |
| 새 선택자 3개(`.brand`, `.brand h1`, `.mark`)만 추가, 헤더 하단 여백 총합(16px) 보존 | PASS |
| 렌더 HTML 전체에 `http://`/`https://` 0개, 외부 URL 가드 정규식 비매칭 | PASS |
| 렌더 HTML(agy 스냅샷 채운 상태, `<h2>Gemini</h2>` 렌더 선확인) 전체에 `agy` 0개 | PASS |
| 016 추가분(파비콘 `<link>` + brand/mark 블록 + 새 CSS 3선택자)에 한정한 `claude` 0개 — 렌더된 HTML 에서 그 부분만 잘라내 계산 | PASS |
| 013 무회귀: `<div class="field">엔진 범위: claude</div>` 렌더 유지, `covers` 로직 무수정 | PASS |
| `lib/status-page.js`·`lib/brand.js` 소스 `claude` 0개(소스 축) | PASS |
| 실제 포트(`port:0`) 왕복: `GET /` 200, 파비콘·브랜드·0건 단언이 HTTP 응답 본문에서 성립 | PASS |
| `GET /favicon.ico` 여전히 JSON 404, `ok===false`, `<html` 없음(신규 경로 없음) | PASS |
| `GET /api/health` `contracts["supervised-v1"] === '1.5.0'` 실제 포트에서도 불변 | PASS |
| HEAD `55f14ed` 기준으로는 실패해야 하는 반증력 확인 — `control-server.test.js:2824` 대체 테스트가 `<link rel="icon">`·`<div class="brand">` 부재를 근거로 그 시점 실패를 요구하는 구조로 작성됨 | PASS(구조 확인) |
| Phase 2 는 `lib/status-page.js` 단 하나만 수정(`git diff 55f14ed..HEAD` 로 확인 — `lib/control-server.js`·`watch-loop.js`·런처 `.ps1` 무수정) | PASS |
| 기존 테스트 432개 무수정, `status-page.test.js`/`control-server.test.js` 는 추가만 | PASS |
| `status-page.js` 의 신규 `require` 는 `./brand` 하나뿐 | PASS |
| `node p-quaestor/test/run-all.js` 실패 0 / exitCode 0(465/465) | PASS |
| 직전 라운드의 `control-server.test.js:2824` 가 ACCEPTANCE §Phase2 규정대로 대체됨(013 생존 선확인 + 016 추가분 한정 `claude` 0건) | PASS |

## 이전 Phase 통합 검증

- 013(엔진 범위 `covers`) — `엔진 범위: claude` 렌더 유지, 로직 무수정 확인.
- 014/015(agy·Gemini) — `<h2>Gemini</h2>` 섹션 렌더 및 `agy` 0건 단언이 016 추가 이후에도 유지.
- 011/012(계약 버전·임계값 API) — `/api/health` `contracts["supervised-v1"]` = `1.5.0` 불변, 실제 포트 확인.
- 009(런처 개명) — `run-bellows`/`deploy-bellows` 0건 단언, `assets/icon.svg` 추가 후에도 유지.
- 전체 스위트 465/465/0, exitCode 0 — 회귀 없음.

## 구현 수정 사항

없음. 이번 QA 실행에서 코드나 테스트를 변경하지 않았다 — 직전 `implement` 라운드(커밋 `3b23274`)의
결과물이 ACCEPTANCE.md 의 모든 [SPEC]/[DERIVED] 기준을 이미 충족한다.

## 버그

없음.
