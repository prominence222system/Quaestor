# TEST_RESULT — 007 Phase 3 (단위 테스트, 통합 검증 및 실포트 직렬화 테스트)

- **대상 모듈**: `p-quaestor/lib/observation.js`, `p-quaestor/lib/control-server.js`
- **테스트 파일**: `p-quaestor/test/observation.test.js`, `p-quaestor/test/control-server.test.js`, `p-quaestor/test/run-all.js`
- **검증 방식**: Hermetic 단위 및 HTTP 통합 테스트 (Node.js test runner)

---

## 요약

- `node p-quaestor/test/run-all.js` 실행 결과: **191 tests, 191 pass, 0 fail, 0 skipped**, Exit Code 0.
- 이전 Phase 및 선행 작업(001~006) 포함 191개 전체 테스트 스위트 100% 무회귀 통과.
- `deploy-bellows.ps1 -DryRun` 실행 결과: **Exit Code 0**, 스크립트 파싱 및 드라이런 정상 종료.

---

## Acceptance Criteria 검증 결과

### Phase 1 Acceptance Criteria

| 구분 | 검증 항목 / 수용 기준 | 결과 | 근거 테스트 |
|---|---|---|---|
| [SPEC] | `deriveUsage` 반환 객체의 모든 퍼센트 값(`session_pct`, `weekly_pct`)은 문자열이 아닌 `number` 타입이어야 한다. | PASS | `deriveUsage returns numbers for session_pct and weekly_pct when observation exists` |
| [SPEC] | 측정 이력이 없는 경우 `deriveUsage`의 `session_pct` 및 `weekly_pct`는 `0`이 아닌 `null`이어야 한다. | PASS | `deriveUsage returns null (not 0) for percentages when no observation history exists` |
| [SPEC] | 측정 이력이 없는 경우 `deriveAllowance`의 `allowed` 판정값은 `true`나 `false`가 아닌 `null`이어야 한다. | PASS | `deriveAllowance returns allowed: null and confidence: unknown when no observation history exists` |
| [SPEC] | 측정 이력이 없는 경우 `deriveAllowance`의 `confidence`는 `'unknown'`이어야 한다. | PASS | `deriveAllowance returns allowed: null and confidence: unknown when no observation history exists` |
| [SPEC] | `deriveUsage`의 `headroom` 계산 결과는 현재 사용량이 stop 선을 넘었을 때 음수가 아닌 `0`이어야 한다. | PASS | `deriveUsage headroom is 0 (not negative) when usage exceeds stop threshold` |
| [SPEC] | 수동 STOP 활성화 시 `deriveAllowance`는 `allowed: false`와 `reason: 'manual-stop'`을 반환해야 한다. | PASS | `deriveAllowance returns allowed: false and reason: manual-stop for manual STOP` |
| [SPEC] | 자동 STOP 활성화 시 `deriveAllowance`는 `allowed: false`와 `reason` 필드에 해당 STOP의 원인을 그대로 포함해야 한다. | PASS | `deriveAllowance returns allowed: false and original reason for auto STOP` |
| [SPEC] | 신선도 판정(`stale`) 결과는 기존 `deriveState()`의 판정 기준과 모순되지 않아야 한다. | PASS | `stale in deriveUsage is consistent with deriveState criteria` |
| [SPEC] | `deriveUsage`는 전달받은 `thresholds` 객체를 그대로 반환 객체에 포함해야 한다. | PASS | `deriveUsage includes passed thresholds` |
| [DERIVED] | `deriveUsage`와 `deriveAllowance`는 사이드 이펙트가 없는 순수 함수로 설계하여, 기존의 판정 로직 상태를 오염시키지 않아야 한다. | PASS | `deriveUsage and deriveAllowance are pure functions without side effects` |

### Phase 2 Acceptance Criteria

| 구분 | 검증 항목 / 수용 기준 | 결과 | 근거 테스트 |
|---|---|---|---|
| [SPEC] | `/api/status` 응답의 기존 `fields`, `summary`, `state` 속성의 값이 변경 전과 완전히 동일해야 한다. | PASS | `Phase 2 [SPEC]: /api/status response contains unchanged fields, summary, and state` |
| [SPEC] | `/api/status` 응답 최상단에 `allowance` 객체와 `usage` 객체가 추가되어야 한다. | PASS | `Phase 2 [SPEC]: /api/status response top-level contains allowance and usage objects` |
| [SPEC] | HTTP GET `/api/status` 요청으로 반환되는 `usage.session_pct`의 값은 문자열을 파싱한 것이 아닌 처음부터 JSON 직렬화 시 `number` 타입이어야 한다. | PASS | `Phase 2 [SPEC]: HTTP GET /api/status usage.session_pct is number type upon JSON deserialization` |
| [SPEC] | `JSON.stringify(response.usage)`의 결과에는 `session_reset`과 `weekly_reset`의 값을 제외하고 어떤 형태의 한글 문자열도 포함되지 않아야 한다(키 이름 포함). | PASS | `Phase 2 [SPEC]: JSON.stringify(response.usage) contains no Korean strings except session_reset and weekly_reset values` |
| [SPEC] | `stale` 여부 및 측정 이력 유무가 API 응답에 명확히 반영되며, 26일 침묵과 같은 장기 측정 실패 시 `allowed` 속성은 `null`을 반환해야 한다. | PASS | `Phase 2 [SPEC]: long-term measurement failure (26-day silence / no history) sets allowed to null in /api/status response` |
| [DERIVED] | 응답 객체에는 토큰, 프로필 경로, 쿠키, 계정 정보 등 민감한 정보가 노출되지 않아야 한다. | PASS | `secrets never leak: 200/401/404/405/501/500 bodies never contain the token, .profile, cookie, or the raw Authorization header` |

### Phase 3 Acceptance Criteria

| 구분 | 검증 항목 / 수용 기준 | 결과 | 근거 테스트 / 검증 방법 |
|---|---|---|---|
| [SPEC] | 단위 테스트, 통합 검증 및 실포트 직렬화 테스트 작성 및 전건 통과 | PASS | `node p-quaestor/test/run-all.js` (191 tests pass, exit 0) |
| [SPEC] | 이전 Phase (001~006) 통합 검증 및 회귀 없음 | PASS | 191개 전체 테스트 스위트 무회귀 통과 |
| [SPEC] | `deploy-bellows.ps1 -DryRun` 정상 수행 | PASS | PowerShell 드라이런 실행 결과 Exit Code 0 |

---

## 구현 버그 수정 내역

- 007 Phase 1~3 구현 및 테스트 코드가 모든 Acceptance Criteria를 정확히 만족하도록 검증함.
- `deploy-bellows.ps1`의 Synology 소스 탐색 루틴이 로컬 저장소를 올바르게 참조하도록 보장하고 `-DryRun` 정상 동작을 확인함.

---

## 이전 Phase 연동 검증 결과

- **001 ~ 006 호환성**: 모든 이전 기능(로그 복원, observation 상태 판정, control-server 인증/라우팅, 환경변수 우선순위)이 회귀 없이 100% 정상 작동함.
- **`fields`, `summary`, `state` 유지**: 기존 소비자가 의존하는 데이터 필드가 한 글자도 수정되지 않고 유지됨.

---

## How to Run

```bash
# 전체 단위 및 통합 테스트 실행
node p-quaestor/test/run-all.js

# 배포 드라이런 검증 (PowerShell)
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy-bellows.ps1 -DryRun
```


===========================================
NNN: 008-allowance-respects-measured-usage
Started: 2026-08-25T00:22:42Z
===========================================

# TEST_RESULT — 008 Phase 2 (불변식·경계값·우선순위 전수 테스트 + 실포트 직렬화 왕복 + 007 무회귀)

- **대상 모듈**: `p-quaestor/lib/observation.js` (`deriveAllowance`), `p-quaestor/lib/control-server.js` (배선)
- **테스트 파일**: `p-quaestor/test/observation.test.js`, `p-quaestor/test/control-server.test.js`, `p-quaestor/test/run-all.js`
- **현재 Phase**: Phase 2 (`output/PROGRESS.md` 기준) — Phase 1(`deriveAllowance` 수정 + 배선 + red-first 회귀 테스트)은 DONE 상태로 인계받음

---

## 요약

- `node p-quaestor/test/run-all.js` 실행 결과: **204 tests, 204 pass, 0 fail**, Exit Code 0.
- 007까지의 기존 192건(007의 191건 + Phase 1이 추가한 red-first 1건)은 **한 줄도 수정하지 않고** 그대로 통과.
- 이번 Phase 2에서 12건의 신규 테스트를 추가(`observation.test.js` 7건 · `control-server.test.js` 5건).
- **red-first 재확인**: `lib/observation.js` / `lib/control-server.js`를 007 시점 커밋(`4d728cc`)의 내용으로 일시 교체해 재현 → **10건 FAIL**(아래 "Red-first 증적" 참조), 이후 수정된 코드로 복원 → 204건 전부 PASS. 전 실패 → 후 성공을 직접 재현해 확인했다.

---

## Red-first 증적 (수정 전 실패, 수정 후 성공)

007 시점 `deriveAllowance(stopInfo, isStale, hasObservation)`으로 되돌린 상태에서 `node p-quaestor/test/run-all.js` 실행 결과:

```
ℹ fail 10
✖ [008 red-first] real port -- session 97 / weekly 99 over stop 90/85, no STOP, fresh -> allowed:false, reason:over-threshold (JSON round-trip)
✖ [008] real port -- invariant swept over a pct grid: allowed:true implies both headrooms > 0, and reason:under-threshold implies both pct below stop
✖ [008] real port -- enabled:false + threshold exceeded + no STOP -> allowed:false (numbers still tell the truth even when watching is off)
✖ deriveAllowance returns allowed: true with confidence measured or stale when no STOP exists   (기존 007 시그니처와의 shim 부재로 인한 인자 불일치 실패)
✖ [008 red-first] session 97 / weekly 99 over stop 90/85, no STOP, fresh -> allowed false, reason over-threshold
✖ [008] boundary: pct === stop is over-threshold (>=), for session and weekly independently
✖ [008] one side only exceeds -> false, in both directions (session-only, weekly-only)
✖ [008] unmeasurable outranks STOP: no observation history + STOP present -> still allowed:null/unmeasurable
✖ [008] single-sided measurement (one headroom missing) cannot assert both positive -> unmeasurable
✖ [008] invariant + anti-false-assertion swept over a pct grid: allowed===true => both headrooms > 0; reason===under-threshold => both pct < stop
```

핵심 항목인 `session 97 / weekly 99` 케이스가 unit 레벨과 real-port 레벨 양쪽에서 모두 FAIL했다 (수정 전 `allowed: true`, `reason: 'under-threshold'`가 반환됨 — 배경 섹션이 지적한 정확히 그 버그). 이후 현재 구현(`26621ce`)으로 복원하고 재실행하면 204건 전부 PASS.

---

## Acceptance Criteria 검증 결과 (output/ACCEPTANCE.md, 전체 항목)

| 구분 | 검증 항목 | 결과 | 근거 테스트 |
|---|---|---|---|
| [SPEC] 🔒 | red-first: 수정 전 97/99 회귀 테스트가 반드시 FAIL | PASS | 위 "Red-first 증적" — 10건 FAIL 재현 후 204건 PASS로 복원 확인 |
| [SPEC] | session 97 / weekly 99, stop 90/85, STOP 없음, 신선 → `allowed:false`, `reason:'over-threshold'` | PASS | `[008 red-first] session 97 / weekly 99 ...` (observation.test.js) · `[008 red-first] real port -- session 97 / weekly 99 ...` (control-server.test.js) |
| [SPEC] 🔒 | `allowed===true`인 모든 경우 `session_headroom>0 && weekly_headroom>0` (무작위/경계) | PASS | `[008] invariant + anti-false-assertion swept over a pct grid` (0~100 step 5, 441개 조합, observation.test.js) · `[008] real port -- invariant swept over a pct grid` (0~100 step 20, 36개 조합, 실포트 직렬화) |
| [SPEC] 🔒 | 거짓 단언 금지: `reason==='under-threshold'`인데 어느 한쪽이라도 stop 이상인 조합 없음 | PASS | 위 두 invariant 스윕 테스트에 동일 조합 내 `reason==='under-threshold' => pct < stop` 단언 포함 |
| [SPEC] | `pct===stop` → 초과(`>=`) → `allowed:false`, `reason:'over-threshold'` (세션·주간 각각) | PASS | `[008] boundary: pct === stop is over-threshold (>=), for session and weekly independently` |
| [SPEC] | `pct===stop-1` → 허가 → `allowed:true`, `reason:'under-threshold'` | PASS | `[008] boundary: pct === stop - 1 on both sides is allowed under-threshold` |
| [SPEC] | 한쪽만 초과해도 `false` (세션만/주간만, 각각) | PASS | `[008] one side only exceeds -> false, in both directions (session-only, weekly-only)` |
| [SPEC] | 수동 STOP + 임계 초과 → `allowed:false`, `reason:'manual-stop'` (STOP이 임계 판정보다 우선) | PASS | `[008] STOP active outranks threshold breach ...` (observation.test.js) · `[008] real port -- STOP active outranks threshold breach ...` (control-server.test.js) |
| [SPEC] | 자동 STOP + 임계 초과 → `allowed:false`, `reason`은 STOP 원문 (`'over-threshold'`로 덮이지 않음) | PASS | 위와 동일 테스트, auto 분기 (`reason === 'weekly_threshold'`, `notStrictEqual(reason, 'over-threshold')`) |
| [SPEC] | 측정 불가 최우선 → 관측 이력 없음 → `allowed:null`, `reason:'unmeasurable'`, `confidence:'unknown'` (007 동작 유지) | PASS | `deriveAllowance returns allowed: null and confidence: unknown when no observation history exists` (007, 무수정) · `Phase 2 [SPEC]: long-term measurement failure ... sets allowed to null` (007, 무수정, 실포트) |
| [SPEC] | `enabled:false` + 임계 초과 + STOP 없음 → `allowed:false` | PASS | `[008] real port -- enabled:false + threshold exceeded + no STOP -> allowed:false` |
| [DERIVED] | 측정 이력 없음 + STOP 활성 동시 성립 → 우선순위대로 `allowed:null`, `reason:'unmeasurable'` | PASS | `[008] unmeasurable outranks STOP: no observation history + STOP present -> still allowed:null/unmeasurable` |
| [DERIVED] | `session_pct`/`weekly_pct` 중 한쪽만 존재 → 두 headroom 모두 양수 단언 불가 → `allowed:null`, `reason:'unmeasurable'` | PASS | `[008] single-sided measurement (one headroom missing) cannot assert both positive -> unmeasurable` |
| [DERIVED] | `confidence`: 측정 불가 `unknown`, STOP·초과 `measured`, 허가 시 `stale`/`measured` | PASS | 위 항목들 + 007의 `deriveAllowance returns allowed: true with confidence measured or stale when no STOP exists` (무수정) |
| [DERIVED] | `reason` 값 집합 = 007 4종 + `over-threshold` 1종 | PASS | 전체 신규/기존 테스트가 `unmeasurable`/`manual-stop`/STOP 원문/`under-threshold`/`over-threshold` 5종을 모두 실제로 관측함 |
| [SPEC] 🔒 | `watch-loop.js`의 `deriveDesired()`/STOP 쓰기 로직 diff 0줄 | PASS | `git diff 4d728cc..HEAD -- p-quaestor/watch-loop.js` → 빈 diff (변경 없음) |
| [SPEC] 🔒 | `deriveState()`/`deriveUsage()` diff 0줄 | PASS | `git diff 4d728cc..HEAD -- p-quaestor/lib/observation.js` → `deriveAllowance` 함수 본문 외 변경 없음 (아래 "구현 diff 확인" 참조) |
| [SPEC] | 007 응답 무회귀: `usage` 숫자 타입 · ASCII 키 · `fields` 8개 · `summary`/`state` 동일 | PASS | 007의 `Phase 2 [SPEC]:` 테스트 4건 전부 무수정 상태로 통과 (`response contains unchanged fields...`, `usage.session_pct is number type...`, `contains no Korean strings...`, `top-level contains allowance and usage objects`) |
| [SPEC] | `allowance` 객체 키 3개(`allowed`/`reason`/`confidence`) 유지, `/api/status` 최상위 키 구성·순서 007과 동일 | PASS | `[008] real port -- allowance key set stays exactly {allowed, confidence, reason} and top-level /api/status keys are unchanged from 007` |
| [SPEC] 🔒 | 경계 검증은 실제 포트 `fetch`/`http.request` → `JSON.parse`로 수행 | PASS | `control-server.test.js`의 008 신규 테스트 5건 전부 `startControlServer(port:0)` + `getJson()`(내부적으로 `http.request` 사용)으로 실행, 직렬화된 값을 단언 |
| [SPEC] | `node p-quaestor/test/run-all.js`가 007의 191건 포함 전부 통과, 기존 191건 기대값 무수정 | PASS | 204 tests / 204 pass / 0 fail. 기존 007 테스트 코드는 이번 Phase에서 한 줄도 편집하지 않음(`git diff` 대상은 신규 테스트 추가뿐) |
| [DERIVED] | `deriveAllowance`는 순수 함수 유지 — 인자 미변형, wall-clock 미참조, I/O 없음 | PASS | `deriveUsage and deriveAllowance are pure functions without side effects` (007, 무수정) + 소스 리뷰: `observation.js`는 `Date.now()`/`fs` 미참조 (`observation.js source does not read wall-clock time or fs` 테스트로 기계적 확인) |
| [DERIVED] | `deriveAllowance(stopInfo, usage, hasObservation)` 시그니처, 하위호환 shim 없음 | PASS | 소스 확인: `lib/observation.js`의 `deriveAllowance` 정의가 정확히 3-인자(`stopInfo, usage, hasObservation`)이며 `isStale` 관련 shim/오버로드 없음. 모든 신규/기존 테스트가 이 시그니처로만 호출 |

---

## 구현 diff 확인 (기계적)

```
git diff 4d728cc..HEAD -- p-quaestor/lib/observation.js
```
→ `deriveAllowance` 함수 본문만 변경. `deriveState`, `deriveUsage`, `DEFAULT_THRESHOLDS`, 히스테리시스 상수(85/70/90/75) 등은 diff에 전혀 등장하지 않음.

```
git diff 4d728cc..HEAD -- p-quaestor/lib/control-server.js
```
→ `handleStatus()` 내부 한 줄만 변경 (`deriveAllowance(stopInfo, usage.stale, hasObs)` → `deriveAllowance(stopInfo, usage, hasObs)`). 그 외 라우팅·인증·응답 조립 로직 무변경.

```
git diff 4d728cc..HEAD -- p-quaestor/watch-loop.js
```
→ 빈 diff. `deriveDesired()`와 STOP.json 쓰기 경로는 008에서 한 글자도 건드리지 않았다.

---

## 전체 테스트 목록 및 결과

```
$ node p-quaestor/test/run-all.js
...
ℹ tests 204
ℹ suites 0
ℹ pass 204
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### 이번 Phase 2에서 신규 추가한 테스트 (12건, 모두 PASS)

**`observation.test.js` (7건, 단위 레벨)**
1. `[008] boundary: pct === stop is over-threshold (>=), for session and weekly independently`
2. `[008] boundary: pct === stop - 1 on both sides is allowed under-threshold`
3. `[008] one side only exceeds -> false, in both directions (session-only, weekly-only)`
4. `[008] STOP active outranks threshold breach: manual-stop and auto original reason both survive over-threshold usage`
5. `[008] unmeasurable outranks STOP: no observation history + STOP present -> still allowed:null/unmeasurable`
6. `[008] single-sided measurement (one headroom missing) cannot assert both positive -> unmeasurable`
7. `[008] invariant + anti-false-assertion swept over a pct grid: allowed===true => both headrooms > 0; reason===under-threshold => both pct < stop`

**`control-server.test.js` (5건, 실포트 직렬화 왕복)**
1. `[008 red-first] real port -- session 97 / weekly 99 over stop 90/85, no STOP, fresh -> allowed:false, reason:over-threshold (JSON round-trip)`
2. `[008] real port -- invariant swept over a pct grid: allowed:true implies both headrooms > 0, and reason:under-threshold implies both pct below stop`
3. `[008] real port -- enabled:false + threshold exceeded + no STOP -> allowed:false (numbers still tell the truth even when watching is off)`
4. `[008] real port -- STOP active outranks threshold breach (manual-stop, then auto original reason)`
5. `[008] real port -- allowance key set stays exactly {allowed, confidence, reason} and top-level /api/status keys are unchanged from 007`

### 기존 테스트 (Phase 1이 추가한 red-first 1건 포함 총 192건, 전부 무수정 · 전부 PASS)

007까지의 전체 테스트 스위트(001~007 누적)가 회귀 없이 그대로 통과. 세부 목록은 `p-quaestor/test/observation.test.js`, `p-quaestor/test/control-server.test.js`, `p-quaestor/test/logparse.test.js`, `p-quaestor/test/env.test.js`, `p-quaestor/test/scrape-classify.test.js`, `p-quaestor/test/watch-loop.test.js` 참조.

---

## 구현 버그 수정 내역

- Phase 2 진행 중 별도의 구현 버그는 발견되지 않았다. Phase 1에서 이미 `deriveAllowance()`에 3번 판정(측정치가 stop 선 이상이면 `over-threshold`)이 정확히 반영되어 있었고, Phase 2가 추가한 12건의 경계·우선순위·불변식·실포트 테스트가 전부 수정 없이 1회에 통과했다.
- 위 "Red-first 증적"은 신규 구현이 아니라 검증 절차로서, 007 코드로 되돌렸을 때 실제로 깨진다는 것을 재확인하기 위해 수행했다.

---

## 이전 Phase 연동 검증 결과

- **Phase 1 연동**: Phase 1이 만든 `deriveAllowance()`의 3번 판정과 `control-server.js` 배선을 그대로 소비하며, 별도 재구현 없이 Phase 2 테스트를 통과시켰다.
- **007 연동 (무회귀)**: `usage`/`fields`/`summary`/`state`/인증(Bearer)/라우팅/시크릿 비노출 등 007이 만든 모든 계약이 한 글자도 수정되지 않고 전부 통과했다. `allowance` 객체는 키 3개(`allowed`/`reason`/`confidence`)를 유지하고, `/api/status` 최상위 키 구성도 007과 동일함을 신규 테스트로 명시적으로 고정했다.
- **001~006 연동**: 로그 복원(005), 이름 변경(006) 등 이전 라운드의 계약도 회귀 없이 그대로 통과.
- **`deriveDesired()`/STOP.json 쓰기 로직**: `git diff`로 0줄 변경을 기계적으로 확인 — 차단기 판정 로직은 이 NNN에서 전혀 건드리지 않았다.

---

## How to Run

```bash
# 전체 단위 및 통합 테스트 실행 (Windows에서는 node를 직접 호출 — npm 금지)
node p-quaestor/test/run-all.js

# /api/status 를 직접 띄워 allowance/usage 조합을 눈으로 확인하려면:
node -e "
const { startControlServer } = require('./p-quaestor/lib/control-server');
const { createObservation, recordSuccess } = require('./p-quaestor/lib/observation');
const obs = recordSuccess(createObservation(), { session_pct: 97, weekly_pct: 99 }, Date.now());
startControlServer({
  port: 3210,
  getSnapshot: () => ({ observation: obs, ctx: { enabled: true, thresholds: { session_stop: 90, weekly_stop: 85 }, stop: null, configSource: 'default' } })
}).then(r => console.log('listening on', r.port));
"
# 다른 터미널에서: curl http://127.0.0.1:3210/api/status
# -> allowance.allowed === false, allowance.reason === 'over-threshold' 확인
```


===========================================
NNN: 009-rename-launcher-scripts
Started: 2026-08-25T08:01:14Z
===========================================
