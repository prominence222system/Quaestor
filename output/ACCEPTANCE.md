## Phase 1 Acceptance Criteria

### 파서 — 실측 벡터 (외부 참조: work/014 의 2026-09-23 실측 바이트)
- [SPEC] `parseUsage` 가 **파이프 형식**(TAB 구분 4행, 실측 바이트 그대로)을 읽어 `ok: true`, `weekly_remaining_pct === 45`, `five_hour_remaining_pct === 100` 을 내야 한다.
- [SPEC] 같은 입력에서 `weekly_reset_raw === '2026-09-23T06:57:36Z'`, `five_hour_reset_raw === '2026-09-23T05:53:40Z'` 로 **원문 문자열 그대로** 나와야 한다.
- [SPEC] `parseUsage` 가 **콘솔 형식**(공백 2칸 이상 정렬 + `Quota:` 머리줄)을 읽어 `ok: true`, `weekly_remaining_pct === 51`, `five_hour_remaining_pct === 89` 를 내야 한다.
- [SPEC] 두 형식이 **같은 키 집합**(`ok`, `weekly_remaining_pct`, `five_hour_remaining_pct`, `weekly_reset_raw`, `five_hour_reset_raw`)을 가진 결과를 내야 한다.

### 파서 — 엄격성
- [SPEC] 다음 입력은 각각 `{ ok: false }` 여야 한다: (a) Gemini weekly 줄만 있음, (b) 퍼센트가 `150%`, (c) 같은 metric 이 **다른 값으로 두 번** 등장, (d) 빈 문자열, (e) `Error: Please sign in ...` 한 줄.
- [SPEC] Gemini 두 줄의 **순서를 바꾼 입력**에서도 값이 **metric 문자열을 따라간다** — weekly 45 / five_hour 100 이 뒤바뀌지 않아야 한다.
- [SPEC] `Claude and GPT models` 등 `Gemini Models` 가 아닌 버킷의 값은 **결과 어디에도 없어야 한다**: 센티넬 픽스처(`37%`/`2031-01-01T00:00:00Z`, `23%`/`2032-02-02T00:00:00Z`)에서 `parseUsage` 결과를 `JSON.stringify` 한 문자열과 그 측정이 남긴 로그 줄 어디에도 `37`·`23`·`2031-01-01`·`2032-02-02` 가 없어야 한다. 대조로 Gemini 쪽 값은 나와야 한다.
- [DERIVED] 퍼센트 칸은 `^\d{1,3}%$` 이면서 값이 0~100 범위여야 하고, 리셋 칸은 `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$` 여야 한다. 둘 중 하나라도 어기면 **그 줄을 거부**한다(전체 실패가 아니라 줄 폐기).
- [DERIVED] 칸 수가 4가 아닌 줄, 빈 줄, `Quota:` 머리줄은 조용히 건너뛴다.
- [DERIVED] `parseUsage` 는 순수 함수다 — 파일 I/O·`process.env` 읽기·`Date` 계열 호출이 없어야 하고, 문자열이 아닌 입력에는 예외 대신 `{ ok: false }` 를 반환해야 한다.

### 인자 고정
- [SPEC] `AGY_ARGS` 가 `['-p', '/usage']` 와 `deepStrictEqual` 이고 `Object.isFrozen(AGY_ARGS) === true` 여야 한다.
- [SPEC] `measureAgy` 가 실행기에 넘기는 두 번째 인자는 **정확히 `['-p','/usage']`** 여야 하며, 이는 **진짜 자식 프로세스 경계를 넘어서** 검증되어야 한다: 가짜 스크립트가 `process.argv.slice(2)` 를 검사해 다르면 아무것도 쓰지 않고 `exit 3` 하고, 정상 모드 테스트가 `ok: true` 로 통과한다는 사실이 그 증거다.
- [SPEC] `measureAgy` 는 인자(프롬프트 등)를 주입할 수 있는 매개변수를 노출하지 않아야 한다 — `lib/agy-usage.js` 소스에 `AGY_ARGS` 외의 agy 인자 배열 리터럴이 없어야 한다.

### `measureAgy` — 실패 분류
- [SPEC] 실행기가 **동기 throw** 하면 `{ ok:false, kind:'spawn-failed' }` 로 resolve 해야 한다(예외가 모듈 밖으로 새지 않는다).
- [SPEC] `error.code` 가 문자열이면서 `ENOENT` 가 아닌 경우(`EINVAL` 등)는 `kind === 'spawn-failed'` 여야 한다.
- [SPEC] 존재하지 않는 절대경로를 `QUAESTOR_AGY_EXE` 로 두고 **기본 실행기**로 부르면 `kind === 'not-installed'` 여야 한다.
- [SPEC] 60초 잠드는 가짜 agy + `timeoutMs = 1000` 에서 `measureAgy` 가 **3초 안에** `kind === 'timeout'` 으로 끝나야 한다.
- [SPEC] exit 0 + 에러 문구 stdout → `kind === 'parse-failed'`. exit 0 + 빈 stdout → `kind === 'parse-failed'`. exit 1 + 에러 문구 → `kind === 'exit-nonzero'`.
- [SPEC] `measureAgy` 는 위 모든 경우를 포함해 **어떤 입력에서도 reject 하지 않는다**(always resolve).
- [SPEC] 성공 결과는 `{ ok:true, at, weekly_remaining_pct, five_hour_remaining_pct, weekly_reset_raw, five_hour_reset_raw }`, 실패 결과는 `{ ok:false, at, kind }`(+선택적 `hint`) 형태여야 한다.
- [SPEC] `hint` 는 **판정에 쓰이지 않는다** — 같은 로그인 요구 문구라도 exit 0 이면 `parse-failed`, exit 1 이면 `exit-nonzero` 로 갈려야 한다(위 기준과 동일 문구로 대조 검증).
- [DERIVED] 로그인 요구 문구가 stdout/stderr 에 보이면 실패 결과에 `hint: 'login-required'` 가 붙고, 보이지 않으면 `hint` 키 자체가 없어야 한다.
- [DERIVED] `at` 은 `nowFn()` 기준의 ISO-8601 문자열이며, 주입한 `nowFn` 이 반영되어야 한다.
- [DERIVED] `measureAgy` 는 자체 마감 타이머(`timeoutMs + 2000`)를 걸되 **두 번 resolve 하지 않아야** 한다 — 정상 완료 후에도 추가 resolve 나 미처리 예외가 발생하지 않는다.
- [DERIVED] 실행기에 넘기는 옵션에 `shell: false` 가 포함되어야 한다(Windows `.cmd`/`.bat` 함정 회피).

### 실행 파일 해석
- [SPEC] `QUAESTOR_AGY_EXE`·`BELLOWS_AGY_EXE` 가 모두 미정의일 때 해석 함수의 반환값이 문자열 `'agy'` 여야 한다. 🔒 이 검증은 **반환값만** 단언하고 **진짜 `agy` 를 실행하지 않는다**.
- [SPEC] `QUAESTOR_AGY_EXE` 가 설정되어 있으면 그 값이 `BELLOWS_AGY_EXE` 보다 우선한다(`lib/env.js` 의 기존 규율).
- [DERIVED] 값이 빈 문자열이거나 공백뿐이면 `'agy'` 로 되돌아간다.

### `createAgyMonitor`
- [SPEC] `.poll()` 은 측정이 60초 걸려도 **즉시(동기적으로) 반환**해야 한다.
- [SPEC] 측정이 진행 중일 때 `.poll()` 을 다시 부르면 **새 측정이 시작되지 않아야** 한다(`measure` 호출 횟수가 1 그대로).
- [SPEC] 성공 뒤 실패가 와도 `snapshot().lastSuccess` 는 **그대로 유지**되고, `lastAttempt` 만 `{ ok:false, kind }` 로 바뀌어야 한다.
- [SPEC] `.poll()` 과 결과 처리 어디에서도 **예외가 밖으로 새지 않아야** 한다 — `measure` 가 동기 throw 하거나 reject 해도 모니터는 살아 있고 이후 `.poll()` 이 다시 동작해야 한다.
- [DERIVED] `snapshot()` 은 `{ lastSuccess, lastAttempt, inFlight }` 를 반환하고 **매번 새 객체**여야 한다 — 반환값을 수정해도 다음 `snapshot()` 결과가 오염되지 않는다.
- [DERIVED] 초기 상태는 `{ lastSuccess: null, lastAttempt: null, inFlight: false }` 이고, 측정 진행 중에는 `inFlight === true`, 완료 후 `false` 여야 한다.
- [DERIVED] 성공 시 로그 한 줄 `[agy] gemini weekly_left=45% five_hour_left=100%`, 실패 시 `[agy] fail kind=<kind>`(+`hint` 가 있으면 ` hint=<hint>`)를 정확히 한 번 남겨야 한다.
- [DERIVED] 주입한 `log` 가 없거나 throw 해도 모니터의 상태 갱신은 정상적으로 끝나야 한다.

### 로그 형식의 비오염 (Phase 1 시점의 형식 고정)
- [SPEC] 모니터가 만드는 로그 줄에는 부분문자열 `session=`, `weekly=`, `[poll error]` 가 **하나도 없어야** 한다. (`weekly_left=` 는 `weekly=` 와 다르다.)

### 경계·격리
- [SPEC] Phase 1 의 모든 실행 경로 테스트는 **진짜 `agy` 를 실행하지 않는다** — 가짜 스크립트(또는 존재하지 않는 경로)만 사용한다.
- [SPEC] 정상·콘솔·센티넬 모드 검증은 순수 문자열 주입이 아니라 **진짜 `child_process`·진짜 파이프**를 거쳐야 한다. 특히 TAB 구분 출력은 파이프로 전달된 바이트를 파서가 읽어 통과해야 한다.
- [SPEC] `lib/agy-usage.js` 소스에 `Gemini Models` 외의 벤더/엔진 버킷 이름 문자열이 없어야 한다.
- [SPEC] `lib/agy-usage.js` 소스에 `https://claude.ai` 가 0회여야 한다(`test/scrape-classify.test.js:370` 의 lib/ 전수 검사 통과).
- [SPEC] `node p-quaestor/test/run-all.js` 가 **회귀 0**으로 통과해야 한다 — 기존 테스트 파일 **편집 0**, `watch-loop.js`·`lib/logparse.js`·`lib/control-server.js`·`lib/status-page.js` **무수정**, `/api/status` 응답·`fields`·상태 페이지·계약 버전 **무변경**.
- [SPEC] 구현 전에는 위 파서·`measureAgy`·모니터 기준이 전부 FAIL 해야 한다(모듈이 존재하지 않는다).
- [DERIVED] 가짜 agy 픽스처는 `test/fixtures/` 하위에 두고 `.test.js` 로 끝나지 않아 `test/run-all.js` 가 테스트로 오인하지 않아야 한다.
- [DERIVED] `process.env` 를 건드리는 테스트는 `try/finally` 로 원상복구해 다른 테스트 파일을 오염시키지 않아야 한다.
