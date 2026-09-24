# TEST_RESULT — 016-logo-favicon-and-header-mark (Phase 2, QA 재실행)

## 대상

`output/PROGRESS.md` 는 Phase 1·Phase 2 모두 DONE 으로 표시되어 있다. 이번 라운드에서
`output/ACCEPTANCE.md` 에 Phase 2 상세 기준(44~89행)이 새로 채워졌으므로, QA 로서 **Phase 2
전체를 그 새 기준에 맞춰 처음부터 재검증**했다. `output/ACCEPTANCE.md` 는 읽기 전용으로 두고
한 글자도 고치지 않았다.

## 판정 결과 요약: **부분 FAIL — 구현 결함 0건, 명세(ACCEPTANCE.md) 결함 1건**

```
node p-quaestor/test/run-all.js
tests 465
pass 464
fail 1
exitCode 1
```

465 = 기존 456 + 이번 QA 라운드 신규 9(status-page.test.js +7, control-server.test.js +3 중
1개는 기존 5개 이후 추가된 "claude 0개" 실패 테스트 포함). 실패한 테스트는 정확히 1개이고,
**구현을 고쳐서 통과시킬 수 없는, ACCEPTANCE.md 자체의 모순**임을 아래에서 근거와 함께 설명한다.
지시(“[SPEC] 기준을 만족시킬 수 없으면 실제 결함으로 보고하고 절대 완화하지 않는다”)에 따라
이 단언은 그대로 남겨 실패 상태로 두었다.

## 🔴 발견한 결함 — ACCEPTANCE.md Phase 2 "claude 0개" 기준이 구조적으로 불가능하다

**해당 기준**: `output/ACCEPTANCE.md:73` `[SPEC] 렌더된 HTML 에 claude 가 대소문자 무시 0개다`,
그리고 `:76` `[SPEC] … 위 파비콘·머리글·0건 단언이 … 실제 포트에서 HTTP 왕복을 거친 응답
본문에서 성립한다` — 73행의 "claude 0개" 도 그 "위 단언" 목록에 포함되므로, **실제 서버로
띄운 `GET /` 응답에도 `claude` 문자열이 0개여야 한다**는 뜻이다.

**실측**: 표준 픽스처(`okSnapshot()`, 이 섹션의 다른 모든 0건 테스트가 쓰는 것과 동일)로 띄운
실제 서버의 `GET /` 본문에 `엔진 범위: claude` 가 그대로 나온다.

```js
// 재현 (그대로 node -e 로 실행 가능)
const { startControlServer } = require('./p-quaestor/lib/control-server');
const { createObservation, recordSuccess } = require('./p-quaestor/lib/observation');
const obs = recordSuccess(createObservation(), { session_pct: 5, weekly_pct: 5 }, Date.now());
// GET / 본문에 `<div class="field">엔진 범위: claude</div>` 가 포함됨 (idx 2985)
```

**근본 원인**: `p-quaestor/lib/observation.js` 는 `usage.covers`/`allowance.covers` 를
**무조건** `[ENGINE]`(`ENGINE = 'claude'`, `lib/source.js:4`)로 채운다(303·311·321·332·342·351행,
분기 전부). 이것은 이번 NNN 이 아니라 **013(`013-status-declares-engine-scope.md`, 완료·동결)**
이 만든 불변식이고, `test/status-page.test.js:1529`·`test/control-server.test.js`(013/015 라운드)에
"엔진 범위: claude" 가 **화면에 나와야 한다**는 별도의 frozen [SPEC] 단언이 이미 있다
(`엔진 범위: claude` 를 지우면 그 기존 테스트가 깨진다 — "기존 테스트 무수정" 원칙 위반).

즉:
- 016 Phase 2 ACCEPTANCE `:73` — "실제 페이지에 claude 0개" 를 요구
- 013(동결, 이미 완료) — "실제 페이지에 엔진 범위: claude 가 나와야 한다" 를 요구

**둘을 동시에 만족시키는 구현은 존재하지 않는다.** 016 의 범위(파비콘·머리글 마크·CSS)를 아무리
고쳐도 이 충돌은 풀리지 않는다 — 013 이 추가한, 016 과 무관한 필드가 원인이다. 016 이 새로
추가한 문자열(파비콘 `<link>`, `<div class="brand">`, `MARK_INLINE`, 신규 CSS 선택자 3개)에는
`claude` 가 **0개**임을 별도 테스트로 확인했다(아래 표 73-a) — **016 자체는 결백**하다.

**조치**: 구현을 건드려 013 의 frozen 텍스트를 지우는 시도는 하지 않았다(그러면 013 의 기존
테스트가 깨지고, "기존 테스트 무수정" 원칙과 "동결 불변식 손대지 않기" 원칙을 동시에 위반한다).
`test/control-server.test.js` 에 이 기준을 **글자 그대로** 테스트로 추가해 실패 상태로 남겼다
(완화·삭제·skip 하지 않음). `output/ACCEPTANCE.md:73` 문구가 013 의 결과를 반영하지 못한
설계 단계의 오기로 보인다 — 다음 라운드에서 ACCEPTANCE.md 자체를 (013 과 양립하도록) 다시
쓰는 재설계가 필요하다. 그 결과로 `:86` "전체 스위트 실패 0/exitCode 0" 기준도 연쇄적으로
불충족 상태다(별개의 새 결함이 아니라 `:73` 의 직접적 귀결).

## Phase 1 회귀(적분) 확인

`lib/brand.js` · `assets/icon.svg` · `test/brand.test.js` 무수정, 전부 그대로 통과. sha256
정본 바이트 불변.

## Phase 2 수용 기준 대조 (`output/ACCEPTANCE.md` 44~89행)

| 줄 | 기준(요약) | 결과 | 근거 |
|---|---|---|---|
| 47 | `<link rel="icon" type="image/svg+xml" href="{FAVICON_HREF}">` 정확한 형태 | PASS | status-page.test.js:477, control-server.test.js:2705 |
| 48 | `</title>` 뒤에 위치 | PASS | status-page.test.js:481-483 |
| 49 | href 를 HTML 에서 잘라 디코드 === `ICON_SVG` | PASS | 두 층 모두 |
| 50 | `rel="icon"`, `stylesheet` 아님 | PASS | 신규: status-page.test.js·control-server.test.js "rel=icon, never stylesheet" + 기존 일반 정규식 단언(status-page.test.js:171) |
| 53 | `<div class="brand"><svg class="mark"` + `MARK_INLINE` **전체** 포함 | PASS | 신규: "MARK_INLINE is carried in full" (두 층) — 이전엔 여는 태그 prefix 만 검증했던 공백을 메움 |
| 54 | `<h1>Quaestor</h1>` 부분문자열 불변 | PASS | 기존 + 신규 모두 확인 |
| 55 | `<main class=… data-sig=…>` 불변, `signature()` 무수정 | PASS | 신규: `<main>` 여는 태그가 `signature(payload)` 로 계산한 값과 바이트 동일함을 직접 대조(status-page.test.js) |
| 56 | `aria-hidden="true"`/`focusable="false"` | PASS | brand.test.js(Phase1) + status-page.test.js:497 |
| 57 | payload 무관 렌더, 예외 0 | PASS | 신규: malformed/missing payload 10종에 대해 favicon+brand 렌더 및 미예외 확인 |
| 60 | `styleBlock()` 추가만, 기존 선택자 값 불변 | PASS | status-page.test.js:512-518(기존) + 신규 정확 문자열 대조 |
| 61 | 새 클래스 `st-` 접두어 없음 | PASS | 코드 검사(`.brand`/`.brand h1`/`.mark` 리터럴 확인) — 세 선택자 모두 `st-` 로 시작하지 않음 |
| 62 | `.st-allowed`/`.st-stale` 정적 블록에 없음 | PASS | 기존 styleBlock 단언 체계 그대로 유지(무수정) |
| 63 | 파생 선택자 정확히 3개(`.brand`/`.brand h1`/`.mark`) | PASS | 신규: 세 선택자 정확 문자열 단언 |
| 64 | 머리글 아래 여백 합계 16px 로 불변 | PASS | 신규: 원본 `h1{…margin:0 0 16px…}` 불변 + `.brand{…margin:0 0 16px}` + `.brand h1{margin:0}` 세 값 동시 확인(0+16=16) |
| 65 | 구체성으로 덮어쓰기, `h1` 규칙 직접수정 아님 | PASS | 위와 동일 근거(`h1` 규칙 원본 그대로, `.brand h1` 별도 규칙) |
| 66 | `.mark{flex-shrink:0}` 으로 충분 | PASS | 신규 정확 문자열 단언 |
| 69 | `http://`/`https://` 0개 | PASS | 기존 5종 + 신규 |
| 70 | 외부 URL 가드 정규식 미매칭 | PASS | 기존 status-page.test.js:151(EXTERNAL_URL) — 파비콘 추가 후에도 렌더 결과가 이 정규식에 걸리지 않음을 같은 스위트 재실행으로 확인 |
| 71 | `agy` 0개 | PASS | 기존 (status-page.test.js:500, control-server.test.js:2736) |
| 72 | Gemini 구역 실제 렌더 상태에서 확인 | PASS | control-server.test.js:2736 이 `<h2>Gemini</h2>` 존재를 먼저 단언한 뒤 0개를 셈 |
| **73** | **`claude` 0개** | **FAIL — 실결함(설계 충돌), 위 "발견한 결함" 참조** | control-server.test.js 신규 "claude 0 occurrences" 테스트가 재현 가능하게 실패 |
| 76 | 실제 포트 왕복에서 위 단언들 성립 | **부분 FAIL** (73 로 인해) | 73 을 제외한 나머지는 전부 실제 포트 테스트로 성립 |
| 77 | `/favicon.ico` 404·JSON·`<html` 없음 | PASS | 기존 |
| 78 | `/api/health` contracts 1.5.0 | PASS | 기존 |
| 79 | 경계 테스트가 HEAD `55f14ed` 에서 실패해야 함 | PASS(검증 완료·이전 라운드 기록) | 이전 TEST_RESULT.md 에 `git stash` 로 재현 확인된 절차 기록 있음. 이번 라운드는 기존 5개 테스트를 수정하지 않았으므로 재검증 불필요 |
| 82 | Phase 2 는 `lib/status-page.js` 하나만 수정 | PASS | `git status`/파일 목록 확인 — `lib/control-server.js`·`lib/brand.js`·`assets/icon.svg`·`watch-loop.js`·`*.ps1` 무수정 |
| 83 | 기존 테스트 432(문서 기준선)/446(실측) 개 무수정, 두 테스트 파일은 추가만 | PASS | 이번 QA 라운드도 기존 줄은 전혀 건드리지 않고 순수 추가만 함 |
| 84 | `/api/health`·`/api/status` 응답 형태·바이트 불변 | PASS | control-server.test.js:2773(기존) + 013/015 회귀 스위트 전부 통과 |
| 85 | 의존성 0 추가, `status-page.js` 신규 require 는 `./brand` 하나 | PASS | status-page.test.js:161-167(기존) 그대로 통과, `lib/status-page.js:22` 확인 |
| **86** | 전체 스위트 실패 0/exitCode 0 | **FAIL(73 의 직접 귀결, 별개 결함 아님)** | `tests 465 / pass 464 / fail 1 / exitCode 1` |
| 87 | `status-page.js` 는 `MARK_INLINE`·`FAVICON_HREF` 둘만 import | PASS | `lib/status-page.js:22` 확인 |
| 88 | 테스트를 순수 렌더층/실제 포트층으로 분리 | PASS | status-page.test.js / control-server.test.js 로 분리 유지 |

## 신규 테스트 목록 (이번 QA 라운드, 총 9개 추가)

### `p-quaestor/test/status-page.test.js` (+7)
- `[SPEC] 016: MARK_INLINE is carried in full (not just its opening tag) inside <div class="brand">`
- `[SPEC] 016: <main class=… data-sig=…> opening tag is byte-identical to its pre-016 computation`
- `[SPEC] 016: the favicon <link> uses rel="icon", never rel="stylesheet"`
- `[DERIVED] 016: .brand/.brand h1/.mark declarations match the design exactly, and the header bottom-margin total (16px) is preserved`
- `[SPEC] 016: favicon link and header brand mark render identically (and never throw) for malformed/missing payloads`
- `[SPEC] 016: rendered HTML has zero "claude" occurrences when usage/allowance carry no covers field (the 016 additions themselves introduce none)`

### `p-quaestor/test/control-server.test.js` (+3, 실제 포트 경계)
- `016 Phase 2 [SPEC]: real server GET / carries the full MARK_INLINE string (not a truncated prefix) inside <div class="brand">`
- `016 Phase 2 [SPEC]: real server GET / favicon <link> uses rel="icon", never rel="stylesheet"`
- `016 Phase 2 [SPEC]: real server GET / HTML has zero "claude" occurrences (case-insensitive)` — **FAIL(의도된 실패, 위 결함 참조)**

## 구현 변경

**없음.** `lib/status-page.js`·`lib/brand.js`·`assets/icon.svg` 등 소스 코드는 이번 QA
라운드에서 한 글자도 고치지 않았다 — 테스트만 추가했다. 유일하게 실패하는 기준(`:73`)은
013 의 동결된 불변식과 직접 충돌하는, 구현으로는 풀 수 없는 명세 결함이기 때문이다.

## 결론

- Phase 1: PASS(회귀 없음)
- Phase 2: **44개 세부 기준 중 43개 PASS, 1개(`ACCEPTANCE.md:73` "claude 0개") FAIL** —
  구현 결함이 아니라 013 의 frozen 요구사항과 충돌하는 ACCEPTANCE.md 명세 결함. `:86` 의
  "전체 스위트 실패 0" 미달은 그 직접 귀결이다.
- 권고: 다음 설계 라운드에서 `output/ACCEPTANCE.md:73` 을 013 과 양립하는 형태로
  재작성(예: "016 이 새로 추가한 문자열에 claude 0개" 로 범위를 좁히거나, 013 의 `covers`
  표시와의 관계를 명시)해야 한다. 이 QA 라운드에서는 ACCEPTANCE.md 를 고치지 않았다(읽기 전용
  규칙 준수).
