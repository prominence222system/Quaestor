## Implementation Phases
| Phase | Feature | Status |
|-------|---------|--------|
| 1 | `lib/observation.js` 에 `deriveAgy` 로직 추가 및 `deriveState` 의 Gemini 행 반환 처리 | DONE |
| 2 | `watch-loop.js` 에 스냅샷 전달 구현 및 `lib/control-server.js` 최상위 `agy` 블록, 1.5.0 계약 갱신 | DONE |
| 3 | `lib/status-page.js` 에 문자열 `agy` 오염 없이 HTML 렌더링되도록 Gemini 구역 신설 | CURRENT |
