chore: 016 Phase 2 claude 0건 기준이 013 동결 요구와 충돌함을 확인해 REDESIGN 처리

ACCEPTANCE.md:73 "렌더된 HTML에 claude 0개" 는 :76 에 의해 실제 포트 왕복 응답까지
요구로 확정되는데, 013 이 만든 frozen 불변식(observation.js 가 covers 를 무조건
['claude'] 로 채우고 status-page.js 가 "엔진 범위: claude" 를 렌더하며 013/015 의
기존 테스트가 그 문자열의 존재를 이미 단언함)과 정면으로 모순된다. run-all.js 를
독립 재실행해 tests 465/pass 464/fail 1 을 확인했고, 실패가 016 구현이 아니라
design-next 가 작성한 ACCEPTANCE.md 문구 자체의 결함임을 근거와 함께 남겼다.
구현·Phase 1·Phase 2 의 나머지 43개 기준은 전부 실측 통과했으므로, 다음 라운드는
:73(및 파급되는 :76/:86) 문구만 013 과 양립하도록 좁혀 다시 쓰면 된다.
