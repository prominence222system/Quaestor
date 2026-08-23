# DESIGN — 006 저장소 내부를 Quaestor 이름으로

> 🔒 **이 NNN 의 성공 기준은 "아무것도 안 달라짐"이다.**
> 기능 추가·리팩터링·개선 없음. 기계적 개명과, 그 개명이 무엇도 깨뜨리지 않았다는 실증뿐이다.

## 1. 배경과 이 문서의 위치

제품명은 2026-08-19 에 **Bellows → Quaestor** 로 확정됐다. 004 가 `/api/health` 의 `id` 를
`quaestor` 로 이미 바꿨고, 문서 3종과 `deploy.json` 은 사람이 갱신했다.
**저장소 내부(폴더명·패키지명·환경변수)는 아직 전부 옛 이름이다.**

소유권은 3분할되어 있고(`_system-briefs\RENAME_BELLOWS_TO_QUAESTOR.md` §2),
이 NNN 은 **이 저장소 안에서 끝나는 것만** 한다.

| 대상 | 주인 | 이 NNN |
|------|------|--------|
| `p-bellows/` 폴더명, 패키지명, 환경변수, 저장소 내 문자열 | 이 NNN | ✅ 한다 |
| `products\Bellows` · `projects\Bellows` 폴더, git 저장소 이름 | 다른 주인 | ❌ 안 한다 |
| forge · foundry · Foreman 의 참조, `run-bellows.ps1` **파일명** | 다른 주인 | ❌ 안 한다 |
| `.prominence\{STOP.json, bellows.log, bellows-config.json}` 이름·경로 해석 | 저장소 밖·소비자 4곳 | ❌ 안 한다 |

## 2. 아키텍처 (변경 없음 — 이름만 갈아끼운다)

```
run-bellows.ps1  (파일명 유지)
   └─ $ToolDir = <repo>\p-quaestor          ← [변경] 경로 문자열만
        ├─ watch-loop.js      ── require('./lib/...')  상대경로, 무변경
        │     ├─ lib/scrape.js      (puppeteer → CDP 9222 → claude.ai/settings/usage)
        │     ├─ lib/extract.js
        │     ├─ lib/config.js      ← [변경] QUAESTOR_* 우선 / BELLOWS_* 폴백
        │     ├─ lib/observation.js (deriveState = 계기판)
        │     ├─ lib/logparse.js    (005: 기동 시 로그 꼬리 복원)
        │     └─ lib/control-server.js (127.0.0.1:3210, id="quaestor")
        └─ test/run-all.js    ← 스모크 진입점 (경로가 p-quaestor 로 바뀐다)

🔒 저장소 밖 (이름·경로 전부 불변):
   <Drive>:\SynologyDrive\Obsidian\Automatic\.prominence\
        STOP.json · bellows.log · bellows-config.json
```

**데이터 흐름은 한 글자도 바뀌지 않는다.** scrape → `deriveDesired()` → STOP.json,
그리고 기동 시 `bellows.log` 꼬리 → `parseLogTail()` → `deriveState()`.
이 NNN 이 건드리는 것은 (a) 파일이 놓인 **디렉토리 이름**, (b) 패키지 **name 필드**,
(c) 환경변수 **키 이름의 조회 순서**뿐이다.

## 3. 실측 조사 결과 — 바꿔야 할 것의 전수

저장소를 grep 해서 확인한 실제 사정(2026-08-23 실측):

### (a) `p-bellows` 문자열 — 소스 측 **6곳뿐**
| 파일:줄 | 내용 | 처리 |
|---|---|---|
| `run-bellows.ps1:91` | `Join-Path $ScriptDir 'p-bellows'` | → `'p-quaestor'` |
| `deploy-bellows.ps1:81` | `$srcTool = Join-Path $SrcRoot 'p-bellows'` | → `'p-quaestor'` |
| `deploy-bellows.ps1:82` | `$dstTool = Join-Path $Target 'p-bellows'` | → `'p-quaestor'` |
| `deploy-bellows.ps1:85` | `Write-Host "Step 1: copy p-bellows"` | → `p-quaestor` |
| `p-bellows/test/run-all.js:2` | 주석 `// Run: node p-bellows/test/run-all.js` | → `p-quaestor` |
| `p-bellows/test/watch-loop.test.js:64` | 테스트 **제목** `'p-bellows/.js files ...'` | → `p-quaestor/...` |

🔒 **테스트의 경로 단언은 전부 `__dirname` 상대다**(`path.join(__dirname, '..', 'lib', ...)`).
`require('../package.json')` 도 상대다. 따라서 **폴더를 옮겨도 고칠 경로 단언은 없다** —
위 두 곳은 주석과 테스트 제목, 즉 **문자열일 뿐**이다. 이것이 이 NNN 이 저위험인 이유다.

### (b) 패키지 이름 — 3곳
`package.json:2` `"name"`, `package-lock.json:2` 루트 `"name"`, `package-lock.json:8`
`packages[""].name`. lockfileVersion 3.

### (c) 환경변수 — 4파일 9키
| 파일 | 키 |
|---|---|
| `lib/config.js:38-46` | `BELLOWS_WEEKLY_STOP` · `WEEKLY_RELEASE` · `SESSION_STOP` · `SESSION_RELEASE` · `CONTROL_PORT` · `CONTROL_TOKEN` |
| `watch-loop.js:10-11` | `BELLOWS_PROFILE_DIR` · `BELLOWS_INTERVAL_MIN` |
| `watch-once.js:5` | `BELLOWS_PROFILE_DIR` |
| `lib/scrape.js:4` | `BELLOWS_CHROME_DEBUG_URL` |

`run-bellows.ps1:140` 이 `$env:BELLOWS_INTERVAL_MIN` 을 세팅한다.

## 4. 기술 결정과 근거

### D1. `git mv` — 이력 보존 (SPEC)
지우고 새로 만들면 `git log --follow` 가 끊긴다. 이 저장소의 `watch-loop.js` 는 이미 5개
커밋의 이력을 갖고 있고, 004·005 의 설계 의도가 그 diff 안에 있다.
`git mv p-bellows p-quaestor` **한 번**으로 옮기고, 같은 커밋에서 문자열을 고친다.
검증: `git log --follow p-quaestor/watch-loop.js` 가 이동 이전 커밋(현재 5건)까지 보여준다.

### D2. 상대 require 는 손대지 않는다
`require('./lib/scrape')` 는 폴더가 통째로 이동하면 그대로 유효하다.
"확실히 하려고" 절대경로로 바꾸는 종류의 개선은 **금지**다 — 이 NNN 은 이름만 바꾼다.

### D3. `run-bellows.ps1` · `deploy-bellows.ps1` 파일명 유지 (SPEC)
Foreman 이 이 파일명을 소비한다(런처 경로 · `TOOL_PATTERNS` 프로세스 탐지 ·
`foreman-config.json` 의 `start.args`). 여기서 먼저 바꾸면 **깨져 있는 창**이 생긴다.
내용 중 `p-bellows` 경로 참조만 갱신한다.

### D4. ps1 경로 갱신을 Phase 1 에 함께 넣는다 (Phase 분할 조정)
work 파일의 "예상 phase" 는 ps1 갱신을 Phase 2 로 뒀지만, 그러면 Phase 1 종료 시점의
저장소에서 `run-bellows.ps1` 이 **존재하지 않는 디렉토리**를 가리킨다. 즉 라운드 중간에
런처가 죽어 있는 창이 생긴다 — work 파일 §3 이 경계하는 것과 같은 종류의 사고다.
그래서 **폴더 이동과 그 폴더를 가리키는 모든 문자열을 Phase 1 에서 원자적으로** 끝내고,
Phase 2 는 **"문자열이 아니라 실제 파일시스템"을 확인하는 경계 검증**으로 쓴다.
(work 파일의 phase 목록은 "예상"이며 [SPEC] 이 아니다. Acceptance 항목은 전부 보존된다.)

### D5. `p-bellows` 0건 검사의 범위 (해석 명시)
work 파일 Acceptance 는 "저장소에서 `p-bellows` 문자열 0건"을 요구한다. 그런데:
- `work/**` 는 **수정 금지**이고 `MASTER.md`·`001`·`003`·`004`·`005`·`006` 이 `p-bellows` 를 쓴다
- `output/**` 은 **지난 라운드의 기록**이고 `ACCEPTANCE.md` 는 append-only 다
- `.p-forge/**` 는 러너 산출물이다

따라서 검사 범위는 **소스 트리**로 한다:
```
git grep -n "p-bellows" -- . ":(exclude)work" ":(exclude)output" ":(exclude).p-forge"   → 0건
```
🔒 런타임 파일명 `bellows.log` · `bellows-config.json` · `STOP.json` 은 애초에 대상이 아니다.

### D6. ⚠️ MASTER.md 의 Work Verify 는 개명 후 **낡은 줄이 된다** (기록)
`work/MASTER.md` 는 `Smoke: node p-bellows/test/run-all.js` 라고 적고 있고,
MASTER.md 는 **절대 불변**이라 이 NNN 이 고칠 수 없다.
개명 후 올바른 스모크 명령은 **`node p-quaestor/test/run-all.js`** 다(work 파일 Acceptance 가
이 경로를 [SPEC] 으로 못박았다). 두 문서가 충돌할 때는 **현재 work 파일이 이긴다.**
- TEST_RESULT.md 와 EVAL_FEEDBACK.md 의 "How to Run" 에 새 경로를 명시한다
- 러너가 MASTER 의 옛 경로를 그대로 실행해 `MODULE_NOT_FOUND` 로 실패한다면 그것은
  **이 NNN 의 결함이 아니라 낡은 설정**이다. 사람이 MASTER/러너 설정을 갱신해야 한다
  (USER_GATE 로 올린다).
- ⚠️ `npm` 은 여전히 금지다. Windows 에서 `.cmd` shim 이라 러너에서 실행되지 않는다.

### D7. 환경변수 — 새 이름 우선, 옛 이름 폴백, **의미는 불변** (Phase 3)
🔒 `QUAESTOR_*` 를 먼저 보고 **없으면** `BELLOWS_*` 를 본다. 옛 이름을 삭제하지 않는다.
바깥에서 옛 이름을 설정해 둔 곳(예: `run-bellows.ps1:140`, 사람의 셸 프로필)이 조용히
기본값으로 떨어지면, 그게 임계값일 때 **차단기가 풀린다.** 폴백은 그 사고를 막는 보험이다.

핵심 설계 규칙 — **"있음"의 판정은 `undefined` 여부로 한다**:
```
QUAESTOR_X 가 process.env 에 정의되어 있으면(빈 문자열이어도) 그 값을 쓴다.
정의되어 있지 않을 때만 BELLOWS_X 를 본다.
```
이유: 현행 `envToken()` 은 `''` 를 "토큰 명시적 해제(null)"로, `undefined` 를 "미설정"으로
**다르게** 취급한다. 선택을 truthiness 로 하면 `QUAESTOR_CONTROL_TOKEN=''` 의 의미가
바뀌어 **동작이 달라진다** — 이 NNN 의 대전제 위반이다. 값 해석 함수(`envInt`/`envToken`)의
로직은 **한 글자도 바꾸지 않고**, 어떤 키를 읽을지 고르는 얇은 층만 앞에 둔다.

### D8. 🔒 로그 줄 형식은 얼려 둔다 (005 가 이걸 읽는다)
`lib/logparse.js` 의 `parseLogTail()` 이 기동 시 아래 줄들을 파싱해 26일치 이력을 복원한다.
형식이 바뀌면 **복원이 조용히 실패하고 `crit` 이 `warn` 으로 되돌아간다** — 005 가 고친
결함의 재발이다.
```
<ISO> session=NN% weekly=NN%
<ISO> [poll start]
<ISO> [poll error] scrape failed: ... kind=<kind> hint=<hint>
<ISO> [start] bellows watcher. interval=NNm config=...
<ISO> [restore] lastSuccess=... failures=... kind=...
<ISO> [control] listening on 127.0.0.1:NNNN
```
⚠️ `[start] bellows watcher` 의 `bellows` 도 **그대로 둔다.** 26일치 과거 줄과 형식이
갈라지면 파서가 둘을 따로 처리해야 한다. `[bellows]`·`[bellows-chrome]` 같은 콘솔 접두사,
`bellows-test-` 같은 임시파일 접두사도 **건드리지 않는다**(개명 대상이 아니다).

### D9. 손대지 않는 것 (MASTER.md 불변 조항의 재확인)
`deriveDesired()` 의 임계(stop weekly 85 / session 90, release 70 / 75)와 히스테리시스,
수동 STOP(`source === 'manual'`) 우선 규칙, `STOP.json` 의 위치·이름·스키마,
`resolveStopDir()` 의 드라이브 후보 탐색, 스크레이핑 로직, 제어 서버의 `127.0.0.1` 고정 바인딩과
`POST /api/stop` 미구현, 토큰의 `timingSafeEqual` 비교. **전부 무변경.**

## 5. 디렉토리 구조 (이 NNN 종료 후)

```
F:\Workspace\Automatic\projects\Bellows\          ← 폴더명 그대로 (다른 주인)
├─ run-bellows.ps1        ← 파일명 그대로, 내부 경로만 p-quaestor
├─ deploy-bellows.ps1     ← 파일명 그대로, 내부 경로만 p-quaestor
├─ p-quaestor\            ← [git mv] p-bellows 에서 이동
│   ├─ package.json       "name": "prominence-quaestor"
│   ├─ package-lock.json  루트 name + packages[""].name 동일하게
│   ├─ .gitignore         (node_modules/ .profile/ *.log — 함께 따라온다)
│   ├─ watch-loop.js  watch-once.js
│   ├─ lib\  config.js · scrape.js · extract.js · observation.js · logparse.js · control-server.js
│   └─ test\ run-all.js · control-server.test.js · observation.test.js
│             scrape-classify.test.js · watch-loop.test.js · logparse.test.js
├─ work\      (수정 금지)
└─ output\    DESIGN.md · PROGRESS.md · ACCEPTANCE.md(append-only) · TEST_RESULT.md · EVAL_FEEDBACK.md
```

## 6. Phase 분할

| Phase | 내용 | 왜 이 순서인가 |
|---|---|---|
| 1 | `git mv` + 패키지 이름 + 저장소 내 `p-bellows` 문자열 전수(ps1 경로 포함) | 의존이 가장 낮고, 원자적으로 끝내야 런처가 깨진 창을 남기지 않는다 |
| 2 | 경계 검증 — PS 5.1 파싱 · `-DryRun` · **참조 경로가 파일시스템에 실제로 존재하는지** | 문자열만 맞고 실제 경로가 어긋나면 테스트는 통과하는데 **기동만 죽는다**. 이 계열 사고 이력이 있다 |
| 3 | 환경변수 `QUAESTOR_*` 우선 + `BELLOWS_*` 폴백 (hermetic 3케이스) | 유일하게 코드 **동작**을 건드리는 부분이라 마지막에, 격리해서 한다 |

---

# Phase 1 상세 설계 — 폴더 이동 · 패키지 이름 · 문자열 전수

## 1-1. 작업 순서 (이 순서를 지킨다)

```
① git status 로 작업 트리가 깨끗한지 확인 (output/ 의 forge 산출물 제외)
② git mv p-bellows p-quaestor          ← 반드시 git mv. rm+add 금지
③ p-quaestor/package.json      : "name": "prominence-bellows" → "prominence-quaestor"
④ p-quaestor/package-lock.json : 루트 "name" 과 packages[""].name 을 같은 값으로
⑤ p-quaestor/test/run-all.js:2 : 주석의 실행 경로
⑥ p-quaestor/test/watch-loop.test.js:64 : 테스트 제목 문자열
⑦ run-bellows.ps1:91           : 'p-bellows' → 'p-quaestor'
⑧ deploy-bellows.ps1:81,82,85  : 'p-bellows' → 'p-quaestor'
⑨ node p-quaestor/test/run-all.js  → exit 0, 146건 이상, fail 0
⑩ git grep 로 p-bellows 0건(D5 범위), git log --follow 로 이력 연결 확인
```

## 1-2. 각 편집의 정확한 내용

**③ `p-quaestor/package.json`** — `name` 필드 한 줄만. `version`·`description`·`scripts`·
`dependencies` 는 무변경. `scripts.once/loop` 는 `node watch-once.js` / `node watch-loop.js`
로 폴더 상대이므로 손댈 것이 없다.

**④ `p-quaestor/package-lock.json`** — `npm` 을 실행하지 않는다(Windows 에서 `.cmd` shim).
`name` 이 나오는 두 곳만 손으로 고친다. `lockfileVersion: 3`, `packages` 의 의존성 트리,
`integrity` 해시는 **한 글자도 건드리지 않는다**. 두 파일의 `name` 이 어긋나면 `npm ci` 가
경고하므로 **정확히 같은 문자열**이어야 한다.

**⑥ `test/watch-loop.test.js:64`** — 테스트 **제목만** 바뀐다:
`'p-bellows/.js files do not reference the Claude CLI'`
→ `'p-quaestor/.js files do not reference the Claude CLI'`.
본문의 `path.join(__dirname, '..')` 은 그대로다. **테스트 개수는 변하지 않는다.**

**⑦⑧ ps1** — `Join-Path` 의 리터럴과 `Write-Host` 문구뿐. `param()` 블록, `$Target` 기본값
(`...\projects\Bellows`), Synology 후보 경로(`...\products\Bellows`), 제외 목록
(`node_modules`, `.profile`, `.git`, `.log`), 복사할 스크립트 목록
(`run-bellows.ps1`, `deploy-bellows.ps1`) 은 **전부 그대로**다. 이들은 다른 주인의 것이다.

## 1-3. 🔒 Phase 1 에서 **하지 않는** 것

- 환경변수 이름 — Phase 3 (지금 바꾸면 이동과 동작 변경이 한 diff 에 섞여 원인 추적이 막힌다)
- 로그 문구, `[bellows]`·`[bellows-chrome]` 접두사, `bellows-test-` 임시파일 접두사
- `require` 경로, 테스트의 `__dirname` 단언, 테스트 추가·삭제
- 코드 정리·주석 개선·포맷팅 — **diff 에 이름 외의 것이 섞이면 안 된다**

## 1-4. 검증 방법 (Phase 1 종료 조건)

| 확인 | 명령 |
|---|---|
| 테스트 | `node p-quaestor/test/run-all.js` → exit 0, 146건 이상, fail 0 |
| 005 회귀 | 26일 침묵 fixture 테스트가 `crit` 으로 계속 통과 |
| 이름 잔재 | `git grep -n "p-bellows" -- . ":(exclude)work" ":(exclude)output" ":(exclude).p-forge"` → 0건 |
| 이력 연결 | `git log --follow p-quaestor/watch-loop.js` → 이동 이전 커밋(5건)까지 |
| 이동 인식 | `git status --porcelain -M` 이 `R` (rename) 로 표시 |
| 무변경 실증 | `git diff -M` 의 `.js` 변경이 **run-all.js 주석 1줄 + watch-loop.test.js 제목 1줄**뿐 |
| 파일명 유지 | `run-bellows.ps1` · `deploy-bellows.ps1` 이 그대로 존재 |

## 1-5. 위험과 완화

| 위험 | 완화 |
|---|---|
| Windows 대소문자 무시 파일시스템에서 rename 이 `D`+`A` 로 보임 | `p-bellows` → `p-quaestor` 는 완전히 다른 이름이라 해당 없음. `git status -M` 으로 `R` 확인 |
| 러너가 MASTER 의 옛 스모크 경로를 실행 | D6 참고. TEST_RESULT 에 명시하고 USER_GATE 로 올린다 |
| `npm install`/`npm ci` 를 자동 실행하고 싶은 유혹 | 금지. lock 은 손편집, 검증은 `node` 로만 |
| `node_modules/` 가 함께 옮겨지지 않아 puppeteer 못 찾음 | 테스트는 hermetic 이라 puppeteer 를 로드하지 않는다. 실기동은 `run-bellows.ps1` 이 없으면 설치한다 |
