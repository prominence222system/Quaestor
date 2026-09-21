feat: /api/status 및 상태 페이지에 엔진 범위(claude) 선언 추가

Quaestor가 모니터링하는 사용량 수치가 claude 전용임에도 API 응답에
엔진 정보가 없어, forge처럼 claude와 agy를 교대로 사용하는 소비자에서
agy 실행 직전 잘못된 허가(allowed: true) 판정을 내릴 수 있는 위험을
해소하기 위함이다. 계약 1.4.0을 통해 'covers에 명시되지 않은 엔진은
모른다'는 규칙을 응답과 상태 페이지에 구조화하여 오판을 방지하고
하위 호환성을 유지한다.
