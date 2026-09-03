test: 012 Phase 2 임계값 쓰기 API 수용기준 전수 확인

PUT /api/thresholds가 판정 로직을 재구현하지 않고 순수 모듈(Phase 1)에
전부 위임했는지, 토큰 기본 거부·401이 403보다 항상 먼저·원자적 쓰기·
enabled/control.* 보존·never-brick이 실제 HTTP 왕복에서도 성립하는지가
이 NNN의 안전선이다. ACCEPTANCE.md Phase 2 [SPEC]/[DERIVED] 항목을
control-server.test.js 신규 테스트와 1:1 대조했고, run-all.js를 직접
재실행해 344개 중 343 PASS를 재현했다. 유일한 실패는 netstat으로 확인한
개발 머신의 포트 3210 선점 프로세스(PID 6944)로 인한 환경 충돌이며 이번
Phase 변경과 무관함을 확인했다. QA 중 발견된 collectBody()의 413 소켓
파괴 버그 수정도 판정 로직을 건드리지 않는 최소 범위였음을 검증했다.
