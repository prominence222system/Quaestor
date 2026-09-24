# TEST_RESULT — 016-logo-favicon-and-header-mark (Phase 2)

## 대상

**Phase 2** — `lib/status-page.js` 파비콘 `<link>` · 머리글 브랜드 마크 · `.brand`/`.mark` CSS 추가,
렌더 단위 테스트, 실제 포트 경계 테스트, 전체 스위트 검증.

`output/ACCEPTANCE.md` 에는 Phase 1(정본 바이트·자산 동일성·파비콘 표기·출처 단일성·안전검사·제약 준수) 기준만
기록되어 있고 Phase 2 전용 기준이 없다. 지시에 따라 작업 파일(`work/016-logo-favicon-and-header-mark.md`)의
Phase 2 스코프(§3)와 수용 기준 6·7번 항목을 Phase 2 판정 기준으로 사용했다.

## 판정 결과 요약: **PASS**

`node p-quaestor/test/run-all.js` → **456 / 456 pass, 실패 0, exitCode 0**
(기존 446 + 신규 10). 구현 결함 없음 — 첫 구현이 모든 신규 테스트를 통과했다.

## Phase 1 회귀(적분) 확인

Phase 1 이 만든 `lib/brand.js` · `assets/icon.svg` · `test/brand.test.js` 의 17개 테스트 전부
이번 라운드에서도 그대로 통과했다(파일 무수정, sha256 정본 바이트 불변). `lib/status-page.js` 는
`brand.js` 를 상대경로로 `require` 만 하고 SVG 리터럴을 직접 갖지 않으므로, "SVG 문자열은 brand.js 에만
둔다"는 Phase 1 의 불변식이 유지된다.

## 작업 파일 수용 기준 대조 (work/016 §6, §7)

| # | 기준 | 결과 |
|---|---|---|
| 6-1 | `GET /` → 200, HTML 에 `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,` 가 있고 그 href 를 HTML 에서 잘라내 디코드한 값이 `ICON_SVG` 와 같다 | PASS |
| 6-2 | HTML 에 `<div class="brand"><svg class="mark"` 와 `<h1>Quaestor</h1>` 가 있다 | PASS |
| 6-3 | HTML 에 `http://` · `https://` · `agy` 가 0개 | PASS |
| 6-4 | `GET /favicon.ico` → 404 이고 본문이 JSON 으로 파싱된다(새 경로 없음) | PASS |
| 6-5 | 이 경계 테스트는 HEAD `55f14ed`(이번 변경 전)에서 실패해야 한다 | **검증함** — `status-page.js` 만 `git stash` 로 되돌린 뒤 재실행 → 파비콘/브랜드 마크 관련 2개 테스트가 `AssertionError` 로 실패함을 확인 후 `git stash pop` 으로 복원 |
| 7 | 전체 스위트 432(문서 기준선, 실측 기준선은 446) + 신규, 실패 0 | PASS — 실측 456/456/0 |

## 불변 확인

- `CONTRACTS['supervised-v1']` = `1.5.0` 그대로 (`016 Phase 2 [SPEC]: real server GET /api/health contracts["supervised-v1"] is still "1.5.0"` 로 실측)
- `/api/health` · `/api/status` 응답 형태 무변경 (기존 회귀 테스트들 그대로 통과)
- `GET /favicon.ico` 는 여전히 JSON 404 — 새 라우트 미추가
- 기존 테스트 446개 **한 줄도 수정하지 않음** — `git diff --stat` 으로 확인, `status-page.test.js`/`control-server.test.js` 는 추가만 있고 기존 줄 변경 없음
- 새 CSS 클래스에 `st-` 접두어 없음(`.brand`, `.mark`)

## 구현 변경 (`p-quaestor/lib/status-page.js`, 기존 파일 +10줄)

1. `const { MARK_INLINE, FAVICON_HREF } = require('./brand');` 추가
2. `<title>` 줄 다음에 `<link rel="icon" type="image/svg+xml" href="' + FAVICON_HREF + '">` 삽입
3. `<h1>Quaestor</h1>` 를 `<div class="brand">' + MARK_INLINE + '<h1>Quaestor</h1></div>` 로 교체
4. `styleBlock()` 에 `.brand{display:flex;align-items:center;gap:8px;margin:0 0 16px}` · `.brand h1{margin:0}` ·
   `.mark{flex-shrink:0}` 추가(기존 선택자 값은 하나도 변경하지 않음)

구현 중 발견되어 고친 버그: **없음.** 스펙대로 한 번에 구현했고 신규 테스트 10개가 전부 첫 실행에 통과했다.

## 신규 테스트 목록 (10개)

### `p-quaestor/test/status-page.test.js` (+5, 렌더 단위 테스트)
- `[SPEC] 016: <head> carries a base64 SVG favicon link right after <title>, decoding back to ICON_SVG`
- `[SPEC] 016: <main> contains <div class="brand"><svg class="mark" ... and the "<h1>Quaestor</h1>" substring is unchanged`
- `[SPEC] 016: rendered HTML with the favicon/mark additions still has zero http://, https://, agy substrings`
- `[SPEC] 016: GET /favicon.ico is not a route added by this renderer (status-page.js has no favicon.ico route logic)`
- `[DERIVED] 016: new .brand/.mark CSS selectors are added without touching any existing selector value`

### `p-quaestor/test/control-server.test.js` (+5, 실제 포트 경계 테스트)
- `016 Phase 2 [SPEC]: real server GET / carries a base64 favicon <link> that decodes to lib/brand.js ICON_SVG`
- `016 Phase 2 [SPEC]: real server GET / HTML contains the header brand mark and the unchanged "<h1>Quaestor</h1>" substring`
- `016 Phase 2 [SPEC]: real server GET / HTML still has zero http://, https://, agy substrings after the logo additions`
- `016 Phase 2 [SPEC]: real server GET /favicon.ico is still a JSON 404 -- no new route was added`
- `016 Phase 2 [SPEC]: real server GET /api/health contracts["supervised-v1"] is still "1.5.0" (contract unchanged by the logo work)`

## 전체 스위트 실행 결과

```
node p-quaestor/test/run-all.js
tests 456
pass 456
fail 0
cancelled 0
skipped 0
todo 0
exitCode 0
```

## 다음 단계

Phase 2(마지막 phase) 완료. `output/PROGRESS.md` 의 Phase 2 상태 갱신 및 `output/EVAL_FEEDBACK.md` 작성은
QA 역할 범위 밖이므로 이 문서에서는 다루지 않는다.
