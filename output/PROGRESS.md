## Implementation Phases
| Phase | Feature | Status |
|-------|---------|--------|
| 1 | `lib/thresholds.js` 순수 모듈 — 방향 판정(tighten/loosen) · 검증(미지 키·범위·히스테리시스·만료) · 설정 병합 · 로그 줄 생성 | DONE |
| 2 | `lib/control-server.js` 에 `PUT /api/thresholds` 배선 — 토큰 게이트(403 `write-requires-token`) · 본문 파싱 · `readConfig` 기준선 · 원자적 파일 쓰기 · `[thresholds]` 기록 · `onConfigChange` 로 스냅샷 즉시 갱신 · `contracts` 를 `1.3.0` 으로 · `watch-loop.js` 배선 | DONE |
| 3 | 실포트 왕복 통합 테스트(조이기/무르기/만료 4종/토큰 401·403/보존/부분요청/미지 키) + 회귀 검증(`/api/status`·`fields`·웹 페이지·STOP 동작 불변, 005 의 26일 fixture 통과) | DONE |
