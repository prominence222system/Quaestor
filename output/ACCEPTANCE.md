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
