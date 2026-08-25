# 008 — 임계를 넘었는데 허가하는 구멍 막기

## 배경 — 007 랜딩 후 실제로 띄워보고 나온 것

007 은 테스트 191개를 통과했다. 그런데 컨트롤 서버를 실제로 띄워 직렬화된 응답을 받아보니:

```
입력: session 97% / weekly 99%   (stop 선 = session 90 / weekly 85)

"allowance": { "allowed": true, "reason": "under-threshold", "confidence": "measured" }
"usage":     { "session_headroom": 0, "weekly_headroom": 0, ... }
```

🔒 **주간 99% 인데 `allowed: true` 다.** 게다가 `reason` 이 `"under-threshold"` —
**사실이 아닌 것을 단언한다.** `headroom` 은 0 으로 정확히 계산해놓고서.

**구현 잘못이 아니다. 007 스펙이 그렇게 시켰다:**

> `allowed` 판정은 기존 차단기를 그대로 읽는다. 🔒 재판정 금지.
> | STOP 없음 + 측정 신선 | `true` | `under-threshold` |

"재구현 금지"를 지키려다 **`allowed` 를 `STOP.json` 존재 여부에만 묶었다.**
손에 측정치를 들고 있으면서 보지 않는다.

### 평소엔 안 드러난다 — 그러나 벌어지는 간극이 있다

임계를 넘으면 `deriveDesired()` 가 STOP 을 쓰므로 대개는 `allowed: false` 가 된다. 다만:

| 간극 | 설명 |
|---|---|
| 측정 직후 ~ STOP 쓰기 전 | 짧지만 실재한다 |
| **STOP 쓰기 실패** | `writeStopJsonAtomic()` 이 디스크·권한 문제로 실패해도 루프는 계속 돈다 |
| STOP.json 외부 삭제 | 사람이 지우거나 정리 스크립트가 지운 뒤 |
| **`enabled: false`** | 설정이 감시를 끄면 임계 검사를 건너뛰고 auto STOP 을 **지운다**. 사용량이 99% 여도 STOP 이 없다 |

🔒 **이 제품이 존재하는 이유가 정확히 그 실패(한도를 넘었는데 계속 쓰는 것)를 막는 것**인데,
새 API 에 그 구멍을 만들어 넣었다.

## Project Type

제품(Quaestor) 진화. **작은 수정 · ADDITIVE.**
🔒 `fields` · `summary` · `state` · `usage` 의 숫자 계산은 **불변**. `allowance` 판정만 고친다.

## Scope

### 1. `allowed` 판정에 측정치 비교를 추가한다 (우선순위 순)

| # | 조건 | `allowed` | `reason` | `confidence` |
|---|---|---|---|---|
| 1 | 측정 이력 없음 / 오래 죽음 | `null` | `unmeasurable` | `unknown` |
| 2 | STOP 활성 | `false` | STOP 의 `reason`(수동은 `manual-stop`) | `measured` |
| 3 | 🆕 **측정치가 stop 선 이상** | **`false`** | **`over-threshold`** | `measured` |
| 4 | 그 외 | `true` | `under-threshold` | 신선 `measured` / 밀림 `stale` |

- 3번 판정은 `session_pct >= session_stop` **또는** `weekly_pct >= weekly_stop`
- 🔒 **[SPEC] 이것은 재판정이 아니다.** `deriveDesired()` 의 히스테리시스(멈춤선 ≠ 해제선)를
  흉내내지 않는다. **이미 계산한 `headroom` 이 0 이면 허가하지 않는다**는 안전선을 하나 더 둘 뿐이다.
  🔒 `deriveDesired()` 와 STOP.json 쓰기 로직은 **한 글자도 건드리지 않는다**

### 2. 🔒 거짓 단언 금지

🔒 **[SPEC] `reason` 이 `under-threshold` 인데 어느 한쪽이라도 stop 선 이상이면 실패다.**
API 가 사실이 아닌 것을 말하는 것은 값이 보수적이지 않은 것보다 나쁘다 —
소비자는 `reason` 을 읽고 판단하기 때문이다.

### 3. 🔒 불변식 하나로 못박는다

🔒 **[SPEC] `allowed === true` 이면 `session_headroom > 0` 이고 `weekly_headroom > 0` 이다.**

이 한 줄이 이 NNN 의 핵심이다. 두 값은 이미 올바르게 계산되고 있으므로,
이 불변식이 서면 같은 구멍이 다시 나기 어렵다. **테스트로 고정할 것.**

## Acceptance (hermetic)

🔒 **[SPEC] 수정 전에는 첫 항목이 반드시 FAIL 해야 한다.** 전 실패 → 후 성공이 확인돼야 진짜 잡은 것이다.

- [SPEC] `session 97 / weekly 99`(stop 90/85), STOP 없음, 측정 신선
  → `allowed === false`, `reason === 'over-threshold'` 🔒 `true` 면 실패
- [SPEC] 불변식: 무작위/경계 조합에서 `allowed === true` 인 모든 경우에
  `session_headroom > 0 && weekly_headroom > 0`
- [SPEC] 경계값 — `pct === stop` 은 **초과로 본다**(`>=`). `stop - 1` 은 허가
- [SPEC] 한쪽만 넘어도 `false`(session 만 초과 / weekly 만 초과 각각)
- [SPEC] STOP 활성이 3번보다 **우선**한다 — 수동 STOP + 임계 초과면 `reason === 'manual-stop'`
- [SPEC] 측정 불가가 **최우선** — `allowed === null`(007 동작 유지)
- [SPEC] `enabled: false` + 임계 초과 + STOP 없음 → `allowed === false`
  (감시가 꺼져 있어도 숫자가 말하는 사실은 바뀌지 않는다)
- [SPEC] 007 의 나머지 응답이 **회귀 없음**: `usage` 숫자 타입 · ASCII 키 · `fields` 8개 ·
  `summary`/`state` 동일
- [SPEC] 🔒 **경계 검증**: 실제 포트를 열고 `fetch` → `JSON.parse` 로 위 조합을 확인한다
  (직렬화를 거쳐야 실제 소비자가 보는 값이다 — 이 버그를 잡아낸 것이 바로 그 방식이었다)
- [SPEC] `deriveDesired()` 의 동작이 007 전과 동일하다(STOP 쓰기 회귀 없음)

## Out of Scope

- 🔒 **히스테리시스 변경** — 멈춤선 ≠ 해제선은 의도된 설계다. `allowed` 는 순간 판정일 뿐
  STOP 의 수명을 바꾸지 않는다
- 🔒 **측정이 오래 죽으면 STOP 을 거는 fail-safe** — 여전히 사람 판단 몫
- loopback → LAN 바인딩 · 런처 파일명 · 스크레이핑 방식

## USER_GATE

- 로그인·재기동 후 `/api/status` 에서 `allowed` 와 `headroom` 이 서로 모순되지 않는지 확인
  (`allowed: true` 인데 `headroom: 0` 인 조합이 보이면 실패다)

## 예상 phase 2

1. `lib/observation.js` — `deriveAllowance()` 에 3번 판정 추가 + 우선순위 정리
2. `test/` — 불변식·경계값·우선순위 + 실포트 직렬화 왕복

## Related

- 선행: **007** 이 만든 `allowance`/`usage`. 이 NNN 은 그 판정만 고친다
- 🔒 **혼동 주의**: `deriveDesired()`(차단기, STOP 쓰기) 는 **건드리지 않는다.**
  이 NNN 은 `deriveAllowance()`(소비자 질문)만 고친다
- Agora 등록 `apis/Quaestor/supervised-v1.md` 갱신은 사람 몫(볼트 md, forge 불필요)
