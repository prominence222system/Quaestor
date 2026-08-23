# 005 — 기동 시 관측 이력 복원 (재기동 건망증 제거)

## 배경 — 004 를 실제로 돌려보고 드러난 것

003 의 판정은 설계대로 작동한다. 연속 실패가 쌓이면 `crit` 으로 올라가고 `hint` 까지 짚는다.
그런데 **관측 상태가 프로세스 메모리에만 산다.** 그래서 재기동하면 이력이 통째로 사라진다.

2026-08-20 실측:

```
재기동 직후 GET /api/status
  { "state": "warn", "summary": "첫 측정 대기 중", ... }
```

그때 이 감시자는 **이미 23일째 측정에 실패하고 있었다.** 화면에는 "이제 막 떠서 아직 측정 전"
으로 보였다. 다시 `crit` 이 되려면 4폴, 약 1시간이 걸린다.

🔒 **재기동 한 번이 26일치 침묵을 지운다.** 침묵을 잡으라고 만든 물건이 재기동으로 눈을 감는다.

그리고 그 26일치 증거는 **바로 옆에 있다.** `.prominence\bellows.log` 가 1.6MB 쌓여 있고
마지막 성공 줄(`2026-07-28T11:58:12.472Z session=24% weekly=24%`)도 그 안에 있다.
읽지 않을 뿐이다.

⚠️ **이것은 004 구현의 결함이 아니다.** 003 스펙의 [DERIVED] 판정
(`lastSuccessAt === null → warn`)이 "아직 측정 전"과 "오래전부터 실패 중"을 구분하지 못한 것이다.
구분에 필요한 정보를 안 주고 판정만 시켰다.

## Project Type

제품(Quaestor) 진화. **ADDITIVE · never-brick.**
읽기 전용 복원만 추가한다. 🔒 STOP.json · `deriveDesired` · 임계 판정 · 스크레이핑은 건드리지 않는다.

## Scope

### 1. 신규 순수 파서 — `p-bellows/lib/logparse.js`

로그 **줄 배열**을 받아 관측 상태를 만든다. 🔒 **I/O 없음 · 시계 없음 · 파일 경로 모름.**
`observation.js` 와 같은 규율이다(그래서 테스트가 쉽다).

```js
parseLogTail(lines)  // -> { lastSuccessAt, lastUsage, consecutiveFailures, lastFailure } | null
```

읽어낼 것:

| 대상 | 출처 줄 |
|---|---|
| `lastSuccessAt` · `lastUsage` | 마지막 `session=NN% weekly=NN%` 줄 + 그 줄의 ISO 타임스탬프 |
| `consecutiveFailures` | **그 성공 줄 이후** 나타난 `[poll error]` 줄 수 |
| `lastFailure` | 마지막 `[poll error]` 줄의 `kind=` · `hint=` + 타임스탬프 |

- 🔒 **[SPEC] 옛 형식 줄도 읽는다.** 003 이전 코드가 쓴 줄에는 `kind=` 가 없다
  (로그의 대부분이 그렇다). 그 경우 `kind` 는 **`'unknown'`** 이고, 있지도 않은 값을 지어내지 않는다
- 🔒 **[SPEC] 성공 줄이 하나도 없으면 `lastSuccessAt` 은 `null`.** 추정하지 않는다
- 🔒 **[SPEC] 파싱 못 한 줄은 조용히 건너뛴다.** 한 줄이 깨졌다고 전체를 버리지 않는다

### 2. 기동 복원 배선 — `watch-loop.js`

`mainLoop()` 시작 시, 폴링을 시작하기 **전에** 한 번만:

- 로그 파일의 **꼬리만** 읽는다. 🔒 **[SPEC] 전체를 메모리에 올리지 말 것** —
  지금 1.6MB 이고 계속 자란다. 마지막 **64KB** 만 읽고, 잘린 첫 줄은 버린다
- `parseLogTail()` 결과로 `observation` 을 초기화한다
- 복원했으면 로그에 한 줄 남긴다: `[restore] lastSuccess=<ISO> failures=<N> kind=<k>`
- 🔒 **[SPEC] never-brick — 로그 파일이 없거나·못 읽거나·파싱이 실패하면
  `createObservation()` 으로 조용히 시작한다.** 예외가 루프까지 새면 안 된다.
  차단기가 로그 파일 때문에 죽으면 안 된다

⚠️ **복원값은 "관측된 사실"이지 "지금 상태"가 아니다.** 복원 직후 첫 폴이 성공하면
`recordSuccess` 가 즉시 덮는다 — 그게 정상 흐름이다.

### 3. `deriveState` 는 그대로 둔다

🔒 **재구현 금지.** 003 의 판정 로직은 손대지 않는다. 이 NNN 은 **판정에 넣을 입력을 채울 뿐**이다.
`observation.js` 를 수정해야 한다고 느껴지면 설계가 틀린 것이다.

## Acceptance (hermetic — Chrome·네트워크 없이 돈다)

🔒 **[SPEC] 수정 전에는 아래 첫 항목이 반드시 FAIL 해야 한다.**
전 실패 → 후 성공이 확인돼야 진짜 잡은 것이다.

- [SPEC] **26일 침묵 fixture**: 성공 줄 하나 + 그 뒤 수백 개의 실패 줄로 된 로그를 만들고,
  기동 복원을 거친 뒤 `deriveState()` 가 **`crit`** 을 낸다.
  🔒 `warn` 이나 `ok` 가 나오면 이 NNN 은 실패다
- [SPEC] `parseLogTail()` 은 순수 함수다 — 같은 입력 → 같은 출력, `Date.now()` 를 읽지 않는다
- [SPEC] 성공 줄이 없는 로그 → `lastSuccessAt === null` (0 이나 현재시각으로 채우지 않는다)
- [SPEC] `kind=` 가 없는 옛 형식 실패 줄 → `kind === 'unknown'`, `hint` 는 없음
- [SPEC] 성공 줄 **이후의** 실패만 센다 — 성공 이전 실패는 `consecutiveFailures` 에 안 들어간다
- [SPEC] 🔒 **경계 검증**: 임시 디렉토리에 **실제 로그 파일을 쓰고 실제로 읽어** 복원한다.
  주입 배열만으로는 꼬리 읽기·인코딩·잘린 줄 처리를 증명하지 못한다
- [SPEC] 로그 파일 없음 / 0바이트 / 깨진 바이트 → 예외 없이 빈 관측으로 시작한다
- [SPEC] 64KB보다 큰 파일에서 **읽은 바이트가 상한 이하**임을 확인한다
- [SPEC] 복원 결과를 `JSON.stringify` 한 문자열에 `.profile` · `cookie` · `@`(이메일) 가 없다

## Out of Scope

- 🔒 **측정 실패가 오래되면 STOP 을 거는 fail-safe** — 안전장치의 의미를 바꾸는 결정이라
  이 NNN 에 섞지 않는다. 별도로 사람이 판단할 몫이다
- 로케일 독립 앵커 전환
- 죽은 프로세스를 되살리는 일 — 🔒 자기 죽음은 자기가 못 알린다. Quaestor 밖의 몫이다
- 폴더·저장소 개명

## USER_GATE

- 감시자를 재기동한 직후 `http://127.0.0.1:3210/api/status` 를 열어
  **`state` 가 곧바로 `crit`** 인지 확인(복원 전에는 `warn` "첫 측정 대기 중" 이었다).
  🔒 여기서 `warn` 이 나오면 복원이 안 된 것이다

## 예상 phase 3

1. `lib/logparse.js` — `parseLogTail()` 순수 파서 (신·구 형식, 성공 이후 실패 카운트)
2. `watch-loop.js` 기동 복원 배선 — 꼬리 64KB 읽기 + 잘린 줄 버리기 + never-brick 폴백 + `[restore]` 로그
3. `test/logparse.test.js` — 26일 fixture + 실파일 경유 경계 검증

## Related

- 선행: **003** `observation.js`(판정) · **004** `control-server.js`(노출). 둘 다 그대로 쓴다
- 계약: `_guides\SUPERVISED_TOOL_CONTRACT.md` — `state` 는 측정의 신선도다
- ⚠️ 혼동 주의: 이 NNN 은 **측정을 되살리지 않는다.** 죽은 것을 정확히 죽었다고 보이게 할 뿐이다.
  측정 복구는 전용 프로필 Chrome 의 claude.ai 로그인이며 사람만 할 수 있다
