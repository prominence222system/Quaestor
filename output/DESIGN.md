# DESIGN — 008 임계를 넘었는데 허가하는 구멍 막기

## 1. 이 NNN 의 한 문장

`/api/status` 의 `allowance.allowed` 가 **STOP.json 존재 여부만** 보던 것을,
**이미 계산해 둔 `usage.*_headroom` 도 함께** 보게 만든다. 그 외에는 아무것도 바꾸지 않는다.

## 2. 전체 구조 (현행 · 변경점 표시)

```
run-bellows.ps1
  └─ node watch-loop.js  ── 15분 루프 ─────────────────────────────────┐
        │                                                             │
        ├─ lib/scrape.js ─ Chrome(9222) ─ claude.ai/settings/usage     │
        ├─ lib/extract.js ─ session_pct / weekly_pct                   │
        ├─ lib/observation.js                                          │
        │     recordSuccess / recordFailure   (관측 누적)              │
        │     deriveState()   → state/summary/fields   🔒 불변          │
        │     deriveUsage()   → 숫자·headroom·stale    🔒 불변          │
        │     deriveAllowance() → allowed/reason/conf  ★ 이 NNN 이 고침 │
        │                                                              │
        ├─ deriveDesired()  (watch-loop.js, 차단기)   🔒 한 글자도 금지  │
        │     └─ writeStopJsonAtomic() → .prominence\STOP.json ────────┼─→ forge/foundry
        │                                                              │
        └─ lib/control-server.js  127.0.0.1:3210                       │
              /api/health  (프로세스 생존만)                            │
              /api/status  → { ok, allowance★, usage, summary, state, fields, updatedAt }
```

★ 표시 두 곳만 수정한다. 그 외 파일은 읽기 전용으로 취급한다.

## 3. 디렉터리 구조 (변경 없음)

```
p-quaestor/
├─ watch-loop.js          🔒 deriveDesired / STOP 쓰기 — 수정 금지
├─ watch-once.js
├─ lib/
│  ├─ observation.js      ★ deriveAllowance() 만 수정
│  ├─ control-server.js   ★ 호출부 1줄 수정
│  ├─ config.js  scrape.js  extract.js  logparse.js  env.js   (무수정)
└─ test/
   ├─ observation.test.js       ★ 추가
   ├─ control-server.test.js    ★ 추가
   └─ run-all.js                ★ 신규 파일 추가 시에만 등록
```

## 4. 현재 코드의 진단 (근거)

`lib/observation.js:285` `deriveAllowance(stopInfo, isStale, hasObservation)` 은
**측정 숫자를 인자로 받지 않는다.** 받는 것은 `stale` 불리언 하나뿐이다.
따라서 STOP 이 없으면 무조건 `allowed: true` / `reason: 'under-threshold'` 로 떨어진다.

`lib/control-server.js:116` 이 `deriveAllowance(stopInfo, usage.stale, hasObs)` 로
**`usage` 객체를 손에 들고 있으면서 `.stale` 한 필드만 떼어 넘긴다.**
같은 함수 호출에서 `usage.weekly_headroom === 0` 을 이미 계산해 둔 상태다.

즉 결함은 판정식이 아니라 **입력 결핍**이다. 고칠 곳도 입력이다.

## 5. 기술 결정

### D1. 시그니처를 `deriveAllowance(stopInfo, usage, hasObservation)` 로 바꾼다
- `isStale` 불리언 대신 **`deriveUsage()` 의 반환 객체 전체**를 넘긴다.
- 근거: `stale` 은 그 객체의 한 필드다. 객체를 넘기면 `stale` 도 headroom 도 한 출처에서 온다.
  판정과 숫자가 **같은 계산의 산물**이 되어 불변식이 구조적으로 성립한다.
- 하위호환 shim(2번째 인자가 불리언이면 옛 경로)은 **두지 않는다.** 내부 함수이고
  호출자는 `control-server.js` 한 곳뿐이다. 007 단위 테스트의 호출부만 갱신한다.
- 대안(4번째 인자로 `usage` 추가)을 버린 이유: 인자를 빠뜨려도 조용히 옛 동작(허가)으로
  떨어진다 — 지금 고치려는 실패 양식과 정확히 같다.

### D2. `pct >= stop` 을 다시 비교하지 않고 **`headroom` 을 읽는다**
- `deriveUsage()` 는 이미 `headroom = max(0, stop - pct)` 를 계산한다(`observation.js:259`).
  따라서 `headroom === 0` ⟺ `pct >= stop` 로 **수학적으로 동치**다.
- 임계 비교식을 두 곳에 두지 않는다 → 임계 해석이 갈라질 여지가 없다.
- 작업지시의 불변식(`allowed === true ⇒ 두 headroom > 0`)이 **판정 그 자체**가 되어
  테스트가 사후 확인이 아니라 동어반복적 보증이 된다.
- 경계는 자동으로 맞는다: `pct === stop` → headroom 0 → 불허, `pct === stop - 1` → 1 → 허가.
- 🔒 이것은 재판정이 아니다. 히스테리시스(해제선 70/75)는 **참조하지 않는다.**
  `deriveAllowance` 는 STOP 의 수명에 관여하지 않는 순간 판정이다.

### D3. 판정 순서 — 작업지시 표의 우선순위 그대로

| # | 조건 | allowed | reason | confidence |
|---|---|---|---|---|
| 1 | 측정 불가 | `null` | `unmeasurable` | `unknown` |
| 2 | STOP 활성 | `false` | 수동=`manual-stop` / 그 외 STOP 의 `reason`(없으면 `stop-active`) | `measured` |
| 3 | headroom 어느 쪽이든 `0` | `false` | `over-threshold` | `measured` |
| 4 | 그 외 | `true` | `under-threshold` | `usage.stale ? 'stale' : 'measured'` |

- 2번이 3번보다 위: STOP 은 사람 또는 차단기가 이미 내린 결론이다. 수동 STOP + 임계 초과면
  `reason === 'manual-stop'` 이어야 한다(🔒 수동 STOP 을 자동 판정이 덮지 않는다).
- 1번이 2번보다 위: 표가 "우선순위 순" 으로 명시한다. 두 조건이 겹치는
  (측정 이력 0 + STOP 존재) 조합은 007 에 테스트가 없던 새 조합이므로 표를 따른다.

### D4. "측정 불가" 의 정의 — 새 임계를 만들지 않는다
```
measurable = hasObservation === true
          && typeof usage.session_headroom === 'number'
          && typeof usage.weekly_headroom  === 'number'
```
- 🔒 "오래 죽으면 자동 STOP" 은 **Out of Scope**(사람 판단 몫)이므로 새 사망 컷오프를
  도입하지 않는다. 오래 밀린 측정은 007 그대로 `stale` 로 남고, 그 낡은 숫자가 임계를
  넘었으면 3번이 잡아 `false` 가 된다 — 보수적인 쪽으로만 움직인다.
- 한쪽 pct 만 존재하는 경우(예: 세션만 파싱 성공)는 `null`(측정 불가)로 본다.
  두 headroom 이 모두 양수임을 단언할 수 없으면 `true` 를 말하지 않는다는 불변식의 귀결이다.
  007 에 해당 테스트는 없다 → **[DERIVED]** 로 표기한다.

### D5. 🔒 손대지 않는 것 (기계적 확인 대상)
- `watch-loop.js` 의 `deriveDesired()` · `writeStopJsonAtomic()` — **diff 0 줄**
- `deriveState()` · `deriveUsage()` — **diff 0 줄**
- 응답의 `fields`(8개) · `summary` · `state` · `usage` 의 모든 숫자
- STOP.json 의 위치·이름·스키마, 임계값/히스테리시스 상수

### D6. 검증 방식 — red-first + 실포트 왕복
- 🔒 작업지시 요구: **수정 전에 97/99 케이스가 반드시 FAIL** 해야 한다.
  구현 순서를 (1) 테스트 추가 → 실패 확인 → (2) 코드 수정 → 통과 확인 으로 고정한다.
- 이 버그를 잡아낸 것이 직렬화된 응답이었으므로, 최종 확인은 실제 포트를 열고
  `fetch` → `JSON.parse` 한 값으로 한다(순수 함수 단언만으로 끝내지 않는다).

## 6. 데이터 흐름 (수정 후 `/api/status` 1회)

```
getSnapshot() → { observation, ctx }
   │
   ├─ nowMs = Date.now()
   ├─ st       = deriveState(observation, ctx, nowMs)          (그대로)
   ├─ usage    = deriveUsage(observation, ctx.thresholds, nowMs)(그대로)
   │      └─ session_headroom = max(0, session_stop - session_pct)
   │         weekly_headroom  = max(0, weekly_stop  - weekly_pct)
   │         stale            = 45분 초과 || 연속실패 4회 이상
   ├─ hasObs   = typeof observation.lastSuccessAt === 'number'  (그대로)
   └─ allowance = deriveAllowance(ctx.stop, usage, hasObs)      ★ 인자 변경
          1) !measurable            → { null,  'unmeasurable',   'unknown'  }
          2) ctx.stop 존재          → { false, manual-stop|reason,'measured' }
          3) headroom 중 하나라도 0 → { false, 'over-threshold', 'measured' }
          4) 그 외                  → { true,  'under-threshold', stale?'stale':'measured' }
   ↓
{ ok, allowance, usage, summary, state, fields, updatedAt }   (키 순서·이름 불변)
```

문제의 실측 입력이 지나는 경로:
`session 97 / weekly 99` → `session_headroom 0`, `weekly_headroom 0` → 3번 → `false / over-threshold`.
`enabled: false` 여도 `deriveAllowance` 는 `ctx.enabled` 를 보지 않으므로 결과가 같다
(숫자가 말하는 사실은 감시 스위치와 무관하다).

## 7. Phase 분할

| Phase | 내용 |
|---|---|
| 1 | `deriveAllowance()` 판정 수정 + `control-server.js` 배선 + red-first 회귀 테스트 1건 |
| 2 | 불변식·경계·우선순위 전수 테스트 + 실포트 직렬화 왕복 + 007 무회귀 확인 |

---

# Phase 1 상세 설계

## 1-1. `lib/observation.js` — `deriveAllowance` 교체

```
function deriveAllowance(stopInfo, usage, hasObservation) {
  const u = usage || {};
  const sh = u.session_headroom;
  const wh = u.weekly_headroom;
  const measurable =
    Boolean(hasObservation) && typeof sh === 'number' && typeof wh === 'number';

  // 1. 측정 불가 — 무지를 허가로도 금지로도 승격시키지 않는다
  if (!measurable) return { allowed: null, reason: 'unmeasurable', confidence: 'unknown' };

  // 2. STOP 활성 — 이미 내려진 결론(수동 STOP 포함)이 우선
  if (stopInfo) {
    const isManual = stopInfo.source === 'manual';
    return {
      allowed: false,
      reason: isManual ? 'manual-stop' : (stopInfo.reason || 'stop-active'),
      confidence: 'measured'
    };
  }

  // 3. 이미 계산된 headroom 이 0 이면 허가하지 않는다 (안전선)
  if (sh <= 0 || wh <= 0) return { allowed: false, reason: 'over-threshold', confidence: 'measured' };

  // 4. 여유 있음 — 여기서만 true 가 나온다 (sh > 0 && wh > 0 보장)
  return { allowed: true, reason: 'under-threshold', confidence: u.stale ? 'stale' : 'measured' };
}
```

- 순수 함수 유지: 인자 미변형, wall-clock 미참조, I/O 없음.
- 반환 객체의 **키 3개와 이름은 007 과 동일**하다. 값 도메인에 `'over-threshold'` 하나만 추가된다.
- `headroom` 은 `max(0, ...)` 산물이라 음수가 될 수 없지만, 비교를 `<= 0` 으로 두어
  상류가 바뀌어도 안전한 쪽으로 실패하게 한다.

## 1-2. `lib/control-server.js` — 호출부 1줄

```
- allowance = deriveAllowance(stopInfo, usage.stale, hasObs);
+ allowance = deriveAllowance(stopInfo, usage, hasObs);
```
- `usage` 는 바로 윗줄에서 만든 객체다. 계산 순서·응답 조립·키 순서는 그대로.
- 상단 주석의 "/api/status 는 판정하지 않는다" 조항은 유지된다 — 판정은 여전히
  `observation.js` 안에서만 일어난다.

## 1-3. 007 단위 테스트 호출부 갱신 (`test/observation.test.js`)

기존 4건이 2번째 인자로 불리언을 넘긴다. 동일 의미의 `usage` 객체로 치환한다.
- `deriveAllowance(null, false, true)` → `deriveAllowance(null, {session_headroom: 5, weekly_headroom: 5, stale: false}, true)`
- `deriveAllowance(null, true, true)`  → 같은 형태에 `stale: true`
- `deriveAllowance(null, true, false)` (무측정) → `usage` 는 headroom `null` 인 객체
- 🔒 **단언 기대값은 바꾸지 않는다.** 바꿔야 통과한다면 그것은 회귀다.

## 1-4. red-first 회귀 테스트 1건 (`test/observation.test.js`)

작업지시가 보고한 실측 입력을 그대로 옮긴다.
- 입력: `session_pct 97`, `weekly_pct 99`, `thresholds {session_stop: 90, weekly_stop: 85}`,
  STOP 없음, 측정 신선
- 기대: `allowed === false`, `reason === 'over-threshold'`, `confidence === 'measured'`
- 🔒 1-1 수정 **전에** 이 테스트를 넣고 `node p-quaestor/test/run-all.js` 로
  **실패를 눈으로 확인**한 뒤 수정한다. 실패 로그를 TEST_RESULT.md 에 남긴다.

## 1-5. Phase 1 완료 판정

`node p-quaestor/test/run-all.js` 가 **191 + 신규 건수 전부 통과**한다.
(007 의 191건은 한 건도 빠지거나 기대값이 수정되지 않는다.)
