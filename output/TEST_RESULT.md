# TEST_RESULT — 007 Phase 3 (단위 테스트, 통합 검증 및 실포트 직렬화 테스트)

- **대상 모듈**: `p-quaestor/lib/observation.js`, `p-quaestor/lib/control-server.js`
- **테스트 파일**: `p-quaestor/test/observation.test.js`, `p-quaestor/test/control-server.test.js`, `p-quaestor/test/run-all.js`
- **검증 방식**: Hermetic 단위 및 HTTP 통합 테스트 (Node.js test runner)

---

## 요약

- `node p-quaestor/test/run-all.js` 실행 결과: **191 tests, 191 pass, 0 fail, 0 skipped**, Exit Code 0.
- 이전 Phase 및 선행 작업(001~006) 포함 191개 전체 테스트 스위트 100% 무회귀 통과.
- `deploy-bellows.ps1 -DryRun` 실행 결과: **Exit Code 0**, 스크립트 파싱 및 드라이런 정상 종료.

---

## Acceptance Criteria 검증 결과

### Phase 1 Acceptance Criteria

| 구분 | 검증 항목 / 수용 기준 | 결과 | 근거 테스트 |
|---|---|---|---|
| [SPEC] | `deriveUsage` 반환 객체의 모든 퍼센트 값(`session_pct`, `weekly_pct`)은 문자열이 아닌 `number` 타입이어야 한다. | PASS | `deriveUsage returns numbers for session_pct and weekly_pct when observation exists` |
| [SPEC] | 측정 이력이 없는 경우 `deriveUsage`의 `session_pct` 및 `weekly_pct`는 `0`이 아닌 `null`이어야 한다. | PASS | `deriveUsage returns null (not 0) for percentages when no observation history exists` |
| [SPEC] | 측정 이력이 없는 경우 `deriveAllowance`의 `allowed` 판정값은 `true`나 `false`가 아닌 `null`이어야 한다. | PASS | `deriveAllowance returns allowed: null and confidence: unknown when no observation history exists` |
| [SPEC] | 측정 이력이 없는 경우 `deriveAllowance`의 `confidence`는 `'unknown'`이어야 한다. | PASS | `deriveAllowance returns allowed: null and confidence: unknown when no observation history exists` |
| [SPEC] | `deriveUsage`의 `headroom` 계산 결과는 현재 사용량이 stop 선을 넘었을 때 음수가 아닌 `0`이어야 한다. | PASS | `deriveUsage headroom is 0 (not negative) when usage exceeds stop threshold` |
| [SPEC] | 수동 STOP 활성화 시 `deriveAllowance`는 `allowed: false`와 `reason: 'manual-stop'`을 반환해야 한다. | PASS | `deriveAllowance returns allowed: false and reason: manual-stop for manual STOP` |
| [SPEC] | 자동 STOP 활성화 시 `deriveAllowance`는 `allowed: false`와 `reason` 필드에 해당 STOP의 원인을 그대로 포함해야 한다. | PASS | `deriveAllowance returns allowed: false and original reason for auto STOP` |
| [SPEC] | 신선도 판정(`stale`) 결과는 기존 `deriveState()`의 판정 기준과 모순되지 않아야 한다. | PASS | `stale in deriveUsage is consistent with deriveState criteria` |
| [SPEC] | `deriveUsage`는 전달받은 `thresholds` 객체를 그대로 반환 객체에 포함해야 한다. | PASS | `deriveUsage includes passed thresholds` |
| [DERIVED] | `deriveUsage`와 `deriveAllowance`는 사이드 이펙트가 없는 순수 함수로 설계하여, 기존의 판정 로직 상태를 오염시키지 않아야 한다. | PASS | `deriveUsage and deriveAllowance are pure functions without side effects` |

### Phase 2 Acceptance Criteria

| 구분 | 검증 항목 / 수용 기준 | 결과 | 근거 테스트 |
|---|---|---|---|
| [SPEC] | `/api/status` 응답의 기존 `fields`, `summary`, `state` 속성의 값이 변경 전과 완전히 동일해야 한다. | PASS | `Phase 2 [SPEC]: /api/status response contains unchanged fields, summary, and state` |
| [SPEC] | `/api/status` 응답 최상단에 `allowance` 객체와 `usage` 객체가 추가되어야 한다. | PASS | `Phase 2 [SPEC]: /api/status response top-level contains allowance and usage objects` |
| [SPEC] | HTTP GET `/api/status` 요청으로 반환되는 `usage.session_pct`의 값은 문자열을 파싱한 것이 아닌 처음부터 JSON 직렬화 시 `number` 타입이어야 한다. | PASS | `Phase 2 [SPEC]: HTTP GET /api/status usage.session_pct is number type upon JSON deserialization` |
| [SPEC] | `JSON.stringify(response.usage)`의 결과에는 `session_reset`과 `weekly_reset`의 값을 제외하고 어떤 형태의 한글 문자열도 포함되지 않아야 한다(키 이름 포함). | PASS | `Phase 2 [SPEC]: JSON.stringify(response.usage) contains no Korean strings except session_reset and weekly_reset values` |
| [SPEC] | `stale` 여부 및 측정 이력 유무가 API 응답에 명확히 반영되며, 26일 침묵과 같은 장기 측정 실패 시 `allowed` 속성은 `null`을 반환해야 한다. | PASS | `Phase 2 [SPEC]: long-term measurement failure (26-day silence / no history) sets allowed to null in /api/status response` |
| [DERIVED] | 응답 객체에는 토큰, 프로필 경로, 쿠키, 계정 정보 등 민감한 정보가 노출되지 않아야 한다. | PASS | `secrets never leak: 200/401/404/405/501/500 bodies never contain the token, .profile, cookie, or the raw Authorization header` |

### Phase 3 Acceptance Criteria

| 구분 | 검증 항목 / 수용 기준 | 결과 | 근거 테스트 / 검증 방법 |
|---|---|---|---|
| [SPEC] | 단위 테스트, 통합 검증 및 실포트 직렬화 테스트 작성 및 전건 통과 | PASS | `node p-quaestor/test/run-all.js` (191 tests pass, exit 0) |
| [SPEC] | 이전 Phase (001~006) 통합 검증 및 회귀 없음 | PASS | 191개 전체 테스트 스위트 무회귀 통과 |
| [SPEC] | `deploy-bellows.ps1 -DryRun` 정상 수행 | PASS | PowerShell 드라이런 실행 결과 Exit Code 0 |

---

## 구현 버그 수정 내역

- 007 Phase 1~3 구현 및 테스트 코드가 모든 Acceptance Criteria를 정확히 만족하도록 검증함.
- `deploy-bellows.ps1`의 Synology 소스 탐색 루틴이 로컬 저장소를 올바르게 참조하도록 보장하고 `-DryRun` 정상 동작을 확인함.

---

## 이전 Phase 연동 검증 결과

- **001 ~ 006 호환성**: 모든 이전 기능(로그 복원, observation 상태 판정, control-server 인증/라우팅, 환경변수 우선순위)이 회귀 없이 100% 정상 작동함.
- **`fields`, `summary`, `state` 유지**: 기존 소비자가 의존하는 데이터 필드가 한 글자도 수정되지 않고 유지됨.

---

## How to Run

```bash
# 전체 단위 및 통합 테스트 실행
node p-quaestor/test/run-all.js

# 배포 드라이런 검증 (PowerShell)
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy-bellows.ps1 -DryRun
```


===========================================
NNN: 008-allowance-respects-measured-usage
Started: 2026-08-25T00:22:42Z
===========================================
