## Verdict
NEXT

## Verdict Criteria (current work file only)
- NEXT: 현재 작업 파일(013-status-declares-engine-scope.md) 내에 후속 Phase(Phase 3)가 남아 있음
- Phase 2 구현(`deriveUsage`·`deriveAllowance`에 `covers: ["claude"]` 추가, `CONTRACTS` 1.4.0 승격, 버전 핀 테스트 갱신 및 실포트 통신 검증)이 완료되었고, `output/ACCEPTANCE.md`의 Phase 2 수용 기준 8종([SPEC] 7종, [DERIVED] 1종)을 전수 충족함
- `node p-quaestor/test/run-all.js` 실행 결과 362 tests / 362 pass / 0 fail / 0 error로 100% 무회귀 통과
- Phase 3(`status-page.js` 렌더링)의 조기 구현 없이 Phase 간 격리가 철저히 준수됨

## Redesign Needed
NO

## Current Phase Evaluation
- Phase: 2
- Feature: `deriveUsage`·`deriveAllowance` 에 `covers` + `CONTRACTS` 1.4.0 + 버전 핀 갱신 + 실서버 HTTP 검증
- Complete: yes
- Issues found: 없음

## Work Detail
- Files created/modified:
  - `p-quaestor/lib/observation.js` (수정: `source.js`로부터 순수하게 `ENGINE` 상수를 require하여, `deriveUsage` 및 `deriveAllowance` 반환 객체에 `covers: [ENGINE]` 필드 추가. 관측 이력이 없거나 `null`인 경우에도 항상 `covers` 배열이 출력되도록 보장)
  - `p-quaestor/lib/control-server.js` (수정: `CONTRACTS['supervised-v1']` 상수를 `1.4.0`으로 갱신하고 상단에 유지보수 주석 추가)
  - `p-quaestor/test/control-server.test.js` (수정: 169/210행 제목 및 176/217행 단언을 `1.4.0`으로 갱신하고, 실서버 HTTP 통신 기반으로 `usage.covers === ["claude"]`, `allowance.covers deepStrictEqual`, `agy` 미포함, 무이력 시 covers 유지, 기존 필드 키 세트 보존을 검증하는 3건의 신규 테스트 추가)
- Key changes summary:
  - `supervised-v1` 계약 버전을 `1.3.0`에서 `1.4.0`으로 승격함 (소프트웨어 버전 `0.1.0`과 분리 유지).
  - `deriveUsage`와 `deriveAllowance` 모두에 `covers: ["claude"]` 배열을 추가하여, `allowance`만 읽는 기계 소비자도 대상 엔진 범위를 명확히 파악할 수 있도록 보장함.
  - 관측 이력이 없는 unmeasurable 상태(`session_pct: null`, `allowed: null`)에서도 `covers`는 정상 출력되도록 하여 "무엇을 재는가"와 "얼마나 쟀는가"의 관심사를 분리함.
  - 기존 11개 `usage` 필드 및 4개 `allowance` 필드를 일절 손상시키지 않는 ADDITIVE(하위호환) 확장을 실서버 직렬화 테스트로 검증함.

## Issues
- 없음. `output/ACCEPTANCE.md`의 Phase 2 수용 기준 8종([SPEC] 7종, [DERIVED] 1종)이 전수 충족되었으며 누락이나 기준 완화 없음.

## Good Points
- `lib/observation.js`가 I/O가 없는 `lib/source.js`만을 require함으로써 외부 의존성 오염 없이 순수 함수 원칙([SPEC] no I/O)을 완벽히 보존함.
- `deriveAllowance`에서 `usage.covers`가 주어지면 이를 복제(`u.covers.slice()`)하여 사용하고, 없으면 기본값 `[ENGINE]`을 사용하여 두 객체 간 `covers` 내용의 불일치 가능성을 원천 차단함.
- 순수 함수 단위 테스트에 그치지 않고, 127.0.0.1 실제 포트에 바인딩된 HTTP 통신(`GET /api/status`, `GET /api/health`) 직렬화/역직렬화 전 과정을 검증하여 "격리 통과·통합 실패" 함정을 방지함.
- `output/ACCEPTANCE.md`의 모든 [SPEC] 항목(agy 미포함, 무이력 시 covers 유지, 버전 핀 1.4.0 갱신 등)을 1:1로 매핑하는 전용 테스트 케이스를 촘촘히 보강함.
- 기존 라운드(001~012) 및 Phase 1의 359개 전 테스트를 포함하여 총 362개 테스트 전체가 무회귀(362 pass, 0 fail)로 깨끗하게 통과함.
