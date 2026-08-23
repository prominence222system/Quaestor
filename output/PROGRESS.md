## Implementation Phases
| Phase | Feature | Status |
|-------|---------|--------|
| 1 | `git mv p-bellows p-quaestor` + 패키지 이름(`prominence-quaestor`) + 저장소 내 `p-bellows` 문자열 전수 갱신(ps1 경로 참조 포함) | CURRENT |
| 2 | 경계 검증 — PS 5.1 파싱 0 errors · `deploy-bellows.ps1 -DryRun` · `run-bellows.ps1` 참조 경로의 파일시스템 실존 확인 | PENDING |
| 3 | 환경변수 `QUAESTOR_*` 우선 + `BELLOWS_*` 폴백(의미 불변) + hermetic 3케이스 검증 | PENDING |
