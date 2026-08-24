## Phase 1 Acceptance Criteria
- [SPEC] `deriveUsage` 반환 객체의 모든 퍼센트 값(`session_pct`, `weekly_pct`)은 문자열이 아닌 `number` 타입이어야 한다.
- [SPEC] 측정 이력이 없는 경우 `deriveUsage`의 `session_pct` 및 `weekly_pct`는 `0`이 아닌 `null`이어야 한다.
- [SPEC] 측정 이력이 없는 경우 `deriveAllowance`의 `allowed` 판정값은 `true`나 `false`가 아닌 `null`이어야 한다.
- [SPEC] 측정 이력이 없는 경우 `deriveAllowance`의 `confidence`는 `'unknown'`이어야 한다.
- [SPEC] `deriveUsage`의 `headroom` 계산 결과는 현재 사용량이 stop 선을 넘었을 때 음수가 아닌 `0`이어야 한다.
- [SPEC] 수동 STOP 활성화 시 `deriveAllowance`는 `allowed: false`와 `reason: 'manual-stop'`을 반환해야 한다.
- [SPEC] 자동 STOP 활성화 시 `deriveAllowance`는 `allowed: false`와 `reason` 필드에 해당 STOP의 원인을 그대로 포함해야 한다.
- [SPEC] 신선도 판정(`stale`) 결과는 기존 `deriveState()`의 판정 기준과 모순되지 않아야 한다.
- [SPEC] `deriveUsage`는 전달받은 `thresholds` 객체를 그대로 반환 객체에 포함해야 한다.
- [DERIVED] `deriveUsage`와 `deriveAllowance`는 사이드 이펙트가 없는 순수 함수로 설계하여, 기존의 판정 로직 상태를 오염시키지 않아야 한다.

## Phase 2 Acceptance Criteria
- [SPEC] `/api/status` 응답의 기존 `fields`, `summary`, `state` 속성의 값이 변경 전과 완전히 동일해야 한다.
- [SPEC] `/api/status` 응답 최상단에 `allowance` 객체와 `usage` 객체가 추가되어야 한다.
- [SPEC] HTTP GET `/api/status` 요청으로 반환되는 `usage.session_pct`의 값은 문자열을 파싱한 것이 아닌 처음부터 JSON 직렬화 시 `number` 타입이어야 한다.
- [SPEC] `JSON.stringify(response.usage)`의 결과에는 `session_reset`과 `weekly_reset`의 값을 제외하고 어떤 형태의 한글 문자열도 포함되지 않아야 한다(키 이름 포함).
- [SPEC] `stale` 여부 및 측정 이력 유무가 API 응답에 명확히 반영되며, 26일 침묵과 같은 장기 측정 실패 시 `allowed` 속성은 `null`을 반환해야 한다.
- [DERIVED] 응답 객체에는 토큰, 프로필 경로, 쿠키, 계정 정보 등 민감한 정보가 노출되지 않아야 한다.
