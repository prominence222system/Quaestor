## Implementation Phases
| Phase | Feature | Status |
|-------|---------|--------|
| 1 | `lib/status-page.js` — `/api/status` payload → HTML 문자열 순수 렌더러 (3상태 배지 · null "측정 없음" · stale 표시 · 인라인 CSS/JS · 외부 참조 0) | DONE |
| 2 | `lib/control-server.js` — `buildStatusPayload` 추출 + `GET /` 라우트 추가, 실포트 HTML 왕복 · null/stale 표시 · 404/401/경로탈출 회귀 테스트 | PENDING |

## Notes
- 🔒 `observation.js`(판정)·`/api/health`·`/api/status` 응답은 무변경 — ADDITIVE only
- 🔒 검증은 `node p-quaestor/test/run-all.js` (npm 금지)
