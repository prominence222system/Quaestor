fix: 측정치가 임계 초과여도 allowed:true로 오판정하던 구멍 막기

007이 만든 /api/status의 allowance.allowed는 STOP.json 존재 여부만
보고 있어, session 97% / weekly 99%처럼 stop 선(90/85)을 넘어도
STOP이 없으면 allowed:true, reason:under-threshold를 반환했다.
headroom은 0으로 정확히 계산해두고도 reason이 사실과 다른 것을
단언하는 것은 값이 보수적이지 않은 것보다 나쁘다 — 소비자는
reason을 읽고 판단하기 때문이다.

deriveAllowance()가 stale 불리언 대신 deriveUsage()의 반환 객체
전체(session_headroom/weekly_headroom)를 받도록 시그니처를 바꾸고,
headroom이 0이면 허가하지 않는 안전선을 추가했다. deriveDesired()의
히스테리시스나 STOP 쓰기 로직은 한 글자도 건드리지 않았다 — 이미
계산된 숫자를 판정에 반영하지 않던 입력 결핍을 고친 것뿐이다.

핵심 불변식(allowed===true이면 두 headroom 모두 0보다 큼)을
테스트로 고정해 같은 구멍이 재발하기 어렵게 했다.
