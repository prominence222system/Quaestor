## Phase 1 Acceptance Criteria

### 이 NNN 이 잡으려는 버그
- [SPEC] 🔒 red-first: 판정 수정 **전에** 97/99 회귀 테스트가 반드시 FAIL 한다. 그 실패 출력이 TEST_RESULT.md 에 기록된다 (전 실패 → 후 성공이 확인돼야 진짜 잡은 것이다)
- [SPEC] `session_pct 97` / `weekly_pct 99`, 임계 `session_stop 90` / `weekly_stop 85`, STOP 없음, 측정 신선 → `allowed === false` 이고 `reason === 'over-threshold'` (🔒 `allowed === true` 면 실패)

### 불변식 (이 NNN 의 핵심)
- [SPEC] 🔒 `allowed === true` 인 모든 경우에 `usage.session_headroom > 0` 이고 `usage.weekly_headroom > 0` 이다. 무작위/경계 조합으로 확인한다
- [SPEC] 🔒 거짓 단언 금지: `reason === 'under-threshold'` 인데 `session_pct >= session_stop` 또는 `weekly_pct >= weekly_stop` 인 조합이 하나도 없다

### 경계와 우선순위
- [SPEC] `pct === stop` 은 초과로 본다(`>=`) → `allowed === false`, `reason === 'over-threshold'` (세션·주간 각각)
- [SPEC] `pct === stop - 1` 은 허가된다 → `allowed === true`, `reason === 'under-threshold'`
- [SPEC] 한쪽만 초과해도 `false` 다 — 세션만 초과(주간 여유), 주간만 초과(세션 여유) 두 경우 모두
- [SPEC] STOP 활성이 임계 판정보다 우선한다 — 수동 STOP + 임계 초과 → `allowed === false`, `reason === 'manual-stop'`
- [SPEC] 자동 STOP + 임계 초과 → `allowed === false`, `reason` 은 STOP 의 `reason` 원문이며 `'over-threshold'` 로 덮이지 않는다
- [SPEC] 측정 불가가 최우선 — 관측 이력 없음 → `allowed === null`, `reason === 'unmeasurable'`, `confidence === 'unknown'` (007 동작 유지)
- [SPEC] `enabled: false` + 임계 초과 + STOP 없음 → `allowed === false` (감시가 꺼져 있어도 숫자가 말하는 사실은 바뀌지 않는다)
- [DERIVED] 측정 이력 없음과 STOP 활성이 동시에 성립하면 표의 우선순위대로 `allowed === null`, `reason === 'unmeasurable'` 이다
- [DERIVED] `session_pct` / `weekly_pct` 중 한쪽만 존재하면 두 headroom 이 모두 양수임을 단언할 수 없으므로 `allowed === null`, `reason === 'unmeasurable'` 이다
- [DERIVED] `confidence` 는 측정 불가 `unknown`, STOP·초과 `measured`, 허가 시 `usage.stale` 이면 `stale` 아니면 `measured` 다
- [DERIVED] `reason` 값 집합은 007 의 `unmeasurable` / `manual-stop` / STOP 원문 / `stop-active` / `under-threshold` 에 `over-threshold` 하나만 추가된다

### 손대지 않았음 (기계적 확인)
- [SPEC] 🔒 `watch-loop.js` 의 `deriveDesired()` 와 STOP.json 쓰기 로직의 diff 가 0 줄이다 — STOP 쓰기 동작이 007 전과 동일하다
- [SPEC] 🔒 `deriveState()` · `deriveUsage()` 의 diff 가 0 줄이다. 임계값·히스테리시스 상수 무변경
- [SPEC] 007 응답 무회귀: `usage` 의 pct/headroom/age_sec 는 숫자 타입, 모든 키는 ASCII, `fields` 는 8개, 같은 입력에서 `summary` · `state` 가 007 과 동일하다
- [SPEC] `allowance` 객체의 키는 `allowed` · `reason` · `confidence` 3개로 유지되고 `/api/status` 최상위 키 구성·순서가 007 과 동일하다

### 검증 방식
- [SPEC] 🔒 경계 검증은 실제 포트를 열고 `fetch` → `JSON.parse` 한 값으로 위 조합을 확인한다 (직렬화를 거친 값이 실제 소비자가 보는 값이다)
- [SPEC] `node p-quaestor/test/run-all.js` 가 007 의 191건을 포함해 전부 통과한다. 기존 191건의 기대값은 한 줄도 수정되지 않는다
- [DERIVED] `deriveAllowance` 는 순수 함수로 유지된다 — 인자 미변형, wall-clock 미참조, I/O 없음
- [DERIVED] `deriveAllowance(stopInfo, usage, hasObservation)` 시그니처로 `deriveUsage()` 반환 객체를 통째로 받으며, 불리언 2번째 인자를 위한 하위호환 shim 은 두지 않는다
