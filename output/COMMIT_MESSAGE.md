feat: Quaestor /api/status 사용량 및 허용량 공개 API 추가

기존 /api/status 응답의 fields는 UI 표시 전용으로 설계되어 있어 외부 소비자가 기계적으로 사용량을 파악하고 토큰 사용 허가 여부를 판단하기 어려웠다.

기존 fields, summary, state 속성의 하위 호환성을 완벽히 보존하면서 최상단에 수치형 사용량 정보(usage)와 토큰 사용 허가 판정(allowance)을 추가한다. 측정이 불가능하거나 관측 이력이 없는 경우에는 allowed 및 사용량 퍼센트를 null로 반환하여 소비자가 정보 부재를 허가나 금지로 오해하지 않고 자체 정책을 갖추도록 강제한다.
