## Phase 1 Acceptance Criteria

Phase 1 은 `lib/thresholds.js` **순수 모듈**이다. HTTP·파일·시계를 만지지 않으므로
아래 기준은 전부 함수 호출 수준에서 검증 가능하다. (상태 코드는 반환 객체의 `status` 필드,
거부 사유는 `reason` 필드로 확인한다 — 실제 HTTP 전송은 Phase 2/3.)

### 순수성·모듈 형태
- [DERIVED] `lib/thresholds.js` 는 `validateThresholdRequest`, `mergeIntoConfig`, `formatThresholdLog`, `THRESHOLD_KEYS`, `ALLOWED_KEYS` 를 내보낸다.
- [SPEC] 모듈은 `fs`/`http`/`net` 을 require 하지 않고 `Date.now()` 를 호출하지 않는다. 현재 시각은 `nowMs` 인자로만 들어온다 (작업 지시서 "phase 1 = **순수 함수**").
- [SPEC] `claude` 문자열이 이 파일에 등장하지 않는다 (프로젝트 전역 제약).

### 방향 판정 (tighten / loosen)
- [SPEC] 요청 병합 결과의 `weekly_stop` 과 `session_stop` 이 **둘 다 현재 적용값보다 커지지 않으면** `direction === 'tighten'`.
- [SPEC] `weekly_stop` 또는 `session_stop` 중 **어느 한쪽이라도 커지면** `direction === 'loosen'`.
- [SPEC] 적용값 `{99,70,99,75}` 에 `{weekly_stop:85, session_stop:90}` → `direction === 'tighten'`, `ok === true`.
- [DERIVED] 요청값이 적용값과 **완전히 동일**하면 `direction === 'tighten'` (커지지 않았으므로).
- [DERIVED] `weekly_release`/`session_release` 만 바뀌는 요청은 `*_stop` 이 그대로이므로 `direction === 'tighten'`.

### 🔒 무르기는 만료 없이는 거부 — 이 NNN 의 본체
- [SPEC] 적용값 `{85,70,90,75}` 에 `{weekly_stop:99}` 를 `expires_at` 없이 주면 `ok === false`, `status === 400`, `reason === 'loosen-requires-expiry'`. **성공(`ok:true`)이 나오면 Phase 1 은 실패다.**
- [SPEC] 같은 무르기에 **미래** `expires_at`(ISO8601)을 주면 `ok === true`, `direction === 'loosen'`, 반환 `expiresAt` 이 그 값과 동일.
- [SPEC] 같은 무르기에 **과거** `expires_at` 을 주면 `ok === false`, `status === 400` (사유 `expiry-in-past`).
- [SPEC] `expires_at` 이 파싱 불가한 문자열이면 `ok === false`, `status === 400` (사유 `invalid-expiry`).
- [DERIVED] 요청이 `expires_at` 을 생략했더라도 **기존 설정의 `expires_at` 이 미래**이면 무르기가 허용되고, 반환 `expiresAt` 은 그 기존 값이다.
- [DERIVED] 요청이 `expires_at` 을 생략했고 기존 값이 `null` 이거나 이미 과거이면 무르기는 `loosen-requires-expiry` 로 거부된다.
- [DERIVED] `expires_at: null`(명시적 해제)은 병합 결과의 두 `*_stop` 이 모두 `HARD_DEFAULTS`(85/90) 이하일 때만 허용되고, 그렇지 않으면 `400 loosen-requires-expiry` 로 거부된다.
- [SPEC] `loosen-requires-expiry` 거부의 `error` 문구는 "영구 변경은 코드의 하드 기본값 자리이고 이 파일은 임시 덮어쓰기용"이라는 사실을 담는다.

### 🔒 히스테리시스 불변식
- [SPEC] 병합 결과에서 `weekly_stop > weekly_release` 가 아니면 `ok === false`, `status === 400`, `reason === 'hysteresis-violation'`.
- [SPEC] 병합 결과에서 `session_stop > session_release` 가 아니면 동일하게 거부된다.
- [SPEC] 적용값 `weekly_release: 70` 상태에서 `{weekly_stop: 60}` 만 보내면 (요청 자체에는 release 가 없어도) 병합 결과로 판정해 400 `hysteresis-violation` 이 된다.
- [DERIVED] `stop === release` (예: 70/70)도 위반으로 거부된다 — 등호에서는 해제선이 열리지 않는다.

### 값·키 검증
- [SPEC] 정수가 아닌 임계값(`85.5`), 숫자가 아닌 값(`"85"`, `null`, `true`)은 `400` (사유 `invalid-value`).
- [SPEC] `< 0` 또는 `> 100` 인 임계값은 `400` (사유 `invalid-value`).
- [SPEC] `ALLOWED_KEYS`(4개 임계 키 + `expires_at`) 밖의 키가 하나라도 있으면 `400`, `reason === 'unknown-key'`. 조용히 무시하지 않는다.
- [DERIVED] `enabled` 나 `control` 을 본문에 넣는 것도 `unknown-key` 로 거부된다 (012 범위 밖).
- [DERIVED] 본문이 `null`·배열·객체 아님이면 `400 invalid-body`.
- [DERIVED] 본문이 빈 객체 `{}` 이면 `400 invalid-body` — 아무것도 바꾸지 않는 쓰기는 기록만 더럽힌다.

### 부분 요청
- [SPEC] `{weekly_stop: 85}` 만 보내면 반환 `next` 의 나머지 3개(`weekly_release`·`session_stop`·`session_release`)가 적용값과 **동일**하다.
- [SPEC] 반환 객체는 변경 전 4개 값을 `previous` 로, 변경 후 4개 값을 `next` 로 **모두** 담는다.

### 🔒 병합 — 다른 키를 날리지 않는다
- [SPEC] `mergeIntoConfig({enabled:false, control:{port:3999, authToken:'t'}, note:'x'}, next, expiresAt)` 의 결과에 `enabled === false`, `control.port === 3999`, `control.authToken === 't'`, `note === 'x'` 가 그대로 남는다.
- [SPEC] 결과의 `thresholds` 는 `next` 의 4개 값과 정확히 일치한다.
- [SPEC] 결과의 `expires_at` 은 인자로 받은 값과 일치한다 (`null` 이면 `null` 로 저장).
- [DERIVED] `mergeIntoConfig` 는 입력 `rawConfig` 와 그 하위 객체를 변형하지 않는다 — 호출 전후로 원본이 깊은 수준에서 동일하다.
- [DERIVED] `rawConfig.thresholds` 가 없거나 객체가 아니어도 결과에는 `next` 4개가 온전히 들어간다.

### 🔒 로그 줄 — 005 의 파서를 깨우지 않는다
- [SPEC] `formatThresholdLog` 의 출력은 `[thresholds] ` 로 시작하고 `tighten`/`loosen` 과 변경된 축의 `<key> <from>-><to>`, 그리고 `expires_at=<iso|none>` 을 포함한다.
- [SPEC] 생성된 로그 줄에 ISO 타임스탬프를 앞에 붙여 `parseLogTail([line])` 에 넣으면 `null` 이 반환된다 — 성공 폴로도 실패 폴로도 오인되지 않는다.
- [SPEC] 로그 줄에 `session=`·`weekly=` 형태의 토큰과 `%` 문자가 등장하지 않는다.
- [DERIVED] 변경되지 않은 축은 로그 줄에 나열되지 않는다.

### 🔒 회귀 없음
- [SPEC] `lib/config.js`·`lib/observation.js`·`lib/control-server.js`·`lib/logparse.js`·`watch-loop.js` 는 Phase 1 에서 수정되지 않는다.
- [SPEC] `node p-quaestor/test/run-all.js` 의 기존 전체 테스트가 하나도 깨지지 않는다 (005 의 26일 fixture 테스트 포함).

## Phase 2 Acceptance Criteria

Phase 2 는 Phase 1 의 순수 모듈을 HTTP·파일·로그·스냅샷에 **배선**한다.
아래 기준은 서버 인스턴스 수준에서 검증 가능하다 (실포트 왕복 회귀 검증 전체는 Phase 3).

### 라우팅
- [SPEC] `PUT /api/thresholds` 경로가 존재한다 — 404 가 아니다.
- [DERIVED] `/api/thresholds` 에 `PUT` 이외의 메서드로 오면 `405`.
- [DERIVED] `PUT /api/thresholds` 는 `getSnapshot()` 을 호출하지 않는다 — 관측 상태와 무관한 경로다.

### 🔒 쓰기는 토큰이 있어야 한다 — 기본 거부
- [SPEC] `control.authToken` **미설정** 상태에서 `PUT /api/thresholds` → `403`, `reason === 'write-requires-token'`.
- [SPEC] 같은(토큰 미설정) 상태에서 `GET /api/status` 는 여전히 `200` 이다 — 읽기 정책은 영향받지 않는다.
- [SPEC] 토큰 설정 + 잘못된/없는 `Authorization: Bearer` → `401`. 401 이 403 보다 항상 먼저 결정된다.
- [SPEC] 토큰 설정 + 올바른 Bearer → 검증 단계로 진행한다.
- [DERIVED] `isAuthorized()` 의 기존 동작(토큰 미설정 → 통과)은 수정되지 않는다. 403 검사는 PUT 핸들러 안에만 존재한다.

### 🔒 무르기는 만료 없이는 거부 — HTTP 왕복에서도 성립
- [SPEC] 적용값 `{85,70,90,75}` 에 `{"weekly_stop":99}` 를 `expires_at` 없이 PUT → `400`, `reason === 'loosen-requires-expiry'`. **`200` 이 나오면 이 Phase 는 실패다.**
- [SPEC] 같은 무르기에 **미래** `expires_at` 을 붙이면 `200`, `direction === 'loosen'`, 파일에 그 `expires_at` 이 저장된다.
- [SPEC] 같은 무르기에 **과거** `expires_at` → `400`.
- [SPEC] 조이기(`99→85`, 토큰 설정 상태) → `200`, `direction === 'tighten'`, 파일의 `thresholds` 에 새 값이 반영된다.
- [DERIVED] 거부(4xx/5xx) 시 설정 파일은 **한 바이트도 바뀌지 않는다** — 검증이 파일 쓰기보다 먼저다.

### 검증 위임
- [SPEC] 히스테리시스 위반 조합(예: `weekly_stop 60`, 기존 `weekly_release 70`) → `400`.
- [SPEC] `ALLOWED_KEYS` 밖의 키가 포함되면 → `400`, `reason === 'unknown-key'`.
- [DERIVED] `enabled`·`control` 을 본문에 넣으면 `unknown-key` 로 400 이다 (012 범위 밖).
- [DERIVED] `lib/control-server.js` 는 방향 판정·범위 검사·히스테리시스 검사를 **재구현하지 않고** `validateThresholdRequest()` 에 위임한다.
- [DERIVED] 현재 시각은 핸들러에서 한 번 읽어 `nowMs` 로 주입한다 — 검증 모듈은 시계를 읽지 않는다.
- [DERIVED] 본문이 JSON 으로 파싱되지 않으면(빈 본문 포함) `400`, `reason === 'invalid-json'`.
- [DERIVED] 본문이 상한(64KiB)을 넘으면 `413`, `reason === 'body-too-large'`.

### 🔒 기준선은 `readConfig()` 의 결과다
- [SPEC] 방향 판정의 기준선은 `readConfig(configPath).thresholds` 다 — 파일 원문 값이 아니다.
- [SPEC] `lib/config.js` 의 `isExpired` 는 재구현되지 않는다 (`readConfig` 를 그대로 호출한다).
- [DERIVED] 파일의 `expires_at` 이 이미 과거여서 하드 기본값으로 동작 중이면, 파일 원문보다 큰 값이라도 하드 기본값 대비 상승이면 `loosen` 으로 판정된다.

### 🔒 파일 쓰기 — 원자적이고, 다른 키를 보존한다
- [SPEC] 쓰기 후 파일의 `enabled` 와 `control.*` 가 **보존**된다.
- [SPEC] 파일에 있던 그 밖의 키도 보존된다 (병합 대상은 `thresholds` 4개와 `expires_at` 뿐).
- [SPEC] 부분 요청(`weekly_stop` 만) 후 파일의 나머지 3개 임계값이 **변하지 않는다**.
- [SPEC] 쓰기는 임시 파일 → `rename` 방식이다 (`writeStopJsonAtomic` 과 같은 관례). 대상 경로에 부분 기록된 내용이 남지 않는다.
- [DERIVED] 설정 파일이 없으면 `{}` 에서 시작해 새로 만든다.
- [DERIVED] 설정 파일이 있는데 JSON 파싱 불가면 `500`, `reason === 'config-unreadable'` 이고 **덮어쓰지 않는다**.
- [DERIVED] UTF-8 BOM 이 붙은 설정 파일도 정상적으로 읽어 병합한다 (PowerShell 5.1 이 BOM 을 붙인다).
- [DERIVED] 쓰기 자체가 실패하면 `500`, `reason === 'write-failed'`.

### 🔒 never-brick
- [SPEC] 쓰기 실패가 감시 루프를 멈추지 않는다 — PUT 핸들러의 어떤 경로도 폴 루프에 예외를 전파하지 않는다.
- [SPEC] `startControlServer()` 는 여전히 reject 하지 않고 throw 하지 않는다.
- [DERIVED] `onConfigChange` 콜백이 예외를 던져도 응답은 `200` 이다 — 파일은 이미 커밋됐다.

### 기록
- [SPEC] 임계값 변경이 성공하면 로그에 `[thresholds]` 로 시작하는 줄이 **정확히 한 줄** 남는다 (전→후 값, 방향, `expires_at` 포함).
- [SPEC] 그 줄에 ISO 타임스탬프가 붙은 상태로 `parseLogTail` 에 들어가도 성공 폴/실패 폴로 오인되지 않는다.
- [SPEC] 기존 로그 줄 형식(`[poll start]`·`session=NN%`·`[restore]`·`[stop]`·`[config]`·`[control]`)은 한 글자도 바뀌지 않는다.

### 즉시 반영
- [SPEC] 쓰기 직후(다음 폴을 기다리지 않고) `GET /api/status` 의 `usage.thresholds` 가 **새 값**을 낸다.
- [DERIVED] 반영 경로는 `onConfigChange` 콜백 → watch-loop 의 `readConfig()` 재호출이다. 제어 서버가 watch-loop 의 변수를 직접 대입하지 않는다.
- [DERIVED] `configPath`/`onConfigChange` 는 선택적 옵션이다 — 주지 않아도 서버는 기존과 동일하게 뜬다.
- [DERIVED] `configPath` 없이 뜬 서버에 PUT 하면 `500`, `reason === 'config-unavailable'` (단, 토큰 미설정이면 403 이 먼저다).

### 계약 버전
- [SPEC] `GET /api/health` 의 `contracts["supervised-v1"] === "1.3.0"`.
- [SPEC] `package.json` 의 `version` 은 바뀌지 않는다 — 소프트웨어 축과 계약 축을 섞지 않는다.
- [DERIVED] `/api/health` 는 여전히 `getSnapshot()` 을 호출하지 않는다.

### 🔒 회귀 없음
- [SPEC] `GET /api/status` 의 `fields`·`summary`·`state`·`allowance`·`usage` 응답 형태가 불변이다.
- [SPEC] `GET /` 상태 페이지는 읽기 전용이다 — 편집 UI 나 폼이 추가되지 않는다.
- [SPEC] `POST /api/stop` 은 여전히 `501` 이다.
- [SPEC] `deriveDesired()` 와 STOP.json 의 위치·이름·스키마·수동 STOP 우선 규칙이 바뀌지 않는다.
- [SPEC] `lib/thresholds.js`·`lib/config.js`·`lib/observation.js`·`lib/status-page.js`·`lib/logparse.js` 는 Phase 2 에서 수정되지 않는다.
- [SPEC] 토큰 비교에 `===`/`==`/`startsWith`/`indexOf` 를 쓰지 않는 기존 규율이 유지된다.
- [SPEC] `claude` 문자열이 새로 추가된 `.js` 코드에 등장하지 않는다.
- [SPEC] 새 npm 의존성이 추가되지 않는다 (`node:fs` 등 코어 모듈만).
- [SPEC] `node p-quaestor/test/run-all.js` 의 기존 전체 테스트가 하나도 깨지지 않는다 (005 의 26일 fixture 테스트 포함).
