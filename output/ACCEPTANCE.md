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

---

# ACCEPTANCE — Phase 2

대상: `p-bellows/lib/scrape.js` · `p-bellows/test/scrape-classify.test.js`
전제: 모든 기준은 **hermetic** 하게 검증된다 — Chrome·네트워크·대상 사이트 없이 만족해야 한다.

시그니처(참조):
`scrapeUsage(profileDir, opts)` (기존, 변경 없음) ·
`hintFrom({ url, textHead })` → `'login-expired' | 'anchor-missing' | 'unknown'` (순수) ·
`collectDiagnostics(page)` → `{ url, textHead, hint }` (async, 던지지 않음) ·
상수 `FAILURE_KINDS` · `HINTS`.

## Phase 2 Acceptance Criteria

### 실패 분류 — `err.kind`
- [SPEC] `scrapeUsage()` 가 던지는 모든 오류에 `kind` 속성이 붙어 있다. 분류할 수 없는 경로에서도 `kind` 가 없는 오류가 새어나가지 않는다.
- [SPEC] `kind` 는 항상 `chrome-unreachable` · `anchor-timeout` · `invalid-extraction` · `nav-failed` · `unknown` 중 하나다. 그 외 값이 나오면 FAIL.
- [SPEC] 브라우저 연결 실패는 `chrome-unreachable`, 페이지 이동 실패는 `nav-failed`, 앵커 대기 실패는 `anchor-timeout`, 추출 단계 실패는 `invalid-extraction` 으로 분류된다.
- [SPEC] 태깅은 원본 오류 객체에 속성을 얹는 방식이며, 오류를 새 객체로 갈아끼우지 않는다 — 태깅 전후로 `message` 와 `stack` 이 보존된다.
- [DERIVED] 앵커 대기 지점에서 나온 오류는 타임아웃 여부와 무관하게 전부 `anchor-timeout` 이다.
- [DERIVED] `browser.newPage()` 실패는 `chrome-unreachable` 로 분류된다(브라우저 수준 조작이므로).

### `hint` 판정 — 🔒 이 Phase 의 존재 이유
- [SPEC] `hint` 는 항상 `login-expired` · `anchor-missing` · `unknown` 중 하나다.
- [SPEC] `url()` 이 대상 사이트의 로그인 경로를 돌려주는 가짜 page 객체로 진단하면 `hint === 'login-expired'` 다.
- [SPEC] 로그인 화면이 아닌 대상 사이트 페이지이고 본문 텍스트가 존재하는데 앵커만 없는 경우 `hint === 'anchor-missing'` 이다.
- [SPEC] 판정 근거가 없는 입력에는 `unknown` 이 나온다 — `login-expired` 로 기울지 않는다. 최소한 다음 입력이 모두 `unknown` 이어야 한다: `url` 이 없음/빈 문자열/문자열이 아님 · 대상 오리진 밖으로 리다이렉트됨 · 본문 텍스트가 비어 있거나 수집 실패.
- [SPEC] `hintFrom()` 은 순수 함수다 — 동일 입력에 항상 동일 출력이며, 네트워크·파일시스템·시계를 읽지 않고 입력 객체를 변형하지 않는다.
- [DERIVED] 판정은 first-match-wins 이며 우선순위는 `url 부재 → unknown` → `로그인 경로 → login-expired` → `대상 오리진 + 본문 있음 → anchor-missing` → `그 외 → unknown` 순이다.
- [DERIVED] URL 매칭은 접두사 비교로 하며, 잘못된 형식의 URL 문자열이 들어와도 예외를 던지지 않는다.

### 진단 수집 — 🔒 원인 조사가 원인을 지우면 안 된다
- [SPEC] `collectDiagnostics(page)` 는 어떤 입력에도 예외를 던지지 않는다 — `page.url()` 이 던지거나, `page.evaluate()` 가 거부되거나, `page` 자체가 `null` 이어도 `{ url, textHead, hint }` 를 반환한다.
- [SPEC] 진단 수집이 실패해도 `scrapeUsage()` 는 원래의 실패 오류를 던진다 — 진단 과정의 오류가 원래 오류를 대체하지 않는다.
- [SPEC] `err.detail.textHead` 는 본문 텍스트의 앞 200자를 넘지 않는다(작업지시서가 지정한 길이).
- [SPEC] 진단은 `page` 가 닫히기 전에 수집된다 — `finally` 의 정리보다 먼저 실행되어 `url`·`textHead` 가 실제 값으로 채워진다.
- [DERIVED] `collectDiagnostics` 가 만지는 page 인터페이스는 `url()` 과 `evaluate(fn)` 둘뿐이며, 이 둘만 가진 가짜 객체로 모든 hint 경로를 재현할 수 있다.
- [DERIVED] 수집에 실패한 항목은 `null` 로 남고, 그 상태에서 `hint` 는 `unknown` 이다.

### 어휘 일치 (Phase 1 접합)
- [SPEC] `scrape.js` 가 내는 `hint` 어휘는 `observation.js` 의 hint 화이트리스트와 정확히 일치한다 — `deriveState()` 의 `마지막 실패` 필드에서 `hint` 가 조용히 사라지면 FAIL.
- [SPEC] `scrape.js` 가 내는 `kind` 어휘는 Phase 1 이 정의한 5종 어휘와 일치한다.
- [DERIVED] 두 어휘의 일치는 테스트로 고정된다(한쪽만 바뀌면 실패한다).

### 유출 경계 — 🔒
- [SPEC] 수집한 본문 텍스트(`textHead`)와 전체 `url` 은 `err.detail` 안에만 존재하며, `deriveState()` 의 `fields`·`summary` 에 나타나지 않는다.
- [SPEC] `hint` 와 `kind` 는 고정 어휘에서만 나오므로 자유 텍스트·계정 이메일이 섞일 수 없다.

### 회귀 금지 (never-brick)
- [SPEC] `scrapeUsage()` 의 시그니처와 성공 시 반환값 형태는 변경되지 않는다 — 기존 호출부(`watch-once.js`·`watch-loop.js`)가 수정 없이 그대로 동작한다.
- [SPEC] 브라우저 연결 실패 시의 기존 오류 메시지 문구는 변경되지 않는다 — `kind` 속성만 추가된다.
- [SPEC] 성공 경로에서 브라우저를 닫지 않고 `disconnect` 만 하는 기존 동작(사용자의 Chrome 인스턴스 보호)이 유지된다.
- [SPEC] Phase 2 는 `lib/extract.js` 를 수정하지 않는다 — 🔒 이 NNN 은 앵커를 **구분**할 뿐 고치지 않는다.
- [SPEC] Phase 2 는 `lib/observation.js` · `lib/config.js` · `watch-once.js` · `watch-loop.js` 를 수정하지 않는다.
- [SPEC] STOP.json 의 경로·이름·스키마, `deriveDesired()` 의 임계 판정과 히스테리시스, 수동 STOP 우선 규칙은 변경되지 않는다.

### 검증 하네스
- [SPEC] `node p-bellows/test/run-all.js` 가 Phase 1·2 테스트를 모두 실행하고 종료 코드 0 으로 끝난다. Chrome·네트워크 없이 완주한다.
- [SPEC] 새 의존성을 추가하지 않는다 — `node:test`/`node:assert` 만 쓰고 `npm` 을 호출하지 않는다.
- [DERIVED] `require('../lib/scrape.js')` 가 브라우저 드라이버를 로드하지 않고 성공한다(puppeteer 지연 로드) — 순수 판정 경로는 `node_modules/puppeteer` 없이도 검증된다.
- [DERIVED] `p-bellows` 의 `.js` 파일에서 `claude` grep 매칭은 도메인 URL 상수 한 곳으로 제한되며, Phase 2 가 그 개수를 늘리지 않는다.
