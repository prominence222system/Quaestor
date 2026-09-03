# 012 — 임계값 쓰기 API (`PUT /api/thresholds`)

## 배경

임계값은 **읽기만** 된다. `/api/status` 의 `usage.thresholds` 가 적용값을 내주지만
바꿀 창구가 없어, 지금은 `.prominence\bellows-config.json` 을 손으로 편집하는 수밖에 없다.

그 결과가 실제로 남아 있다:

```
bellows-config.json   생성 2026-05-03 20:43   수정 2026-05-04 11:45
{ "thresholds": { "weekly_stop": 99, "session_stop": 99, ... }, "enabled": true }
```

🔒 **정지선이 양쪽 다 99 인 채로 넉 달이 흘렀다.** 하드 기본값은 85/90 이다.
차단기가 사실상 풀린 상태였고, 측정이 죽어 있던 36일 동안은 아무도 몰랐다.

⚠️ **이 설정에는 이미 자동 만료 장치가 있다** — `expires_at` 이 지나면 파일을 무시하고
하드 기본값으로 돌아간다(`lib/config.js` `isExpired`). **5월에 그걸 썼다면 저절로 풀렸을 것이다.**
장치가 있는데 안 쓴 것이 이 사건의 본질이고, 이 NNN 은 그것을 **구조적으로 강제**한다.

## 누가 무엇을 소유하는가

```
Foreman   화면 + 호출자   ->  PUT /api/thresholds
Quaestor  소유자 + 검증자  ->  히스테리시스 검사 · 만료 규칙 · 원자적 쓰기 · 기록
                              🔒 bellows-config.json 은 Quaestor 만 만진다
```

🔒 **Foreman 이 설정 파일을 직접 쓰게 하지 않는다.** 남의 파일 경로를 자기 코드에 박는 것이
감독 계약이 없애려던 바로 그 결합이다(`run-foreman.ps1` 의 `$bellowsRoot` 가 조용히 깨졌던 유형).
`/api/status` 를 Foreman 이 표시만 하고 판정은 Quaestor 가 하는 것과 같은 모양을 유지한다.

⚠️ 계약이 **"Foreman 은 확인 없이 호출한다"** 고 못박고 있다. 화면에서 값을 밀면 즉시 나간다는 뜻이다.
🔒 **그러므로 안전선은 서버 쪽에 있어야 한다.** UI 의 확인 대화상자에 기대지 않는다.

## Project Type

제품(Quaestor) 진화. **ADDITIVE.** 🔒 기존 읽기 응답·판정 로직·STOP 동작은 바꾸지 않는다.

## Scope

### 1. `PUT /api/thresholds`

```jsonc
// 요청 (부분 허용 — 준 키만 바뀐다)
{ "weekly_stop": 85, "session_stop": 90, "expires_at": "2026-09-09T00:00:00Z" }

// 응답
{ "ok": true, "direction": "tighten", "applied": { ...4개 전부... },
  "expires_at": null, "previous": { ...변경 전 4개... } }
```

### 2. 🔒 방향에 따라 다르게 취급한다 — 이 NNN 의 핵심

| 방향 | 정의 | 규칙 |
|---|---|---|
| **조이기(tighten)** | 어떤 `*_stop` 도 현재 적용값보다 **커지지 않음** | 그대로 허용 |
| **무르기(loosen)** | 어느 한쪽이라도 `*_stop` 이 **커짐** | 🔒 **`expires_at` 필수.** 없으면 400 |

- 🔒 **[SPEC] 무르기인데 `expires_at` 이 없으면 거부한다**(`400`, `reason: "loosen-requires-expiry"`).
  안전장치를 무르는 변경은 **스스로 되돌아오게** 만든다
- `expires_at` 은 ISO8601 이고 **미래**여야 한다. 과거·파싱 불가면 400
- 영구히 무르고 싶으면 **코드의 하드 기본값을 바꾸는 것이 맞는 자리다.**
  파일은 원래 임시 덮어쓰기용이다 — 그 사실을 거부 메시지에 담을 것

### 3. 🔒 쓰기는 토큰이 있어야 한다

- `control.authToken` 이 **설정돼 있으면**: `Authorization: Bearer` 필수(읽기와 동일)
- 🔒 **[SPEC] 설정돼 있지 않으면 쓰기를 거부한다**(`403`, `reason: "write-requires-token"`).
  읽기는 loopback 을 방어선 삼아 통과시키지만, **안전장치를 무르는 쓰기는 기본 거부**다.
  운영자가 토큰을 두는 행위가 곧 쓰기 허용의 명시적 선택이 된다

### 4. 검증 — 지금 `readConfig` 보다 엄격하게

`readConfig` 는 범위(0~100)만 본다. 쓰기 경로는 더 봐야 한다:

- [SPEC] 정수, 0~100 (기존과 동일)
- 🔒 [SPEC] **각 축에서 `stop > release`** — 깨지면 400. 히스테리시스가 무너지면
  경계에서 깜빡이거나 영원히 안 풀린다. 🔒 **이 불변식은 의도된 설계다**
- [SPEC] 알 수 없는 키는 거부(400). 조용히 무시하지 않는다

### 5. 파일 쓰기 — 🔒 원자적으로, 다른 키를 보존하며

- `writeStopJsonAtomic` 과 같은 방식(임시 파일 → rename)
- 🔒 **[SPEC] `enabled` · `control.*` · 기존의 다른 키를 날리지 않는다.**
  임계값 4개와 `expires_at` 만 병합한다
- 🔒 **[SPEC] 감시 루프는 영향받지 않는다** — 쓰기 실패가 폴링을 멈추면 안 된다(never-brick)

### 6. 기록 — 5월 사건의 진짜 피해는 "기록 없음"이었다

🔒 **[SPEC] 변경 시 로그에 한 줄 남긴다** — 전→후 값, 방향, `expires_at`.

```
[thresholds] loosen: weekly_stop 85->99 session_stop 90->99 expires_at=2026-09-09T00:00:00Z
```

⚠️ 로그 줄 형식은 **005 의 `parseLogTail` 이 읽는 줄들과 다른 접두어**를 쓸 것.
🔒 기존 형식(`[poll start]`·`session=NN%`·`[restore]` 등)은 불변이다.

### 7. 계약 버전

이 엔드포인트가 생기면 계약이 바뀐다. 🔒 **`contracts["supervised-v1"]` 상수를 `1.3.0` 으로 올린다**
(011 이 만든 결합). Agora 등록 문서 갱신은 사람이 랜딩 후 곧바로 한다.

### 8. 🔒 범위 밖

- **웹 페이지에 편집 UI** — 페이지는 읽기 전용을 유지한다(010). 화면은 Foreman 몫
- `POST /api/stop` — 여전히 501, 의도적 미구현
- `enabled` 토글 쓰기 — 감시 자체를 끄는 것이라 별개 판단
- `_guides\SUPERVISED_TOOL_CONTRACT.md` — 🔒 Foreman 소유. 이건 Quaestor 고유 엔드포인트다

## Acceptance (hermetic — 실포트 왕복)

- [SPEC] 토큰 설정 상태에서 조이기(`99->85`) → 200, 파일에 반영, `direction: "tighten"`
- [SPEC] 🔒 무르기(`85->99`)에 `expires_at` 없음 → **400** `loosen-requires-expiry`.
  🔒 200 이 나오면 이 NNN 은 실패다
- [SPEC] 무르기 + 미래 `expires_at` → 200, 파일에 `expires_at` 이 함께 저장됨
- [SPEC] 무르기 + **과거** `expires_at` → 400
- [SPEC] `stop <= release` 조합(예: `weekly_stop 60`, `weekly_release 70`) → 400
- [SPEC] 토큰 **미설정** 상태에서 PUT → **403** `write-requires-token`
  (같은 상태에서 `GET /api/status` 는 여전히 200 — 읽기는 영향 없음)
- [SPEC] 잘못된 Bearer → 401
- [SPEC] 🔒 쓰기 후 파일의 `enabled` 와 `control.*` 가 **보존**된다
- [SPEC] 부분 요청(`weekly_stop` 만) 시 나머지 3개가 **변하지 않는다**
- [SPEC] 알 수 없는 키 포함 → 400
- [SPEC] 쓰기 직후 `GET /api/status` 의 `usage.thresholds` 가 **새 값**을 낸다
- [SPEC] `/api/health` 의 `contracts["supervised-v1"] === "1.3.0"`
- [SPEC] 🔒 **회귀 없음**: `/api/status` 의 나머지 응답·`fields`·웹 페이지·STOP 동작 불변
- [SPEC] 🔒 005 의 26일 fixture 테스트가 계속 통과(로그 형식 불변의 증거)

## USER_GATE

- 토큰을 설정한 뒤 조이기 한 번 → 다음 폴에서 `/api/status` 의 `thresholds` 가 바뀌는지 확인
- 🔒 무르기를 `expires_at` 없이 시도해 **거부되는지** 확인. 통과하면 안전선이 없는 것이다

## 예상 phase 3

1. `lib/thresholds.js` — 방향 판정 · 검증(히스테리시스·범위·미지 키) · 병합. **순수 함수**
2. `lib/control-server.js` — `PUT /api/thresholds` 라우팅 + 토큰 게이트 + 원자적 파일 쓰기 + 기록
3. 테스트 — 실포트 왕복(조이기/무르기/만료/토큰/보존/부분요청) + 계약 상수 + 회귀

## Related

- 🔒 **`lib/config.js` 의 `isExpired`** — 이미 있는 만료 장치. 재구현하지 말고 그대로 쓴다
- 011 — `contracts` 상수와 계약 버전의 결합
- 010 — 페이지가 읽기 전용인 이유(같은 규율을 여기서도 지킨다)
- ⚠️ 혼동 주의: `deriveDesired()`(차단기 판정)는 이 NNN 이 건드리지 않는다.
  바꾸는 것은 **그 판정이 쓰는 임계값**이다
