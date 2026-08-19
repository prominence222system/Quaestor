feat: 감독 대상 HTTP 계약면에 인증과 비밀 차단을 추가한다

Foreman 이 대상별 특수 코드 없이 이 감시자를 읽어갈 수 있도록,
127.0.0.1:3210 에서만 열리는 로컬 제어면(GET /api/health, GET
/api/status)을 앞선 라운드에서 만들었다. 이번 라운드는 그 위에
Authorization: Bearer 인증 게이트를 얹었다: authToken 이 설정되면
길이 무관 상수시간 비교(SHA-256 다이제스트 + timingSafeEqual)로만
통과시키고, 헤더 누락과 값 불일치를 구분 불가능한 401 로 응답한다.
경로 존재 여부가 누설되지 않도록 인증 검사를 라우팅보다 먼저 둔다.

토큰은 bellows-config.json 의 control 블록에서 읽되, 파일이 없거나
깨졌거나 만료돼도 readConfig() 는 절대 throw 하지 않고 기본값(인증
꺼짐, 127.0.0.1 바인딩만 방어선)으로 복귀한다 — 설정 오타로 감시
루프가 죽으면 안 되기 때문이다. 모든 응답(200/401/404/405/501/500)
전체를 문자열로 검사해 authToken 값·.profile·cookie 가 새지 않음을
확인했다. POST /api/stop 은 계약상 선택 조항이지만 이 제품의 정지가
안전장치를 끄는 동작이라 확인 없이 호출되면 안 되므로 501 로 영구
미구현 상태를 유지하며, 그 근거를 코드 주석과 PROJECT_INTENT.md
양쪽에 남겼다.

watch-loop.js 배선(never-brick)은 이어지는 Phase 에서 다룬다.
