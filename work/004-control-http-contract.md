# 004 — 감독 대상 HTTP 계약면 (`/api/health` · `/api/status`)

## 배경

Foreman 이 감독 대상을 **대상별 특수 코드**로 다뤄 왔다 — 전용 패널, 전용 엔드포인트,
하드코딩된 경로. 그래서 이 제품이 이관될 때 Foreman 이 함께 열려야 했고,
`run-foreman.ps1` 의 경로 한 곳을 빠뜨려 **지금도 Foreman 은 이 감시자를 못 띄운다.**

그 비용을 없애려고 계약이 생겼다 → 🔒 **`_guides\SUPERVISED_TOOL_CONTRACT.md` 를 먼저 읽을 것.**
이 NNN 은 **대상 쪽 절반**이다. Foreman 쪽 절반은 `products\Foreman\work\010` 이 맡는다.

🔒 **의존 방향을 뒤집지 않는다.** 이 제품은 Foreman 을 알지 않는다 —
`require` 하지 않고, 호출하지 않고, Foreman 이 없어도 정상 동작한다. HTTP 로만 만난다.

⚠️ **이 NNN 이 끝나도 화면에는 아무 변화가 없다.** Foreman 의 클라이언트가 아직 미구현이기 때문이다.
그것이 정상이며, 실패가 아니다.

## Project Type

제품(Quaestor) 진화. **ADDITIVE · never-brick.**
🔒 **감시 루프가 본체고 HTTP 는 부가 기능이다.** 아래 §4 가 이 NNN 의 안전 조항이다.

## Scope

### 1. 신규 `p-bellows/lib/control-server.js`

`node:http` 만 쓴다(의존성 추가 금지). 003 이 만든 관측 상태를 읽어 응답한다.

🔒 **[SPEC] `127.0.0.1` 에만 바인딩한다.** `0.0.0.0` 이나 LAN 주소에 열면 이 NNN 은 실패다.
이건 로컬 제어면이지 서비스가 아니다.

포트 기본값 **3210** (실측: 비어 있음. 3000 Foreman · 3100 Armory · 3200 Gate 와 안 겹침).
`bellows-config.json` 의 `control.port` 로 덮어쓸 수 있다.

### 2. `GET /api/health` (필수)

```json
{ "ok": true, "id": "quaestor", "version": "<package.json version>", "startedAt": "<ISO>" }
```

🔒 **[SPEC] `id` 는 `"quaestor"` 다.** 폴더와 저장소는 아직 `Bellows` 이지만
제품 이름은 Quaestor 로 확정됐고, 이 슬러그는 Foreman 설정의 키가 된다.
지금 옛 이름으로 박으면 나중에 양쪽을 두 번 고치게 된다.

⚠️ `/api/health` 의 `ok` 는 **HTTP 면이 살아있다**는 뜻이지 측정이 건강하다는 뜻이 아니다.
측정 건강은 `/api/status` 의 `state` 가 말한다. 🔒 **이 둘을 합치지 말 것** —
합치는 순간 "프로세스는 살아있고 측정은 3주째 죽어 있는" 상태를 다시 초록불로 표시하게 된다.

### 3. `GET /api/status` (필수)

003 의 `deriveState()` 결과를 그대로 계약 형식으로 낸다. **여기서 판정을 새로 하지 말 것.**

```jsonc
{
  "ok": true,
  "summary": "측정 실패 12회 연속 · 마지막 성공 3일 전",
  "state": "crit",
  "fields": [ { "label": "...", "value": "...", "state": "warn" } ],
  "updatedAt": "<ISO>"
}
```

- 🔒 **[SPEC] 부작용 없음.** GET 이 폴링을 유발하거나 STOP.json 을 건드리면 실패다.
  마지막 관측 결과를 읽어 돌려줄 뿐이다
- 🔒 **[SPEC] 응답에 비밀이 없다** — `authToken` 값 · `.profile` 경로 · 쿠키 · 계정.
  003 의 동일 조항을 HTTP 응답 전체에 대해 다시 확인한다

### 4. `watch-loop.js` 배선 — 🔒 never-brick

기동 시 컨트롤 서버를 띄우되, **감시 루프의 생사와 분리한다.**

- 🔒 **[SPEC] 포트 점유(`EADDRINUSE`)·바인딩 실패·핸들러 예외 중 무엇이 나도
  감시 루프는 계속 돈다.** 로그 1회 남기고 HTTP 없이 진행한다.
  차단기가 계기판 때문에 죽으면 안 된다
- 서버 시작 실패는 삼키되 **조용히 삼키지 않는다** — `[control] listen failed: ...` 를 남긴다

### 5. 인증 — `Authorization: Bearer`

계약: Foreman 은 `control.tokenFrom` 이 가리키는 값을 읽어 Bearer 로 보낸다.
없으면 인증 없이 호출하고, 401 을 받으면 "인증 필요" 로 표시한다.

⚠️ **실측: `bellows-config.json` 은 지금 디스크에 없다.** 하드 기본값으로 동작 중이다.
그래서 이 제품이 정할 규칙:

| 상황 | 동작 |
|---|---|
| `control.authToken` 이 설정됨 | Bearer 필수. 불일치/누락 → **401** |
| 설정 안 됨 (지금 상태) | 인증 없이 허용. 방어선은 `127.0.0.1` 바인딩 |

- 🔒 **[SPEC] 토큰 비교는 길이 무관 상수시간 비교**(`crypto.timingSafeEqual`)로 한다
- 🔒 **[SPEC] 401 응답 본문에 기대 토큰을 넣지 않는다**
- 🔒 **[SPEC] 인증 실패를 `ok: true` 로 내지 않는다** — 정보 부재는 성공이 아니다

### 6. `POST /api/stop` — 🔒 구현하지 않는다

계약상 **선택** 조항이라 미구현이 위반이 아니다. 의도적으로 뺀다:

> 계약: "Foreman 은 확인 없이 호출한다"

이 제품의 정지는 **안전장치를 끄는 것**이다. 확인 없이 끌 수 있으면 안 된다.
🔒 **이 결정을 코드 주석과 `PROJECT_INTENT.md` 에 남긴다** — 다음 사람이
"계약에 있는데 왜 없지?" 하고 무심코 추가하지 않도록.

### 7. `deploy.json` 갱신은 이 NNN 의 몫이 아니다

포트가 생겼으니 `deploy.json` 도 바뀌어야 하지만, **데이터 파일이라 forge 를 쓰지 않는다**
(`_guides\PRODUCT_DEPLOY_CONTRACT.md`). 사람이 직접 쓴다.

## Acceptance (hermetic — Chrome·claude.ai·Foreman 없이 돈다)

003 의 `test/run-all.js` 에 이어 붙인다. 🔒 **실제로 포트를 열고 실제로 요청한다** —
주입 픽스처만으로는 "실제로 뜨는가"를 증명하지 못한다(§격리 통과·통합 실패).

- [SPEC] 서버를 **임의의 빈 포트**에 실제로 띄우고 `fetch` 로 `GET /api/health` → **200** + `id === 'quaestor'`
- [SPEC] `GET /api/status` → 200 + `summary`·`state`·`fields` 가 모두 존재
- [SPEC] 응답 JSON 전체 문자열에 `authToken` 값 · `.profile` · `cookie` 가 **없다**
- [SPEC] 토큰 설정 상태에서 헤더 없이 호출 → **401**, 틀린 토큰 → **401**, 맞는 토큰 → **200**
- [SPEC] 토큰 미설정 상태에서 헤더 없이 호출 → **200**
- [SPEC] 이미 점유된 포트로 시작을 시도해도 **호출자에게 예외가 새지 않고**
  `started === false` 를 돌려주며, 감시 루프 쪽 경로는 계속 진행한다
- [SPEC] 바인딩 주소가 `127.0.0.1` 이다 (`server.address().address` 로 확인)
- [SPEC] `GET /api/status` 를 두 번 호출해도 폴링 횟수·STOP.json 이 변하지 않는다
- [SPEC] 테스트 종료 시 서버가 닫혀 프로세스가 매달리지 않는다

## Out of Scope

- Foreman 쪽 클라이언트·패널·등록부 → `products\Foreman\work\010`·011·013
- `POST /api/stop` → §6 대로 **의도적 미구현**
- 폴더·저장소 개명 → 별도 시스템 스펙
- `.prominence` 의 STOP.json 이름·경로 해석 — 🔒 **불변**(계약이 금지)

## USER_GATE

- 감시자를 띄운 뒤 브라우저나 curl 로 `http://127.0.0.1:3210/api/status` 를 열어
  **지금 이 고장난 상태가 `state: "crit"` 으로 나오는지** 눈으로 확인.
  🔒 여기서 `ok` 가 나오면 계약을 구현하면서 3주 침묵을 새 층에 재현한 것이다

## 예상 phase 3

1. `lib/control-server.js` — 리스너 + 라우팅 + `/api/health`·`/api/status`
2. 인증(Bearer·상수시간 비교) + 비밀 차단 검증
3. `watch-loop.js` 배선(never-brick) + `test/run-all.js` 확장(실포트 통합 검증)

## Related

- 계약 원문: `_guides\SUPERVISED_TOOL_CONTRACT.md`
- 상대편 절반: `products\Foreman\work\010-supervised-http-contract-client.md` (미착수)
- 선행: **003** 의 `observation.js` 가 이 NNN 의 데이터 원천이다 — 003 없이는 못 짠다
- ⚠️ 혼동 주의: `/api/health` 의 `ok`(HTTP 생존) ≠ `/api/status` 의 `state`(측정 건강)
