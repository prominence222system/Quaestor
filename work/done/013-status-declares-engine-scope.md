# 013 — `/api/status` 가 자기 범위를 말한다 (claude 전용임을 응답에 싣는다)

## Project Type

제품 진화(Quaestor) · Node · **ADDITIVE**(기존 응답 필드 불변) · never-brick

## Project Goal

계약 `supervised-v1` 은 1.3.0 까지 **어느 엔진 이야기인지 한 번도 말하지 않았다.**
`allowance`·`usage` 의 모든 숫자는 `lib/scrape.js:8` 의 `ORIGIN = 'https://claude.ai'`
관측에서만 나오는데, **응답에는 그 사실이 없다.**

**실제 위험**: forge 는 `buildEngine: alternate` 로 엔진을 번갈아 돌린다. 2026-09-20 실측 —
25개 프로젝트에서 **agy 스텝 1,037 / claude 스텝 2,784, 전체의 27%가 agy** 다.
🔒 **agy 라운드 직전에 이 API 에 물으면 `allowed: true` 가 오는데, 그 숫자는 다른 지갑 이야기다.**

2026-09-21 에 계약 문서에 **산문으로** 명시했다. 그러나 같은 문서가 스스로
*"`fields` 는 표시 전용이므로 기계는 `allowance`·`usage` 두 키를 쓸 것"* 이라고 적어 뒀다.
**기계 소비자는 볼트 산문을 읽지 않는다.**

선례: `authMode: bearer` 를 선언했는데 토큰이 실재하지 않았고, Agora 의 `authdecl.js` 는
**fs import 가 없어 그것을 확인할 수 없었다.** 🔒 **선언이 응답에 실리지 않으면 아무도 검증할 수 없다.**

## Scope

### 1) `lib/source.js` 를 신설해 origin 과 엔진 라벨을 함께 export 한다

```js
// lib/source.js  -- import 0개. observation.js 가 순수성을 지키며 require 할 수 있어야 한다.
const ORIGIN = 'https://claude.ai';
const ENGINE = 'claude';
module.exports = { ORIGIN, ENGINE };
```

- `lib/scrape.js` 는 **자기 리터럴을 버리고** 이 모듈에서 `ORIGIN` 을 가져다 쓴다
- 🔒 **`lib/source.js` 는 아무것도 require 하지 않는다.** `observation.js` 가 이것을 require 해야 하는데,
  `scrape.js` 를 require 하면 스크래퍼 의존(`extract`·`env`)이 순수 판정 경로로 끌려 들어온다

🔒 **기존 테스트 이관 — 약화가 아니라 이동이다**

`test/scrape-classify.test.js:353` 이 *"`lib/scrape.js` 안에 `/claude/g` 가 **정확히 1회**"* 를 단언한다.
상수가 나가면 0 이 되어 FAIL 한다. **불변식은 "도메인은 repo 에 한 곳" 이지 "그 한 곳이 scrape.js" 가 아니다.**

- 그 단언을 **`lib/source.js` 를 향하도록 이관**한다. 강도 동일(`strictEqual(..., 1)`)
- `lib/scrape.js` 쪽은 **0 회**를 단언하도록 남긴다(리터럴이 되살아나는 것을 막는다)
- 🔒 **삭제·완화 금지.** 이것은 기준 약화가 아니라 같은 불변식의 위치 이동이다

⚠️ `test/watch-loop.test.js:71` 이 `watch-loop.js` 의 `/claude/` 를 **0** 으로 못박고 있다.
`watch-loop.js` 가 `source.js` 를 require 하게 만들지 말 것(경로 문자열에 `claude` 가 없으므로
require 자체는 안전하지만, 불필요하다).

### 2) `deriveUsage` 와 `deriveAllowance` 가 **같은 목록**을 싣는다

🔒 **필드명과 값은 design 재량이 아니다. 아래로 확정한다.**

```jsonc
"usage":     { ..., "covers": ["claude"] },
"allowance": { ..., "covers": ["claude"] }
```

- 키 이름은 **`covers`**, 값은 **정확히 `["claude"]`** (문자열 배열)
- 🔒 **확정하는 이유**: 랜딩 후 세션이 Agora `supervised-v1.md` 를 1.4.0 으로 올릴 때 **같은 토큰**을
  적어야 한다. 구현자가 고른 이름을 세션이 예측할 수 없으면 문서와 응답이 어긋난 채 발행된다
- 🔒 **"목록에 없으면 이 API 는 모른다"** 가 규칙이다. 나중에 엔진이 늘면 목록이 늘고,
  안 늘면 모른다는 뜻이 유지된다. 단일 문자열은 그 규칙을 표현하지 못한다
- 🔒 **`allowance` 에도 싣는 이유**: Goal 이 위험하다고 지목한 필드가 `allowance.allowed` 다.
  `usage` 에만 실으면 **`allowance` 만 읽는 소비자는 여전히 범위 없는 판정을 받는다** — 이 NNN 이
  자기 목표를 절반만 닫는다. `deriveAllowance(stopInfo, usage, hasObservation)`(`observation.js:285`)
  는 **이미 `usage` 를 인자로 받는다** — 새 배관이 필요 없다
- 🔒 `lib/observation.js` 는 **순수 함수다**([SPEC] no I/O). `source.js` 를 `require` 하는 것은 I/O 가 아니다
  (`test/observation.test.js` 의 순수성 검사는 `Date.now(`·인자 없는 `new Date()`·`require('fs')` 만 막는다)
- 🔒 **값·키 모두 ASCII 토큰.** `test/control-server.test.js:337` 이 `usage` 안의 한글을 금지한다.
  한국어 표기는 `status-page.js` 에서만 만든다
- 🔒 **기존 필드는 하나도 바꾸지 않는다.** Foreman 이 1.3.0 에 핀을 걸고 있고(2026-09-20 갱신),
  Agora 영향도 판정이 `breaks: false` 다. 이것을 유지해야 한다

### 3) 상태 페이지는 **payload 에서 받아 그린다** — 소스에 라벨을 쓰지 않는다

🔒 `test/status-page.test.js:230` 이 *"`status-page.js` 안에 `/claude/gi` 가 **0회**"* 를 단언한다([SPEC] 태그).
**이 테스트는 그대로 통과해야 한다 — 약화 대상이 아니다.**

- `usage.covers` 로 들어온 **값을 `esc()` 해서 출력**할 뿐이다
- 🔒 소스에 `'claude'` 리터럴도, `covers.includes('claude')` 같은 분기도 **넣지 않는다**
- 🔒 **origin URL 문자열을 HTML 에 넣지 말 것.** `test/status-page.test.js:151` 과
  `test/control-server.test.js:1493` 이 `https://` **부분문자열 자체**를 금지한다
- 상태 페이지는 **읽기 전용·외부 요청 0** 유지(010 조항)

### 4) 계약 버전 — 그리고 버전 핀 테스트 갱신

- `lib/control-server.js:43-45` 의 `CONTRACTS` 를 **`1.4.0`** 으로
- 그 상수 위 주석에 `1.3.0 -> 1.4.0: usage·allowance 에 covers 추가 (하위호환)` 한 줄 추가
- 🔒 **버전 핀 테스트를 같이 고친다**(허가된 편집): `test/control-server.test.js:176`·`:217` 의
  단언값과 `:169`·`:210` 의 제목 문자열을 `1.4.0` 으로

## Acceptance — [SPEC]

1. `GET /api/status` 응답에서 `usage.covers` 가 **정확히 `["claude"]`** 다(`deepStrictEqual`)
2. 🔒 **라벨이 origin 과 같은 모듈에서 나온다** — `lib/source.js` 가 `ORIGIN` 과 `ENGINE` 을 **함께 export**
   하고, `lib/scrape.js` 소스에 `/claude/g` 매치가 **0회**다.
   부수 불변: 문자열 `https://claude.ai` 는 `lib/` 전체에서 **여전히 정확히 1회**(= `source.js`)
3. 🔒 `allowance.covers` 가 `usage.covers` 와 **deep-equal** 이다(같은 응답 안에서)
4. `GET /api/health` 의 `contracts['supervised-v1']` 이 `1.4.0`
5. 🔒 **응답이 agy 를 덮는다고 말하지 않는다** — `covers` 에 `agy` 가 없다
6. 🔒 **실제 바인딩된 서버의 `GET /` 응답 HTML** 이 범위를 사람이 읽을 수 있게 담는다
7. 🔒 **관측 이력이 없을 때도 `covers` 는 나온다.** `session_pct` 등이 `null` 이어도 `covers` 는 `null` 이 아니다 —
   *"무엇을 재는가"* 와 *"얼마나 쟀는가"* 는 다른 질문이다
8. 🔒 **위에서 명시한 곳 외 회귀 0.** 허용된 편집은 **셋뿐**이다:
   (a) `test/scrape-classify.test.js:353` 의 단언을 `lib/source.js` 로 이관(+ scrape.js 는 0회 단언),
   (b) `test/control-server.test.js:176`·`:217` 및 제목 `:169`·`:210` 의 버전 핀,
   (c) 그 외 없음. 🔒 `test/status-page.test.js:230` 과 `test/watch-loop.test.js:71` 은 **손대지 않는다**

### 경계를 실제로 건너는 검증

- 🔒 수용기준 1·3·4·6 은 **실제로 `127.0.0.1` 에 바인딩한 서버에 HTTP 요청을 보내** 확인한다.
  `test/control-server.test.js` 에 이미 그 경로가 있다 — `/api/status`·`/api/health` 조립 경로와,
  `GET /` HTML 을 읽는 테스트(`:1437`·`:1450`·`:1464`·`:1491`). **재구현하지 말고 거기에 얹는다**
- 🔒 **순수 렌더러에 손으로 만든 payload 를 넣어 확인한 것은 수용기준 6 을 충족하지 않는다.**
  `renderStatusPage` 는 순수 함수라 픽스처로 초록을 만들 수 있다. `buildStatusPayload` 가 `GET /`
  경로에서 필드를 떨구면 그 테스트는 끝까지 모른다 — 이 프로젝트가 이름 붙인 "격리 통과·통합 실패" 다

### 🔒 수정 전 상태 (사실 확인 완료, 2026-09-21)

- **반드시 FAIL 하는 것: 수용기준 1·3·4·6** — `lib/` 전체에 `covers`·`ENGINE` 이 0건이고,
  계약 상수는 `1.3.0` 이며, 화면에 범위 표기가 없다
- ⚠️ **수용기준 2 의 부수 불변("`https://claude.ai` 가 `lib/` 에 정확히 1회")은 지금도 참이다.**
  실측: `grep -rn "claude\.ai" lib/` → 1건(`lib/scrape.js:8`), 대조군 `require(` 14건.
  🔒 **그 절을 "전 실패" 항목으로 읽지 말 것** — 깨뜨리지 말아야 할 불변이다.
  수용기준 2 에서 **실제로 오늘 실패하는 부분은 "`scrape.js` 에 `/claude/g` 0회"** 쪽이다(현재 1회)

## 예상 phase 3

1. `lib/source.js` 신설 + `scrape.js` 가 require + `scrape-classify` 단언 이관
2. `deriveUsage`·`deriveAllowance` 에 `covers` + `CONTRACTS` 1.4.0 + 버전 핀 갱신 + 실서버 HTTP 검증
3. `status-page.js` 가 payload 에서 `covers` 를 그림 + 실서버 `GET /` HTML 검증

## USER_GATE

- 상태 페이지를 열어 **"이 숫자가 claude 것"이라는 게 설명 없이 읽히는지** 확인한다.
  읽히지 않으면 문구 문제이지 구현 문제가 아니다

## Related

- 계약 문서 `2. Area/Prominence_Agora/apis/Quaestor/supervised-v1.md` — 2026-09-21 에 같은 내용을
  **산문으로** 명시했다. 이 NNN 은 그것을 **응답에** 싣는다.
  🔒 **랜딩 후 그 문서의 `version` 을 1.4.0 으로 올리고 `covers` 를 적는 것은 세션 몫**(forge 는 볼트를 안 건드린다)
- ⚠️ **MASTER.md `Constraints` 의 "`claude` grep 0건" 규칙은 Claude CLI 호출 금지를 뜻한다.**
  이 NNN 이 추가하는 **엔진 라벨 리터럴은 `lib/source.js` 한 곳에서만 허용**된다(MASTER 도 같이 고친다)
- ⚠️ **agy 잔량을 재려는 것이 아니다.** agy/Antigravity 에는 스크립트로 읽을 쿼터 API 가 없다
  (벤더 확인 + 로컬 상태 전수 스캔 + 로그에 숫자 없음). Gemini 웹은 **다른 지갑**이다.
  이 NNN 은 **"우리가 agy 를 모른다"는 사실을 응답에 적는 것**이다
- agy **소비량**은 forge 가 `.p-forge/status.json` 의 `history[]` 에 이미 기록한다 → Agora 요청 `0013`
- Agora 요청 `0007` — agy **잔량** 오보 건(Foreman). 별개다
- 007(`allowance`·`usage` 신설) · 011(`contracts` 신설) 의 연장선. **둘 다 추가만으로 성공한 선례다**
- 🔒 **`deriveDesired()`·STOP.json 은 불변 영역이다**(MASTER 참조). 이 NNN 은 그 근처도 가지 않는다
