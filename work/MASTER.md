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

## Work Verify
- Smoke: `node p-bellows/test/run-all.js`
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
  1. Project\products\Bellows\
    ├─ work\           (이 스펙)   ├─ PROJECT_INTENT.md   ├─ CONTINUATION.md
    ├─ deploy.json     ├─ run-bellows.ps1   ├─ deploy-bellows.ps1
    └─ p-bellows\  package.json · watch-loop.js · watch-once.js · lib\{config,scrape,extract}.js

Workspace (빌드·git):
  F:\Workspace\Automatic\projects\Bellows\      (repo: Prominence-Bellows)

런타임 산출물 — 🔒 저장소 밖:
  <Drive>:\SynologyDrive\Obsidian\Automatic\.prominence\{STOP.json, bellows.log, bellows-config.json}
```

## Related

- 감독 계약: `_guides\SUPERVISED_TOOL_CONTRACT.md` (Foreman 이 정의, 대상이 맞춘다)
- 상대편 절반: `products\Foreman\work\010-supervised-http-contract-client.md`
- 이관 이력: `add-bellows-product-migration\`
- 소비자: `p-forge.ps1` / `foundry.ps1` 의 `Get-PromnenceStopPath` → 착수 차단
