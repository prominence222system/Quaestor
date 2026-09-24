## Verdict
REDESIGN

## Verdict Criteria (current work file only)
- NEXT: a phase REMAINS WITHIN the current work file (not for other work files)
- FIX: Current Phase has bugs or missing features
- REDESIGN: Fundamental design issues require architecture change
- INTEGRATE: ALL phases of the current work file are DONE, need an integration test
- PASS: the current work file is complete (all its phases DONE, tests pass); forge advances to the next work file

## Redesign Needed
YES

## Current Phase Evaluation
- Phase: 2
- Feature: `lib/status-page.js` 파비콘 `<link>` · 머리글 브랜드 마크 · `.brand`/`.mark` CSS + 렌더 단위 테스트 + 실제 포트 경계 테스트
- Complete: no
- Issues found: **구현이 아니라 `output/ACCEPTANCE.md`(design-next 산출물) 자체의 결함.** `:73` `[SPEC] 렌더된 HTML 에 claude 가 대소문자 무시 0개다` 는, `:76` 에 의해 **실제 포트 왕복 응답 본문**에 대한 요구로 확정되는데, 이것이 이미 완료·동결된 013 의 불변식(`p-quaestor/lib/observation.js` 가 `usage.covers`/`allowance.covers` 를 **무조건** `[ENGINE]='claude'` 로 채우고, `status-page.js:208` 가 그것을 `<div class="field">엔진 범위: claude</div>` 로 렌더하며, 이를 013/015 가 만든 기존 frozen 테스트 `control-server.test.js:1495/1509/1529/1549/1572` 가 **반드시 나와야 한다**고 못박음)와 정면으로 모순된다. 016 의 범위(파비콘·머리글 마크·CSS)를 아무리 고쳐도 두 요구를 동시에 만족하는 구현은 존재할 수 없다.

## Work Detail
- 이번 라운드(`9966a8f` test 커밋)는 소스 코드를 전혀 건드리지 않았다 — `p-quaestor/test/status-page.test.js`(+6)·`p-quaestor/test/control-server.test.js`(+2) 순수 추가뿐이다(`git diff 9966a8f~1 9966a8f` 로 직접 확인).
- `node p-quaestor/test/run-all.js` 를 독립적으로 재실행: **tests 465 / pass 464 / fail 1 / exitCode 1.** `TEST_RESULT.md` 의 수치와 정확히 일치한다.
- 실패한 테스트 1개: `control-server.test.js:2824` `016 Phase 2 [SPEC]: real server GET / HTML has zero "claude" occurrences (case-insensitive)`. `startControlServer({port:0, getSnapshot: okSnapshot})` 로 띄운 실서버의 `GET /` 본문에 `엔진 범위: claude` 가 그대로 포함되어 `1 !== 0` 으로 실패함을 직접 재현·확인했다.
- 대조: `status-page.test.js` 의 동일 이름 테스트(순수 렌더층)는 **통과**한다 — 이는 `basePayload()` 가 `covers` 필드를 채우지 않는 단순 픽스처를 쓰기 때문이며, 016 이 새로 추가한 문자열 자체(`<link>`, `MARK_INLINE`, 새 CSS 3개)에는 `claude` 가 0개임을 보여줄 뿐, 실제 파이프라인(observation → buildStatusPayload → covers=['claude'])을 거치는 경계 테스트의 실패와는 별개다. 두 결과가 갈리는 것 자체가 "016 자체는 결백하고, 결함은 명세(:73)와 013 동결 요구의 충돌"이라는 TEST_RESULT.md 의 결론을 뒷받침한다.
- `output/ACCEPTANCE.md` 는 이번 라운드에 한 글자도 고치지 않았다(읽기 전용 규칙 준수) — `QA`/eval 모두 저자성 규칙(7d)을 지켰다.
- `output/PROGRESS.md` 는 이번 verdict(REDESIGN)에 따라 변경하지 않는다.

## Issues
- `output/ACCEPTANCE.md:73` 의 "렌더된 HTML 에 claude 가 대소문자 무시 0개다" 를, 013 의 frozen 요구(엔진 범위 표시)와 양립하도록 **design-next 에서 다시 써야 한다.** 예: "016 이 새로 추가한 문자열(파비콘 `<link>`, `MARK_INLINE`, 새 CSS 선택자 3개)에는 claude 가 0개다" 로 범위를 016 자신의 산출물로 좁히거나, 013 의 `엔진 범위: claude` 필드와의 공존을 명시적으로 인정하는 문구로 교체한다.
- `:76`("위 파비콘·머리글·0건 단언이 실제 포트 왕복에서 성립") 은 `:73` 을 목록에 포함하는 한 동일한 모순을 상속한다 — `:73` 재작성과 함께 정리되어야 한다.
- `:86`("전체 스위트 실패 0/exitCode 0") 은 `:73` 의 직접적 귀결이며 별도 결함이 아니다.
- 위 세 줄을 제외한 Phase 2 의 나머지 [SPEC]/[DERIVED] 기준은 이번 라운드에 신규·기존 테스트로 전부 실측 통과가 확인되었으므로, design-next 는 그 부분을 다시 설계할 필요가 없다 — `:73`(및 그 파급인 `:76`/`:86`) 한 줄의 문구 수정만 필요한 좁은 재설계다.

## Good Points
- `TEST_RESULT.md` 가 실패를 완화·삭제·skip 하지 않고 "구현으로는 풀 수 없는 명세 결함" 이라는 근거(013 의 정확한 행 번호, 재현 코드)까지 남긴 채 실패 상태로 정직하게 보고했다 — 지시된 QA 프로토콜을 정확히 따랐다.
- Phase 1(`brand.js`/`assets/icon.svg`)과 Phase 2 의 44개 세부 기준 중 43개는 신규·기존 테스트로 각각 개별 근거와 함께 실측 확인되어 있고, 특히 "016 자신이 추가한 문자열에는 claude 가 없다" 를 별도 테스트로 분리해 016 구현 자체의 결백을 기계적으로 증명했다.
- 순수 렌더층(`status-page.test.js`)과 실제 포트 경계층(`control-server.test.js`)을 분리해, 같은 이름의 두 테스트가 서로 다른 결과를 내는 방식으로 결함의 원인(명세 vs 파이프라인 통합)을 정확히 국소화했다.
