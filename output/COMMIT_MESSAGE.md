chore: 006 저장소 내부 Bellows→Quaestor 개명 완료(env 폴백 포함)

006-rename-internals-to-quaestor 의 세 Phase(폴더 이동·경계 검증·환경변수
폴백)를 전부 재실측해 PASS 확정. `git mv` 로 p-bellows → p-quaestor 이동
이력을 보존했고, `QUAESTOR_*` 우선/`BELLOWS_*` 폴백 선택층(lib/env.js)이
undefined 여부로만 판정해 빈 문자열·미설정의 기존 의미를 그대로 유지한다.
외부에서 옛 이름만 설정해 둔 환경이 조용히 기본값으로 떨어져 차단기 임계가
풀리는 사고를 막기 위한 보험이므로 BELLOWS_* 키는 삭제하지 않았다.
run-bellows.ps1/deploy-bellows.ps1 파일명과 STOP.json 등 저장소 밖 런타임
경로는 다른 소유자 몫이라 손대지 않았다.
