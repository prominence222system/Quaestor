

===========================================
NNN: 003-observation-state-and-failure-classification
Started: 2026-08-19T04:35:13Z
===========================================

## Implementation Phases
| Phase | Feature | Status |
|-------|---------|--------|
| 1 | `lib/observation.js` 순수 모듈 — 관측 구조체(`createObservation`/`recordSuccess`/`recordFailure`) + `deriveState()` 판정 + `fields` 구성 · `test/run-all.js` 하네스 | DONE |
| 2 | `lib/scrape.js` 실패 분류 — `err.kind` 부착 + `anchor-timeout` 진단 수집(`hint`: login-expired / anchor-missing / unknown) | PENDING |
| 3 | `watch-loop.js` 배선 — 성공/실패 관측 갱신 · `kind`·`hint` 로그 · `require.main` 가드 · 모듈 로드 경계 검증 | PENDING |

## 비고
- 모든 검증은 hermetic (Chrome·네트워크·claude.ai 없이 실행).
- Work Verify: `node p-bellows/test/run-all.js` — 🔒 `npm` 을 쓰지 않는다.
- 🔒 불변: STOP.json 의 위치·이름·스키마, `deriveDesired()` 임계 판정과 히스테리시스,
  수동 STOP(`source === 'manual'`) 우선 규칙.
