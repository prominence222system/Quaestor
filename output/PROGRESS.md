## Implementation Phases
| Phase | Feature | Status |
|-------|---------|--------|
| 1 | `lib/agy-usage.js` 신설 — 인자 고정(`AGY_ARGS`) · 주입 가능 실행기 · 엄격한 `parseUsage` · `measureAgy`(실패 kind 5종 · 자체 마감 · never-reject) · `createAgyMonitor`(in-flight 가드 · 성공값 보존) + 가짜 agy 자식 프로세스 테스트 | DONE |
| 2 | `watch-loop.js` 연결(`pollOnce()` 첫 동작 · `await` 없음 · `claude` 0회) + `[agy]` 로그 형식 확정 + `logparse` 비오염 테스트(`logparse.test.js` 추가만) | CURRENT |
