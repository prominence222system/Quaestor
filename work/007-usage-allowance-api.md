# 007 — 사용량 공개 API (기계가 쓸 숫자 + 허용 판정)

## 배경 — 지금 API 는 엉뚱한 질문에 답한다

Quaestor 의 목적은 **"지금 토큰을 써도 되는지, 얼마나 남았는지"** 를 알려주는 것이다.
그런데 004 가 만든 `/api/status` 는 **"측정이 건강한가"** 를 답한다. 감시자 자신의 건강검진이다.
쓸모가 없지는 않지만(3주 침묵을 잡으려고 만들었다) **소비자가 묻는 질문이 아니다.**

사용량은 응답 안에 있긴 하다. 다만 이렇게 있다:

```js
{ label: '세션 사용량', value: sessionPct === null ? '-' : (sessionPct + '%') }
```

🔒 **문자열이고, 찾으려면 `'세션 사용량'` 이라는 한국어 라벨을 매칭해야 한다.**
`%` 도 떼어내야 한다. 이건 **우리가 27일을 태운 그 함정을 소비자에게 그대로 떠넘기는 구조**다 —
`extract.js` 가 한국어 앵커에 묶여 있어서 겪은 일을 API 응답에서 반복한다.

⚠️ 변명하자면 `fields` 는 계약상 **표시 전용**이다("소비자는 해석하지 않고 그대로 그린다").
그 목적엔 맞다. 하지만 **데이터 계약이 아니다.** 기계가 읽을 창구가 따로 필요하다.

그리고 Agora 등록 문서(`apis/Quaestor/supervised-v1.md`)의 응답 필드에 **사용량이 아예 안 적혀 있다** —
읽는 사람은 이 API 가 사용량을 준다는 사실조차 모른다.

## Project Type

제품(Quaestor) 진화. **ADDITIVE · never-brick.**
🔒 **`fields` · `summary` · `state` 는 한 글자도 바꾸지 않는다** — 기존 소비자(Foreman) 무영향.
새 키를 **추가만** 한다.

## Scope

### 1. `/api/status` 에 `allowance` 추가 — "지금 써도 되나"

```jsonc
"allowance": {
  "allowed":    true,            // true | false | null
  "reason":     "under-threshold",
  "confidence": "measured"       // measured | stale | unknown
}
```

**`allowed` 판정은 기존 차단기를 그대로 읽는다. 🔒 재판정 금지.**

| 상황 | `allowed` | `reason` | `confidence` |
|---|---|---|---|
| STOP 활성(사람이 건 것) | `false` | `manual-stop` | `measured` |
| STOP 활성(자동) | `false` | STOP 의 `reason` 그대로(`weekly_threshold` 등) | `measured` |
| STOP 없음 + 측정 신선 | `true` | `under-threshold` | `measured` |
| STOP 없음 + 측정이 밀림 | `true` | `under-threshold` | **`stale`** |
| 🔒 **측정 이력 없음 / 오래 죽어 있음** | **`null`** | `unmeasurable` | **`unknown`** |

🔒 **[SPEC] 측정할 수 없을 때 `allowed` 는 `null` 이다. `true` 도 `false` 도 아니다.**

이유를 분명히 해둔다. `true` 로 내면 소비자가 26일 묵은 무지를 **허가로 착각**한다.
`false` 로 내면 Quaestor 가 혼자서 **큐 전체를 멈추는 정책 결정**을 내리는 셈이다 —
지금 실제 동작은 STOP.json 이 없어 fail-open 이므로 그건 **동작 변경**이고, 이 NNN 의 몫이 아니다.
`null` 은 **소비자가 자기 정책을 갖도록 강제한다.** 정보 부재를 어느 쪽으로도 승격시키지 않는다.

### 2. `/api/status` 에 `usage` 추가 — "얼마나 남았나"

```jsonc
"usage": {
  "session_pct":     24,          // number. 문자열 금지, '%' 접미사 금지
  "weekly_pct":      24,
  "session_headroom": 66,         // stop 선까지 남은 여유(퍼센트포인트)
  "weekly_headroom":  61,
  "session_reset":   "1시간 25분 후 재설정",   // 원문 그대로(표시용, null 가능)
  "weekly_reset":    "(월) 오후 1:00에 재설정",
  "measured_at":     "2026-07-28T11:58:12.472Z",
  "age_sec":         2246400,
  "stale":           true,
  "thresholds": { "weekly_stop": 85, "weekly_release": 70, "session_stop": 90, "session_release": 75 }
}
```

- 🔒 **[SPEC] 모든 퍼센트는 `number`.** `"24%"` 같은 문자열이 하나라도 있으면 실패다
- 🔒 **[SPEC] 키는 전부 ASCII.** 한국어 라벨을 매칭해야 값을 찾는 구조가 있으면 실패다
- `headroom` = `stop 선 - 현재치`, **음수면 0** (이미 넘었으면 여유는 없다)
- 🔒 **[SPEC] `thresholds` 를 함께 낸다.** headroom 은 임계값에 따라 달라지므로
  임계값 없이는 해석할 수 없다. (실측 참고: 지금 디스크 설정이 stop 을 양쪽 99 로 올려놨다 —
  소비자가 이 숫자를 보고 스스로 판단할 수 있어야 한다)
- 측정 이력이 없으면 `session_pct`·`weekly_pct`·`measured_at` 은 **`null`**, `stale` 은 `true`.
  🔒 **0 으로 채우지 말 것** — 0% 는 "여유 만점"이라는 뜻이 되어 정반대 오해를 만든다

### 3. `stale` 판정은 005 의 신선도 규칙을 그대로 쓴다

🔒 **재구현 금지.** `deriveState()` 가 이미 `STALE_WARN_MS`/`STALE_CRIT_MS` 로 신선도를 판정한다.
같은 기준을 쓰고 새 상수를 만들지 않는다. 두 곳이 갈리면 화면과 API 가 다른 말을 한다.

### 4. Agora 등록 갱신 — 🔒 이 NNN 이 아니다

`apis/Quaestor/supervised-v1.md` 의 `version` 을 `1.1.0` 으로 올리고 응답 필드에
`allowance`·`usage` 를 적는 일은 **볼트 마크다운 편집**이라 forge 를 쓰지 않는다. 사람이 한다.
🔒 **추가만 하는 변경이라 하위호환**이며 기존 소비자는 영향받지 않는다.

## Acceptance (hermetic — Chrome·네트워크 없이 돈다)

- [SPEC] `fields`·`summary`·`state` 의 값이 007 전과 **완전히 동일**하다(회귀 없음)
- [SPEC] 측정 성공 상태에서 `usage.session_pct` 가 **`number`** 이고 `'%'` 를 포함하지 않는다
- [SPEC] `JSON.stringify(response.usage)` 에 한글이 나타나지 않는다 —
  단, `session_reset`·`weekly_reset` 의 **값**은 예외(원문 그대로 담는다). **키는 전부 ASCII**
- [SPEC] 측정 이력이 없으면 `allowance.allowed === null` 이고 `confidence === 'unknown'`.
  🔒 `true` 나 `false` 가 나오면 **실패**
- [SPEC] 측정 이력이 없으면 `usage.session_pct === null` (0 이 아니다)
- [SPEC] 수동 STOP 이 있으면 `allowed === false`, `reason === 'manual-stop'`
- [SPEC] 자동 STOP 이 있으면 `allowed === false` 이고 `reason` 이 STOP 의 `reason` 과 같다
- [SPEC] `headroom` 은 현재치가 stop 선을 넘었을 때 **0** 이다(음수 금지)
- [SPEC] `thresholds` 가 실제 적용값(설정 파일이 있으면 그 값)과 일치한다
- [SPEC] `stale` 이 `deriveState()` 의 신선도 판정과 **모순되지 않는다**
  (화면이 `crit` 인데 `stale:false` 같은 조합이 없다)
- [SPEC] 🔒 **경계 검증**: 실제 포트를 열고 `fetch` 로 받아 `JSON.parse` 한 뒤
  `typeof usage.session_pct === 'number'` 를 확인한다. 직렬화를 거쳐야 문자열/숫자가 갈린다
- [SPEC] 응답에 비밀이 없다(토큰·`.profile`·쿠키·계정) — 004 조항 유지

## Out of Scope

- 🔒 **측정이 오래 죽으면 STOP 을 거는 fail-safe** — 안전장치의 의미를 바꾸는 결정이고
  현재 동작(fail-open)을 뒤집는다. 여전히 **사람이 판단할 몫**
- 🔒 **loopback → LAN 바인딩 변경** — 다른 PC 에서 보려면 필요하지만 제어면을 네트워크에
  노출하는 별도 결정이다(토큰 인증 전제)
- `run-bellows.ps1`·`deploy-bellows.ps1` 파일명 — Foreman 과 맞춰야 하므로 별도
- 스크레이핑 방식 개선(로케일 독립 앵커) — 별도

## USER_GATE

- 로그인·재기동 후 `curl http://127.0.0.1:3210/api/status` 로
  `usage.session_pct` 가 **숫자**로, `allowance.allowed` 가 **`true`** 로 나오는지 확인
- 🔒 측정이 죽은 상태에서는 `allowed` 가 **`null`** 이어야 한다 —
  여기서 `true` 가 나오면 소비자가 무지를 허가로 읽는다

## 예상 phase 3

1. `lib/observation.js` — `deriveUsage()` / `deriveAllowance()` 순수 함수(숫자·headroom·stale)
2. `lib/control-server.js` — `/api/status` 응답에 `allowance`·`usage` 추가(`fields` 불변)
3. `test/` — 숫자 타입·null 규칙·headroom 하한·STOP 반영 + 실포트 직렬화 왕복 검증

## Related

- 계약: `_guides\SUPERVISED_TOOL_CONTRACT.md` — `fields` 가 표시 전용인 근거
- Agora 등록: `2. Area\Prominence_Agora\apis\Quaestor\supervised-v1.md` (1.1.0 로 갱신 예정)
- 선행: **004** 계약면 · **005** 신선도 판정(그대로 재사용)
- ⚠️ 혼동 주의: `deriveDesired()`(차단기, STOP 쓰기) ≠ `deriveState()`(계기판) ≠
  `deriveAllowance()`(소비자 질문). **세 번째는 앞의 둘을 읽을 뿐 새로 판정하지 않는다**
