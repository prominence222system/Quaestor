chore: 006 저장소 내부 Bellows→Quaestor 개명 완료(env 폴백 포함)

006-rename-internals-to-quaestor 의 세 Phase(폴더 이동·경계 검증·환경변수
폴백)를 QA 가 독립 재실행으로 재확인해 PASS 확정. `git mv` 로 p-bellows →
p-quaestor 이동 이력을 보존했고, `QUAESTOR_*` 우선/`BELLOWS_*` 폴백
선택층(lib/env.js)이 undefined 여부로만 판정해 envToken 의 빈 문자열 의미를
그대로 지킨다. run-bellows.ps1/deploy-bellows.ps1 은 파일명·
`$env:BELLOWS_INTERVAL_MIN` 을 유지한 채 내부 경로 참조만 갱신했다 — 이
런처를 Foreman 이 소비하므로 이름을 먼저 바꾸면 깨진 창이 생긴다. 로그 줄
형식과 STOP.json 판정 로직은 한 글자도 바뀌지 않았다(005 26일 침묵 fixture
로 재확인). node p-quaestor/test/run-all.js 176건 전부 통과, 소스 트리
p-bellows 문자열 0건.
