## Phase 1 Acceptance Criteria
- [SPEC] `git mv` 명령을 통해 `run-bellows.ps1`이 `run-quaestor.ps1`로, `deploy-bellows.ps1`이 `deploy-quaestor.ps1`로 이동되어 파일 이력이 유지되어야 한다 (`git log --follow`에서 확인 가능해야 함).
- [SPEC] 저장소 내에서 런처 파일명 `run-bellows` 및 `deploy-bellows` 문자열이 0건 발견되어야 한다 (`.prominence` 런타임 파일명과 `BellowsProfile` 문자열은 제외).
- [SPEC] `run-quaestor.ps1` 내의 `-Setup` 안내 메시지에서 `C:\BellowsChrome` 문자열이 나타나지 않고, 스크립트가 실제로 사용하는 프로필 경로(`$env:LOCALAPPDATA\Google\Chrome\BellowsProfile`)가 안내되어야 한다.
- [SPEC] 스크립트 내의 환경변수 읽기 시 `$env:BELLOWS_INTERVAL_MIN`이 `$env:QUAESTOR_INTERVAL_MIN`으로 변경되어 있어야 한다.
- [SPEC] 콘솔 출력 시의 접두어가 `[bellows]` / `[bellows-chrome]`에서 `[quaestor]` / `[quaestor-chrome]`으로 갱신되어야 한다.
- [SPEC] `lib/logparse.js`가 읽는 대상 로그 줄 형식(`[start] bellows watcher` 등)은 절대로 변경되지 않고 그대로 보존되어야 한다.
- [DERIVED] 스크립트 내에서 다른 스크립트 파일을 참조할 때 올바르게 갱신된 파일명을 지칭해야 한다.
