# DESIGN — 014 agy(Gemini) 잔량 측정

> 대상 작업: `work/014-measure-agy-gemini-quota.md`
> 성격: **ADDITIVE · never-brick · 측정 전용**
> 🔒 이 NNN 은 `/api/status` 응답 · `fields` · 상태 페이지 · 계약 버전을 **건드리지 않는다**. 그건 015 다.

---

## 1. 배경과 이 설계가 지켜야 하는 것

Quaestor 는 지금까지 claude 만 쟀다. 013 이 응답에 `covers: ["claude"]` 를 실어
*"agy 는 모른다"* 고 정직하게 말하게 했고, 014 가 그 빈칸을 **실제 측정으로** 메우기 시작한다.

2026-09-23 실측으로 `agy -p "/usage"` 가 **비대화형(파이프) 호출에서도** 동작함이 확인됐다
(3/3 `exit=0`, 회당 약 6초). 다만 **파이프 출력과 콘솔 출력의 바이트가 다르다**:

| 환경 | 구분자 | 머리줄 |
|---|---|---|
| 파이프(서비스가 부르는 조건) | **TAB** | 없음 |
| 콘솔(대화형 터미널) | 공백 정렬(2칸 이상) | `Quota:` 있음 |

🔒 **공백 2칸을 가정한 파서는 파이프 출력에서 0행**이 된다 — 실측에서 실제로 조용히 실패했다.
그래서 파서는 **TAB 우선 → 실패 시 공백 2칸 이상** 2단계로 나눈다.

이 설계가 관통해서 지키는 다섯 가지 규율:

1. **인자 고정** — agy 에 넘기는 인자는 언제나 정확히 `['-p', '/usage']`. 프롬프트를 넘기는 순간
   이 제품이 감시 대상이 된다(MASTER `Constraints`).
2. **엄격성** — 못 읽으면 **추측하지 않는다.** 반쪽 값을 내지 않는다.
3. **never-reject / never-throw** — 측정 실패는 `resolve` 된 결과값이지 예외가 아니다.
   agy 가 없거나 죽어도 claude 차단기는 한 폴도 놓치지 않는다.
4. **지갑 분리** — `Claude and GPT models` 버킷은 **Antigravity 안의 Claude 할당량**이라
   claude.ai 구독과 다른 지갑이다. 파서가 **그 줄을 버린다.**
5. **로그 비오염** — `lib/logparse.js` 의 `weekRe = /weekly=(\d+...)%/` 가 agy 줄을
   claude 주간 사용량으로 복원하면 **조용히 틀린 값**이 된다. agy 줄은 `weekly_left=` 를 쓴다.

---

## 2. 전체 아키텍처

```
                      [ 기존 · 불변 ]                       [ 014 가 추가 ]

 watch-loop.js
   └ pollOnce()
      ├─ refreshConfig()
      ├─ agyMonitor.poll()  ← 🔴 여기 한 줄 (await 없음, 모든 return 보다 앞)
      │                                  │
      │                                  └──► lib/agy-usage.js
      │                                         ├ AGY_ARGS = ['-p','/usage']  (frozen)
      │                                         ├ resolveAgyFile()  ← lib/env.js
      │                                         ├ measureAgy()  → execFile → 자식 프로세스
      │                                         │     └ parseUsage(stdout)  (엄격)
      │                                         └ createAgyMonitor()  (in-flight 가드 · 상태 보존)
      │                                                  │
      │                                                  └─ log('[agy] gemini weekly_left=..% ..')
      │                                                          │
      ├─ scrapeUsage()  ─ 실패 시 return ①                       ▼
      ├─ isValidUsage() ─ 실패 시 return ②              .prominence\bellows.log
      ├─ !cfg.enabled   ─ return ③                              │
      ├─ manual STOP    ─ return ④                              └─ 재기동 시 logparse.js 가 읽음
      ├─ auto STOP 유지 ─ return ⑤                                 🔒 agy 줄은 **무시되어야** 한다
      └─ deriveDesired() → STOP.json
```

🔒 **`agyMonitor.poll()` 이 `pollOnce()` 의 첫 동작 부근에 있어야 하는 이유**: claude 경로에는
조기 `return` 이 **5곳**(위 ①~⑤) 있다. agy 를 그 뒤에 두면 **claude 가 실패하거나 STOP 이 걸린
동안 agy 는 영영 안 잰다** — 바로 agy 숫자가 제일 필요한 때다.
🔒 **`await` 하지 않는 이유**: agy 호출은 회당 약 6초, 타임아웃 45초다. `await` 하면
STOP.json 판정이 최대 45초 늦어진다. 차단기의 응답성이 측정 부가기능보다 우선한다.

---

## 3. 디렉터리 구조

```
p-quaestor/
├─ watch-loop.js                 (수정 · Phase 2 — 한 줄 호출 + 모니터 생성)
├─ lib/
│   ├─ agy-usage.js              🆕 (Phase 1 — 이 NNN 의 본체)
│   ├─ env.js                    (불변 · envRaw('AGY_EXE') 재사용)
│   ├─ logparse.js               (🔒 불변 — 정규식 한 글자도 안 바꾼다)
│   ├─ source.js · scrape.js · extract.js · observation.js
│   ├─ control-server.js · config.js · status-page.js · thresholds.js   (불변)
└─ test/
    ├─ agy-usage.test.js         🆕 (Phase 1)
    ├─ fixtures/
    │   └─ fake-agy.js           🆕 (Phase 1 — 가짜 agy 자식 프로세스 스크립트)
    ├─ logparse.test.js          (Phase 2 — 🔒 **추가만**, 기존 테스트 편집 0)
    └─ watch-loop.test.js        (🔒 무수정 통과가 목표)
```

🔒 `fixtures/fake-agy.js` 는 **`.test.js` 로 끝나지 않으므로** `test/run-all.js` 의
`filter((f) => f.endsWith('.test.js'))` 에 걸리지 않는다. 또한 `fixtures/` 하위라
`readdirSync(testDir)` 의 평면 스캔에도 잡히지 않는다 — 러너가 이 픽스처를 테스트로 오인하지 않는다.

---

## 4. 기술 결정과 근거

### D1. 실행기(executor)를 주입하되 **기본값은 `execFile` 그 자체**

```js
measureAgy({ executor = require('node:child_process').execFile, ... })
```

래핑·가공 없이 `execFile` 자체를 기본값으로 둔다. 테스트가 주입하는 실행기는
**진짜 `child_process.execFile` 로 가짜 스크립트를 띄우는** 얇은 어댑터다:

```js
(file, args, opts, cb) => execFile(process.execPath, [FAKE_AGY_JS, ...args], opts, cb)
```

🔒 **근거**: 순수 함수에 가짜 문자열을 먹이는 테스트는 "격리 통과·통합 실패" 를 놓친다.
이 NNN 의 핵심 위험이 **파이프에서 TAB 이 어떻게 오는가**이므로, 진짜 프로세스 · 진짜 파이프 ·
진짜 파서를 거쳐야만 검증이 성립한다. 어댑터는 `args` 를 **그대로 뒤에 붙이므로**
모듈이 넘긴 `['-p','/usage']` 가 프로세스 경계를 그대로 건너간다.

### D2. 인자 고정은 **런타임 + 프로세스 경계** 양쪽에서 강제한다

- 코드: `const AGY_ARGS = Object.freeze(['-p', '/usage']);` — 제품 코드는 **항상 이 상수만** 넘긴다.
  인자를 받는 매개변수를 만들지 않는다.
- 테스트: 가짜 스크립트가 `process.argv.slice(2)` 를 검사해 `['-p','/usage']` 와 다르면
  **아무것도 쓰지 않고 `exit 3`** 한다.

🔒 이 두 겹이 있어야 "인자 고정" 이 주석이 아니라 **기계적 사실**이 된다.

### D3. 실행 옵션 — Windows 함정 회피

```js
executor(file, AGY_ARGS, { shell: false, windowsHide: true, timeout: timeoutMs, encoding: 'utf8' }, cb)
```

🔒 **`shell: true` 금지.** 이 프로젝트는 `npm` 이 `.cmd` shim 이라 라운드를 한 번 잃었다.
`shell:false` 에서 `.cmd`/`.bat` 를 file 로 주면 `EINVAL` 로 **동기 throw** 하고, `.js` 는
실행되지 않는다. 개발PC 의 `agy` 는 실제 `.exe` 라 `shell:false` 로 해석된다(실측).
동기 throw 가능성은 D5 의 ① 이 흡수한다.

### D4. 실행 파일 해석 — `lib/env.js` 재사용

`resolveAgyFile()` = `envRaw('AGY_EXE')`(→ `QUAESTOR_AGY_EXE`, 없으면 `BELLOWS_AGY_EXE`)
→ 값이 **비어 있지 않은 문자열이면** 그것, 아니면 문자열 `'agy'`(PATH 해석).

🔒 **테스트는 진짜 `agy` 를 절대 실행하지 않는다.** 인증이 대화형 세션에만 있어 forge 환경에서는
`Error: Please sign in ...` 로 실패한다(SSH·세션 0 에서 실측). 기본 해석은 **함수의 반환값**
(`'agy'`)만 단언한다.

### D5. 실패 분류 — 문구가 아니라 **프로세스 사실**로 판정한다

| 순서 | 조건 | `kind` |
|---|---|---|
| ① | 실행기가 **동기 throw** 하거나, `error.code` 가 **문자열이고 `ENOENT` 가 아님**(`EINVAL`·`EACCES`·`ERR_CHILD_PROCESS_STDIO_MAXBUFFER` 등) | `spawn-failed` |
| ② | `error.code === 'ENOENT'` | `not-installed` |
| ③ | `error.killed === true` 이거나 **자체 마감**에 걸림 | `timeout` |
| ④ | **숫자** exit code ≠ 0 (stdout 내용과 무관) | `exit-nonzero` |
| ⑤ | exit 0 인데 `parseUsage` 가 `{ ok: false }` | `parse-failed` |

🔒 **`hint` 는 판정에 쓰지 않는다.** stdout/stderr 에 로그인 요구 문구가 **보이면**
`hint: 'login-required'` 를 **덧붙일 뿐**이다. 문구는 UI 언어가 바뀌면 조용히 틀린다 —
기존 `scrape.js` 의 `hintFrom()` 과 같은 규율이다. `kind` 는 위 표로만 정한다.

🔒 **순서가 규범이다.** `exit 0 + 에러 문구 stdout` 은 `parse-failed`(프로세스는 성공했고 읽기가
실패했다), `exit 1 + 에러 문구` 는 `exit-nonzero`(프로세스가 실패했다). 같은 문구라도 다르게 분류된다.

### D6. 자체 마감(self-deadline) — child 의 `close` 에 의존하지 않는다

`execFile` 의 `timeout` 은 child 에 신호를 보내지만, 자식이 신호를 무시하거나 stdio 파이프가
안 닫히면 콜백이 오지 않을 수 있다. 그래서 **모듈이 직접 `timeoutMs + 2000` 짜리 타이머**를 건다.

- 타이머가 먼저 울리면: child kill 시도(실패해도 무시) → `{ ok:false, kind:'timeout' }` 로 확정
- 🔒 **두 번 resolve 하지 않는다** — `settled` 플래그 하나로 콜백과 타이머가 경쟁한다
- 타이머는 `unref()` 해서 이 모듈 때문에 프로세스가 안 끝나는 일이 없게 한다

검증: **60초 잠드는 가짜 + `timeoutMs = 1000`** 에서 `measureAgy` 가 **3초 안에** `timeout` 으로 끝난다.

### D7. 파서 — 허용목록으로 고르고, 문자열 정확 일치로 짝짓는다

- **버킷 선택**: `Gemini Models` **정확 일치 허용목록**.
  🔒 **제외할 버킷 이름을 코드에 적지 않는다.** 그러면 이 파일에 다른 엔진 이름이 들어오지 않고,
  MASTER 의 "`claude` grep 0건" 규칙과 자동으로 정합한다.
- **metric 짝짓기**: 2번째 칸 **문자열 정확 일치** — `Weekly Limit Remaining` / `Five Hour Limit Remaining`.
  🔒 **줄 순서로 짝짓지 않는다.** 벤더가 행 순서를 바꾸면 값이 뒤바뀌어 조용히 틀린다.
- **엄격성**: Gemini **두 줄이 모두 유효해야** 성공. 하나라도 없거나, 같은 metric 이 **다른 값으로
  두 번** 나오면 **전체 실패**. 반쪽 값을 내지 않는다.

### D8. 모니터 — `.poll()` 은 동기적으로 즉시 반환한다

`createAgyMonitor({ measure, log, nowFn })`:

- `.poll()` — **동기 반환**. 진행 중인 측정이 없을 때만 `measure()` 를 시작한다
  (🔒 **in-flight 가드**). 결과가 오면 상태를 갱신하고 로그 한 줄을 남긴다.
- `.snapshot()` — 상태의 **복사본**(호출자가 내부를 오염시킬 수 없다).
- 🔒 **이전 성공값은 실패로 지워지지 않는다.** 실패는 `lastAttempt` 만 바꾼다 —
  claude 쪽 `observation.lastUsage` 와 같은 규율이다. 015 가 이 값을 노출할 때
  "한 번 실패했다고 화면이 빈칸이 되는" 일을 막는다.
- 🔒 `.poll()` 과 결과 처리 **어디에서도 예외가 밖으로 새지 않는다.**

### D9. 로그 형식 — `logparse` 를 오염시키지 않는 것이 제1 제약

```
[agy] gemini weekly_left=45% five_hour_left=100%
[agy] fail kind=timeout
[agy] fail kind=exit-nonzero hint=login-required
```

`logparse.js:24-25` 의 정규식은 이렇다:

```js
const sessRe = /session=(\d+(?:\.\d+)?)%/;
const weekRe = /weekly=(\d+(?:\.\d+)?)%/;
```

- `weekly_left=45%` 에서 `weekly` 다음 글자는 `_` 이므로 `weekly=` 에 **매칭되지 않는다.**
- agy 줄에 `session=` 이 없으므로 성공 줄로 오인되지 않는다(`sessMatch && weekMatch` 둘 다 필요).
- agy 줄에 `[poll error]` 부분문자열이 없으므로 실패 줄로도 오인되지 않는다.
- 따라서 `parseLogTail` 은 agy 줄을 **통째로 건너뛴다**(`totalValidEvents` 불변).

🔒 **agy 줄에는 `session=` · `weekly=` · `[poll error]` 부분문자열이 있으면 안 된다.**
🔒 **기존 claude 로그 줄 형식은 한 글자도 바꾸지 않는다.**
🔒 **reset 시각은 로그에 싣지 않는다** — 로그는 사람이 읽는 두 숫자면 충분하고,
`2031-01-01` 같은 센티넬 오염 검사 표면을 줄인다.

### D10. `[agy]` 문자열은 `lib/agy-usage.js` 안에만 둔다

로그 포매팅을 모니터 안에서 하고 `watch-loop.js` 에는 **`agyMonitor.poll();` 한 줄만** 남긴다.

🔒 **근거 둘**: (a) `watch-loop.test.js:316` 의 W3 는 `pollOnce()` 본문을 정규식으로 읽는다 —
본문이 짧고 단순할수록 안전하다. (b) `watch-loop.test.js:71` 은 watch-loop.js 의
`claude` 매칭 **0건**을 못박는다 — 로직이 lib 로 빠져 있으면 실수로 그 문자열이 들어갈 여지가 없다.

---

## 5. 데이터 흐름

### 5-1. 성공 경로

```
pollOnce()
  └ agyMonitor.poll()                       (동기 반환, await 없음)
       └ inFlight? → yes 면 아무것도 안 함
         no 면 inFlight = true
            └ measureAgy({ executor, file, timeoutMs: 45000 })
                 ├ file = resolveAgyFile()            'agy' 또는 QUAESTOR_AGY_EXE
                 ├ execFile(file, ['-p','/usage'], { shell:false, windowsHide:true, ... })
                 ├ (약 6초 뒤) exit 0, stdout = TAB 구분 4행
                 └ parseUsage(stdout)
                      ├ 줄마다 TAB split → 4칸 아니면 /\s{2,}/ split
                      ├ 'Quota:' 머리줄 skip
                      ├ 칸[0] === 'Gemini Models' 인 줄만 채택          ← 허용목록
                      ├ 칸[2] =~ /^\d{1,3}%$/ && 0<=n<=100
                      ├ 칸[3] =~ /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
                      └ 칸[1] 정확 일치로 weekly/five_hour 배정
                           └ 둘 다 있어야 { ok:true, ... }
            ← { ok:true, at, weekly_remaining_pct:45, five_hour_remaining_pct:100,
                          weekly_reset_raw, five_hour_reset_raw }
         └ lastSuccess = 결과, lastAttempt = {at, ok:true, kind:null}, inFlight = false
         └ log('[agy] gemini weekly_left=45% five_hour_left=100%')
```

### 5-2. 실패 경로 (상태 보존이 핵심)

```
measureAgy → { ok:false, at, kind:'timeout' }
  └ lastSuccess  : 🔒 그대로 (지우지 않는다)
    lastAttempt  : { at, ok:false, kind:'timeout' }
    inFlight     : false
  └ log('[agy] fail kind=timeout')
```

### 5-3. 버려지는 데이터

```
stdout 4행 ──┬─ 'Gemini Models' 2행           ──► 결과 · 로그 · (015 에서) 응답
             └─ 그 밖의 버킷 2행               ──► ✂ 파서에서 폐기. 어디에도 안 실린다
```

🔒 **센티넬 검사**로 기계적으로 보장한다: 다른 버킷 값을 Gemini 와 겹치지 않는
`37%`/`2031-01-01T00:00:00Z`, `23%`/`2032-02-02T00:00:00Z` 로 두고, `parseUsage` 결과와
그 측정이 남긴 로그 줄 **어디에도** `37`·`23`·`2031-01-01`·`2032-02-02` 가 없음을 단언한다.
대조로 Gemini 쪽 값은 나와야 한다.

---

## 6. Phase 분할

| Phase | 내용 | 산출물 |
|---|---|---|
| **1** | `lib/agy-usage.js` 신설 — 인자 고정 · 주입 실행기 · 엄격한 파서 · `measureAgy`(실패 표 · 자체 마감 · never-reject) · `createAgyMonitor` + **가짜 agy 자식 프로세스** 테스트 | `lib/agy-usage.js`, `test/agy-usage.test.js`, `test/fixtures/fake-agy.js` |
| **2** | `watch-loop.js` 연결(첫 동작 · `await` 없음 · `claude` 0회) + 로그 형식 확정 + `logparse` 비오염 테스트 | `watch-loop.js`(수정), `test/logparse.test.js`(**추가만**) |

🔒 **둘로 가르는 이유**: Phase 1 이 깨지면 Phase 2 가 그 위에 서지 않는다. Phase 1 은 외부
의존이 0 이고 순수하게 테스트 가능하다. Phase 2 는 실행 중인 워처 파일을 건드리므로 가장 나중이다.

---

## 7. Phase 1 상세 설계 — `lib/agy-usage.js`

### 7-1. 모듈 형태

```
'use strict';
const { envRaw } = require('./env');
// child_process 는 기본 실행기 용도로만 require 한다.

const AGY_ARGS = Object.freeze(['-p', '/usage']);
const DEFAULT_AGY_FILE = 'agy';
const DEFAULT_TIMEOUT_MS = 45000;
const DEADLINE_SLACK_MS  = 2000;

const BUCKET        = 'Gemini Models';               // 허용목록. 유일한 버킷 이름
const METRIC_WEEKLY = 'Weekly Limit Remaining';
const METRIC_5H     = 'Five Hour Limit Remaining';

module.exports = { AGY_ARGS, resolveAgyFile, parseUsage, measureAgy, createAgyMonitor };
```

🔒 `AGY_ARGS` 는 `Object.freeze` 된 **모듈 상수**이며 export 한다 — 테스트가 이 배열의
동일성(`deepStrictEqual` 및 `Object.isFrozen`)을 직접 단언할 수 있어야 한다.
🔒 이 파일에는 `Gemini Models` 외의 어떤 벤더/엔진 버킷 이름도 적지 않는다.
🔒 이 파일에는 `https://claude.ai` 가 없다 — `scrape-classify.test.js:370` 의 lib/ 전수 검사를 통과한다.

### 7-2. `resolveAgyFile()`

| 입력(`QUAESTOR_AGY_EXE` / `BELLOWS_AGY_EXE`) | 반환 |
|---|---|
| 미정의 | `'agy'` |
| 빈 문자열 / 공백뿐 | `'agy'` — 빈 file 은 실행될 수 없으므로 기본값으로 되돌린다 |
| `C:\tools\agy.exe` | 그 값 그대로 |

인자를 받지 않는다(`process.env` 를 호출 시점에 읽는다 — `env.js` 의 규율과 동일).

### 7-3. `parseUsage(text)` — 순수 함수, I/O·시계 접근 0

입력이 문자열이 아니면 즉시 `{ ok: false }`.

줄 단위 처리(`/\r?\n/` 로 분할):

1. `trim()` 후 빈 줄이면 skip.
2. 머리줄 `Quota:`(trim 결과가 정확히 그것)이면 skip.
3. **TAB 으로 먼저** 분할. 결과가 4칸이 아니면 **`/\s{2,}/`(공백 2칸 이상)** 로 다시 분할.
4. 4칸이 아니면 그 줄 skip. 각 칸은 `trim()` 한다.
5. 칸[0] !== `'Gemini Models'` 이면 skip. — ✂ **다른 버킷은 여기서 사라진다**
6. 칸[2] 가 `/^\d{1,3}%$/` 가 아니거나 값이 **0~100 범위 밖**이면 그 줄 **거부**(skip).
7. 칸[3] 이 `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/` 가 아니면 그 줄 **거부**(skip).
8. 칸[1] 이 `METRIC_WEEKLY` 면 weekly 슬롯에, `METRIC_5H` 면 five_hour 슬롯에 배정.
   그 밖이면 skip.
   🔒 해당 슬롯이 **이미 채워져 있고 값(pct 또는 reset)이 다르면** → 전체 `{ ok:false }` 로 즉시 종료.
   완전히 동일한 중복 줄은 무해하므로 허용한다.

두 슬롯이 **모두** 채워졌으면:

```
{ ok: true,
  weekly_remaining_pct:    45,                        // number
  five_hour_remaining_pct: 100,                       // number
  weekly_reset_raw:        '2026-09-23T06:57:36Z',    // string, 원문 그대로
  five_hour_reset_raw:     '2026-09-23T05:53:40Z' }
```

하나라도 비었으면 `{ ok: false }`.

🔒 `*_reset_raw` 는 **원문 문자열 그대로** 둔다. `Date.parse` 로 정규화하지 않는다 —
파서를 순수하게 유지하고, 015 가 표시 정책을 정할 때 원자료가 남아 있어야 한다.

**실측 벡터 (파이프, TAB)** → `45` / `100`
**실측 벡터 (콘솔, 공백 정렬 + `Quota:`)** → `51` / `89`
두 형식이 **같은 구조의 결과**를 낸다.

### 7-4. `measureAgy(opts)` — 🔒 절대 reject 하지 않는다

```
measureAgy({ executor = execFile, file = resolveAgyFile(),
             timeoutMs = 45000, nowFn = Date.now }) → Promise
```

골격:

```
new Promise((resolve) => {
  let settled = false;
  const finish = (r) => { if (settled) return; settled = true; clearTimeout(timer); resolve(r); };
  const at = new Date(nowFn()).toISOString();   // ← 시각은 호출 시점 기준

  const timer = setTimeout(() => {
      try { child && child.kill(); } catch (_) {}
      finish({ ok:false, at, kind:'timeout' });
  }, timeoutMs + DEADLINE_SLACK_MS);
  timer.unref && timer.unref();

  let child = null;
  try {
    child = executor(file, AGY_ARGS,
      { shell:false, windowsHide:true, timeout:timeoutMs, encoding:'utf8' },
      (err, stdout, stderr) => finish(classify(err, stdout, stderr, at)));
  } catch (e) {                                  // ← ① 동기 throw 를 모듈 안에서 잡는다
    finish({ ok:false, at, kind:'spawn-failed', ...hint });
  }
});
```

`classify(err, stdout, stderr, at)` 는 **D5 의 표 순서 그대로** 판정한다:

```
if (err) {
  if (typeof err.code === 'string' && err.code !== 'ENOENT') → spawn-failed
  if (err.code === 'ENOENT')                                 → not-installed
  if (err.killed === true)                                   → timeout
  if (typeof err.code === 'number' && err.code !== 0)        → exit-nonzero
  → spawn-failed                     // 분류 불가한 err 는 보수적으로 spawn-failed
}
const p = parseUsage(stdout);
if (!p.ok) → parse-failed
→ { ok:true, at, ...p 의 네 필드 }
```

`hint` 부착(🔒 **판정에는 쓰지 않는다**): `stdout + stderr` 에 로그인 요구를 뜻하는 문구가
보이면 실패 결과에 `hint: 'login-required'` 를 덧붙인다. 보이지 않으면 `hint` 키 자체를 넣지 않는다.

반환 형태:

| 경우 | 반환 |
|---|---|
| 성공 | `{ ok:true, at, weekly_remaining_pct, five_hour_remaining_pct, weekly_reset_raw, five_hour_reset_raw }` |
| 실패 | `{ ok:false, at, kind }` 또는 `{ ok:false, at, kind, hint }` |

🔒 **어떤 경우에도 `reject` 하지 않는다** — 동기 throw 하는 실행기를 주입해도 마찬가지다.

### 7-5. `createAgyMonitor({ measure, log, nowFn })`

내부 상태: `lastSuccess`(초기 `null`), `lastAttempt`(초기 `null`), `inFlight`(초기 `false`).

```
poll() {                                  // 🔒 동기 반환. 값 없음(undefined)
  if (inFlight) return;                   // 🔒 in-flight 가드
  inFlight = true;
  let p;
  try { p = measure(); } catch (e) { inFlight = false; return; }   // 동기 throw 방어
  Promise.resolve(p).then(onResult, onRejected);  // 🔒 예외가 밖으로 새지 않는다
}
```

`onResult(r)`:
- `inFlight = false`
- `lastAttempt = { at: r.at, ok: r.ok, kind: r.ok ? null : r.kind }`
- `r.ok` 면 `lastSuccess = { weekly_remaining_pct, five_hour_remaining_pct,
  weekly_reset_raw, five_hour_reset_raw, at }` — 🔒 **실패면 `lastSuccess` 를 건드리지 않는다**
- 로그 한 줄(아래 형식). `log` 가 없거나 throw 해도 삼킨다.

`onRejected(e)`: `measure` 가 계약을 어기고 reject 해도 모니터는 살아 있어야 한다 —
`inFlight = false`, `lastAttempt = { at: nowIso, ok:false, kind:'spawn-failed' }` 로 흡수한다.

`snapshot()`:

```
{ lastSuccess: {weekly_remaining_pct, five_hour_remaining_pct,
                weekly_reset_raw, five_hour_reset_raw, at} | null,
  lastAttempt: { at, ok, kind } | null,
  inFlight:    boolean }
```

🔒 **매 호출마다 새 객체를 만든다**(얕은 복사면 충분 — 내부 값이 전부 원시값이다).
호출자가 반환값을 수정해도 모니터 내부는 불변임을 테스트로 고정한다.

로그 형식(🔒 고정):

```
성공 : '[agy] gemini weekly_left=' + w + '% five_hour_left=' + f + '%'
실패 : '[agy] fail kind=' + kind            (+ hint 가 있으면 ' hint=' + hint)
```

### 7-6. 테스트 설계 — `test/fixtures/fake-agy.js`

🔒 **경계를 실제로 건너는 검증.** 테스트 실행기:

```js
const FAKE = path.join(__dirname, 'fixtures', 'fake-agy.js');
const exec = (file, args, opts, cb) => execFile(process.execPath, [FAKE, ...args], opts, cb);
```

가짜 스크립트의 계약:

1. 🔒 `process.argv.slice(2)` 가 `['-p','/usage']` 와 **다르면 아무것도 쓰지 않고 `exit 3`**.
   → 인자 고정이 **진짜 프로세스 경계를 넘어서도** 검증된다.
2. 동작은 `opts.env` 의 변수(예: `FAKE_AGY_MODE`)로 고른다:

| 모드 | stdout | exit | 기대 결과 |
|---|---|---|---|
| `pipe` | 🔒 **실측 TAB 4행 그대로** | 0 | `ok:true` 45/100 |
| `console` | 공백 정렬 + `Quota:` 머리줄 | 0 | `ok:true` 51/89 |
| `sentinel` | Gemini 2행 + 다른 버킷 2행(`37%`/`2031-01-01T00:00:00Z`, `23%`/`2032-02-02T00:00:00Z`) | 0 | `ok:true`, 센티넬 값 0회 |
| `empty` | (없음) | 0 | `parse-failed` |
| `login0` | `Error: Please sign in ...` | 0 | `parse-failed` (+`hint`) |
| `login1` | `Error: Please sign in ...` | 1 | `exit-nonzero` (+`hint`) |
| `hang` | — (60초 sleep) | — | `timeout` (🔒 3초 안에) |

🔒 **실측 바이트를 TAB 그대로 stdout 에 쓴다** — 파이프에서 TAB 이 어떻게 오는지가 이 NNN 의 핵심이다.

그 밖의 판정 검증:
- `spawn-failed` — 동기 throw 하는 실행기를 주입한다.
- `not-installed` — `QUAESTOR_AGY_EXE` 를 **존재하지 않는 절대경로**로 두고 **기본 실행기**로 검증한다.
- 🔒 **진짜 `agy` 는 절대 실행하지 않는다.** 기본 실행 파일 해석은 `resolveAgyFile()` 의
  **반환값**(`'agy'`)만 단언한다.

환경변수 조작 테스트는 `try/finally` 로 `process.env` 를 원상복구한다(다른 테스트 파일 오염 방지).

### 7-7. Phase 1 이 건드리지 않는 것

- `watch-loop.js`, `lib/logparse.js`, `lib/control-server.js`, `lib/status-page.js` — **무수정**
- 기존 테스트 파일 **편집 0**
- `/api/status` 응답 · `fields` · 상태 페이지 · 계약 버전 — **무변경**

🔒 **수정 전에는 Phase 1 의 수용 기준이 전부 FAIL 한다**(모듈이 존재하지 않는다).

---

## 8. 위험과 완화

| 위험 | 완화 |
|---|---|
| 파이프/콘솔 구분자 차이로 0행 파싱 | TAB 우선 → 공백 2칸 이상 2단계. 두 실측 벡터를 모두 테스트에 고정 |
| agy 호출이 STOP 판정을 지연 | `await` 하지 않는다 + `pollOnce()` 첫 동작에 배치 + in-flight 가드 |
| agy 줄이 claude 사용량으로 복원됨 | `weekly_left=` 사용, `session=`·`weekly=`·`[poll error]` 부분문자열 금지, Phase 2 의 `deepStrictEqual` 테스트 |
| 다른 버킷 값이 새어나감 | 허용목록 파싱 + 센티넬 픽스처 기계 검증 |
| 자식이 안 죽어 콜백이 영영 안 옴 | 자체 마감 타이머(`timeoutMs + 2000`) + `settled` 플래그 |
| Windows `.cmd`/`.bat` 동기 throw | `shell:false` 고정 + ① 이 동기 throw 를 `spawn-failed` 로 흡수 |
| `watch-loop.js` 에 `claude` 유입 | 로직 전부를 `lib/agy-usage.js` 에 두고 호출 한 줄만 남긴다 |
| 진짜 agy 실행으로 CI 실패 | 모든 실행 경로에 가짜 스크립트를 주입. 기본값은 반환값만 단언 |
