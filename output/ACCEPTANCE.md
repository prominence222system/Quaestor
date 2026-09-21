## Phase 1 Acceptance Criteria
- [SPEC] `lib/source.js` 모듈이 `ORIGIN`('https://claude.ai')과 `ENGINE`('claude') 값을 함께 export 해야 한다.
- [SPEC] `lib/scrape.js` 소스 코드 내에 정규식 `/claude/g` 매치 횟수가 정확히 0회여야 한다.
- [SPEC] 문자열 `https://claude.ai`는 `lib/` 폴더 내 모든 파일 중에서 정확히 1회(`lib/source.js`)만 등장해야 한다.
- [SPEC] `test/scrape-classify.test.js:353`의 `/claude/g` 매치 단언이 `lib/source.js`를 대상으로 이관되어 강도 저하 없이 통과해야 하며, `lib/scrape.js`에 대한 매치 단언은 0회로 고정되어야 홍다.
- [DERIVED] `lib/source.js`는 `fs` 등의 다른 I/O 모듈을 일절 `require`하지 않는 순수한 상태를 유지해야 한다.

## Phase 2 Acceptance Criteria
- [SPEC] `GET /api/status` 응답에서 `usage.covers` 값이 정확히 `["claude"]` 여야 한다 (`deepStrictEqual`).
- [SPEC] 동일한 응답 내에서 `allowance.covers` 값이 `usage.covers` 와 `deepStrictEqual` 로 동일해야 한다.
- [SPEC] `GET /api/health` 응답의 `contracts['supervised-v1']` 값이 `1.4.0` 이어야 한다.
- [SPEC] `GET /api/status` 응답 내 `covers` 배열에 `agy` 문자열이 포함되어서는 안 된다.
- [SPEC] 관측 이력이 없어서 `session_pct` 등이 `null` 인 경우에도 `usage` 및 `allowance` 의 `covers` 필드는 `null` 이 되지 않고 출력되어야 한다.
- [SPEC] `test/control-server.test.js` 의 176, 217행 단언값 및 169, 210행 제목이 `1.4.0` 으로 갱신되어 통과해야 한다.
- [SPEC] 수용기준의 검증은 순수 렌더러가 아닌 127.0.0.1 에 바인딩된 실제 서버에 HTTP 요청을 보내는 기존 테스트 경로 위에서 수행되어야 한다.
- [DERIVED] 기존 `deriveUsage` 및 `deriveAllowance` 가 반환하던 필드들은 단 하나도 누락되거나 변경되지 않고 모두 유지되어야 한다.

## Phase 3 Acceptance Criteria
- [SPEC] 127.0.0.1에 바인딩된 실제 서버의 `GET /` 응답 HTML 내에 범위(`covers` 값)가 사람이 읽을 수 있는 형태로 표시되어야 한다.
- [SPEC] `test/status-page.test.js:230`의 `status-page.js` 내 `/claude/gi` 정규식 매치 0회 단언이 수정 없이 그대로 통과해야 한다.
- [SPEC] 순수 렌더러 함수에 픽스처를 넣는 방식이 아닌, 통합 환경(`GET /`)에서 HTTP 왕복을 통해 조립된 실제 HTML을 대상으로 `covers` 렌더링 여부를 검증해야 한다.
- [DERIVED] `lib/status-page.js`는 `covers` 값을 출력하기 위해 안전한 이스케이프(`esc()`)만을 수행하며, `'claude'`라는 문자열 리터럴이나 값에 의존하는 어떠한 분기문도 포함하지 않는다.
- [DERIVED] 화면에 origin URL 문자열(`https://`)이 포함되거나 하드코딩되어서는 안 된다.
