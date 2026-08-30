# Quaestor — 사용량 감시·차단기

> ⚠️ **폴더·저장소 이름은 아직 `Bellows` 다.** 제품 이름은 2026-08-19 에 **Quaestor** 로 확정됐고,
> 파일시스템·git 개명은 별도 시스템 스펙이 맡는다. 코드가 새로 내는 식별자(`id`)는 **`quaestor`** 다.

## Project Type
code

## Project Goal

**Claude 사용량을 읽어 한도에 닿기 전에 시스템을 멈춘다.** 계기를 읽고 차단기를 내리는 장치다.
대장간의 일부가 아니라 옆에 붙어 있다 — forge 를 실행하지도, 큐를 돌리지도 않는다.

```
claude.ai/settings/usage --scrape--> session_pct / weekly_pct
                                          |
                                   deriveDesired()  stop / release / hold
                                          v
                    .prominence\STOP.json --읽음--> foundry 가 새 run 착수를 막는다
```

⚠️ **원래 Smithy 도구 4종 중 하나(Bellows, 풀무)였다.** 2026-08-18 에 제품으로 이관됐다
(`add-bellows-product-migration`). 도구가 아니므로 전역 배타 스케줄링을 얻지 않는다.

## Rounds
- Round 1: 001, 002
- Round 2: 003, 004
- Round 3: 005 (engine: agy)
- Round 4: 006 (engine: claude)
- Round 5: 007 (engine: agy)
- Round 6: 008 (engine: claude)
- Round 7: 009 (engine: agy)
- Round 8: 010 (engine: claude)
- Round 9: 011 (engine: agy)

## Work Verify
- Smoke: `node p-quaestor/test/run-all.js`
- Timeout: 300

⚠️ **`npm` 을 쓰지 말 것.** Windows 에서 `npm` 은 `.cmd` shim 이라 이 러너에서 실행되지 않고,
그 실패가 clean eval 을 뒤집어 작업 전체를 FAIL 시킨 이력이 있다. `node` 를 직접 부른다.

## Round 2 가 하는 일

이 감시자는 2026-07-28 이후 **3주간 측정에 한 번도 성공하지 못했다**(누적 실패 3,658 건).
프로세스는 살아서 15분마다 돌았고 실패는 로그에만 쌓였다. 아무도 몰랐다.

- **003** — 관측 상태를 구조체로 들고, 실패를 분류하고, 그것을 `state` 로 판정한다.
  로그인 만료인지 UI 문구 변경인지 가른다
- **004** — 그 상태를 `/api/health`·`/api/status` 로 노출한다(Foreman 감독 계약의 대상 쪽 절반)

🔒 **두 NNN 을 관통하는 조항: 측정이 죽어 있는데 `ok` 로 보이면 실패다.**
프로세스 생존이 아니라 측정의 신선도가 판정 근거다. 그러지 않으면 3주 침묵을 새 층에 재현한다.

## Round 3 이 하는 일

004 를 실제로 돌려보니 판정은 맞는데 **재기동하면 이력이 통째로 사라진다.**
2026-08-20 실측: 23일째 실패 중이었는데 재기동 직후 `state` 가 `warn` "첫 측정 대기 중" 으로 나왔다.
다시 `crit` 이 되기까지 4폴(약 1시간)이 걸린다.

- **005** — 기동 시 `bellows.log` 꼬리에서 마지막 성공 시각과 그 뒤의 실패 흐름을 복원한다

🔒 **재기동 한 번이 26일치 침묵을 지우면 안 된다.** 증거는 이미 로그에 있다 — 읽지 않을 뿐이었다.
🔒 판정 로직(`deriveState`)은 손대지 않는다. 이 라운드는 **판정에 넣을 입력을 채울 뿐**이다.

## Round 4 가 하는 일

제품 이름이 **Quaestor** 로 확정됐는데(2026-08-19) 저장소 내부는 아직 전부 옛 이름이다.

- **006** — `p-bellows/` -> `p-quaestor/`, 패키지 이름, 내부 경로 참조. **폴더 이동은 없다**

🔒 **동작 변경 0 이 합격 기준이다.** 이름만 바꾸는 작업이고, 실행 결과가 한 글자라도
달라지면 실패다. 005 의 26일 fixture 테스트 통과가 로그 형식 불변의 기계적 증거다.

🔒 `run-bellows.ps1` **파일명은 그대로 둔다** — Foreman 이 소비하므로 폴더 이동 작업과
같은 시점에 바꿔야 깨져 있는 창이 안 생긴다. 소유권 분할은
`_system-briefs\RENAME_BELLOWS_TO_QUAESTOR.md` 참조.

## Round 5 가 하는 일

🔒 **이 제품의 목적은 "지금 토큰을 써도 되는지, 얼마나 남았는지" 를 알려주는 것이다.**
그런데 004 가 만든 `/api/status` 는 "측정이 건강한가" 를 답한다 — 감시자 자신의 건강검진이다.
사용량은 응답 안에 있지만 `fields` 의 **한국어 라벨 + 문자열**(`"24%"`)뿐이라 기계가 쓸 수 없다.

- **007** — `allowance`(써도 되나) + `usage`(숫자·남은 여유)를 **추가**한다

🔒 **`fields`·`summary`·`state` 는 불변** — 기존 소비자(Foreman) 무영향, 추가만 하는 하위호환 변경.
🔒 **측정할 수 없으면 `allowed` 는 `null`** — `true` 도 `false` 도 아니다. 무지를 허가로도
금지로도 승격시키지 않고, 소비자가 자기 정책을 갖게 한다.

## Round 6 이 하는 일

007 을 실제로 띄워보니 **주간 99% 인데 `allowed: true`** 였고 `reason` 이 `under-threshold` 였다.
`headroom` 은 0 으로 맞게 냈으면서 판정만 틀렸다.

- **008** — `allowed` 가 STOP.json 존재 여부뿐 아니라 **측정치도 본다**

🔒 **재판정이 아니다.** `deriveDesired()`(차단기)는 한 글자도 안 건드린다. 이미 계산한
`headroom` 이 0 이면 허가하지 않는다는 안전선을 하나 더 두는 것뿐이다.
🔒 **불변식**: `allowed === true` 이면 두 `headroom` 이 모두 0 보다 크다. 이 한 줄을 테스트로 고정한다.

## Round 7 이 하는 일

개명의 마지막 조각이다. 006 이 저장소 내부를 바꿨고 폴더·저장소도 옮겼는데
**런처 두 개만 옛 이름으로 남아 있다.**

- **009** — `run-bellows.ps1` -> `run-quaestor.ps1`, `deploy-bellows.ps1` -> `deploy-quaestor.ps1`

006 이 이 둘을 남긴 이유(Foreman 이 파일명을 소비함)는 해소됐다 — Foreman 에 `supervised[]`
등록부가 랜딩해 **파일명이 설정값**(`start.args`)이 됐고, 🔒 **Foreman 은 이 개명을 기다리고 있다.**

🔒 **동작 변경 0 이 합격 기준이다.** 이름만 바뀐다.
🔒 **`.prominence` 의 로그·설정 파일명과 로그 줄 형식은 불변** — 005 의 복원이 그걸 읽는다.
콘솔 출력 접두어(`[bellows-chrome]`)와 로그 파일 줄(`[start] bellows watcher`)을 혼동하지 말 것.

## Round 8 이 하는 일

007·008 이 사용량을 계약대로 내주게 만들었다. 이제 사람이 보는 표면을 하나 얹는다.

- **010** — `GET /` 에 사용량 상태 페이지. `/api/status` 만 소비하고 그리기만 한다

🔒 **이 NNN 의 핵심은 화면이 거짓말하지 않는 것이다.**
`allowed: null` 이면 **"모름"** 으로 그린다 — 초록·"사용 가능" 금지. 프로세스가 살아 있다는
이유로 초록불을 켰다면 28일 침묵을 아무도 몰랐다. `/api/health` 와 `/api/status` 를 나눈 것과
같은 규율을 화면에서도 지킨다.
🔒 `stale` 이면 낡았음이 눈에 보여야 하고, `null` 을 `0%` 로 뭉개면 안 된다
(0% 는 "여유 만점"이라는 정반대 뜻이다).
🔒 **외부 요청 0** — CDN·웹폰트 금지, CSS/JS 인라인. loopback 전용이고 오프라인에서도 떠야 한다.

## Round 9 가 하는 일

Agora 에 버전 관측기가 생겼다(Agora 021·022). 등록된 계약의 health 를 찔러 **구현 중인 계약 버전**을
읽고 문서와 대조한다. Quaestor 는 아직 `not_declared` 다.

- **011** — `/api/health` 에 `contracts: { "supervised-v1": "1.2.0" }` 추가

🔒 **축을 틀리면 상시 오경보가 된다.** `package.json` 은 `0.1.0`(소프트웨어), 계약은 `1.2.0`(인터페이스)로
서로 다른 축이다. 소프트웨어 버전을 계약 버전 자리에 넣으면 **영원히 drifted** 이고,
Agora 022 가 말하듯 상시 울리는 경보는 없는 것보다 나쁘다. **둘을 함께 내되 섞지 않는다.**
🔒 `contracts` 값은 **코드가 아는 상수**여야 한다 — 볼트 문서를 읽어 채우면 자기로 자기를 검증하는 꼴이다.

## Constraints

- **Claude CLI 절대 사용 금지** — `claude` 가 `.js` 코드에 grep 매칭 0건이어야 한다(도메인 URL 은 예외).
  이 제품이 토큰을 쓰면 감시자가 감시 대상이 된다
- 의존성 추가 금지 — HTTP 는 `node:http`, 테스트는 `node:test`/`node:assert` 로 충분하다
  (현재 의존성은 puppeteer 하나뿐)
- 전용 Chrome 프로필(`./.profile/`, gitignore)로 동작. 사용자의 일반 Chrome 을 건드리지 않는다
- 🔒 **`.profile` 을 커밋·번들에 넣지 말 것.** claude.ai 로그인 세션이다
- 영문 코드/주석. 한글은 페이지 라벨 매칭 string literal 안에만
- PS 5.1 파싱 0 errors

## 🔒 불변 — 손대지 말 것

- **STOP.json 의 위치·이름·스키마.** Bellows·forge·foundry 세 곳이 각자 드라이브 후보를 훑어
  `.prominence` 를 찾는다. "경로를 맞춰준다"며 통일하지 말 것 — 여기가 안전장치의 본체다
- **`deriveDesired()` 의 임계 판정과 히스테리시스.** 멈추는 선(weekly 85 / session 90)과
  푸는 선(70 / 75)이 다른 것은 경계에서 깜빡이지 않게 하려는 **의도된 설계**다
- **사람이 건 수동 STOP**(`source === 'manual'`)은 자동 판정이 절대 덮지 않는다

## 실행

```
run-bellows.ps1 [-IntervalMinutes 15] [-ChromePath ...] [-ChromeProfileDir ...]
```

Chrome 을 `--remote-debugging-port=9222` + 전용 프로필로 띄운 뒤 루프를 돈다.
🔒 **`node watch-loop.js` 만 단독으로 돌리지 말 것** — Chrome 이 9222 로 떠 있지 않으면 연결 실패로 끝난다.

## File Layout (실측 · 2026-08-19)

```
Synology (스펙·산출물, scanPath):
  1. Project\products\Quaestor\
    ├─ work\           (이 스펙)   ├─ PROJECT_INTENT.md   ├─ CONTINUATION.md
    ├─ deploy.json     ├─ run-bellows.ps1   ├─ deploy-bellows.ps1
    └─ p-quaestor\ package.json · watch-loop.js · watch-once.js · lib\{config,scrape,extract,observation,control-server,logparse,env}.js

Workspace (빌드·git):
  F:\Workspace\Automatic\projects\Quaestor\      (repo: Quaestor)

런타임 산출물 — 🔒 저장소 밖:
  <Drive>:\SynologyDrive\Obsidian\Automatic\.prominence\{STOP.json, bellows.log, bellows-config.json}
```

## Related

- 감독 계약: `_guides\SUPERVISED_TOOL_CONTRACT.md` (Foreman 이 정의, 대상이 맞춘다)
- 상대편 절반: `products\Foreman\work\010-supervised-http-contract-client.md`
- 이관 이력: `add-bellows-product-migration\`
- 소비자: `p-forge.ps1` / `foundry.ps1` 의 `Get-PromnenceStopPath` → 착수 차단
