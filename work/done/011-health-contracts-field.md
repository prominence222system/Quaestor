# 011 — `/api/health` 에 구현 중인 계약 버전 노출

## 배경

Agora 에 **버전 관측기**가 생겼다(Agora `work/done/021`·`022`). 등록된 계약의 `healthUrl` 을 찔러
**"이 서비스가 지금 어느 계약 버전을 구현하고 있는가"** 를 읽고 문서상 버전과 대조한다.

Quaestor 는 지금 `versionState: "not_declared"` 다 — 관측 대상을 선언하지 않았다.

🔒 **선언할 때 축을 틀리면 안 된다.** Agora 022 §② 가 못박은 규칙:

> 비교해야 하는 것은 "이 서비스가 지금 어느 계약 버전을 구현하고 있는가" 이지
> 소프트웨어 빌드 번호가 아니다. 🔒 **상시 울리는 경보는 없는 것보다 나쁘다.**

실측으로 이 제품도 같은 함정에 있다:

```
p-quaestor/package.json          version = 0.1.0    <- 소프트웨어 버전
apis/Quaestor/supervised-v1.md   version = 1.2.0    <- 계약(인터페이스) 버전
```

`/api/health` 는 지금 `version: "0.1.0"`(패키지)만 준다. 이걸 관측 대상으로 삼으면
**영원히 `drifted`** 다 — 사람이 곧 무시하게 되고 진짜 어긋남도 같이 묻힌다.

## Project Type

제품(Quaestor) 진화. **ADDITIVE · never-brick.**
🔒 기존 응답 필드는 **하나도 바꾸지 않는다.** 새 키를 추가만 한다(소비자 Foreman 무영향).

## Scope

### 1. `/api/health` 에 `contracts` 추가

```jsonc
{
  "ok": true,
  "id": "quaestor",
  "version": "0.1.0",                        // 그대로 둔다 (소프트웨어 버전)
  "contracts": { "supervised-v1": "1.2.0" }, // 신설 (계약 버전)
  "startedAt": "..."
}
```

- 🔒 **[SPEC] `version` 을 없애거나 의미를 바꾸지 말 것.** 두 축을 **함께** 내되 **섞지 않는다**
- 🔒 **[SPEC] `contracts` 값은 코드가 아는 사실이어야 한다** — 소스의 상수로 둔다.
  볼트 문서(`apis/Quaestor/supervised-v1.md`)를 읽어서 채우면 **자기를 근거로 자기를 검증**하는
  꼴이라 의미가 없다(Agora 022 §3 과 같은 규율)
- 상수는 **한 곳**에만 둔다. 여러 파일에 흩어지면 다음 사람이 한쪽만 고친다

### 2. 🔒 유지보수 결합을 코드에 적어둔다

이 기능의 대가는 **계약 버전을 올릴 때 이 상수도 같이 올려야 한다**는 것이다.
안 그러면 Agora 가 `drifted` 로 표시한다.

🔒 **[SPEC] 상수 선언부 바로 위에 그 사실을 주석으로 남긴다.**
"이 값을 바꾸는 시점 = Agora 등록 문서의 `version` 을 바꾸는 시점"임이 코드에서 보여야 한다.

### 3. 범위 밖

- **볼트 문서에 `healthUrl`·`versionField` 선언** — 데이터 파일이라 사람이 직접 한다(forge 불필요).
  🔒 **코드가 먼저 랜딩한 뒤** 선언한다. 순서가 뒤면 `no_version` 이 뜬다(고장은 아니지만 불필요한 잡음)
- `/api/status` · `allowance` · `usage` · 웹 페이지 — 건드리지 않는다
- Agora 쪽 관측기 로직 — 남의 제품이다

## Acceptance (hermetic)

- [SPEC] 실제 포트를 열고 `GET /api/health` → 200, `usage.contracts` 가 아니라
  **최상위 `contracts` 객체**가 있고 `contracts["supervised-v1"] === "1.2.0"`
- [SPEC] `contracts` 값이 **문자열**이다(숫자·객체 아님) — Agora 가 점 경로로 읽어 비교한다
- [SPEC] 기존 필드 `ok`·`id`·`version`·`startedAt` 이 **그대로** 있고 값이 011 전과 동일하다
  (`id === "quaestor"`, `version === "0.1.0"`)
- [SPEC] 🔒 `version` 과 `contracts["supervised-v1"]` 이 **서로 다른 값**이다 —
  같아지면 두 축을 섞은 것이다(현재 0.1.0 vs 1.2.0)
- [SPEC] `/api/status` 응답이 011 전과 **완전히 동일**하다(회귀 없음)
- [SPEC] 응답에 비밀이 없다(토큰·프로필 경로·쿠키·계정)
- [SPEC] 🔒 **경계 검증**: 실포트 + `fetch` + `JSON.parse` 로 확인한다.
  객체를 직접 들여다보면 직렬화 후 모양이 검증되지 않는다

## USER_GATE

- 코드 랜딩 후 볼트 문서에 두 줄을 선언하고(사람 몫), 감시자를 띄운 상태에서
  Agora brief 의 `versionState` 가 **`match`** 로 바뀌는지 확인

```yaml
healthUrl: http://127.0.0.1:3210/api/health
versionField: contracts.supervised-v1
```

⚠️ 감시자가 꺼져 있으면 `unreachable` 이다 — 고장이 아니라 **관측 불가**다(Agora 022 설계).

## 예상 phase 2

1. `lib/control-server.js` — 계약 버전 상수 + `/api/health` 응답에 `contracts` 추가(유지보수 주석 포함)
2. 테스트 — 실포트 왕복, 두 축이 다름, 기존 필드 회귀 없음

## Related

- Agora `work/done/022-no-version-and-contract-axis.md` — 이 규약의 출처. 🔒 **먼저 읽을 것**
- 시범 사례: `apis/Agora/brief-v1.md` 의 `versionField: contracts.brief-v1`
- 등록 문서: `apis/Quaestor/supervised-v1.md` (현재 `version: 1.2.0`)
- ⚠️ 혼동 주의: `version`(소프트웨어) ≠ `contracts.<id>`(계약). **둘은 다른 축이고 둘 다 필요하다**
