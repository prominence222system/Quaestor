chore: 014 Phase 1 agy 측정 모듈 평가, 회귀 0 확인 후 Phase 2 진행

lib/agy-usage.js와 가짜 agy 자식 프로세스 테스트가 ACCEPTANCE.md의
Phase 1 [SPEC]/[DERIVED] 기준을 전부 충족함을 독립 재실행으로 재확인했다.
node p-quaestor/test/run-all.js가 402/402 통과(회귀 0)이고 구현 커밋 이후
버그가 발견되지 않아 코드 변경 없이 다음 phase(watch-loop.js 연결)로
넘어간다.
