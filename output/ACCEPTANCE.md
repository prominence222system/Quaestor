## Phase 1 Acceptance Criteria
- [SPEC] `deriveAgy` 함수가 스냅샷 실패 시 과거 성공값을 유지하는 정책과 `STALE_WARN_MS` 에 따른 `stale` 판정을 포함해 진리표 4가지를 정확히 구현한다.
- [SPEC] `deriveAgy` 반환값에서 잔량이 100%인 버킷의 리셋 시각(`*_reset`)은 항상 `null` 로 설정된다.
- [SPEC] `deriveAgy` 반환값에서 측정된 이력이 없는 버킷은 잔여량(`*_pct`) 값이 항상 `null` 이다.
- [SPEC] `deriveState` 가 반환하는 `fields` 배열의 맨 끝에 "Gemini 주간 잔량", "Gemini 5시간 잔량" 두 행이 무조건 추가된다.
- [SPEC] `fields` 에 표시되는 문자열 값이 `null` 이면 "모름", `stale` 이면 "N% (낡음)", 정상일 경우 "N%" 로 올바르게 노출된다.
- [SPEC] `ctx.agy` 의 존재 여부 및 상태가 `deriveState` 가 판정하는 `state`, `summary`, `usage`, `allowance` 등 기존 필드에 어떠한 영향도 주지 않는다.
- [SPEC] 허가된 테스트 편집 조항에 따라 `test/observation.test.js:236-244` 검증 라벨 배열의 순서를 지키며 끝에 두 행 이름만 정확하게 추가된다.
