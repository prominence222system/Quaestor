# TEST_RESULT — 005 Phase 1 (logparse 순수 파서 및 단위 테스트)

대상: `p-bellows/lib/logparse.js`(신규) · `p-bellows/test/logparse.test.js`(신규)
검증 방식: hermetic, 순수 함수 단위 테스트 + `deriveState()` 연동 검증.

## 요약

- `node p-bellows/test/run-all.js` → **140 tests, 140 pass, 0 fail, exit code 0**, 프로세스 매달림 없음.
- 이전 004 종료 시점(133개) 대비 **+7개 순증분**, 기존 133개 전부 무회귀로 통과.
- `lib/logparse.js` 순수 함수 파서 구현 및 `test/logparse.test.js` 테스트 스위트 작성 완료.

## Phase 1 Acceptance Criteria 대조

| 기준 | 결과 | 근거 테스트 |
|---|---|---|
| [SPEC] `parseLogTail()` 은 순수 함수다 — 같은 입력 → 같은 출력, Date methods/Date.now() 미독 | PASS | `parseLogTail is pure and deterministic`, `logparse.js source does not read wall-clock time or fs` |
| [SPEC] 26일 침묵 fixture: 성공 줄 하나 + 그 뒤 500개 실패 줄 로그 → `deriveState()` 결과가 반드시 `crit` | PASS | `26-day silence fixture: 1 success line + 500 failure lines yields deriveState() === crit` |
| [SPEC] 성공 줄이 없는 로그 → `lastSuccessAt === null`, `lastUsage === null` | PASS | `log with no success line yields lastSuccessAt === null and lastUsage === null` |
| [SPEC] `kind=` 가 없는 옛 형식 실패 줄 → `kind === 'unknown'`, `detail === null` | PASS | `old format failure line without kind= yields kind === unknown and detail === null` |
| [SPEC] 성공 줄 이후의 실패만 센다 — 성공 이전 실패는 `consecutiveFailures` 미포함 | PASS | `failure lines before last success line are excluded from consecutiveFailures` |

## How to Run

```
node p-bellows/test/run-all.js
```
