docs: 012 Phase 3 테스트 결과 문서화 누락을 FIX 로 반려

Phase 3 구현물(thresholds-integration.test.js S1~S7, watch-loop.test.js
W1~W4)은 이미 작성돼 전체 테스트 스위트에서 통과하지만, output/TEST_RESULT.md
에는 그 결과가 전혀 기록되지 않았다. 직전 "test" 단계 커밋이 TEST_RESULT.md
대신 무관한 output/ANDROIDSMOKE_RESULT.md 만 수정한 것이 원인으로 보인다.

ACCEPTANCE.md Phase 3 는 커버리지 매핑 표와 red-first 증적(R1~R3)을
TEST_RESULT.md 에 명시적으로 요구하므로, 코드가 통과했다는 사실만으로는
합격 근거가 되지 못한다. 다음 iteration 에서 TEST_RESULT.md 에 Phase 3
섹션·커버리지 표·red-first 기록을 추가해야 PASS 로 진행할 수 있다.
