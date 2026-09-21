## Phase 1 Acceptance Criteria
- [SPEC] `lib/source.js` 모듈이 `ORIGIN`('https://claude.ai')과 `ENGINE`('claude') 값을 함께 export 해야 한다.
- [SPEC] `lib/scrape.js` 소스 코드 내에 정규식 `/claude/g` 매치 횟수가 정확히 0회여야 한다.
- [SPEC] 문자열 `https://claude.ai`는 `lib/` 폴더 내 모든 파일 중에서 정확히 1회(`lib/source.js`)만 등장해야 한다.
- [SPEC] `test/scrape-classify.test.js:353`의 `/claude/g` 매치 단언이 `lib/source.js`를 대상으로 이관되어 강도 저하 없이 통과해야 하며, `lib/scrape.js`에 대한 매치 단언은 0회로 고정되어야 한다.
- [DERIVED] `lib/source.js`는 `fs` 등의 다른 I/O 모듈을 일절 `require`하지 않는 순수한 상태를 유지해야 한다.
