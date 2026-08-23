test: 006 Phase 2 경계 검증 통과, Phase 3 로 진행

PS 5.1 파싱 0 errors, deploy-bellows.ps1 -DryRun exit 0, run-bellows.ps1
참조 경로(watch-loop.js/watch-once.js/node_modules)의 파일시스템 실존을
독립 재실행으로 확인했다. Phase 1 이 옮긴 p-quaestor 가 문자열이 아니라
실제 파일시스템에서도 유효함을 실증하는 검증 전용 Phase라 .js/.ps1 소스
변경은 0건이다. 테스트 146건 무회귀, p-bellows 문자열 잔재 0건, git log
--follow 이력 보존도 재확인했다. 남은 Phase 3(환경변수 QUAESTOR_* 우선/
BELLOWS_* 폴백)만 진행하면 006 이 완료된다.
