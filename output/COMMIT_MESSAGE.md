feat: 관측 상태 추적과 측정 실패 원인 분류로 3주 침묵 재발을 막는다

3주간 측정이 전부 실패했는데도 프로세스 생존만으로 정상처럼 보였던
문제를 막기 위해, 측정 이력을 구조체(observation)로 들고 신선도
기준으로 ok/warn/crit/idle 을 판정하는 순수 함수를 추가했다. 정보
부재나 연속 실패 상태를 ok 로 승격하지 않는다.

scrape.js 의 실패에는 kind(chrome-unreachable/anchor-timeout/
invalid-extraction/nav-failed)를 붙이고, anchor-timeout 시점에는
로그인 만료(login-expired)와 UI 문구 변경(anchor-missing)을 가르는
hint 를 추가로 수집해 재로그인 헛걸음을 방지한다. watch-loop.js 는
이 관측 기록을 pollOnce() 성공/실패 분기에 배선하고, 테스트가 모듈을
로드해도 감시 루프가 시작되지 않도록 require.main 가드를 추가했다.

STOP.json 의 위치·스키마, deriveDesired() 의 임계 판정과 히스테리시스,
수동 STOP 우선 규칙은 그대로 유지했다 — 이 작업은 계기판만 새로
붙이고 차단기 로직은 건드리지 않는다.
