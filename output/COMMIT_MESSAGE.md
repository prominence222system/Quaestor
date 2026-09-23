feat: agy(Gemini) 잔량을 매 폴 측정해 로그에 남긴다

Quaestor는 지금까지 claude.ai만 쟀지만 forge는 alternate로 agy를
27% 비율로 함께 돌린다. `agy -p "/usage"`가 비대화형 파이프 호출에서도
동작함이 실측됐으므로, watch-loop.js의 pollOnce() 첫 동작(모든 조기
return보다 앞, await 없이)에서 이를 호출해 Gemini 주간/5시간 잔량을
측정하고 `[agy] gemini weekly_left=..% five_hour_left=..%` 형식으로
로그에 남긴다.

파서는 TAB(파이프 실측 바이트) 우선, 실패 시 공백 2칸 정렬(콘솔 출력)로
재분할하며, `Gemini Models` 버킷만 허용목록으로 골라 metric 문자열
정확 일치로 짝짓는다 — `Claude and GPT models`(Antigravity 안의 별도
지갑)는 어디에도 새지 않는다. agy가 없거나 응답이 깨져도 STOP.json
판정 차단기는 한 폴도 놓치지 않도록 measureAgy는 절대 reject하지
않고, 실패는 lastAttempt만 바꿔 이전 성공값을 지우지 않는다. 로그
줄은 `weekly_left=`를 써서 005의 재기동 복원 정규식(`weekly=`)을
오염시키지 않는다.

이 라운드는 측정과 로그 기록만 다룬다 — `/api/status` 응답, fields,
상태 페이지, 계약 버전은 015에서 노출한다.
