# TEST_RESULT — 005 Phase 2 (watch-loop 기동 복원 배선 및 경계 검증)

대상: `p-bellows/watch-loop.js`(수정) · `p-bellows/test/watch-loop.test.js`(증분)
검증 방식: hermetic, 실 로그 파일 경계 검증 + 꼬리 읽기 + never-brick 폴백 연동 검증.

## 요약

- `node p-bellows/test/run-all.js` → **146 tests, 146 pass, 0 fail, exit code 0**, 프로세스 매달림 없음.
- Phase 1 종료 시점(140개) 대비 **+6개 순증분**, 기존 140개 전부 무회귀로 통과.
- `watch-loop.js` 기동 시 `bellows.log` 꼬리 64KB 읽기, well-formed restoration, `[restore]` 로그 기록 및 never-brick 폴백 검증 완료.

## Phase 2 Acceptance Criteria 대조

| 기준 | 결과 | 근거 테스트 |
|---|---|---|
| [SPEC] 26일 침묵 fixture: 성공 줄 하나 + 그 뒤 500개 실패 줄 로그 → 기동 복원 후 `deriveState()` 결과가 반드시 `crit` | PASS | `Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit` |
| [SPEC] parseLogTail() 순수성 검증 | PASS | `parseLogTail is pure and deterministic` |
| [SPEC] 성공 줄이 없는 로그 → `lastSuccessAt === null` | PASS | `log with no success line yields lastSuccessAt === null and lastUsage === null` |
| [SPEC] kind= 가 없는 옛 형식 실패 줄 → `kind === 'unknown'` | PASS | `old format failure line without kind= yields kind === unknown and detail === null` |
| [SPEC] 성공 줄 이후의 실패만 카운트 | PASS | `failure lines before last success line are excluded from consecutiveFailures` |
| [SPEC] 경계 검증: 임시 디렉토리에 실제 로그 파일 쓰고 읽어서 복원 (꼬리 64KB, 잘린 줄 제거) | PASS | `Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling` |
| [SPEC] 로그 파일 없음 / 0바이트 / 깨진 바이트 → 예외 없이 빈 관측(default observation)으로 시작 | PASS | `Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing` |
| [SPEC] 64KB보다 큰 파일에서 읽은 바이트가 상한(65536 bytes) 이하 | PASS | `Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes)` |
| [SPEC] 복원 결과를 JSON.stringify 한 문자열에 .profile / cookie / @ (이메일) 없음 | PASS | `Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @)` |
| [SPEC] mainLoop 시작 시 restoreObservation 순수 배선 및 never-brick 폴백 | PASS | `Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop` |

## 버그 수정 및 조정 내역

- `watch-loop.js` 내 `mainLoop()`의 `restoreObservation` 래퍼 `catch` 블록 예외 변수명을 `restoreErr`로 정제하여 C2 스파이 라우팅 정규식 충돌을 방지함.

## 이전 Phase 연동 검증

- 001~004 및 005 Phase 1 기존 140개 테스트 전건 pass, 회귀 없음.

## How to Run

```
node p-bellows/test/run-all.js
```
