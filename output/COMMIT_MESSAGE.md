feat: observation.js에 deriveUsage 및 deriveAllowance 구현

소비자가 클라이언트 측 정책 판단을 내릴 수 있도록 파싱 오차 없는 수치형 usage 정보와 allowance 상태 판정 순수 함수를 추가함. 관측 이력이 없을 경우 null을 반환하여 불확실성을 승격시키지 않도록 설계함.
