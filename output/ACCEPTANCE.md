## Phase 1 Acceptance Criteria
- [SPEC] 실제 포트를 열고 `fetch`로 `GET /api/health` 호출 후 `JSON.parse` 한 결과, 200 상태 코드와 최상위 `contracts` 객체가 있고 `contracts["supervised-v1"] === "1.2.0"` 이어야 한다.
- [SPEC] `contracts` 값은 숫자나 객체가 아닌 문자열이어야 한다.
- [SPEC] 기존 응답 필드 `ok`, `id`, `version`, `startedAt` 이 그대로 존재하고 값이 011 이전과 동일해야 한다 (`id === "quaestor"`, `version === "0.1.0"`).
- [SPEC] 소프트웨어 버전 `version` 의 값과 계약 버전 `contracts["supervised-v1"]` 의 값이 서로 달라야 한다 (0.1.0 vs 1.2.0).
- [SPEC] `/api/status` 응답이 011 작업 전과 완전히 동일해야 한다 (회귀 없음).
- [SPEC] 응답에 토큰, 프로필 경로, 쿠키, 계정 등 비밀 정보가 없어야 한다.
- [SPEC] 객체를 직접 들여다보지 않고 반드시 실포트 통신(직렬화/역직렬화)을 통해 응답 형태를 검증해야 한다.
