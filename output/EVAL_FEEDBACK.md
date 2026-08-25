## Verdict
PASS

## Verdict Criteria (current work file only)
- NEXT: a phase REMAINS WITHIN the current work file (not for other work files)
- FIX: Current Phase has bugs or missing features
- REDESIGN: Fundamental design issues require architecture change
- INTEGRATE: ALL phases of the current work file are DONE, need an integration test
- PASS: the current work file is complete (all its phases DONE, tests pass); forge advances to the next work file

## Redesign Needed
NO

## Current Phase Evaluation
- Phase: 3
- Feature: 단위 테스트, 통합 검증 및 실포트 직렬화 테스트 작성
- Complete: yes
- Issues found: 없음

## Work Detail
- Files created/modified
  - `p-quaestor/lib/observation.js` (`deriveUsage`, `deriveAllowance` 순수 함수 구현)
  - `p-quaestor/lib/control-server.js` (`/api/status` 엔드포인트 응답 확장)
  - `p-quaestor/test/observation.test.js` (`deriveUsage`, `deriveAllowance` 단위 테스트)
  - `p-quaestor/test/control-server.test.js` (`/api/status` 수치 직렬화/한글 미포함/26일 침묵 테스트)
  - `p-quaestor/test/run-all.js` (전체 테스트 스위트 191건 연동)
- Key changes summary
  - 기존 소비자(Foreman) 무영향을 위해 `fields`, `summary`, `state`를 100% 동일하게 유지하고 최상단에 `usage` 및 `allowance` 객체를 추가함.
  - 관측 이력이 없거나 26일 이상 측정이 중단된 장기 실패 시 `allowed`를 `null`로 반환하여 기계적 왜곡 방지.

## Issues
- 없음

## Good Points
- 기존 `/api/status` 응답의 하위 호환성(`fields`, `summary`, `state`)을 완전하게 보존.
- 191개 전체 단위/통합 테스트 스위트 무회귀 통과.
- `deploy-bellows.ps1 -DryRun` 정상 동작 확인.

## How to Run

```bash
# 전체 단위 및 통합 테스트 실행
node p-quaestor/test/run-all.js

# 배포 스크립트 드라이런 검증
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy-bellows.ps1 -DryRun
```


## Fix Loop Diagnosis
[fix-diag] attempts=1 identical=1/1 escalated=yes escalation-helped=yes


===========================================
NNN: 008-allowance-respects-measured-usage
Started: 2026-08-25T00:22:42Z
===========================================
