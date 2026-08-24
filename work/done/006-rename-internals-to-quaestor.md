# 006 — 저장소 내부를 Quaestor 이름으로 (폴더 이동 없음)

## 배경

제품 이름이 2026-08-19 에 **Bellows → Quaestor** 로 확정됐다. 004 가 `/api/health` 의
`id` 를 `quaestor` 로 박았고, 문서 3종과 `deploy.json` 은 사람이 갱신했다.
**저장소 내부는 아직 전부 옛 이름이다.**

이 NNN 은 **이 저장소 안에서 끝나는 것만** 한다. 폴더·git 저장소 이동과 forge·foundry·Foreman 의
참조는 다른 주인 몫이다 → `_system-briefs\RENAME_BELLOWS_TO_QUAESTOR.md` §2 소유권 3분할.

## Project Type

제품(Quaestor) 진화. **기계적 개명 · 동작 변경 없음.**
🔒 **이 NNN 이 끝나도 실행 결과는 이전과 한 글자도 달라지지 않아야 한다.**

## Scope

### 1. `p-bellows/` → `p-quaestor/`

🔒 **[SPEC] `git mv` 로 옮긴다.** 지우고 새로 만들면 이력이 끊긴다.

- `require('./lib/...')` 는 상대경로라 그대로 유효하다 — 건드릴 필요 없다
- 갱신할 것은 **문자열로 박힌 `p-bellows` 경로**뿐이다(테스트의 경로 단언 포함)

### 2. 패키지 이름

`package.json` 의 `"name": "prominence-bellows"` → `"prominence-quaestor"`.
`package-lock.json` 의 대응 필드도 함께(두 파일이 어긋나면 `npm ci` 가 경고한다).

### 3. `run-bellows.ps1` · `deploy-bellows.ps1` — **파일명은 그대로, 내용만**

🔒 **[SPEC] 이 두 파일의 이름을 바꾸지 말 것.**

Foreman 이 이 파일명을 소비한다(런처 경로 · `TOOL_PATTERNS` 프로세스 탐지 ·
`foreman-config.json` 의 `start.args`). 여기서 먼저 바꾸면 폴더 이동 작업까지
**깨져 있는 창**이 생긴다. 그쪽은 어차피 Foreman 설정을 건드리는 시점이므로 거기서 함께 바꾼다.

내용 중 **`p-bellows` 를 가리키는 경로 참조만** 새 폴더로 갱신한다.

### 4. 환경변수 — 새 이름 우선, 옛 이름 폴백

`lib/config.js` 와 `watch-loop.js` 가 `BELLOWS_*` 를 읽는다
(`BELLOWS_PROFILE_DIR` · `BELLOWS_INTERVAL_MIN` · `BELLOWS_WEEKLY_STOP` ·
`BELLOWS_CONTROL_PORT` · `BELLOWS_CONTROL_TOKEN` · `BELLOWS_CHROME_DEBUG_URL` 등).

🔒 **[SPEC] `QUAESTOR_*` 를 먼저 보고, 없으면 `BELLOWS_*` 를 본다.** 옛 이름을 삭제하지 않는다.
바깥에서 옛 이름을 설정해 둔 곳이 있으면 조용히 기본값으로 떨어지고, 그게 **임계값이면
차단기가 풀린다.** 폴백은 그 사고를 막는 보험이다.

### 5. 🔒 로그 줄 형식은 불변 — 005 가 이걸 읽는다

**[SPEC] 아래 형식을 한 글자도 바꾸지 말 것.** `lib/logparse.js` 의 `parseLogTail()` 이
기동할 때 이 줄들을 파싱해 26일치 이력을 복원한다. 형식이 바뀌면 **복원이 조용히 실패하고
`crit` 이 `warn` 으로 되돌아간다** — 005 가 고친 결함이 그대로 재발한다.

```
<ISO> session=NN% weekly=NN%
<ISO> [poll start]
<ISO> [poll error] scrape failed: ... kind=<kind> hint=<hint>
<ISO> [start] bellows watcher. interval=NNm config=...
<ISO> [restore] lastSuccess=... failures=... kind=...
<ISO> [control] listening on 127.0.0.1:NNNN
```

⚠️ `[start] bellows watcher` 의 `bellows` 도 **그대로 둔다.** 로그는 26일치 이력이고
과거 줄과 형식이 갈라지면 파서가 둘을 따로 처리해야 한다. 로그 문구 개명은 별도 판단.

### 6. 🔒 범위 밖 — 손대지 말 것

- 폴더 `products\Bellows` · `projects\Bellows`, git 저장소 이름 → **다른 주인**
- forge · foundry · Foreman 의 어떤 파일도 → **다른 주인**
- `.prominence\STOP.json` · `bellows.log` · `bellows-config.json` 의 **이름과 경로 해석**
  → 🔒 저장소 밖이고 소비자가 넷이다. 005 의 복원이 그 로그를 읽는다
- `deriveDesired()` · 임계 판정 · 스크레이핑 로직 → 이 NNN 은 **이름만** 바꾼다

## Acceptance

🔒 **[SPEC] 이 NNN 의 합격 기준은 "새 기능"이 아니라 "아무것도 안 달라짐"이다.**

- [SPEC] `node p-quaestor/test/run-all.js` 가 **exit 0**, 테스트 수 **146 이상**
  (줄어들면 테스트가 사라진 것이다 — 실패로 본다)
- [SPEC] 005 의 **26일 침묵 fixture 테스트가 계속 통과**한다 → 로그 형식 불변의 기계적 증거
- [SPEC] 저장소에서 `p-bellows` 문자열이 **0건**
  (`.prominence` 런타임 파일명 `bellows.log`·`bellows-config.json` 은 대상 아님)
- [SPEC] `package.json` 의 `name` 이 `prominence-quaestor`, `package-lock.json` 과 일치
- [SPEC] `git log --follow p-quaestor/watch-loop.js` 가 **이동 이전 커밋까지** 보여준다
  (`git mv` 로 옮겼다는 증거. 지우고 새로 만들었으면 이력이 끊긴다)
- [SPEC] `run-bellows.ps1` · `deploy-bellows.ps1` **파일명이 그대로** 존재한다
- [SPEC] 🔒 **경계 검증** — `run-bellows.ps1` 이 참조하는 디렉토리·파일이
  **파일시스템에 실제로 존재하는지** 확인한다. 문자열만 바꾸고 실제 경로가 어긋나면
  파싱도 테스트도 통과하는데 **기동만 죽는다**. 이 계열 사고가 반복된 이력이 있다
- [SPEC] `run-bellows.ps1` · `deploy-bellows.ps1` 이 PowerShell 5.1 파싱 **0 errors**
- [SPEC] 환경변수: `QUAESTOR_CONTROL_PORT` 를 주면 그 값이, 없이 `BELLOWS_CONTROL_PORT` 만
  주면 **그 값이** 쓰인다. 둘 다 주면 `QUAESTOR_*` 가 이긴다. 셋 다 hermetic 하게 검증

## USER_GATE

- 랜딩 후 Synology `products\Bellows\` 에 **옛 `p-bellows\` 폴더가 남았는지** 확인.
  sync-back 은 복사이지 삭제가 아니라 고아 폴더가 남을 수 있다. 남았으면 사람이 정리
- `run-bellows.ps1` 로 실제 기동해 이전과 같이 뜨는지 확인
  (측정은 로그인 문제로 여전히 실패할 수 있다 — 그건 이 NNN 의 실패가 아니다.
  🔒 판정 기준은 **"이전과 같은 실패 서명"** 이다)

## 예상 phase 3

1. `git mv p-bellows p-quaestor` + `package.json`/`package-lock.json` 이름 + 테스트 경로 단언
2. `run-bellows.ps1`·`deploy-bellows.ps1` 내부 경로 참조 갱신(파일명 유지) + PS 파싱 확인
3. 환경변수 `QUAESTOR_*` 우선 + `BELLOWS_*` 폴백 + 전체 통과 확인

## Related

- 소유권 분할과 남은 작업: `_system-briefs\RENAME_BELLOWS_TO_QUAESTOR.md`
- 🔒 **005 `lib/logparse.js`** — 로그 형식을 얼려야 하는 이유. 함께 읽을 것
- ⚠️ 혼동 주의: 이 NNN 은 **폴더를 옮기지 않는다.** `products\Bellows` 는 그대로다
