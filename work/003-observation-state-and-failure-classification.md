# 003 — 관측 상태 추적과 실패 분류

## 배경 (왜 이게 먼저인가)

이 감시자는 2026-07-28 11:58 을 마지막으로 **3주간 한 번도 측정에 성공하지 못했다.**
프로세스는 15분마다 살아서 돌았고, 실패는 `bellows.log` 에만 쌓였다(누적 3,658 건).
🔒 **"돌고 있다"와 "작동한다"가 달랐고, 그 차이를 아무도 볼 수 없었다.**

그리고 지금 코드는 **왜 실패했는지도 못 가른다.** 유일한 단서가 이것뿐이다:

```
[poll error] scrape failed: Waiting failed: 20000ms exceeded
```

이 한 줄은 최소 두 가지 원인에서 똑같이 나온다:

1. **로그인 세션 만료** — 페이지엔 갔는데 로그인 화면에 도달
2. **UI 문구/로케일 변경** — 로그인도 정상이고 페이지도 정상인데 한국어 앵커만 사라짐

`lib/scrape.js` 의 대기 조건이 `document.body.innerText.indexOf('마지막 업데이트:') >= 0` 이고
`lib/extract.js` 의 앵커가 전부 한국어(`현재 세션`·`모든 모델`·`[월화수목금토일]`)이기 때문이다.
🔒 **둘을 못 가르면 사람이 재로그인하러 갔다가 헛걸음한다.** 원인 구분이 복구의 선행조건이다.

## Project Type

제품(Quaestor) 내부 로직. **ADDITIVE · never-brick** —
이 NNN 은 판정·기록만 추가한다. STOP.json 스키마·경로·임계 판정은 건드리지 않는다.

## Scope

### 1. 신규 `p-bellows/lib/observation.js` — 순수 모듈

관측 이력을 들고 있는 구조체와, 그것을 계약의 `state` 로 바꾸는 **순수 함수**.
🔒 **부작용 없음 · I/O 없음 · Date.now 는 인자로 주입받는다**(테스트 가능성).

```js
createObservation()            // 초기 상태
recordSuccess(obs, usage, now) // 측정 성공
recordFailure(obs, kind, detail, now) // 측정 실패
deriveState(obs, thresholds, now)     // -> { state, summary, fields }
```

보유할 것:

| 필드 | 의미 |
|---|---|
| `lastSuccessAt` | 마지막으로 **측정에 성공한** 시각 (null = 한 번도 없음) |
| `lastUsage` | 그때의 `session_pct` / `weekly_pct` / reset 문자열 |
| `consecutiveFailures` | 연속 실패 횟수 (성공 시 0 으로 리셋) |
| `lastFailure` | `{ kind, detail, at }` |
| `totalPolls` · `totalFailures` | 누적 |

### 2. `deriveState()` 판정 규칙

🔒 **[SPEC] 측정이 실패 중인데 `state` 가 `ok` 로 나오면 이 NNN 은 실패다.**
프로세스 생존이 아니라 **측정의 신선도**가 판정 근거다. 이 조항이 이 NNN 의 존재 이유다.

🔒 **[SPEC] 정보 부재를 성공으로 승격시키지 않는다.** 측정 이력이 없으면 `ok` 가 아니다.

[DERIVED] 구체적 경계 (폴링 주기 15분 기준, 조정 가능):

| 조건 | state | summary 예 |
|---|---|---|
| `enabled === false` | `idle` | `감시 꺼짐` |
| `lastSuccessAt === null` | `warn` | `첫 측정 대기 중` |
| `consecutiveFailures >= 4` 또는 마지막 성공이 **2시간** 초과 | `crit` | `측정 실패 12회 연속 · 마지막 성공 3일 전` |
| 마지막 성공이 **45분**(3주기) 초과 | `warn` | `측정이 밀림 · 마지막 성공 1시간 전` |
| 신선함 + 임계 접근(stop 선의 90% 이상) | `warn` | `감시 중 · 주간 79%` |
| 신선함 + 여유 | `ok` | `감시 중 · 주간 24%` |

### 3. `fields` 구성

계약(`_guides\SUPERVISED_TOOL_CONTRACT.md`)의 `fields[]` 형식 그대로.
Foreman 은 해석하지 않고 순서대로 그린다.

담을 것: 마지막 성공 측정 시각 · 세션 % · 주간 % · 연속 실패 횟수 ·
마지막 실패 분류와 사유 · STOP 상태(없음/auto/manual + reason) · 적용 중인 임계값 ·
설정 출처(`파일` 또는 `기본값`).

🔒 **[SPEC] 담지 말 것 — `.profile` 경로 · 쿠키 · 계정/이메일 · Chrome 디버그 URL ·
`authToken` 값.** Foreman 은 이 값을 그대로 화면에 그린다.

### 4. 실패 분류 — `lib/scrape.js`

`scrapeUsage()` 가 던지는 오류에 **분류 태그**를 붙인다. `err.kind` 로 노출한다.

| kind | 언제 | 지금 어떻게 보이나 |
|---|---|---|
| `chrome-unreachable` | `puppeteer.connect` 실패 | 이미 별도 메시지 있음 |
| `anchor-timeout` | `waitForFunction` 타임아웃 | **지금 3주째 이것** |
| `invalid-extraction` | 추출은 됐는데 `isValidUsage` 실패 | 이미 별도 분기 있음 |
| `nav-failed` | `page.goto` 실패 | 현재 구분 없음 |

🔒 **핵심: `anchor-timeout` 일 때 진단 정보를 수집한다.**
타임아웃이 난 그 페이지에서 아래를 읽어 `err.detail` 에 담는다:

- `page.url()` — `claude.ai/login*` 으로 리다이렉트됐으면 **로그인 만료**
- `document.body.innerText` 의 **앞 200자** — 로그인 화면이 아닌데 앵커만 없으면 **UI 문구 변경**
- 위 두 힌트로 `detail.hint` 를 `login-expired` / `anchor-missing` / `unknown` 중 하나로 낸다

🔒 **[SPEC] `hint` 를 못 정하면 `unknown` 이다. 추측해서 `login-expired` 라고 쓰지 말 것.**
잘못된 확신이 사람을 헛걸음시킨 것이 이 NNN 의 출발점이다.
⚠️ 수집한 텍스트에 계정 이메일이 섞일 수 있다 — `detail` 은 로그에만 쓰고 **`fields` 에는
`hint` 만 싣는다.** 원문 200자는 응답에 넣지 않는다.

### 5. `watch-loop.js` 배선

- `pollOnce()` 의 성공/실패 각 분기에서 관측 상태를 갱신
- 실패 로그에 `kind` 와 `hint` 를 함께 남긴다 (사람이 로그만 봐도 갈리게)
- 🔒 **파일 맨 아래 즉시실행 루프를 `require.main === module` 가드로 감싼다.**
  지금은 `require('./watch-loop')` 만 해도 감시 루프가 돌기 시작해서
  **모듈을 로드하는 테스트를 쓸 수가 없다.** 이 가드가 6번 검증의 전제다.

🔒 **재구현 금지 — 이미 있는 것을 다시 만들지 말 것:**
`deriveDesired()`(히스테리시스) · `isValidUsage()` · `writeStopJsonAtomic()` ·
`readConfig()` · `resolveStopDir()` 는 **그대로 쓴다.** 이 NNN 은 그 옆에 관측 기록을 더할 뿐이다.

### 6. 검증 하네스 `p-bellows/test/run-all.js`

이 저장소에는 **테스트가 하나도 없다**(실측: 추적 파일 11개, 테스트 0개).
프레임워크를 새로 들이지 말고 `node:test` + `node:assert` 로 짠 뒤,
`run-all.js` 가 전부 실행하고 **실패 시 비-0 으로 종료**하게 한다.

🔒 **[SPEC] 경계를 실제로 건너는 검증 1개 이상** (§격리 통과·통합 실패):
`require('../watch-loop.js')` 가 **루프를 돌리지 않고 성공적으로 로드**되는지 확인한다.
서버가 4일간 못 뜬 채 단위테스트만 전부 통과했던 선례가 있다 —
모듈을 진짜 로드해보지 않으면 그 계열의 결함을 못 잡는다.

## Acceptance (hermetic — Chrome·네트워크·claude.ai 없이 돈다)

- [SPEC] `deriveState()` 는 순수 함수다. 같은 입력 → 같은 출력, 시각은 주입된 `now` 만 쓴다
- [SPEC] `lastSuccessAt=null` 인 상태가 `ok` 를 반환하면 **FAIL**
- [SPEC] `consecutiveFailures` 가 임계 이상인데 `ok` 를 반환하면 **FAIL**
- [SPEC] `deriveState()` 결과를 `JSON.stringify` 한 문자열에 `.profile` · `authToken` ·
  `cookie` · `@`(이메일) 가 나타나면 **FAIL**
- [SPEC] 성공 → 실패 → 실패 → 성공 순서로 기록하면 `consecutiveFailures` 가 0 으로 리셋된다
- [SPEC] `require('../watch-loop.js')` 가 감시 루프를 시작하지 않고 반환한다
- [DERIVED] 주입된 가짜 page 객체(`url()` 이 `claude.ai/login` 을 돌려줌)로
  `hint === 'login-expired'` 가 나온다. 앵커만 없는 정상 페이지면 `anchor-missing` 이다
- [SPEC] 판정이 불가능한 입력에는 `unknown` 이 나온다 — `login-expired` 로 기울지 않는다

## Out of Scope

- HTTP 노출 (`/api/health`·`/api/status`) → **004**
- 로케일 독립 앵커로의 전환 → 별도 NNN (이 NNN 은 **구분**까지만)
- 재로그인 자체 → 사람의 일. 에이전트가 할 수 없다
- STOP.json 스키마·경로·`deriveDesired` 임계 판정 — 🔒 **불변**

## USER_GATE

- 실제 고장난 환경에서 한 주기 돌려 `hint` 가 무엇으로 나오는지 확인
  → 이 값이 `login-expired` 면 사람이 재로그인, `anchor-missing` 이면 앵커 수리다.
  **이 판정이 다음 작업의 방향을 정한다.**

## 예상 phase 3

1. `lib/observation.js` — 상태 구조체 + `deriveState()` 순수 판정 + `fields` 구성
2. `lib/scrape.js` — 실패 분류(`err.kind`) + `anchor-timeout` 진단 수집(`hint`)
3. `watch-loop.js` 배선 + `require.main` 가드 + `test/run-all.js` 하네스

## Related

- 계약 원문: `_guides\SUPERVISED_TOOL_CONTRACT.md` (운영층 `state`·`fields` 형식)
- 이 제품의 이관 이력: `add-bellows-product-migration\` (2026-08-18, 도구→제품)
- ⚠️ 혼동 주의: `deriveDesired()`(STOP 여부, 기존)와 `deriveState()`(화면 표시, 신규)는
  **다른 함수다.** 전자는 차단기, 후자는 계기판. 합치지 말 것
