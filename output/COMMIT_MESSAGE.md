test: 012 Phase 1 임계값 검증 모듈 수용기준 전수 확인

무르기 방향 변경에 만료를 강제하는 안전선과 히스테리시스 불변식은 이 NNN 의
핵심 조항이라 HTTP 배선(Phase 2) 이전에 순수 로직 단계에서 전부 고정해야
한다. ACCEPTANCE.md의 Phase 1 [SPEC]/[DERIVED] 항목을 thresholds.test.js
34건과 1:1 대조해 누락 없음을 확인했고, 다른 소스 파일이 이 단계에서
수정되지 않았음을 git diff로 검증해 회귀 위험이 없음을 못박았다.
