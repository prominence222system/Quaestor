# ACCEPTANCE — Phase 1

대상: `p-bellows/lib/observation.js` · `p-bellows/test/run-all.js` · `p-bellows/test/observation.test.js`
전제: 모든 기준은 **hermetic** 하게 검증된다 — Chrome·네트워크·claude.ai·실제 파일시스템 없이 만족해야 한다.

시그니처(참조):
`createObservation()` · `recordSuccess(obs, usage, now)` · `recordFailure(obs, kind, detail, now)` ·
`deriveState(obs, ctx, now)` → `{ state, summary, fields }`,
`ctx = { enabled, thresholds, stop, configSource }`, `now` = epoch ms.

## Phase 1 Acceptance Criteria

### 순수성 · 결정성
- [SPEC] `deriveState()` 는 순수 함수다 — 동일한 `(obs, ctx, now)` 를 두 번 호출하면 깊은 비교로 동일한 결과를 반환하고, 호출 사이에 실제 시간이 흘러도 결과가 달라지지 않는다.
- [SPEC] `deriveState()` 는 시각을 인자 `now` 에서만 얻는다 — `lib/observation.js` 소스에 `Date.now`·`new Date()`(인자 없는 형태)·`require('fs')`·`require('node:fs')` 호출이 존재하지 않는다.
- [SPEC] `deriveState()` 는 어떤 파일도 읽거나 쓰지 않고, 입력 `obs`·`ctx` 를 변형하지 않는다 — 호출 전후로 두 인자의 JSON 직렬화 결과가 동일하다.
- [DERIVED] `recordSuccess()`·`recordFailure()` 도 입력 `obs` 를 변형하지 않고 새 객체를 반환한다 — 반환값을 수정해도 원본 `obs` 의 필드가 변하지 않는다.
- [DERIVED] 절대 시각 표기는 타임존에 의존하지 않는다 — `TZ` 환경변수를 바꿔도 동일한 입력이 동일한 `fields` 값을 낸다.

### 상태 판정 — 🔒 이 NNN 의 존재 이유
- [SPEC] `lastSuccessAt === null` 인 관측 상태에 대해 `deriveState()` 가 `state === 'ok'` 를 반환하면 **FAIL** 이다. 정보 부재는 성공으로 승격되지 않는다.
- [SPEC] `consecutiveFailures` 가 crit 임계 이상인 관측 상태에 대해 `deriveState()` 가 `state === 'ok'` 를 반환하면 **FAIL** 이다.
- [SPEC] 마지막 성공이 오래된(측정이 죽은) 관측 상태에 대해 `deriveState()` 가 `state === 'ok'` 를 반환하면 **FAIL** 이다 — 판정 근거는 프로세스 생존이 아니라 측정의 신선도다.
- [SPEC] `state` 는 항상 `'ok'` · `'warn'` · `'crit'` · `'idle'` 중 하나다 (감독 계약의 열거값). 그 외 값을 반환하면 FAIL.
- [SPEC] `summary` 는 항상 비어 있지 않은 문자열이고, `fields` 는 항상 배열이다 — 어떤 입력(빈 `obs`, `ctx` 필드 결손, `ctx` 자체 누락)에도 예외를 던지지 않는다.
- [DERIVED] `ctx.enabled === false` 이면 다른 조건과 무관하게 `state === 'idle'` 이다.
- [DERIVED] `consecutiveFailures >= 4` 이면 `state === 'crit'` 이며, 성공 이력이 전혀 없어도(`lastSuccessAt === null`) `crit` 이다 — "첫 측정 대기 중"(warn)으로 완화되지 않는다.
- [DERIVED] 마지막 성공 후 2시간 초과 → `crit`, 45분 초과(2시간 이내) → `warn`.
- [DERIVED] `lastSuccessAt === null` 이고 연속 실패가 crit 임계 미만이면 `state === 'warn'` 이다.
- [DERIVED] 측정이 신선하고(45분 이내) 사용량이 stop 선의 90% 이상이면 `warn`, 그 미만이면 `ok` 다. `thresholds` 기본값(weekly_stop 85 / session_stop 90) 기준으로 주간 79% 는 `warn`, 주간 24% 는 `ok`.
- [DERIVED] 판정 규칙은 first-match-wins 이며 우선순위는 `enabled=false` → `연속 실패 crit` → `장기 미갱신 crit` → `성공 이력 없음 warn` → `지연 warn` → `임계 접근 warn` → `ok` 순이다.

### 관측 기록
- [SPEC] 성공 → 실패 → 실패 → 성공 순서로 기록하면 최종 `consecutiveFailures === 0` 이다.
- [SPEC] `recordFailure()` 는 `consecutiveFailures` 와 `totalFailures` 를 각각 1 증가시키고, `lastSuccessAt` 을 지우지 않는다(직전 성공 시각이 보존된다).
- [SPEC] `recordSuccess()` 는 `lastSuccessAt` 을 주입된 `now` 로 세우고 `consecutiveFailures` 를 0 으로 리셋한다.
- [SPEC] `createObservation()` 의 초기 상태는 `lastSuccessAt === null`, `lastUsage === null`, `lastFailure === null`, `consecutiveFailures === 0`, `totalPolls === 0`, `totalFailures === 0` 이다.
- [DERIVED] `recordSuccess()`·`recordFailure()` 는 각각 `totalPolls` 를 1 증가시킨다.
- [DERIVED] `recordFailure(obs, kind, ...)` 에서 `kind` 가 falsy 하거나 문자열이 아니면 `'unknown'` 으로 정규화된다 — 🔒 다른 값으로 추측하지 않는다.
- [DERIVED] `recordSuccess()` 는 `lastFailure` 를 유지한다(직전 실패 이력을 지우지 않는다).

### 비밀 미유출 — 🔒
- [SPEC] `JSON.stringify(deriveState(...))` 한 문자열에 `.profile` · `authToken` · `cookie` · `@` 가 나타나면 **FAIL** 이다. 계정 이메일이 섞인 `lastFailure.detail` 을 보유한 관측 상태에 대해서도 만족해야 한다.
- [SPEC] `deriveState()` 결과에는 Chrome 디버그 URL(예: 디버그 포트 9222 를 포함하는 문자열)과 `lastFailure.detail` 의 페이지 원문 텍스트가 나타나지 않는다.
- [DERIVED] 마지막 실패 필드가 싣는 것은 `kind` 와 `hint` 뿐이며, 두 값은 모두 고정 어휘(`chrome-unreachable`·`anchor-timeout`·`invalid-extraction`·`nav-failed`·`unknown` / `login-expired`·`anchor-missing`·`unknown`)에서만 나온다 — 자유 텍스트를 정규식으로 마스킹하는 방식이 아니라 화이트리스트로 구성한다.

### `fields` 형식과 내용
- [SPEC] `fields` 의 각 원소는 문자열 `label` 과 문자열 `value` 를 가지며, 선택적으로 `state` 를 가진다. `state` 가 있으면 그 값도 `ok`/`warn`/`crit`/`idle` 중 하나다 (감독 계약의 `fields[]` 형식).
- [SPEC] `fields` 는 다음 항목을 모두 포함한다 — 마지막 성공 측정 시각 · 세션 % · 주간 % · 연속 실패 횟수 · 마지막 실패 분류와 사유 · STOP 상태 · 적용 중인 임계값 · 설정 출처.
- [SPEC] STOP 상태 필드는 STOP 없음 / `auto` / `manual` 을 구분해 표시하며, `manual` 인 경우 그 사실이 값에서 드러난다.
- [DERIVED] 설정 출처 필드는 `ctx.configSource` 에 따라 `파일` 또는 `기본값` 을 표시한다.
- [DERIVED] `lastUsage === null` 일 때 세션·주간 % 필드는 사라지지 않고 미측정 표기(`—`)로 남는다 — 칸이 없어지면 "측정된 적 없음"과 "0%"를 구분할 수 없다.
- [DERIVED] `fields` 의 원소 순서는 동일 입력에 대해 항상 같다 (Foreman 이 순서대로 그린다).

### 테스트 하네스
- [SPEC] `node p-bellows/test/run-all.js` 를 저장소 루트에서 실행하면 모든 테스트를 실행하고, 하나라도 실패하면 **비-0 종료 코드**로 끝난다.
- [SPEC] 하네스는 Chrome·네트워크·claude.ai 없이 완주한다 (Phase 1 시점 기준 전부 통과 + 종료 코드 0).
- [SPEC] `p-bellows` 의 새 `.js` 파일에 `claude` 문자열이 grep 매칭되지 않는다 (도메인 URL 은 예외이며 Phase 1 산출물에는 URL 자체가 없다).
- [DERIVED] 하네스는 `__dirname` 기준으로 테스트 파일을 찾으므로 실행 위치(저장소 루트 / `p-bellows` / `p-bellows/test`)와 무관하게 동작한다.
- [DERIVED] 테스트 파일 로드 중 예외가 발생하면 그 사실을 출력하고 비-0 으로 종료한다 — 로드 실패가 조용히 성공으로 처리되지 않는다.
- [DERIVED] 실행 대상 테스트 파일이 0개면 비-0 으로 종료한다.
- [DERIVED] 하네스와 테스트는 `node:test`/`node:assert` 만 사용하고 새 의존성을 추가하지 않으며, `npm` 을 호출하지 않는다.

### 회귀 금지 (never-brick)
- [SPEC] Phase 1 은 `watch-loop.js` · `lib/scrape.js` · `lib/config.js` · `lib/extract.js` · `watch-once.js` 를 수정하지 않는다.
- [SPEC] STOP.json 의 경로·이름·스키마, `deriveDesired()` 의 임계 판정과 히스테리시스, 수동 STOP 우선 규칙은 변경되지 않는다 — `deriveState()` 는 이들과 별개의 함수이며 합쳐지지 않는다.
- [SPEC] `lib/observation.js` 는 `puppeteer` 를 포함한 어떤 외부 모듈도 `require` 하지 않는다.
