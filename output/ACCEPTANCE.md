# ACCEPTANCE — 004 Phase 1

대상: `p-bellows/lib/control-server.js`(신규) · `p-bellows/test/control-server.test.js`(신규)
전제: 모든 기준은 **hermetic** 하게 검증된다 — Chrome·claude.ai·Foreman·네트워크 외부 접속 없이 만족해야 한다.
🔒 검증은 **실제 포트를 열고 실제 HTTP 요청**을 보내 확인한다. 주입 픽스처만으로는 이 절을 만족시키지 못한다.

시그니처(참조):
`startControlServer(opts)` → `{ started, port, address, error, close }`,
`opts = { port, getSnapshot, version, startedAt, authToken, onLog }`,
`getSnapshot()` → `{ observation, ctx }` (003 의 `deriveState(obs, ctx, now)` 입력).

## Phase 1 Acceptance Criteria

### 바인딩 · 기동 계약
- [SPEC] 리스너의 바인딩 주소가 `127.0.0.1` 이다 — 실제로 띄운 서버의 `server.address().address === '127.0.0.1'` 이고, 반환값의 `address` 도 `'127.0.0.1'` 이다.
- [SPEC] `lib/control-server.js` 소스에 `'0.0.0.0'` · `'::'` · LAN 주소 리터럴이 존재하지 않으며, 바인딩 호스트는 `opts` 로 덮어쓸 수 없다(호스트를 받는 옵션 키가 없다).
- [SPEC] 이미 점유된 포트로 기동을 시도하면 **호출자에게 예외가 새지 않는다** — `startControlServer()` 가 reject 하지 않고 `started === false` 로 resolve 하며, 그 이후 호출자 코드가 계속 진행된다.
- [SPEC] `started === false` 인 경우에도 반환 객체의 `close` 는 함수이며, 호출해도 throw 하지 않는다(no-op).
- [SPEC] 기동 실패 시 `error` 는 비어 있지 않은 문자열이다 — 실패를 조용히 삼키지 않는다.
- [SPEC] 테스트가 `close()` 를 호출한 뒤 해당 포트가 다시 바인딩 가능하며, 테스트 종료 시 프로세스가 매달리지 않는다(열린 핸들이 남지 않는다).
- [DERIVED] `opts.port` 를 생략하면 `3210` 을 사용하고, `opts.port === 0` 이면 OS 가 할당한 실제 포트를 반환값 `port` 에 담는다.
- [DERIVED] `EADDRINUSE` 로 인한 실패 이후 늦게 도착하는 `server.on('error')` 이벤트가 이미 해결된 Promise 를 다시 해결하려 시도해도 프로세스가 죽지 않는다(중복 해결 방지 래치가 있다).

### `GET /api/health`
- [SPEC] 200 을 반환하고 본문 JSON 의 `id === 'quaestor'` 다. (`'bellows'` 이면 실패)
- [SPEC] 본문에 `ok === true` · `version` · `startedAt` 이 모두 존재한다.
- [SPEC] `version` 은 `p-bellows/package.json` 의 `version` 값과 문자열로 일치한다.
- [SPEC] `startedAt` 은 `Date.parse()` 로 해석 가능한 ISO-8601 문자열이며, 같은 서버 인스턴스에 두 번 요청해도 값이 변하지 않는다(기동 시각 상수).
- [SPEC] `/api/health` 는 관측 상태를 읽지 않는다 — 이 엔드포인트만 호출했을 때 `getSnapshot()` 호출 횟수가 0 이다. (🔒 HTTP 생존과 측정 건강을 합치지 않는다)

### `GET /api/status`
- [SPEC] 200 을 반환하고 본문에 `summary` · `state` · `fields` 가 모두 존재한다.
- [SPEC] `state` 는 `deriveState()` 가 반환한 값과 정확히 동일하다 — 이 계층에서 재판정·완화·승격이 없다. 관측 상태가 `crit` 을 만드는 픽스처(연속 실패 다수 / 성공 이력 없음)에서 응답 `state` 가 `'crit'` 이고 `'ok'` 가 아니다.
- [SPEC] `summary` 와 `fields` 도 `deriveState()` 반환값과 깊은 비교로 동일하다 — 문자열 재조립·필드 추가/삭제/재정렬이 없다.
- [SPEC] 본문에 `updatedAt` 이 있고 `Date.parse()` 로 해석 가능한 ISO-8601 문자열이다.
- [SPEC] 부작용이 없다 — `GET /api/status` 를 두 번 호출해도 `getSnapshot()` 이 반환한 관측 객체의 `totalPolls`·`totalFailures`·`consecutiveFailures`·`lastSuccessAt` 이 호출 전후로 동일하다.
- [SPEC] 부작용이 없다 — `GET /api/status` 호출이 스크래핑(`scrapeUsage`)을 유발하지 않고, STOP.json 을 읽거나 쓰거나 지우지 않는다(테스트가 넘긴 임시 경로의 파일 mtime·존재 여부가 불변이며, 서버 코드 경로에서 STOP 관련 함수가 호출되지 않는다).
- [SPEC] 응답 JSON 전체를 문자열로 만들었을 때 `authToken` 의 값 · `.profile` · `cookie` 가 **포함되지 않는다** (대소문자 무시). 003 의 `fields` 화이트리스트를 이 계층이 우회하지 않는다.
- [SPEC] `getSnapshot()` 이 throw 하거나 사용 불가한 값을 반환하면 **`ok: true` 로 응답하지 않는다** — 정보 부재를 성공으로 내지 않는다.

### 라우팅 · 응답 형식
- [SPEC] 두 엔드포인트의 응답 본문은 유효한 JSON 이며, 스택 트레이스·HTML 오류 페이지·내부 파일 경로가 본문에 노출되지 않는다.
- [SPEC] 핸들러 내부에서 예외가 발생해도 프로세스가 종료되지 않고 서버는 계속 응답 가능한 상태로 남는다(예외를 던지는 `getSnapshot` 으로 한 번 호출한 뒤 `/api/health` 가 여전히 200 이다).
- [DERIVED] 알 수 없는 경로는 404 · `{ ok: false, ... }` 로 응답한다.
- [DERIVED] `/api/health`·`/api/status` 에 GET 이 아닌 메서드로 요청하면 405 · `{ ok: false, ... }` 로 응답한다.
- [DERIVED] `POST /api/stop` 은 501 로 응답하며 본문에 미구현이 의도적임을 나타내는 표시가 있다(🔒 Phase 2 에서 사유를 코드 주석·`PROJECT_INTENT.md` 에 명문화한다).
- [DERIVED] 쿼리스트링은 무시한다 — `/api/status?x=1` 의 응답 형태가 `/api/status` 와 동일하다.
- [DERIVED] 응답 헤더에 `Content-Type: application/json; charset=utf-8` 과 `Cache-Control: no-store` 가 있다.

### 경계 · 무변경 보장
- [SPEC] `lib/observation.js` 는 이 Phase 에서 수정되지 않는다 — `deriveState()` 를 재구현하거나 임계값을 이 파일에 복제하지 않는다(`control-server.js` 소스에 `85`/`90`/`70`/`75` 임계 리터럴과 `state` 판정 분기가 없다).
- [SPEC] `watch-loop.js` 의 `deriveDesired()` · `writeStopJsonAtomic()` · `resolveStopDir()` · STOP.json 스키마가 무변경이다(Phase 1 은 `watch-loop.js` 를 수정하지 않는다).
- [SPEC] `lib/control-server.js` 는 Foreman 을 알지 않는다 — `require` 대상에 Foreman 관련 모듈이 없고, 소스에 Foreman 경로가 하드코딩돼 있지 않다.
- [SPEC] 의존성이 늘지 않는다 — `package.json` 의 `dependencies` 는 `puppeteer` 하나로 유지되고, `control-server.js` 는 `node:http`(및 Phase 2 의 `node:crypto`) 등 내장 모듈만 사용한다.
- [SPEC] `lib/control-server.js` 에 `claude` 문자열이 grep 매칭되지 않는다(도메인 URL 예외 없음 — 이 파일은 URL 을 쓰지 않는다).
- [SPEC] `node p-bellows/test/run-all.js` 가 기존 58개 테스트를 포함해 전부 통과하고 종료 코드 0 이다 — 기존 기준의 삭제·완화가 없다.

---

# ACCEPTANCE — 004 Phase 2

대상: `p-bellows/lib/control-server.js`(수정) · `p-bellows/lib/config.js`(수정) ·
`p-bellows/test/control-server.test.js`(증분) · `PROJECT_INTENT.md`(기록)
전제: 모든 기준은 **hermetic** 하게 검증된다 — Chrome·claude.ai·Foreman·외부 네트워크 없이 만족해야 한다.
🔒 인증 기준은 **실제 포트를 열고 실제 HTTP 요청**을 보내 확인한다.

## Phase 2 Acceptance Criteria

### 인증 — `Authorization: Bearer`
- [SPEC] `authToken` 이 설정된 서버에 `Authorization` 헤더 **없이** `GET /api/status` 를 요청하면 **401** 이다.
- [SPEC] `authToken` 이 설정된 서버에 **틀린** 토큰을 `Bearer` 로 보내면 **401** 이다.
- [SPEC] `authToken` 이 설정된 서버에 **맞는** 토큰을 `Bearer` 로 보내면 **200** 이다.
- [SPEC] `authToken` 이 **설정되지 않은** 서버(현재 실측 상태)에 헤더 없이 요청하면 **200** 이다 — 기본값을 인증 필수로 바꾸지 않는다.
- [SPEC] 401 응답 본문에 **기대 토큰 값이 포함되지 않는다.** 토큰의 길이·접두사·일부 문자·해시 등 값을 역추론할 수 있는 어떤 파생물도 없다.
- [SPEC] 401 응답 본문의 `ok` 가 **`false`** 다 — 인증 실패를 `ok: true` 로 내지 않는다(정보 부재는 성공이 아니다).
- [SPEC] "헤더 없음" 과 "값 불일치" 의 응답이 **구분 불가능**하다 — 상태 코드와 본문이 동일하다.
- [SPEC] 토큰 비교는 `crypto.timingSafeEqual` 로 이루어지며 **길이 무관**이다 — 기대 토큰과 길이가 크게 다른(예: 1자, 수백 자) 토큰을 보내도 예외가 새지 않고 500 이 아니라 **401** 로 답한다.
- [SPEC] `control-server.js` 소스에 토큰을 `===`/`==`/`!==`/`startsWith`/`indexOf` 로 비교하는 코드와, 비교 전에 길이로 분기하는 코드가 **없다** — 상수시간 경로가 유일하다.
- [SPEC] 인증 검사는 **라우팅보다 먼저** 실행된다 — 토큰이 설정된 상태에서 존재하지 않는 경로(예: `/api/nope`)를 요청하면 404 가 아니라 **401** 이다(경로 존재 여부를 누설하지 않는다).
- [SPEC] 인증 게이트는 `POST /api/stop` 에도 적용된다 — 토큰 설정 상태에서 헤더 없이 POST 하면 501 이 아니라 **401** 이다.
- [DERIVED] `Bearer` 스킴 비교는 대소문자를 무시한다(RFC 7235) — `bearer <token>` 도 통과한다.
- [DERIVED] 401 응답에 `WWW-Authenticate: Bearer` 헤더가 있고, 그 값에 파일 경로·토큰·계정이 들어 있지 않다.
- [DERIVED] `Basic` 등 다른 스킴이나 형식이 깨진 `Authorization` 헤더는 401 로 처리된다(500 이 아니다).

### `config.js` — `control` 블록
- [SPEC] `readConfig()` 는 어떤 입력(파일 없음 · 깨진 JSON · 잘못된 타입 · 만료)에도 **throw 하지 않는다** — never-brick 이 설정 경로에서도 유지된다.
- [SPEC] `readConfig()` 반환값에 `control.port`(number)와 `control.authToken`(string 또는 `null`)이 **항상 존재한다** — 파일이 없어도 하드 기본값으로 채워진다.
- [SPEC] 기존 필드 의미가 무변경이다 — `enabled` · `thresholds`(85/90/70/75 기본) · `expires_at` · `_parseError` · `_expired` 의 동작과 값이 이전과 동일하다(🔒 `deriveDesired()` 임계·히스테리시스에 영향 0).
- [DERIVED] 기본 포트는 `3210` 이고, 파일의 `control.port` 가 정수이며 `1..65535` 범위일 때만 덮어쓴다. 범위 밖·문자열·`NaN` 은 무시하고 기본값을 쓴다.
- [DERIVED] `control.authToken` 이 빈 문자열이거나 공백만이면 `null`(인증 없음)로 정규화된다.
- [DERIVED] 파일에 `control.authToken` 이 없고 최상위 `authToken` 만 있으면 그것을 인정하며, 둘 다 있으면 `control.authToken` 이 우선한다.
- [DERIVED] `expires_at` 만료 또는 JSON 파싱 실패 시 `control` 도 기본값으로 되돌아간다(토큰 없음 = 인증 꺼짐). 방어선은 `127.0.0.1` 바인딩이다.
- [DERIVED] 환경변수 `BELLOWS_CONTROL_PORT`·`BELLOWS_CONTROL_TOKEN` 로 기본값을 덮어쓸 수 있고, 파일 값이 있으면 파일이 우선한다.

### 비밀 미유출 (응답 전체 관점)
- [SPEC] 인증 성공·실패·404·405·501·500 **모든** 응답의 본문 전체 문자열에 설정된 `authToken` 값이 **포함되지 않는다**.
- [SPEC] 모든 응답 본문 전체 문자열에 `.profile` · `cookie` · `Authorization` 헤더 원문이 **포함되지 않는다**(대소문자 무시).
- [SPEC] 모든 응답 본문에 스택 트레이스 · 절대 파일 경로 · 설정 파일 경로 · 사용자 계정명이 없다.
- [SPEC] `getSnapshot()`/`deriveState()` 가 던진 예외 메시지가 응답 본문에 실리지 않는다 — 고정 문구로만 답한다.
- [DERIVED] 응답 헤더에도 토큰·경로가 없다(`Set-Cookie` 를 보내지 않는다).
- [DERIVED] `onLog` 로 남기는 인증 관련 로그에 수신 토큰·기대 토큰이 찍히지 않는다. 기동 로그는 값이 아니라 여부(`auth: enabled` / `auth: disabled`)만 남긴다.

### `POST /api/stop` — 의도적 미구현 명문화
- [SPEC] `POST /api/stop` 은 차단기를 끄지 않는다 — 호출해도 STOP.json 이 생성·수정·삭제되지 않고 `deriveDesired()` 경로가 실행되지 않는다.
- [SPEC] `control-server.js` 에 미구현 **사유**(계약이 확인 없는 호출을 허용하므로 안전장치를 이 경로에 붙이지 않는다)가 주석으로 남아 있다.
- [SPEC] `PROJECT_INTENT.md` 에 같은 결정과 근거가 기록돼 있다.
- [DERIVED] 인증을 통과한 `POST /api/stop` 은 501 이며 본문에 의도적 미구현임을 나타내는 표시가 있다.

### 경계 · 무변경 보장
- [SPEC] `lib/observation.js` 와 `lib/scrape.js` 는 이 Phase 에서 수정되지 않는다.
- [SPEC] `watch-loop.js` 는 이 Phase 에서 수정되지 않는다(배선은 Phase 3) — `deriveDesired()` · `writeStopJsonAtomic()` · `resolveStopDir()` · STOP.json 스키마 무변경.
- [SPEC] 🔒 바인딩은 여전히 `127.0.0.1` 고정이며 인증 도입이 이를 완화하지 않는다 — "토큰이 있으니 외부에 열어도 된다" 는 변경이 없다(`0.0.0.0`·`::` 리터럴 부재, 호스트 옵션 키 부재).
- [SPEC] 의존성이 늘지 않는다 — `package.json` 의 `dependencies` 는 `puppeteer` 하나이고, 새로 쓰는 것은 내장 `node:crypto` 뿐이다.
- [SPEC] `lib/control-server.js` · `lib/config.js` 에 `claude` 문자열이 grep 매칭되지 않는다.
- [SPEC] `lib/control-server.js` 는 Foreman 을 `require` 하지 않고 Foreman 경로를 하드코딩하지 않는다.
- [SPEC] Phase 1 의 모든 기준이 계속 만족된다 — `/api/health` 의 `id === 'quaestor'`, `/api/status` 의 `deriveState()` 무재판정·부작용 0, 인증 통과 후 응답 형태 불변.
- [SPEC] `node p-bellows/test/run-all.js` 가 기존 테스트를 포함해 전부 통과하고 종료 코드 0 이며, 프로세스가 매달리지 않는다(모든 테스트 서버가 `close()` 된다).

---

# ACCEPTANCE — 004 Phase 3

대상: `p-bellows/watch-loop.js`(수정 — 배선) · `p-bellows/test/watch-loop.test.js`(증분) ·
`p-bellows/test/control-server.test.js`(증분)
전제: 모든 기준은 **hermetic** 하게 검증된다 — Chrome·claude.ai·Foreman·외부 네트워크 없이 만족해야 한다.
🔒 `pollOnce()` 를 테스트에서 구동하지 않는다 — 이 기계의 실제 STOP.json·bellows.log 를 건드리기 때문이다
(설계 §9-7). 배선의 **동작**은 동일한 형태를 테스트 안에서 재구성해 실포트로 검증한다.

## Phase 3 Acceptance Criteria

### never-brick — 🔒 계기판이 차단기를 죽이지 않는다
- [SPEC] 컨트롤 서버 기동이 실패해도(포트 점유·바인딩 거부) 감시 루프 경로는 계속 진행된다 — 기동 호출 이후의 코드가 실제로 실행됨을 관측 가능한 방식(카운터·후속 호출)으로 확인한다.
- [SPEC] 기동 실패가 호출자에게 **예외로 새지 않는다** — 이미 점유된 포트로 시작을 시도해도 reject/throw 없이 `started === false` 를 돌려받는다.
- [SPEC] 기동 실패를 **조용히 삼키지 않는다** — `[control] listen failed: <사유>` 형태의 로그가 정확히 남는 경로가 존재한다.
- [SPEC] 기동 성공 시 `[control] listening on 127.0.0.1:<port>` 가 로그에 남는다(주입된 `onLog` 를 통해).
- [DERIVED] `startControlServer()` 호출부는 결과 분기와 `try/catch` 로 이중 방어되며, 어느 분기에서도 폴링 루프 진입을 건너뛰지 않는다.
- [DERIVED] 기동 로그는 토큰 값이 아니라 여부만 남긴다(`auth: enabled` / `auth: disabled (loopback only)`) — Phase 2 형식이 배선 후에도 유지된다.

### 모듈 로드 경계 (🔒 003 이 얻은 성질의 보존)
- [SPEC] `require('../watch-loop.js')` 가 **리스너를 열지 않는다** — 로드 시점의 `startControlServer` 호출 횟수가 `0` 이다(호출 카운터로 행동 검증).
- [SPEC] `require('../watch-loop.js')` 가 감시 루프를 시작하지 않고 반환한다 — `require.main === module` 가드가 유지된다(003 기준 무회귀).
- [SPEC] 테스트 전체가 끝난 뒤 프로세스가 매달리지 않는다 — 배선 때문에 남는 열린 핸들이 없다.
- [DERIVED] `startControlServer(` 호출은 `mainLoop()` 함수 본문 안에만 존재하고 모듈 최상위 실행 경로에 없다.

### 라이브 관측 — 🔒 기동 시점 값을 캡처하지 않는다
- [SPEC] `/api/status` 는 **매 요청마다 현재 관측 상태**를 읽는다 — 서버 기동 후 관측 변수를 재대입하면 다음 응답의 `state`·`summary`·`fields` 가 새 값을 반영한다(기동 직후 값이 고정되지 않는다).
- [SPEC] 관측이 정상에서 연속 실패 다수로 바뀌면 `/api/status` 의 `state` 가 `'crit'` 으로 바뀐다 — 🔒 측정이 죽었는데 `ok` 로 보이면 실패다.
- [SPEC] 첫 폴 이전(관측이 비어 있고 설정 캐시가 없는 상태)의 `/api/status` 는 `state !== 'ok'` 다 — 측정 전 초록불을 내지 않는다.
- [DERIVED] `getSnapshot` 은 값이 아니라 **함수**로 주입되며, 그 본문이 모듈 변수 `observation` 을 참조한다.

### `getSnapshot()` 부작용 없음 (🔒 C3)
- [SPEC] `/api/status` 처리 경로가 파일시스템에 접근하지 않는다 — 스냅샷 조립부에 `fs.*` 호출, `scrapeUsage` 호출, STOP.json 경로 참조가 없다.
- [SPEC] `/api/status` 를 여러 번 호출해도 STOP.json 이 생성·수정·삭제되지 않고, 폴링 횟수(`totalPolls`)·연속 실패 수가 변하지 않는다.
- [SPEC] 배선이 새로운 파일 I/O 를 만들지 않는다 — `lastStop` 은 `pollOnce()` 가 **이미 호출하는** `readStopJson()` 의 결과를 재사용할 뿐이며, `readStopJson()` 호출 지점이 늘지 않는다.

### `deriveState()` 입력(ctx) 전달
- [SPEC] 임계값 판정을 `watch-loop.js` 에서 다시 하지 않는다 — 배선 코드에 `85`/`90`/`70`/`75` 리터럴이나 `state` 판정 분기가 새로 추가되지 않는다(`deriveDesired()` 의 기존 본문은 별개이며 무변경).
- [DERIVED] 스냅샷의 `ctx` 는 `enabled`·`thresholds`·`stop`·`configSource` 를 담으며, 마지막 폴에서 관측한 값을 그대로 전달한다.
- [DERIVED] `stop` 값이 있으면 `/api/status` 의 `fields` 중 STOP 항목이 그것을 반영하고, `configSource: 'file'` 이면 설정 출처 필드가 파일임을 나타낸다.
- [DERIVED] 첫 폴 이전에는 `enabled` 기본값 `true`, `thresholds` 미지정(→ `observation.js` 의 기본값 적용), `stop: null`, `configSource: 'default'` 로 전달된다.
- [DERIVED] `control.port`·`control.authToken` 은 기동 시 1회 확정되며 폴마다 재적용되지 않는다(변경은 재시작). `enabled`·`thresholds` 는 폴마다 갱신되어 `/api/status` 에 반영된다.

### `config.js` env 우선순위 (Phase 2 잔여 항목의 자동화)
- [DERIVED] `BELLOWS_CONTROL_PORT`·`BELLOWS_CONTROL_TOKEN` 이 하드 기본값을 덮어쓰는 것이 **자동 테스트**로 확인된다(수동 `node -e` 검증에 의존하지 않는다).
- [DERIVED] 파일의 `control.port`·`control.authToken` 이 존재하면 환경변수보다 우선한다.
- [DERIVED] 테스트는 `process.env` 를 변경한 뒤 원상 복구하여 다른 테스트에 영향을 주지 않는다.

### 🔒 불변 · 무회귀 보장
- [SPEC] `deriveDesired()` 의 임계 판정과 히스테리시스, STOP.json 의 위치·이름·스키마, 수동 STOP(`source === 'manual'`) 우선 규칙이 **무변경**이다.
- [SPEC] `resolveStopDir()` · `readStopJson()` · `writeStopJsonAtomic()` · `isValidUsage()` 의 본문이 무변경이며, `resolveStopDir()` 을 주입 가능하게 바꾸지 않는다.
- [SPEC] `lib/observation.js` · `lib/scrape.js` · `lib/control-server.js` · `lib/config.js` 는 이 Phase 에서 수정되지 않는다(배선 Phase 이므로 계약면은 이미 완성돼 있다).
- [SPEC] 바인딩은 여전히 `127.0.0.1` 고정이다 — 배선이 호스트를 설정으로 뚫지 않는다(`watch-loop.js` 가 host 를 넘기지 않는다).
- [SPEC] `POST /api/stop` 은 여전히 미구현이며 배선으로도 활성화되지 않는다 — 호출해도 STOP.json 이 변하지 않는다.
- [SPEC] `watch-loop.js` 에 `claude` 문자열이 grep 매칭 0건으로 유지된다.
- [SPEC] 의존성이 늘지 않는다 — `package.json` 의 `dependencies` 는 `puppeteer` 하나이며, 배선은 내장 모듈과 기존 로컬 모듈만 쓴다.
- [SPEC] `watch-loop.js` 는 Foreman 을 `require` 하지 않고 Foreman 경로·포트를 하드코딩하지 않는다 — 의존 방향이 뒤집히지 않는다.
- [SPEC] Phase 1·2 의 모든 기준이 계속 만족된다 — `/api/health` 의 `id === 'quaestor'`, 인증 게이트, 비밀 미유출, `deriveState()` 무재판정.
- [SPEC] `node p-bellows/test/run-all.js` 가 기존 110개를 포함해 전부 통과하고 종료 코드 0 이다 — 기존 기준의 삭제·완화가 없다.

### USER_GATE (사람 확인 — 자동 테스트로 대체 불가)
- [SPEC] 감시자를 실제로 띄운 뒤 `http://127.0.0.1:3210/api/status` 를 열면 현재의 고장난 측정 상태가 `"state": "crit"` 으로 보인다. 🔒 여기서 `ok` 가 나오면 계약을 구현하면서 3주 침묵을 새 층에 재현한 것이다.
- [SPEC] `http://127.0.0.1:3210/api/health` 는 `{"ok":true,"id":"quaestor",...}` 로 응답한다 — `/api/status` 가 `crit` 이어도 `/api/health` 는 `ok` 다(두 값은 다른 질문에 답한다).

---

# ACCEPTANCE — 004 Phase 4

대상: `p-bellows/test/control-server.test.js`(증분) · `CONTINUATION.md`(Synology, 인수인계 기록)
🔒 **검증·문서 Phase 다.** `lib/*` 와 `watch-loop.js` 의 동작 코드는 수정되지 않는다(설계 §10-2).
전제: 모든 기준은 **hermetic** 하게 검증된다 — Chrome·claude.ai·Foreman·외부 네트워크 없이 만족해야 한다.
🔒 갚으려는 공백: 지금까지 실포트 검증은 전부 `port: 0` 이었고, 계약이 못 박은
`http://127.0.0.1:3210` 은 한 번도 실제로 바인딩된 적이 없다(설계 §10-0).

## Phase 4 Acceptance Criteria

### 조립 경로 종단 검증 (readConfig → startControlServer → 계약 주소)

- [SPEC] 계약(`_guides\SUPERVISED_TOOL_CONTRACT.md`)이 지정한 기본 제어 주소는 `http://127.0.0.1:3210` 이다 — `readConfig()` 가 설정 파일 부재 시 내놓는 `control.port` 가 `3210` 이고, 그 값을 그대로 `startControlServer()` 에 넘겼을 때 기동에 성공하면 `port === 3210` · `address === '127.0.0.1'` 이다.
- [SPEC] 테스트에 넘기는 포트 값은 **`readConfig()` 반환값에서 온다** — 테스트가 `3210` 리터럴로 직접 서버를 띄우지 않는다(계약 리터럴은 기대값 쪽에만 등장한다). 검증 대상은 "3210 에서 뜨는가" 가 아니라 "설정 경로가 계약 주소를 만들어내는가" 다.
- [SPEC] 기동에 성공한 경우 `GET /api/health` 가 200 이고 `id === 'quaestor'` 이며, `GET /api/status` 가 200 이고 `summary`·`state`·`fields`·`updatedAt` 이 모두 존재한다 — 임의 포트가 아니라 **계약이 지정한 주소에서** 확인된다.
- [SPEC] 계약 기본 포트가 이미 점유돼 있어도(감시자가 실제로 돌고 있는 경우) **예외가 새지 않고** `started === false` + 비어 있지 않은 `error` 로 resolve 하며, 그 이후 테스트 코드가 계속 실행된다 — 제품이 정상 동작 중일 때 검증이 깨지는 형태를 만들지 않는다.
- [SPEC] 위 두 갈래(`started === true` 의 계약 형식 왕복 / `started === false` 의 무예외 보고) 중 **어느 쪽도 아닌 결과**(throw · `started` 부재 · 성공했는데 포트·주소 불일치)는 실패로 판정된다.
- [SPEC] 이 테스트는 `try/finally` 로 `close()` 를 보장해 계약 기본 포트를 붙잡은 채 끝나지 않는다 — 붙잡으면 다음 실행이 전부 `started:false` 가 되어 이 검증이 스스로를 무력화한다.
- [DERIVED] `close()` 이후 같은 포트를 다시 바인딩할 수 있음을 확인해 핸들 누수를 배제한다.
- [DERIVED] 계약 기본 포트를 쓰는 테스트는 파일 내 마지막에 배치되어 앞선 임의 포트(`port: 0`) 테스트들과 자원이 겹치지 않는다.

### 계약 원문 대조 · 인수인계 기록

- [SPEC] 계약 §"도구 쪽 체크리스트" 전 항목에 대해 **충족 / 의도적 미구현 / 대상 밖**이 1:1 로 명시된 대조표가 산출물로 남는다 — 판정되지 않은 항목이 없다.
- [SPEC] `POST /api/stop` 은 대조표에서 **의도적 미구현**으로 분류되고 그 근거(계약이 확인 없는 호출을 허용하므로 안전장치를 이 경로에 붙이지 않는다)가 함께 기록된다 — "미구현" 으로만 적어 다음 사람이 결손으로 오해하게 두지 않는다.
- [SPEC] 계약 예시와 이 구현의 이탈점 두 곳이 기록된다: `supervised[].id` 가 `"bellows"` 가 아니라 **`"quaestor"`** 라는 것, 그리고 토큰 출처가 `control.authToken` 우선(최상위 `authToken` 폴백)이라는 것. 🔒 Foreman 쪽 절반이 잘못된 키로 붙어 조용히 빈 칸을 그리는 것을 막는 기록이다.
- [SPEC] 🔒 `_guides\SUPERVISED_TOOL_CONTRACT.md` 는 수정되지 않는다 — 계약은 Foreman 이 소유하고 대상이 맞춘다. "구현 현황" 표가 이 제품을 아직 미구현으로 적고 있어도 이쪽에서 고치지 않는다(의존 방향 불변).
- [SPEC] Foreman 저장소·설정(`foreman-config.json` 의 `supervised[]`)은 이 Phase 에서도 건드리지 않는다 — 대조표에 **대상 밖**으로 분류될 뿐이다.
- [DERIVED] 기록 위치는 Synology 스펙 폴더의 `CONTINUATION.md` 이며, 계약 기본 주소·포트/토큰의 기동 시 1회 확정 성질(변경은 재시작)·`deploy.json` 반영이 사람 몫이라는 점이 함께 남는다.

### 계약 §"부재 규칙" 중 이 제품이 지는 몫

- [SPEC] 모든 응답 경로(200 · 401 · 404 · 405 · 500 · 501)의 본문이 **항상 파싱 가능한 JSON** 이다 — HTML 오류 페이지·스택 트레이스·빈 본문이 나오는 경로가 없다. (계약: "응답 JSON 이 깨짐" 은 Foreman 이 형식 오류로 표시해야 하는 상황이며, 이 제품이 그 상황을 만들지 않는다)
- [SPEC] 컨트롤 서버가 아예 뜨지 못한 상태에서도 감시 루프는 계속 돈다 — Phase 3 의 never-brick 기준이 이 Phase 에서도 유지된다(무회귀).

### 🔒 무회귀 · 경계 (검증 Phase 의 자기 구속)

- [SPEC] `p-bellows/lib/control-server.js` · `lib/config.js` · `lib/observation.js` · `lib/scrape.js` · `watch-loop.js` 가 이 Phase 에서 **수정되지 않는다** — 검증 Phase 가 동작 코드를 고치면 검증의 의미가 사라진다. 테스트를 통과시키기 위해 소스를 바꾸는 일이 없다.
- [SPEC] `run-bellows.ps1` · `deploy-bellows.ps1` · `deploy.json` 이 수정되지 않는다(범위 밖 — §7).
- [SPEC] `deriveDesired()` 의 임계·히스테리시스, STOP.json 의 위치·이름·스키마, 수동 STOP(`source === 'manual'`) 우선 규칙이 무변경이다.
- [SPEC] `watch-loop.js` 를 자식 프로세스로 띄우는 통합 테스트를 만들지 않는다 — 실제 `.prominence` 의 STOP.json·bellows.log 를 오염시키고 Chrome 을 요구해 hermetic 이 깨진다(설계 §10-3(c)).
- [SPEC] Phase 1·2·3 의 모든 기준이 계속 만족되며 **어느 하나도 삭제·완화되지 않는다** — 이 Phase 는 순증분이다.
- [SPEC] `node p-bellows/test/run-all.js` 가 기존 122개를 포함해 전부 통과하고 종료 코드 0 이며, 프로세스가 매달리지 않는다(모든 테스트 서버가 `close()` 된다).
- [SPEC] 의존성이 늘지 않는다 — `package.json` 의 `dependencies` 는 `puppeteer` 하나이고, 새 테스트는 내장 `node:test`/`node:assert`/`fetch` 만 쓴다.
- [SPEC] `p-bellows` 의 `.js` 파일에 `claude` 문자열이 grep 매칭 0건으로 유지된다(도메인 URL 상수 예외).
- [DERIVED] `deploy-bellows.ps1 -DryRun` 이 종료 코드 0 으로 끝난다(PS 5.1 파싱 0 errors).

### USER_GATE (사람 확인 — 자동 테스트로 대체 불가, Phase 3 기준의 재확인)

- [SPEC] 감시자를 실제로 띄운 뒤 `http://127.0.0.1:3210/api/status` 를 열면 현재의 고장난 측정 상태가 `"state": "crit"` 으로 보인다. 🔒 여기서 `ok` 가 나오면 계약을 구현하면서 3주 침묵을 새 층에 재현한 것이다.
- [SPEC] 같은 주소의 `/api/health` 는 `{"ok":true,"id":"quaestor",...}` 다 — `/api/status` 가 `crit` 이어도 `/api/health` 는 `ok` 이며, 두 값은 다른 질문에 답한다.
