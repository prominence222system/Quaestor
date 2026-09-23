# 015 — agy(Gemini) 잔량을 보여준다: `/api/status` · `fields` · 상태 페이지 · 계약 1.5.0

## Project Type

제품 진화(Quaestor) · Node · **ADDITIVE**(기존 필드·판정 불변) · never-brick.
🔒 **014 가 선행 조건이다.** 014 의 `lib/agy-usage.js` 의 `createAgyMonitor().snapshot()` 을 소비한다. 재구현하지 말 것.

## Project Goal

014 가 agy(Gemini) 잔량을 매 폴 재고 기억한다. 이 NNN 은 그것을 **기계(Foreman·다른 소비자)와 사람이 볼 수 있게** 한다.

🔒 **Foreman 은 `/api/status` 의 최상위 키를 화이트리스트로 거른다**
(`products/Foreman/supervised-helpers.js:148` 의 `STATUS_CONTRACT_KEYS`: `ok·summary·state·fields·updatedAt·allowance·usage`).
새 최상위 `agy` 는 **Foreman 에서 떨어진다.** 반면 **`fields[]` 는 손대지 않고 통과시키고 그대로 그린다**
(같은 파일 `:228`, `public/index.html:2942`). 그래서 이 NNN 은 두 가지를 같이 한다:

- **최상위 `agy` 블록** — 기계용. Foreman 이 쓰려면 화이트리스트에 한 줄 추가가 필요하다(랜딩 후 세션이 요청한다)
- **`fields` 의 Gemini 행** — 사람용. **Foreman 코드 수정 없이** Quaestor 패널에 바로 보인다

## Scope

### 1) `lib/observation.js` 에 `deriveAgy(snapshot, nowMs)` — 순수 함수

014 모니터의 `snapshot()` 을 받아 응답용 블록을 만든다. 🔒 **순수**: `./agy-usage` 도 `child_process` 도 require 하지 않는다.
stale 판정은 이 파일 안의 `STALE_WARN_MS` 를 그대로 쓴다.

**응답 블록 — 이름과 값은 design 재량이 아니다**(랜딩 후 Agora 계약 1.5.0 에 같은 키를 적는다):

```jsonc
"agy": {
  "covers": ["agy"],
  "bucket": "Gemini Models",
  "weekly_remaining_pct": 45,               // 🔒 남은 % — claude 쪽 *_pct 는 "쓴 %" 다. 뜻이 반대라 이름을 다르게 한다
  "five_hour_remaining_pct": 100,
  "weekly_reset": "2026-09-23T06:57:36Z",
  "five_hour_reset": null,                  // 🔒 그 버킷이 100% 면 null
  "measured_at": "2026-09-23T06:10:02Z",
  "age_sec": 12,
  "stale": false,
  "last_error": null
}
```

🔒 **`state` 라는 키를 쓰지 않는다.** 최상위 `state`(`ok|warn|crit|idle`)와 이름이 겹쳐 소비자가 같은 정규화에 넣는다.

**진리표 — 이대로 구현한다**(claude 쪽 `lastUsage` 규율과 같다: 이전 성공값은 실패로 지워지지 않는다):

| 상황 | `*_pct` · `*_reset` · `measured_at` · `age_sec` | `stale` | `last_error` |
|---|---|---|---|
| 스냅샷 없음 / 끝난 시도 없음 | 전부 `null` | `true` | `"not-yet-measured"` |
| 마지막 시도 성공 | 성공값 | `age > STALE_WARN_MS` | `null` |
| 마지막 시도 실패, 이전 성공 있음 | **이전 성공값 유지** | `age > STALE_WARN_MS` | 실패 `kind` |
| 마지막 시도 실패, 성공 이력 없음 | 전부 `null` | `true` | 실패 `kind` |

- `last_error` 값: `null` · `not-yet-measured` · `spawn-failed` · `not-installed` · `timeout` · `exit-nonzero` · `parse-failed`
- 🔒 **잔량 100% 인 버킷의 `*_reset` 은 `null`** 이다. 안 쓴 버킷의 리셋 시각은 "지금 + 창 길이" 라서 호출할 때마다 밀린다
  (2026-09-23 실측: 두 실행 사이에 약 18분 이동). 표시하면 거짓 정보다
- 🔒 **측정 이력이 없으면 `*_pct` 는 `null` 이다 — 0 도 100 도 아니다**
- 014 의 `hint` 는 응답에 싣지 않는다(로그 전용)

### 2) `deriveState` 가 Gemini `fields` 행을 **덧붙인다** — 판정은 안 바꾼다

- 🔒 Gemini 행은 **`deriveState` 안에서** 만든다. agy 스냅샷은 **기존 인자 `ctx.agy`** 로 받는다 — 시그니처는 3인자 그대로.
  행 값은 `deriveAgy(ctx.agy, nowMs)` 로 계산해 **응답 블록과 같은 판정**을 쓴다
- 🔒 **이유**: `test/control-server.test.js` 여러 곳이 `body.fields` 를 **같은 입력으로 다시 계산한**
  `deriveState(snap.observation, snap.ctx, ...).fields` 와 deepStrictEqual 로 비교한다(호출 지점 실측: `:225`·`:260`·`:280`·`:1623`·`:2421`).
  행을 `control-server.js` 에서 덧붙이면 그 비교가 전부 깨진다. 행을 `deriveState` 안에서 만들면 양쪽이 같은 입력이라
  **수정 없이** 통과한다. `control-server.js` 는 `fields: st.fields` 를 **그대로 둔다**
- 행은 기존 8행(`마지막 성공 측정`…`설정 출처`) **뒤에 덧붙인다**. 기존 행의 순서·라벨·값은 불변
- 두 행: 라벨 `Gemini 주간 잔량`, `Gemini 5시간 잔량`. 🔒 **"잔량"** 을 라벨에 넣는다 — 바로 위 `세션 사용량`/`주간 사용량` 은
  **쓴 %** 라서 라벨이 말하지 않으면 사람은 반대로 읽는다
- 값(**항상 문자열**): `measured_at` 이 `null` 이면 **`모름`** · `stale` 이면 **`45% (낡음)`** · 그 외 **`45%`**.
  🔒 `-` 나 `0%` 로 뭉개지 말 것
- 🔒 **Foreman 은 행의 `state` 를 버리고 label/value 문자열만 그린다**(문자열이 아닌 행은 조용히 건너뛴다, 최대 50행,
  200자에서 자른다). 그래서 **낡음 여부는 값 텍스트에 담는다** — 행 `state` 에 의미를 두지 말 것
- `ctx.agy` 가 없어도 두 행은 **항상** 붙는다(값 `모름`). 행 집합이 상황마다 바뀌지 않게 한다
- 🔒 **agy 입력은 `state`·`summary` 에 영향을 주지 않는다** — 같은 obs/ctx 에 agy 를 넣었을 때와 뺐을 때 `state`·`summary` 가 같다

### 3) `watch-loop.js` — 스냅샷을 응답 경로로 넘긴다

- `controlSnapshot()` 이 돌려주는 `ctx` 에 `agy: agyMonitor.snapshot()` 을 **추가**한다. 기존 ctx 키는 불변
- 🔒 **`watch-loop.js` 의 문자열 `claude` 는 0회를 유지한다**(주석·변수명 포함)

### 4) `lib/control-server.js` — 최상위 `agy` 블록 + 계약 1.5.0

- `/api/status` 최상위에 `agy: deriveAgy(snap.ctx && snap.ctx.agy, nowMs)` 를 **추가**한다
- 🔒 **`usage` · `allowance` · `summary` · `state` · `fields` · `updatedAt` · `ok` 의 의미·값은 불변**.
  `usage.covers` 와 `allowance.covers` 는 **계속 `["claude"]`** — `allowance` 는 여전히 claude 만 판정한다
- `CONTRACTS` 를 **`1.5.0`** 으로. 상수 위 주석에 `1.4.0 -> 1.5.0: 최상위 agy 블록 추가 (하위호환)` 한 줄
- 🔒 **`control-server.js` 의 문자열 `claude` 는 0회를 유지한다**(`test/control-server.test.js` 가 못박는다)

### 5) `lib/status-page.js` — Gemini 구역

- payload 의 `agy` 블록을 **서버에서** 그린다. 제목·라벨은 **`Gemini`** 로 쓴다
- 🔒 **렌더된 HTML 에 부분문자열 `agy` 가 0회여야 한다** — `test/control-server.test.js:1510` 이 그것을 단언하고, 이 NNN 은
  그 테스트를 **바꾸지 않는다.** 그러려면: class/id 이름에 `agy` 금지(예: `gemini-zone`), `covers` 를 페이지에 그리지 않음,
  `last_error` 는 **한국어로 풀어** 그린다(`측정 전` · `실행 파일 없음` · `시간 초과` · `실패(종료 코드)` · `형식 불일치` · `실행 실패`),
  인라인 스크립트(`sigOf`)에 agy 를 넣지 않는다
- ⚠️ **알고 두는 한계**: 자동 새로고침 시그니처가 claude 값만 보므로, **Gemini 만 바뀐 경우**엔 페이지가 다음 재렌더까지
  옛 값을 보인다. 정상 폴에서는 claude 의 `measured_at` 이 매번 바뀌어 같이 갱신된다
- 🔒 Gemini 구역은 **루트 `<main>` 의 class·style·data-sig 를 바꾸지 않고, 기존 `st-*` 클래스 토큰을 쓰지 않는다**
  (그러면 agy 가 모름일 때 페이지 전체가 낡음으로 칠해진다). 낡음은 구역 안의 텍스트로만 표시한다
- 🔒 `lib/status-page.js` 의 `/claude/gi` 는 **0회**(`test/status-page.test.js:230`). `https://` 부분문자열 금지. 외부 요청 0
- 🔒 값이 없으면 `0%` 가 아니라 **`모름`**. 리셋 시각은 `null` 이 아닐 때만 그린다

## Acceptance — [SPEC]

1. 실서버(`127.0.0.1` 바인딩) `GET /api/status` 최상위에 `agy` 가 있고, 키 집합이 위 스키마와 **정확히** 같다
2. 🔒 진리표 네 줄이 각각 재현된다(`deriveAgy` 단위 테스트)
3. 🔒 **100% 리셋 센티넬**: 스냅샷의 `five_hour_remaining_pct = 100`, `five_hour_reset_raw = "2030-05-05T05:05:05Z"` 일 때
   `/api/status` 본문과 `GET /` HTML 어디에도 `2030-05-05` 가 없다. 대조로 weekly 쪽 리셋 센티넬은 나온다
4. 🔒 **독립성**: `ctx.agy` 가 실패 상태(`last_error: "timeout"`, 성공 이력 없음)일 때의 `usage`·`allowance`·`state`·`summary` 가
   `ctx.agy` 가 없을 때와 **deepStrictEqual** 이다 — 실서버에서 확인
5. `fields` 의 마지막 두 행이 `Gemini 주간 잔량` / `Gemini 5시간 잔량` 이고 값이 **문자열**이다.
   이력 없음 → `모름`, 낡음 → `N% (낡음)`, 정상 → `N%`
6. 실서버 `GET /` HTML 에 Gemini 구역이 있고, 🔒 **부분문자열 `agy` 가 없다**
7. `GET /api/health` 의 `contracts["supervised-v1"]` = `1.5.0`
8. 🔒(구조) `watch-loop.js` 의 `controlSnapshot()` 이 돌려주는 ctx 에 `agy` 키가 있고, 그 값은 모니터의 `snapshot()` 에서 온다
   (소스에서 `controlSnapshot` 본문을 잘라 단언 — 기존 구조 테스트 방식과 같다)
9. 🔒 **아래 명시한 편집 외 회귀 0**

### 🔒 허가된 기존 테스트 편집 — 이것뿐이다

- `test/control-server.test.js:231` · `:501` · `:1632` · `:2425` — 최상위 키 집합 배열에 `'agy'` 추가(4곳)
- `test/control-server.test.js:169`·`:176` 과 `:210`·`:217` — 두 테스트의 **제목과 단언값** 모두 `1.4.0` → `1.5.0`
- `test/observation.test.js:236-244`(`fields include all required items`) — 라벨 배열 **끝에** `'Gemini 주간 잔량'`, `'Gemini 5시간 잔량'`
  두 개만 추가. 기존 8개의 순서·문자열 불변
- 🔒 **그 외 전부 약화·삭제 금지.** 특히 `:1510`(HTML 에 `agy` 없음)과 `:373`·`:374`·`:391`·`:392`(`usage`/`allowance` 의
  covers 에 `agy` 없음)는 **그대로 통과해야 한다** — 이 NNN 은 두 covers 를 바꾸지 않는다

### 경계를 실제로 건너는 검증

- 🔒 수용기준 1·3·4·6·7 은 **실제 바인딩된 서버에 HTTP 요청**으로 확인한다(`test/control-server.test.js` 의 기존 경로에 얹는다).
  `ctx.agy` 는 014 모니터의 스냅샷 형태 그대로 주입한다
- 🔒 **수정 전에는 1·5·6·7·8 이 반드시 FAIL 한다**(`agy` 키 없음 · Gemini 행 없음 · 구역 없음 · 계약 1.4.0 · ctx 에 agy 없음)

## 예상 phase 3

1. `observation.js` — `deriveAgy`(진리표·100% 규칙) + `deriveState` 의 Gemini 행(판정 불변) + 라벨 목록 편집
2. `watch-loop.js` 스냅샷 전달 + `control-server.js` 최상위 블록 · `CONTRACTS` 1.5.0 · 허가된 테스트 편집 + 실서버 검증
3. `status-page.js` Gemini 구역(HTML 에 `agy` 0회 · `st-*` 비사용) + 실서버 `GET /` 검증

## USER_GATE

- 상태 페이지에서 Gemini 잔량이 **claude 사용량과 헷갈리지 않게** 읽히는지(한쪽은 쓴 %, 한쪽은 남은 %)
- 🔒 **Foreman 의 Quaestor 패널에 Gemini 두 행이 Foreman 수정 없이 나오는지** — 이것이 이 NNN 이 Foreman 에 보이는 유일한 경로다
- 재시작 후 1분 안에 `/api/status` 의 `agy.last_error` 가 `null` 이 된다. `not-yet-measured` 가 계속되면 연결 누락이다

## Related

- 014 — 측정. 이 NNN 은 그 결과를 소비만 한다
- 013 — `covers` 신설. 이 NNN 은 `usage`/`allowance` 의 `covers` 를 **바꾸지 않고** 별도 블록에 `["agy"]` 를 둔다
- 007·011·013 — 모두 **추가만**으로 성공한 선례
- 🔒 **불변 영역**: `deriveDesired()` · STOP.json · 히스테리시스 · 수동 STOP
- 랜딩 후 세션 몫: Agora `supervised-v1` **1.5.0** 발행, Foreman 에 핀 갱신 + `STATUS_CONTRACT_KEYS` 에 `agy` 추가 요청
