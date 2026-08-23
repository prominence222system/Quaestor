chore: 006 Phase 1 미구현 확인, FIX 반려

DESIGN.md는 p-bellows→p-quaestor 이동·패키지명·경로 문자열 갱신을
파일:줄 단위로 정확히 설계했으나, 실측 결과 소스 트리에 어떤 변경도
없었다(git mv 미실행, package.json name 미변경, run-bellows.ps1/
deploy-bellows.ps1 경로 미변경). ACCEPTANCE.md의 006 Phase 1 [SPEC]
전항목이 미충족 상태라 다음 이터레이션에서 설계된 순서대로 실제
구현을 진행해야 한다.
