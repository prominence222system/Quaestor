# 009 — 런처 파일명을 Quaestor 로 (개명의 마지막 조각)

## 배경

006 이 저장소 내부를(`p-quaestor/`, 패키지 이름, 환경변수) 개명했고, 폴더와 git 저장소도 옮겼다.
**런처 두 개만 옛 이름으로 남아 있다** — `run-bellows.ps1` · `deploy-bellows.ps1`.

006 이 이 둘을 일부러 남긴 이유는 Foreman 이 파일명을 소비했기 때문이다. 그런데 그 사이
Foreman 에 `supervised[]` 등록부가 랜딩해서 **파일명이 코드가 아니라 설정값**이 됐다:

```jsonc
"start": { "file": "powershell", "args": ["-NoProfile", "-File", "run-bellows.ps1"] }
```

즉 개명해도 Foreman 은 **설정 한 줄**만 고치면 된다. 계약이 약속한 그대로다.
🔒 **Foreman 은 지금 이 개명을 기다리는 상태다** — 더 미룰 이유가 없다.

## Project Type

제품(Quaestor) 진화. **기계적 개명 · 동작 변경 없음.**
🔒 **이 NNN 이 끝나도 실행 결과는 한 글자도 달라지지 않아야 한다.** 이름만 바뀐다.

## Scope

### 1. 파일명 두 개

```
run-bellows.ps1     ->  run-quaestor.ps1
deploy-bellows.ps1  ->  deploy-quaestor.ps1
```

🔒 **[SPEC] `git mv` 로 옮긴다.** 지우고 새로 만들면 이력이 끊긴다.

### 2. 내부 참조 갱신

- 두 스크립트 안에서 서로를, 또는 자기 이름을 문자열로 가리키는 곳
- 콘솔 출력의 `[bellows]` / `[bellows-chrome]` 접두어 → `[quaestor]` / `[quaestor-chrome]`
- `$env:BELLOWS_INTERVAL_MIN` → `$env:QUAESTOR_INTERVAL_MIN`
  (006 이 `QUAESTOR_*` 우선 + `BELLOWS_*` 폴백을 넣어뒀으므로 안전하다)

### 3. `-Setup` 안내문이 틀렸다 — 같이 고친다

`run-bellows.ps1` 의 `-Setup` 은 가이드만 출력하는데 **그 안내가 사람을 잘못된 프로필로 보낸다**:

```
안내문:  --user-data-dir="C:\BellowsChrome"
실제:    %LOCALAPPDATA%\Google\Chrome\BellowsProfile     (스크립트 L84 기본값)
```

🔒 **이 불일치가 실제 사고를 냈다.** 2026-08-20 에 사람이 엉뚱한 Chrome 에 로그인해
측정이 계속 죽어 있었다. 안내문을 **스크립트가 실제로 쓰는 경로**로 맞춘다.

⚠️ **프로필 디렉토리 이름(`BellowsProfile`) 자체는 바꾸지 않는다** — 그 안에 claude.ai
로그인 세션이 들어 있고, 옮기면 사람이 다시 로그인해야 한다. 개명 대상이 아니다.

### 4. 🔒 로그 줄 형식은 불변 — 005 가 읽는다

**[SPEC] `.prominence\bellows.log` 에 쓰이는 줄 형식을 바꾸지 말 것.**
`lib/logparse.js` 가 기동할 때 이 줄들을 파싱해 과거 이력을 복원한다. 형식이 바뀌면
**복원이 조용히 실패하고 `crit` 이 `warn` 으로 되돌아간다.**

```
<ISO> session=NN% weekly=NN%
<ISO> [poll start] / [poll error] ... kind=<kind> hint=<hint>
<ISO> [start] bellows watcher. interval=NNm config=...
<ISO> [restore] ... / [control] listening on 127.0.0.1:NNNN
```

⚠️ 위 접두어들은 **`watch-loop.js` 가 로그 파일에 쓰는 것**이고, §2 에서 바꾸는 것은
**`run-*.ps1` 이 콘솔에 쓰는 것**이다. 🔒 **둘을 혼동하지 말 것.**
`[start] bellows watcher` 의 `bellows` 도 그대로 둔다.

### 5. 🔒 범위 밖 — 손대지 말 것

- `.prominence\bellows.log` · `bellows-config.json` · `STOP.json` 의 **이름과 경로 해석**
  → 저장소 밖이고 소비자가 넷이다. 005 의 복원이 그 로그를 읽는다
- `%LOCALAPPDATA%\...\BellowsProfile` 디렉토리 이름 (§3 참조)
- Foreman 의 어떤 파일도 → 다른 저장소, 다른 주인
- `deriveDesired()` · 임계 판정 · `deriveAllowance()` · 스크레이핑

## Acceptance

🔒 **[SPEC] 합격 기준은 "아무것도 안 달라짐"이다.**

- [SPEC] `run-quaestor.ps1` · `deploy-quaestor.ps1` 이 존재하고,
  `run-bellows.ps1` · `deploy-bellows.ps1` 은 **존재하지 않는다**
- [SPEC] 두 파일 모두 PowerShell 5.1 파싱 **0 errors**
- [SPEC] `git log --follow run-quaestor.ps1` 이 **이동 이전 커밋까지** 보여준다(`git mv` 증거)
- [SPEC] `node p-quaestor/test/run-all.js` **exit 0**, 테스트 수 **204 이상**
- [SPEC] 🔒 **005 의 26일 fixture 테스트가 계속 통과**한다 → 로그 형식 불변의 기계적 증거
- [SPEC] 🔒 **경계 검증** — `run-quaestor.ps1` 이 참조하는 경로·파일이 **파일시스템에 실제로
  존재하는지** 확인한다. 문자열만 바꾸고 실경로가 어긋나면 파싱도 테스트도 통과하는데
  **기동만 죽는다**. 006 에서 같은 검증을 넣었던 이유다
- [SPEC] `-Setup` 출력에 `C:\BellowsChrome` 가 **나타나지 않고**, 스크립트가 실제로 쓰는
  프로필 경로가 안내된다
- [SPEC] 저장소에 `run-bellows` · `deploy-bellows` 문자열이 **0건**
  (`.prominence` 런타임 파일명과 `BellowsProfile` 은 대상 아님)

## USER_GATE

- `.\run-quaestor.ps1 -Once` 가 이전과 **같은 형태로** 동작하는지 확인
  (측정은 로그인 문제로 여전히 실패할 수 있다 — 🔒 판정 기준은 **"이전과 같은 실패 서명"**이다)
- 랜딩 후 Synology 쪽에 옛 파일이 남았는지 확인(sync-back 은 복사이지 삭제가 아니다)

## 예상 phase 2

1. `git mv` 두 건 + 내부 참조·콘솔 접두어·환경변수명 갱신 + `-Setup` 안내문 교정
2. PS 파싱 확인 + 실경로 존재 검증 + 전체 테스트 통과

## Related

- 006 이 이 둘을 일부러 남긴 근거와, 그 제약이 풀린 경위(Foreman `supervised[]` 랜딩)
- 🔒 **005 `lib/logparse.js`** — 로그 형식을 얼려야 하는 이유. 함께 읽을 것
- 랜딩 후 Foreman 이 할 일(다른 주인): `foreman-config.json` 의 `roots` 에
  `projects\Quaestor` 추가 + `start.args` 를 `run-quaestor.ps1` 로 +
  `server.js` `TOOL_PATTERNS.bellows` 정규식 갱신
