# 014 — agy(Gemini) 잔량을 잰다: 부르고, 읽고, 기억하고, 로그에 남긴다

## Project Type

제품 진화(Quaestor) · Node · **ADDITIVE** · never-brick.
🔒 **이 NNN 은 측정만 한다.** 응답(`/api/status`)·`fields`·상태 페이지·계약 버전은 **건드리지 않는다** — 그건 015 다.

## Project Goal

Quaestor 는 지금까지 claude 만 쟀다. forge 는 `alternate` 로 엔진을 번갈아 돌리고, 2026-09-20 실측으로
**전체 스텝의 27%가 agy** 다. 013 이 응답에 `covers: ["claude"]` 를 실어 *"agy 는 모른다"* 고 정직하게 말하게 했다.
이 NNN 과 015 가 그 빈칸을 **실제 측정으로** 메운다.

측정 경로는 실측으로 확인됐다(2026-09-23, 개발PC, `node` 의 `execFileSync` 3회). 아래는 stdout 이
**파이프**일 때 — 서비스가 부르는 조건 — 의 실제 바이트를 줄마다 JSON 이스케이프한 것이다:

```
agy -p "/usage"
"Gemini Models\tWeekly Limit Remaining\t45%\t2026-09-23T06:57:36Z"
"Gemini Models\tFive Hour Limit Remaining\t100%\t2026-09-23T05:53:40Z"
"Claude and GPT models\tWeekly Limit Remaining\t100%\t2026-09-30T00:53:40Z"
"Claude and GPT models\tFive Hour Limit Remaining\t100%\t2026-09-23T05:53:40Z"
```

콘솔(대화형 터미널) 형식은 다르다 — 공백 정렬 + `Quota:` 머리줄:

```
Quota:
Gemini Models          Weekly Limit Remaining     51%   2026-09-23T06:57:36Z
Gemini Models          Five Hour Limit Remaining  89%   2026-09-22T11:07:46Z
Claude and GPT models  Weekly Limit Remaining     100%  2026-09-29T06:24:22Z
Claude and GPT models  Five Hour Limit Remaining  100%  2026-09-22T11:24:22Z
```

- 3/3 `exit=0`, 회당 약 **6초**. 3회 연속 호출에서 네 버킷 모두 정수 % 불변
- 🔒 **공백 2칸을 가정한 파서는 파이프 출력에서 0행**이 된다 — 실제로 한 번 그렇게 조용히 실패했다
- 🔒 SSH(세션 0)에서는 인증이 안 붙어 `Error: Please sign in ...` 로 실패한다(대화형 세션에만 인증이 있다)

## Scope

### 1) `lib/agy-usage.js` 신설

#### 1-a) 인자 고정 — 이 NNN 의 안전장치

```js
const AGY_ARGS = Object.freeze(['-p', '/usage']);
```

🔒 **agy 에 넘기는 인자는 언제나 정확히 이것이다.** 인자를 바꾸거나 덧붙이는 경로를 만들지 말 것.
이 제품의 불변 제약이 *"토큰을 쓰면 감시자가 감시 대상이 된다"* 다. `/usage` 는 모델 턴이 아니라 조회다.
**프롬프트를 넘기는 순간 그 제약을 어긴다.**

#### 1-b) 실행기 — 주입 가능, 기본값은 `execFile` 그 자체

- 실행기 시그니처는 **`child_process.execFile` 과 같은 `(file, args, opts, cb)`** 이고, **기본값은 `execFile` 그 자체**다(래핑·가공 없음)
- 제품 코드는 항상 `executor(file, AGY_ARGS, { shell: false, windowsHide: true, timeout: timeoutMs, encoding: 'utf8' }, cb)` 로 부른다
- 실행 파일: `lib/env.js` 의 `envRaw('AGY_EXE')`(→ `QUAESTOR_AGY_EXE`) → 없으면 문자열 `'agy'`(PATH 해석).
  개발PC 의 `agy` 는 실제 `.exe` 라 `shell:false` 로 해석된다(실측)
- 🔒 **Windows 에서 `.js`·`.cmd`·`.bat` 를 file 로 직접 주거나 `shell: true` 를 쓰지 말 것.** `shell:false` 에서
  `.js` 는 실행되지 않고 `.cmd`/`.bat` 는 `EINVAL` 로 동기 throw 한다(이 프로젝트는 npm 이 `.cmd` shim 이라 한 번 라운드를 잃었다)

#### 1-c) 파서 — 엄격하게, 못 읽으면 추측하지 않는다

`parseUsage(text)` 는 줄마다:
- **TAB 으로 먼저** 나누고, 4칸이 안 되면 **공백 2칸 이상**으로 다시 나눈다. 머리줄 `Quota:` 는 건너뛴다
- 4칸이어야 하고, 3번째 칸은 `^\d{1,3}%$` 이며 🔒 **0~100 만** 받는다(101 이상은 그 줄 거부), 4번째 칸은
  `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$`
- 🔒 **버킷은 `Gemini Models` 정확 일치 허용목록**으로 고른다. 제외할 버킷 이름을 코드에 적지 않는다
  (그러면 이 파일에 다른 엔진 이름이 들어오지 않는다)
- 🔒 weekly/five_hour 는 **2번째 칸 문자열 정확 일치**로 짝짓는다: `Weekly Limit Remaining` / `Five Hour Limit Remaining`.
  **줄 순서로 짝짓지 말 것**
- 🔒 **`Gemini Models` 의 두 줄이 모두 유효해야 성공**이다. 하나라도 없거나, 같은 metric 이 다른 값으로 두 번 나오면
  **전체가 실패**다 — 반쪽 값을 내지 않는다

반환: `{ ok: true, weekly_remaining_pct, five_hour_remaining_pct, weekly_reset_raw, five_hour_reset_raw }` 또는 `{ ok: false }`.

🔒 `Claude and GPT models` 버킷은 **Antigravity 안의 Claude 할당량이라 claude.ai 구독과 다른 지갑**이다.
파서가 **그 줄을 버린다.** 어디에도 싣지 않는다.

#### 1-d) `measureAgy(opts)` — 절대 reject 하지 않는다

`measureAgy({ executor, file, timeoutMs = 45000, nowFn })` → Promise, **어떤 경우에도 resolve** 한다:

- 성공: `{ ok: true, at, weekly_remaining_pct, five_hour_remaining_pct, weekly_reset_raw, five_hour_reset_raw }`
- 실패: `{ ok: false, at, kind, hint }` — `hint` 는 선택(아래)

**실패 판정 순서**(위가 우선):

| 순서 | 조건 | `kind` |
|---|---|---|
| ① | 실행기가 **동기 throw** 하거나, `error.code` 가 문자열이고 `ENOENT` 가 아님(`EINVAL`·`EFTYPE`·`EACCES`·maxBuffer 등) | `spawn-failed` |
| ② | `error.code === 'ENOENT'` | `not-installed` |
| ③ | `error.killed === true` 이거나 **자체 마감**에 걸림 | `timeout` |
| ④ | 숫자 exit ≠ 0 (stdout 내용과 무관) | `exit-nonzero` |
| ⑤ | exit 0 인데 `parseUsage` 가 `{ ok: false }` | `parse-failed` |

- 🔒 동기 throw 는 **모듈 안에서 잡는다.** 측정 함수 밖으로 새지 않는다
- 🔒 **자체 마감**: child 의 `close` 에 의존하지 않는 타이머(`timeoutMs + 2000`)를 둬서, 그때까지 결과가 없으면
  child 를 kill 시도하고 `timeout` 으로 확정한다. **두 번 resolve 하지 않는다**
- `hint`: stdout/stderr 에 로그인 요구 문구가 **보이면** `login-required` 를 붙인다. 🔒 **판정에는 쓰지 않는다** —
  문구는 UI 언어가 바뀌면 조용히 틀린다(기존 `hintFrom()` 과 같은 규율). `kind` 는 위 표로만 정한다

#### 1-e) `createAgyMonitor({ measure, log, nowFn })` — 폴 루프가 붙는 자리

- `.poll()` — **동기적으로 즉시 반환**한다. 진행 중인 측정이 없을 때만 `measure()` 를 시작하고(🔒 **in-flight 가드**:
  이전 호출이 안 끝났으면 새로 띄우지 않는다), 결과가 오면 내부 상태를 갱신하고 로그 한 줄을 남긴다
- `.snapshot()` — 현재 상태의 **복사본**:
  `{ lastSuccess: {weekly_remaining_pct, five_hour_remaining_pct, weekly_reset_raw, five_hour_reset_raw, at} | null,
     lastAttempt: { at, ok, kind } | null, inFlight: boolean }`
- 🔒 **이전 성공값은 실패로 지워지지 않는다.** 실패는 `lastAttempt` 만 바꾼다(claude 쪽 `lastUsage` 와 같은 규율)
- 🔒 `.poll()` 과 결과 처리 어디에서도 예외가 밖으로 새지 않는다

### 2) `watch-loop.js` 에 붙인다 — claude 측정과 독립으로

- 모니터를 **한 번** 만든다. `pollOnce()` 의 **첫 동작 부근**(설정 갱신 직후, **어떤 `return` 보다도 앞**)에서
  `agyMonitor.poll()` 을 부른다. 🔒 **`await` 하지 않는다**
- 🔒 **이유**: `pollOnce` 에는 claude 경로의 조기 `return` 이 5곳 있다(스크레이프 실패 · 추출 실패 · 설정 비활성 ·
  수동 STOP · 자동 STOP 유지). agy 를 그 뒤에 두면 **claude 가 실패하거나 STOP 이 걸린 동안 agy 는 영영 안 잰다** —
  바로 agy 숫자가 제일 필요한 때다. 반대로 `await` 하면 STOP.json 판정이 최대 45초 늦어진다
- 🔒 **`watch-loop.js` 에는 문자열 `claude` 가 0회여야 한다**(`test/watch-loop.test.js` 가 못박는다) — 주석·변수명 포함
- 🔒 `watch-loop.test.js` 의 기존 구조 검사(`pollOnce` 본문을 읽는 정규식)를 깨지 않는다. agy 쪽 코드는 한 줄 호출로 두고
  로직은 `lib/agy-usage.js` 에 둔다

### 3) 로그 한 줄 — 형식을 고정한다

```
[agy] gemini weekly_left=45% five_hour_left=100%
[agy] fail kind=timeout
[agy] fail kind=exit-nonzero hint=login-required
```

🔒 **이 형식이어야 하는 이유**: `lib/logparse.js`(005 의 재기동 복원)가 로그 꼬리에서 claude 상태를 되살린다.
그 정규식이 이렇다:

```js
const sessRe = /session=(\d+(?:\.\d+)?)%/;   // logparse.js:24
const weekRe = /weekly=(\d+(?:\.\d+)?)%/;    // logparse.js:25
```

agy 줄에 `weekly=45%` 가 들어가면 **재기동 때 Gemini 45% 가 claude 주간 사용량으로 복원된다.** 조용히 틀린 값이다.
🔒 **agy 줄에는 `session=` · `weekly=` · `[poll error]` 부분문자열이 없어야 한다.** `weekly_left=` 는 `weekly=` 와 다르다.
🔒 **기존 claude 로그 줄 형식은 바꾸지 않는다.**

## Acceptance — [SPEC]

1. `parseUsage` 가 위 **파이프 형식**(실측 바이트, TAB 포함)과 **콘솔 형식**을 둘 다 읽어 같은 두 값을 낸다(45/100, 51/89)
2. 🔒 엄격성 — 각각 `{ ok: false }` 여야 한다:
   Gemini weekly 줄만 있음 · `150%` · 같은 metric 이 다른 값으로 두 번 · 빈 문자열 · `Error: Please sign in ...` 한 줄.
   그리고 Gemini 두 줄의 **순서를 바꾼 입력**은 값이 metric 을 따라간다
3. 🔒 `Claude and GPT models` 줄의 값은 결과 어디에도 없다 — **센티넬 픽스처**로 검사한다:
   그 두 줄의 값을 Gemini 와 겹치지 않게(`37%`/`2031-01-01T00:00:00Z`, `23%`/`2032-02-02T00:00:00Z`) 두고,
   `parseUsage` 결과와 그 측정이 남긴 로그 줄 어디에도 `37`·`23`·`2031-01-01`·`2032-02-02` 가 없음을 단언한다.
   대조로 Gemini 쪽 값은 나와야 한다
4. 🔒 실패 판정 표의 다섯 `kind` 가 각각 나온다. `measureAgy` 는 **어떤 경우에도 reject 하지 않는다**(동기 throw 하는 실행기 포함)
5. 🔒 **exit 0 + 에러 문구 stdout** 과 **exit 0 + 빈 stdout** 은 `parse-failed`, **exit 1 + 에러 문구** 는 `exit-nonzero`
6. 🔒 모니터: `.poll()` 은 측정이 60초 걸려도 **즉시 반환**한다. 진행 중에 `.poll()` 을 또 부르면 **새 측정이 시작되지 않는다**.
   성공 뒤 실패가 와도 `lastSuccess` 는 그대로다
7. 🔒 로그: `parseLogTail(L)` 과 `parseLogTail(L 에 agy 성공·실패 줄을 섞은 것)` 이 **deepStrictEqual** 이다.
   대조로 L 안의 claude 성공 줄은 여전히 복원된다(`logparse.test.js` 에 **새 테스트 추가** — 기존 테스트 편집 없음)
8. 🔒 **기존 테스트 편집 0, 회귀 0**(`node p-quaestor/test/run-all.js`). 이 NNN 은 응답·`fields`·페이지·계약을 안 바꾸므로
   기존 테스트가 바뀔 이유가 없다

### 🔒 경계를 실제로 건너는 검증 — 가짜 agy 로 진짜 자식 프로세스를 띄운다

- 테스트 실행기는 이렇게 주입한다:
  ```js
  (file, args, opts, cb) => execFile(process.execPath, [FAKE_AGY_JS, ...args], opts, cb)
  ```
  **진짜 `child_process`, 진짜 파이프, 진짜 파서**를 거친다. 모듈이 넘기는 `args` 는 여전히 정확히 `['-p', '/usage']` 다
- 🔒 가짜 스크립트는 `process.argv.slice(2)` 가 `['-p', '/usage']` 와 **다르면 아무것도 쓰지 않고 exit 3** 한다.
  그러면 **인자 고정이 진짜 프로세스 경계를 넘어서도 검증된다**
- 가짜 스크립트의 동작은 `opts.env` 의 변수로 고른다(정상 · hang · 빈 출력 · 로그인 문구 exit 0 · exit 1 · 센티넬 등).
  🔒 **실측 바이트를 TAB 그대로 stdout 에 쓴다** — 파이프에서 TAB 이 어떻게 오는지가 이 NNN 의 핵심이다
- 🔒 **hang 검증**: 60초 잠드는 가짜 + `timeoutMs = 1000` 에서 `measureAgy` 가 **3초 안에** `timeout` 으로 끝난다
- `not-installed` 는 `QUAESTOR_AGY_EXE` 를 **존재하지 않는 절대경로**로 두고 기본 실행기(`execFile`)로 검증한다
- 🔒 **테스트는 진짜 `agy` 를 절대 실행하지 않는다.** 인증이 대화형 세션에만 있어 forge 환경에서는 실패한다.
  기본 실행 파일 해석은 **해석 함수의 반환값**(`'agy'`)만 단언한다
- 🔒 **수정 전에는 1·3·4·6·7 이 반드시 FAIL 한다**(모듈이 없다)

## 예상 phase 2

1. `lib/agy-usage.js` — 인자 고정 · 주입 실행기 · 엄격한 파서 · `measureAgy`(실패 표·자체 마감·never-reject) ·
   `createAgyMonitor` + 가짜 agy 자식 프로세스 테스트
2. `watch-loop.js` 연결(첫 동작·await 없음·claude 0회) + 로그 형식 + `logparse` 비오염 테스트

## USER_GATE

- 랜딩·재시작 후 첫 폴(1분 안)에 `bellows.log` 에 `[agy] gemini weekly_left=..% five_hour_left=..%` 줄이 생긴다
- `[agy] fail kind=not-installed` → `run-quaestor.ps1` 환경에 `QUAESTOR_AGY_EXE` 를 설정
- 🔒 `[agy] fail kind=exit-nonzero hint=login-required` → **워처 맥락에 agy 인증이 없다**는 뜻이다.
  이것이 이 기능의 **마지막 미측정 항목**이고, 여기서 처음 실물로 판정된다

## Related

- 🔒 **불변 영역**: `deriveDesired()` · STOP.json · 히스테리시스 · 수동 STOP. 이 NNN 은 근처도 가지 않는다
- 🔒 MASTER `Constraints` 의 "Claude CLI 사용 금지" 는 **토큰을 쓰는 호출**을 막는 규칙이다. `agy -p "/usage"` 는 모델 턴이 아닌
  조회라 허용되며, **인자 고정**이 그 경계를 지킨다
- 015 — 이 측정을 `/api/status` · `fields` · 상태 페이지로 노출하고 계약을 1.5.0 으로 올린다
- 측정 원자료: `1. Project/_ops/probe-agy-usage.js`(개발PC 실측에 쓴 프로브)
