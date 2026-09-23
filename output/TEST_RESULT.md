# TEST_RESULT — 015 Phase 1: `lib/observation.js` 에 `deriveAgy` 로직 추가 및 `deriveState` 의 Gemini 행 반환 처리

## 현재 Phase

**Phase 1 / 3** — `lib/observation.js` 에 `deriveAgy` 로직 추가 및 `deriveState` 의 Gemini 행 반환 처리

## Phase 1 Acceptance 기준별 결과

| 기준 | 상태 | 근거 및 검증 내용 |
|---|---|---|
| [SPEC] `deriveAgy` 함수가 스냅샷 실패 시 과거 성공값을 유지하는 정책과 `STALE_WARN_MS` 에 따른 `stale` 판정을 포함해 진리표 4가지를 정확히 구현한다. | PASS | `test/observation.test.js` 내 진리표 4가지 케이스 단위 테스트 통과 (케이스 1: 스냅샷 없음/시도 없음, 케이스 2: 마지막 시도 성공(정상/낡음), 케이스 3: 마지막 시도 실패 및 이전 성공값 유지, 케이스 4: 마지막 시도 실패 및 이전 성공 이력 없음) |
| [SPEC] `deriveAgy` 반환값에서 잔량이 100%인 버킷의 리셋 시각(`*_reset`)은 항상 `null` 로 설정된다. | PASS | `test/observation.test.js` 의 `100% reset sentinel rule` 테스트 통과. weekly_remaining_pct=100 및 five_hour_remaining_pct=100 각각에 대해 리셋 시각이 null로 설정됨을 검증 |
| [SPEC] `deriveAgy` 반환값에서 측정된 이력이 없는 버킷은 잔여량(`*_pct`) 값이 항상 `null` 이다. | PASS | `test/observation.test.js` 의 `unmeasured bucket yields null pct` 테스트 통과. 스냅샷이 없거나 이전 성공이 없는 실패 시 0이나 100이 아닌 null이 반환됨을 확인 |
| [SPEC] `deriveState` 가 반환하는 `fields` 배열의 맨 끝에 "Gemini 주간 잔량", "Gemini 5시간 잔량" 두 행이 무조건 추가된다. | PASS | `fields include all required items` 테스트 통과. 기존 8개 행 뒤에 9번째, 10번째 행으로 항상 추가됨을 확인 |
| [SPEC] `fields` 에 표시되는 문자열 값이 `null` 이면 "모름", `stale` 이면 "N% (낡음)", 정상일 경우 "N%" 로 올바르게 노출된다. | PASS | `Gemini rows formatting` 테스트 통과. 미측정 시 "모름", 신선 측정 시 "45%", 낡은 측정 시 "45% (낡음)", 0% 잔량 시 "0%" 및 "0% (낡음)" 문자열이 정확히 생성됨을 확인 |
| [SPEC] `ctx.agy` 의 존재 여부 및 상태가 `deriveState` 가 판정하는 `state`, `summary`, `usage`, `allowance` 등 기존 필드에 어떠한 영향도 주지 않는다. | PASS | `deriveState independence` 테스트 통과. ctx.agy 누락 시와 실패 상태(timeout) 주입 시 state, summary, usage, allowance가 완벽히 동일(deepStrictEqual)함을 검증 |
| [SPEC] 허가된 테스트 편집 조항에 따라 `test/observation.test.js:236-244` 검증 라벨 배열의 순서를 지키며 끝에 두 행 이름만 정확하게 추가된다. | PASS | 허가된 편집 범위 내에서 `test/observation.test.js` 의 8개 기존 라벨 순서 유지 및 끝에 두 행 라벨만 추가되어 테스트 통과 |

## 전체 테스트 실행 결과

```
$ node p-quaestor/test/run-all.js
...
✔ [SPEC] [015 Phase 1 SPEC] deriveAgy truth table case 1: no snapshot or no attempt finished
✔ [SPEC] [015 Phase 1 SPEC] deriveAgy truth table case 2: last attempt success
✔ [SPEC] [015 Phase 1 SPEC] deriveAgy truth table case 3: last attempt failure, previous success exists (preserves success values)
✔ [SPEC] [015 Phase 1 SPEC] deriveAgy truth table case 4: last attempt failure, no previous success
✔ [SPEC] [015 Phase 1 SPEC] deriveAgy 100% reset sentinel rule: 100% bucket reset is null
✔ [SPEC] [015 Phase 1 SPEC] deriveAgy unmeasured bucket yields null pct (never 0 or 100)
✔ [SPEC] [015 Phase 1 SPEC] deriveState fields: Gemini rows formatting (모름, N%, N% (낡음))
✔ [SPEC] [015 Phase 1 SPEC] deriveState independence: ctx.agy presence and failure does not affect state, summary, usage, allowance
✔ [SPEC] [015 Phase 1 SPEC] deriveAgy is pure and does not mutate input snapshot
...
ℹ tests 415
ℹ suites 0
ℹ pass 415
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ~4700ms
```

- 단위 테스트(`test/observation.test.js`): 56개 전수 통과 (PASS: 56, FAIL: 0)
- 전체 스위트(`node p-quaestor/test/run-all.js`): 415개 전수 통과 (PASS: 415, FAIL: 0, 회귀: 0, 종료 코드: 0)

## Phase 1 관련 테스트 목록

`test/observation.test.js`:
- `deriveState is pure and deterministic (same input twice)` — PASS
- `observation.js source does not read wall-clock time or fs` — PASS
- `deriveState does not mutate obs or ctx` — PASS
- `recordSuccess/recordFailure do not mutate input obs` — PASS
- `fields are timezone independent` — PASS
- `never-success observation is not ok` — PASS
- `consecutiveFailures at crit threshold is crit, even with no success history` — PASS
- `stale success (>2h) is crit` — PASS
- `stale success (>45m, <=2h) is warn` — PASS
- `fresh + near threshold is warn, fresh + headroom is ok` — PASS
- `enabled=false forces idle regardless of other conditions` — PASS
- `state is always one of the four enum values` — PASS
- `deriveState never throws on missing/empty inputs` — PASS
- `success -> failure -> failure -> success resets consecutiveFailures to 0` — PASS
- `recordFailure increments consecutiveFailures/totalFailures, keeps lastSuccessAt` — PASS
- `recordSuccess sets lastSuccessAt to now, resets consecutiveFailures, keeps totalPolls counting` — PASS
- `createObservation initial shape` — PASS
- `recordFailure normalizes falsy/non-string kind to unknown` — PASS
- `recordSuccess keeps prior lastFailure` — PASS
- `no secrets leak into deriveState output, even when detail carries them` — PASS
- `lastFailure field carries only kind + known hint vocabulary` — PASS
- `unknown/garbage hint is dropped, not surfaced` — PASS
- `fields entries have string label/value and optional valid state` — PASS
- `fields include all required items` — PASS
- `STOP field distinguishes manual vs auto vs none` — PASS
- `configSource field reflects ctx.configSource` — PASS
- `lastUsage=null keeps session/weekly fields present with placeholder value` — PASS
- `field order is stable across calls` — PASS
- `observation.js requires no external modules (puppeteer etc.)` — PASS
- `deriveUsage returns numbers for session_pct and weekly_pct when observation exists` — PASS
- `deriveUsage returns null (not 0) for percentages when no observation history exists` — PASS
- `deriveUsage headroom is 0 (not negative) when usage exceeds stop threshold` — PASS
- `deriveUsage includes passed thresholds` — PASS
- `deriveAllowance returns allowed: null and confidence: unknown when no observation history exists` — PASS
- `deriveAllowance returns allowed: false and reason: manual-stop for manual STOP` — PASS
- `deriveAllowance returns allowed: false and original reason for auto STOP` — PASS
- `deriveAllowance returns allowed: true with confidence measured or stale when no STOP exists` — PASS
- `deriveUsage and deriveAllowance are pure functions without side effects` — PASS
- `[008 red-first] session 97 / weekly 99 over stop 90/85, no STOP, fresh -> allowed false, reason over-threshold` — PASS
- `[008] boundary: pct === stop is over-threshold (>=), for session and weekly independently` — PASS
- `[008] boundary: pct === stop - 1 on both sides is allowed under-threshold` — PASS
- `[008] one side only exceeds -> false, in both directions (session-only, weekly-only)` — PASS
- `[008] STOP active outranks threshold breach: manual-stop and auto original reason both survive over-threshold usage` — PASS
- `[008] unmeasurable outranks STOP: no observation history + STOP present -> still allowed:null/unmeasurable` — PASS
- `[008] single-sided measurement (one headroom missing) cannot assert both positive -> unmeasurable` — PASS
- `[008] invariant + anti-false-assertion swept over a pct grid: allowed===true => both headrooms > 0; reason===under-threshold => both pct < stop` — PASS
- `stale in deriveUsage is consistent with deriveState criteria` — PASS
- `[015 Phase 1 SPEC] deriveAgy truth table case 1: no snapshot or no attempt finished` — PASS
- `[015 Phase 1 SPEC] deriveAgy truth table case 2: last attempt success` — PASS
- `[015 Phase 1 SPEC] deriveAgy truth table case 3: last attempt failure, previous success exists (preserves success values)` — PASS
- `[015 Phase 1 SPEC] deriveAgy truth table case 4: last attempt failure, no previous success` — PASS
- `[015 Phase 1 SPEC] deriveAgy 100% reset sentinel rule: 100% bucket reset is null` — PASS
- `[015 Phase 1 SPEC] deriveAgy unmeasured bucket yields null pct (never 0 or 100)` — PASS
- `[015 Phase 1 SPEC] deriveState fields: Gemini rows formatting (모름, N%, N% (낡음))` — PASS
- `[015 Phase 1 SPEC] deriveState independence: ctx.agy presence and failure does not affect state, summary, usage, allowance` — PASS
- `[015 Phase 1 SPEC] deriveAgy is pure and does not mutate input snapshot` — PASS

## 구현 코드에서 고친 버그

- 없음: `lib/observation.js` 에 구현된 `deriveAgy` 순수 함수 및 `deriveState` 행 추가 로직이 동결된 수용 기준(Acceptance Criteria)을 완벽히 만족하며, 전수 테스트 결과 실패 없이 한 번에 통과되었습니다.

## 이전 Phase 통합 검증 결과

- 001~014 전 라운드 회귀 0건 확인:
  - 014 agy 모니터링 단위 테스트(`test/agy-usage.test.js`) 47개 전수 통과
  - 004~013 제어 서버 및 계약 버전 검증(`test/control-server.test.js`) 75개 전수 통과
  - 010 상태 웹페이지 무오염 검증(`test/status-page.test.js`) 28개 전수 통과
  - 012 임계값 수정 API 및 통합 검증(`test/thresholds*.test.js`) 38개 전수 통과
  - 005 로그 파싱 및 침묵 복원 검증(`test/logparse.test.js`, `test/watch-loop.test.js`) 전수 통과
- `p-quaestor/lib/observation.js` 내에 금지된 외부 모듈 참조, `claude` CLI 참조, 비밀값 누출 없음 확인.

## 결론

**PASS.** `output/ACCEPTANCE.md` 의 Phase 1 수용 기준 7개 항목이 모두 충족되었으며, 전체 테스트 스위트 415/415 통과, 회귀 0건, 종료 코드 0으로 검증 완료되었습니다.
