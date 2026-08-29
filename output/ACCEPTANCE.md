## Phase 1 Acceptance Criteria

### 화면이 거짓말하지 않는다 (이 NNN 의 핵심)
- [SPEC] `allowance.allowed === null` 인 payload 로 렌더한 HTML 에 "사용 가능" 류 긍정 문구가 한 건도 나타나지 않는다.
- [SPEC] `allowance.allowed === null` 인 payload 로 렌더한 HTML 에 "모름"에 해당하는 표시가 나타난다.
- [SPEC] `allowance.allowed !== true` 인 어떤 payload(`false`·`null`·필드 부재·`undefined`)로 렌더해도 초록 상태 클래스 토큰이 HTML 에 나타나지 않는다.
- [SPEC] `allowance.allowed === true` 인 payload 로 렌더할 때에만 긍정 문구와 초록 상태 클래스가 나타난다.
- [SPEC] `usage.session_pct === null` 인 payload 로 렌더한 HTML 에 `0%` 가 나타나지 않는다.
- [SPEC] `weekly_pct`·`session_headroom`·`weekly_headroom` 이 `null` 인 경우에도 `0%`/`0%p` 가 나타나지 않고 "측정 없음"에 해당하는 표시가 나타난다.
- [SPEC] `usage.stale === true` 인 payload 의 HTML 에 경과 시간(`age_sec` 유래)이 나타나고, 나머지가 동일하되 `stale: false` 인 payload 의 HTML 과 서로 다른 상태 클래스 토큰을 갖는다.
- [SPEC] `usage.stale === false` 인 payload 의 HTML 에는 stale 표시 토큰이 나타나지 않는다.
- [SPEC] `measured_at === null` / `age_sec === null` 인 경우 시각·경과 시간 자리에 숫자나 `0` 이 아니라 "측정 없음"에 해당하는 표시가 나타난다.

### 외부 요청 0 · 의존성 0
- [SPEC] 렌더 결과 HTML 문자열 전체에 `http://` 또는 `https://` 로 시작하는 리소스 참조(`src=`/`href=`/`@import`/`fetch(` 대상)가 0건이다.
- [SPEC] 렌더 결과에 등장하는 네트워크 대상은 상대 경로 `/api/status` 하나뿐이다.
- [SPEC] `status-page.js` 는 새 npm 패키지를 require 하지 않는다(외부 의존성 0).
- [DERIVED] CSS 와 JS 는 각각 `<style>`·`<script>` 로 문서 안에 인라인되며 외부 파일 참조가 없다.
- [DERIVED] 폰트 지정은 시스템 폰트만 사용하고 `@font-face` 원격 로드를 하지 않는다.

### 순수성 · never-brick · 비밀 없음
- [SPEC] `renderStatusPage` 는 파일·네트워크 I/O 를 수행하지 않고 현재 시각을 읽지 않으며, 같은 입력에 대해 항상 같은 문자열을 반환한다.
- [SPEC] payload 가 `null`·`undefined`·비객체·`allowance` 누락·`usage` 누락인 경우에도 throw 하지 않고 HTML 문자열을 반환한다.
- [SPEC] 위 결손 payload 로 렌더한 결과의 배지는 "모름"이며 긍정 문구와 초록 클래스가 없다(무지의 기본값은 결코 허가가 아니다).
- [SPEC] 렌더러의 입력은 `/api/status` payload 와 옵션뿐이며, 토큰·프로필 경로·쿠키·계정 등 비밀에 접근하는 경로가 코드에 존재하지 않는다.
- [SPEC] 렌더 결과 HTML 에 비밀(토큰 값·Chrome 프로필 절대 경로·쿠키·계정 식별자)이 나타나지 않는다.
- [SPEC] `observation.js` 의 `deriveState`/`deriveUsage`/`deriveAllowance` 를 호출하지 않고 임계값 비교·허용 여부 재판정을 하지 않는다(그리기만 한다).
- [SPEC] `claude` 문자열이 이 파일의 코드에 등장하지 않는다.

### 이스케이프 · 표시 내용
- [SPEC] `allowance.reason`·STOP reason·실패 kind/hint·`summary` 에 `<script>` 등 HTML 특수문자가 포함된 payload 로 렌더해도 원시 태그로 출력되지 않고 엔티티로 이스케이프된다.
- [DERIVED] 페이지는 배지(허용 여부), 세션·주간 사용량과 각 headroom, `usage.thresholds` 의 네 값, `measured_at` 과 경과 시간, STOP 정보(있을 때), 마지막 실패의 kind·hint(있을 때)를 모두 표시한다.
- [DERIVED] `usage.thresholds` 의 네 값은 payload 에 담긴 값을 그대로 표시하며 기본값을 하드코딩하지 않는다.
- [DERIVED] 퍼센트 값은 숫자일 때만 `"<n>%"`, headroom 은 숫자일 때만 `"<n>%p"` 형태로 렌더한다.
- [DERIVED] 경과 시간 포맷은 60초 미만이면 "방금", 그 이상은 분/시간/일 단위 한국어 표기를 쓴다.
- [DERIVED] 값이 `null` 인 사용량 항목에는 게이지 바를 렌더하지 않는다(폭 0 인 바는 0% 로 읽히므로).

### 폴링 스크립트
- [SPEC] 인라인 스크립트에는 배지 라벨 문구 리터럴("사용 가능"·"차단됨"·"모름")이 포함되지 않는다.
- [SPEC] 인라인 스크립트는 임계값 비교나 `allowed` 해석 분기를 포함하지 않는다(브라우저에서 재판정 금지).
- [SPEC] 인라인 스크립트가 호출하는 유일한 네트워크 요청은 `/api/status` 에 대한 GET 이며 POST 등 쓰기 요청이 없다.
- [DERIVED] 폴링 주기 기본값은 30000ms 이고 옵션으로 주입 가능하며, 주입한 값이 렌더 결과에 반영된다.
- [DERIVED] 스크립트는 서버가 심은 서명 문자열과 새 응답에서 계산한 서명이 다를 때에만 새로고침하고, fetch 실패 시에는 아무 동작도 하지 않는다.

### 문서 형식
- [DERIVED] 반환 문자열은 `<!doctype html>` 로 시작하는 완결된 HTML 문서이며 `<html lang="ko">` 를 갖는다.
- [DERIVED] 상태 클래스 토큰은 `st-allowed`(초록) · `st-blocked` · `st-unknown` · `st-stale` 네 개로 고정되며, 초록 스타일이 붙는 토큰은 `st-allowed` 하나뿐이다.

### Phase 1 범위 밖 (Phase 2 에서 검증)
- 실포트 왕복, `Content-Type: text/html; charset=utf-8`, 401/404/405, 경로 탈출, `/api/*` 회귀
