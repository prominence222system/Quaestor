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
│   │        env.js  ← [Phase 3 신규] QUAESTOR_*/BELLOWS_* 선택 전용 조회 함수
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

---

# Phase 3 상세 설계 — 환경변수 `QUAESTOR_*` 우선 · `BELLOWS_*` 폴백

## 3-0. 이 Phase 의 위치와 성격

Phase 1 은 **파일이 놓인 자리**를 옮겼고, Phase 2 는 그 자리가 파일시스템에 실제로 있음을 확인했다.
둘 다 `.js` 로직 변경 0건이었다. **Phase 3 은 이 NNN 에서 유일하게 코드 동작 경로를 건드린다** —
그래서 마지막에, 격리해서 한다(§6 Phase 분할).

그런데 이 Phase 조차 **관측 가능한 동작은 달라지지 않아야 한다.** 현재 이 기계에도, `run-bellows.ps1`
안에도 `QUAESTOR_*` 는 **하나도 설정돼 있지 않다**(Phase 2 eval 이 `grep -r QUAESTOR_ p-quaestor` →
0건으로 실증). 따라서 이 Phase 를 끝낸 직후의 실행 결과는 **정의상 이전과 동일**하고,
새 키는 **미래를 위해 열어 두는 문**이다.

🔒 그러므로 Phase 3 의 실패 조건은 "새 키가 안 먹는다" 보다 **"옛 키가 조용히 안 먹게 되는 것"** 이다.
work 파일 §4 가 경고한 사고가 정확히 그것이다 — 바깥에서 `BELLOWS_WEEKLY_STOP=95` 를 설정해 둔
곳이 있는데 코드가 그것을 못 읽으면 조용히 기본값 85 로 떨어지고, **차단기의 임계가 사람이 의도한
것과 달라진다.** 폴백은 기능이 아니라 **보험**이다.

## 3-1. 실측 대상 — 4파일 9키 (2026-08-23 재확인)

| 파일:줄 | 현행 표현 | 평가 시점 |
|---|---|---|
| `lib/config.js:38` | `envInt('BELLOWS_WEEKLY_STOP', 85)` | `readConfig()` 호출마다 |
| `lib/config.js:39` | `envInt('BELLOWS_WEEKLY_RELEASE', 70)` | 〃 |
| `lib/config.js:40` | `envInt('BELLOWS_SESSION_STOP', 90)` | 〃 |
| `lib/config.js:41` | `envInt('BELLOWS_SESSION_RELEASE', 75)` | 〃 |
| `lib/config.js:45` | `envInt('BELLOWS_CONTROL_PORT', 3210)` | 〃 |
| `lib/config.js:46` | `envToken('BELLOWS_CONTROL_TOKEN', null)` | 〃 |
| `watch-loop.js:10` | `path.resolve(process.env.BELLOWS_PROFILE_DIR \|\| './.profile')` | **모듈 로드 시 1회** |
| `watch-loop.js:11` | `parseInt(process.env.BELLOWS_INTERVAL_MIN \|\| '15', 10)` | **모듈 로드 시 1회** |
| `watch-once.js:5` | `path.resolve(process.env.BELLOWS_PROFILE_DIR \|\| './.profile')` | **모듈 로드 시 1회** |
| `lib/scrape.js:4` | `process.env.BELLOWS_CHROME_DEBUG_URL \|\| 'http://127.0.0.1:9222'` | **모듈 로드 시 1회** |

**접미사(suffix)는 9종**: `PROFILE_DIR` · `INTERVAL_MIN` · `WEEKLY_STOP` · `WEEKLY_RELEASE` ·
`SESSION_STOP` · `SESSION_RELEASE` · `CONTROL_PORT` · `CONTROL_TOKEN` · `CHROME_DEBUG_URL`.
🔒 **접미사는 한 글자도 바꾸지 않는다.** 바뀌는 것은 **접두사뿐**이다 — `BELLOWS_` → `QUAESTOR_` 우선.
(`INTERVAL_MIN` 을 `INTERVAL_MINUTES` 로 다듬는 종류의 개선은 금지. 개명이지 재설계가 아니다.)

## 3-2. D10. 선택층을 `lib/env.js` 한 곳에 둔다 (신규 모듈)

9개 호출부에 삼항 연산자를 9번 복붙하면 그중 하나가 다르게 쓰일 여지가 생기고, 그 하나가
**임계값 키**일 때 차단기가 조용히 어긋난다. 규칙이 하나뿐이어야 하므로 **의존 없는 최소 모듈**
`p-quaestor/lib/env.js` 를 새로 만든다.

```js
// lib/env.js  (의존 없음. node 내장조차 require 하지 않는다)
const NEW_PREFIX = 'QUAESTOR_';
const OLD_PREFIX = 'BELLOWS_';

// 새 이름이 '정의되어 있으면'(빈 문자열이어도) 그 값을, 아니면 옛 이름을 돌려준다.
// 둘 다 없으면 undefined -- 호출부의 기존 해석 로직이 그대로 기본값을 만든다.
function envRaw(suffix) { ... }

module.exports = { envRaw, NEW_PREFIX, OLD_PREFIX };
```

- **순수 조회 함수다.** 값을 해석하지 않고(`parseInt`·`trim`·기본값 없음), `process.env` 에 쓰지 않고,
  캐시하지 않는다. `process.env` 를 **호출 시점에** 읽는다(테스트가 env 를 갈아끼우며 검증할 수 있어야 한다).
- 이유: 해석을 여기서 하면 `envInt`(`''`→기본값)와 `envToken`(`''`→`null`)의 **서로 다른** 규칙을
  한 함수에 합치게 되고, 그 순간 D7 이 지키려는 의미 불변이 깨진다.
- 🔒 `lib/env.js` 에 임계값 리터럴(85/90/70/75)·포트 기본값(3210)·경로 기본값을 **넣지 않는다.**
  기본값의 주인은 지금처럼 `HARD_DEFAULTS` 와 각 호출부의 `|| '...'` 다.

### "있음" 의 판정 = `undefined` 여부 (D7 의 구체화)

```
QUAESTOR_X 가 process.env 에 정의되어 있으면 → 그 값을 쓴다 (빈 문자열이어도)
정의되어 있지 않을 때만            → BELLOWS_X 를 본다
```

truthiness(`process.env.QUAESTOR_X || process.env.BELLOWS_X`)로 고르면 안 되는 이유:
현행 `envToken()` 은 `''` 를 **"토큰 명시적 해제(→`null`)"**, `undefined` 를 **"미설정(→기본값)"** 으로
**다르게** 취급한다. truthiness 선택은 `QUAESTOR_CONTROL_TOKEN=''` 의 의미를 조용히 바꾼다.

## 3-3. 각 호출부의 정확한 편집 — 해석 로직은 한 글자도 안 바꾼다

**(a) `lib/config.js`** — `envInt`/`envToken` 의 **첫 줄만** 바뀐다. 나머지 본문은 무변경.

```
  envInt(name, fallback):   const raw = process.env[name];      →  const raw = envRaw(suffix);
  envToken(name, fallback): const raw = process.env[name];      →  const raw = envRaw(suffix);
```
매개변수는 전체 키 이름이 아니라 **접미사**를 받는다(`envInt('WEEKLY_STOP', 85)`).
🔒 `raw == null` / `raw === ''` / `parseInt` / `isNaN` / `trim()` / `''→null` 판정은 **그대로**다.
`envDefaults()` 의 반환 구조, `HARD_DEFAULTS`, `readConfig()` 의 파일 병합·만료·`_parseError`
경로는 **전부 무변경**이다.

**(b) `watch-loop.js:10-11` · `watch-once.js:5` · `lib/scrape.js:4`** — `process.env.BELLOWS_X` 를
`envRaw('X')` 로 바꾸고 **`|| 기본값` 은 그 자리에 그대로 둔다.**

```
path.resolve(process.env.BELLOWS_PROFILE_DIR || './.profile')
  → path.resolve(envRaw('PROFILE_DIR') || './.profile')
```
`||` 를 `??` 로 "고치지 않는다". `??` 로 바꾸면 `BELLOWS_PROFILE_DIR=''` 일 때 지금은 `./.profile`
로 가던 것이 `''` 로 가서 **동작이 달라진다** — 이 NNN 의 대전제 위반이다.

이 세 파일은 `require('./lib/env')` / `require('../lib/env')` 한 줄이 늘어난다. 그 외 변경 없음.

## 3-4. 의미 보존 표 (증명해야 하는 것)

`Q` = `QUAESTOR_X`, `B` = `BELLOWS_X`. `∅` = 미정의.

| Q | B | 개명 후 raw | 현행(개명 전) raw | 판정 |
|---|---|---|---|---|
| ∅ | ∅ | `undefined` | `undefined` | **동일** → 기본값 |
| ∅ | `"v"` | `"v"` | `"v"` | **동일** ← 🔒 이 줄이 폴백의 존재 이유 |
| ∅ | `""` | `""` | `""` | **동일** (해석층이 기존대로 처리) |
| `"v2"` | ∅ | `"v2"` | `undefined` | 새 문. 오늘은 발생하지 않음 |
| `"v2"` | `"v"` | `"v2"` | `"v"` | 새 이름이 이긴다 ([SPEC]) |
| `""` | `"v"` | `""` | `"v"` | **E1 — 아래 참조** |

**E1(경계)**: 새 이름이 빈 문자열로 정의되고 옛 이름에 값이 있는 경우. 선택 규칙이 `undefined`
기준이므로 `""` 가 이기고, 옛 값은 무시된다. 근거: **"새 이름을 명시적으로 정의했다면 그것이
의도다"** 를 일관되게 적용한다. 이 조합은 오늘 이 기계에 존재하지 않으며(`QUAESTOR_*` 0건),
truthiness 로 피하려 하면 `envToken` 의 `''` 의미가 깨진다(§3-2). **의도된 선택**으로 기록한다.

## 3-5. 데이터 흐름 (Phase 3 이 삽입하는 층)

```
process.env
   │
   ├─ QUAESTOR_<SUFFIX>  정의됨? ──yes──┐
   └─ BELLOWS_<SUFFIX>   ──────no───────┤     ← [신규] lib/env.js  envRaw()  · 선택만
                                        │
                        ┌───────────────┴────────────────┐
                        │        해석층 (무변경)          │
                        │  envInt · envToken · `|| 기본값` │
                        └───────────────┬────────────────┘
                                        │
     thresholds(85/90/70/75) · control.port(3210) · control.authToken
     PROFILE_DIR · INTERVAL_MIN · CHROME_DEBUG_URL
                                        │
                     deriveDesired() → STOP.json      (🔒 무변경)
                     startControlServer()             (🔒 무변경)
```
🔒 `deriveDesired()` · `deriveState()` · `parseLogTail()` · `resolveStopDir()` ·
`writeStopJsonAtomic()` 은 **이 그림에 들어오지 않는다.** 이 Phase 는 그들의 **입력 키 이름**만
건드리고 그들의 본문에는 손대지 않는다.

## 3-6. 이전 Phase 와의 통합

- **Phase 1(이동)과의 관계**: 편집 대상은 전부 `p-quaestor/` 안이다. `git mv` 로 얻은 이력은
  내용 편집으로 끊기지 않는다(`--follow` 는 계속 이어진다).
- **Phase 2(경계)와의 관계**: 🔒 이 Phase 는 `run-bellows.ps1`·`deploy-bellows.ps1` 을
  **수정하지 않는다**(§3-7 D11). 따라서 Phase 2 가 실증한 파일시스템 경계는 **재검증 없이 유효**하지만,
  회귀 확인을 위해 PS 파싱과 `-DryRun` 을 한 번 더 돌려 0 errors / exit 0 을 재확인한다.
- **004 와의 관계**: `test/control-server.test.js:818` 의 기존 테스트(`BELLOWS_CONTROL_PORT`·
  `BELLOWS_CONTROL_TOKEN` 이 하드 기본값을 덮어쓴다)는 **삭제·수정하지 않는다.** 그 테스트가
  개명 후에도 그대로 통과하는 것이 곧 폴백의 회귀 증거다.
- **005 와의 관계**: 로그 줄 형식은 이 Phase 의 대상이 아니다. `[start] bellows watcher` 를 포함해
  모든 로그 리터럴이 그대로 남고, 26일 침묵 fixture 테스트가 계속 `crit` 을 낸다.

## 3-7. D11. `run-bellows.ps1:140` 은 그대로 둔다 (`$env:BELLOWS_INTERVAL_MIN`)

바꾸고 싶어지지만 바꾸지 않는다. 근거 셋:
1. work 파일 §3 이 이 두 ps1 의 내용 편집을 **`p-bellows` 경로 참조로 한정**했다. 환경변수 세팅은
   그 목록에 없다.
2. 폴백은 **바깥에서 옛 이름을 설정하는 곳**을 위한 보험이다. 런처가 그 대표 사례이므로
   여기를 옛 이름으로 두면 폴백 경로가 **실기동에서 실제로 검증된다**. 새 이름으로 바꾸면
   폴백은 아무도 밟지 않는 죽은 코드가 된다.
3. Phase 2 가 ps1 diff 0 을 실증했다. 이 Phase 에서도 0 으로 유지하면 "ps1 이 문제일 가능성"이
   원천적으로 배제되어, 만약 실기동이 달라졌을 때 원인이 `.js` 한 곳으로 좁혀진다.

→ 런처의 env 키 개명은 **폴더 이동 작업(다른 주인)이 Foreman 설정을 건드리는 시점**에 함께 한다.
   이 판단을 TEST_RESULT.md 의 USER_GATE 로 올린다.

## 3-8. 🔒 이 Phase 에서 **하지 않는** 것

- `BELLOWS_*` 키 **삭제** — 폴백이 목적이다. 하나라도 지우면 이 Phase 는 실패다
- 접미사 개명·정규화, 새 환경변수 추가, 기본값 조정
- `envInt`/`envToken` 의 해석 규칙 변경, `||` → `??` 변경
- 로그 문구, `[bellows]`·`[bellows-chrome]`·`[bellows-once]` 콘솔 접두사, `bellows-test-` 임시파일 접두사
- `.prominence` 의 `STOP.json`·`bellows.log`·`bellows-config.json` 이름·경로 해석
- ps1 두 파일(§3-7), 기존 테스트의 삭제·완화
- `lib/env.js` 를 "이왕 만든 김에" 설정 로더로 키우는 것 — 조회 함수 하나로 끝낸다

## 3-9. 검증 설계 — 무엇을 어떻게 확인하는가

🔒 전부 **hermetic**. Chrome·claude.ai·네트워크·실제 `.prominence` 접근 없이 만족해야 한다.
env 를 만지는 모든 테스트는 **저장 → 변경 → `finally` 에서 원상 복구**한다(004 Phase 3 의 기존 관행).

| 대상 | 방법 | 왜 이 방법인가 |
|---|---|---|
| `lib/env.js` | 직접 단위 테스트. §3-4 진리표 6줄 전부 | 규칙의 본체. 여기가 맞으면 나머지는 배선 문제로 좁혀진다 |
| `lib/config.js` | `envDefaults()`/`readConfig()` 를 실제로 호출해 3케이스(새 것만 / 옛 것만 / 둘 다) 검증. work 파일이 [SPEC] 으로 지목한 `CONTROL_PORT` 포함 | 호출마다 env 를 읽으므로 **행동 검증**이 가능하다 |
| `watch-loop.js`·`watch-once.js`·`lib/scrape.js` | **구조 단언**(소스 문자열): `process.env.BELLOWS_` 직접 참조가 남아 있지 않고 `envRaw(` 를 경유한다 | 세 곳 모두 **모듈 로드 시 1회** 평가라 로드 후 env 를 바꿔도 값이 변하지 않는다. `watch-once.js` 는 require 즉시 스크레이핑을 시작하는 IIFE 이고, `watch-loop.js` 는 로드 시 실제 `.prominence` 를 잡는다(테스트 파일 상단 NOTE) — 🔒 이들을 재로드해 검증하려 들면 hermetic 이 깨진다 |
| 폴백 회귀 | 004 의 기존 `BELLOWS_CONTROL_PORT`/`TOKEN` 테스트를 **그대로 둔 채** 통과 | 삭제 없는 증거가 가장 강하다 |
| 파일 우선순위 | 설정 파일의 `control.port`·`control.authToken` 이 **두 환경변수 모두**를 이긴다 | 004 Phase 2 의 우선순위(파일 > env)가 새 층 삽입 후에도 유지되는지 |
| 전체 무회귀 | `node p-quaestor/test/run-all.js` → exit 0, **146건 이상**, fail 0 | 146 은 Phase 1·2 의 실측치. 줄면 테스트가 사라진 것 |
| 경계 재확인 | PS 5.1 파싱 0 errors · `deploy-bellows.ps1 -DryRun` exit 0 · `git status` 로 ps1 diff 0 | §3-7 D11 의 기계적 증명 |

**구조 단언의 정직한 한계**: 세 모듈-로드-시점 상수는 "코드가 `envRaw` 를 부른다" 까지만 증명하고
"그 값이 실기동에서 옳다" 는 USER_GATE 가 맡는다. 이 한계를 TEST_RESULT.md 에 명시한다 —
간접 증거를 직접 증거인 척 적지 않는다(004 Phase 5 가 세운 관행).

## 3-10. 위험과 완화

| 위험 | 완화 |
|---|---|
| 🔥 `BELLOWS_*` 를 "정리"하고 싶어져 폴백을 지운다 | 지우면 임계값이 조용히 기본값으로 떨어져 **차단기가 풀린다**(work §4). Acceptance 가 옛 키 동작을 [SPEC] 으로 못 박는다 |
| `envInt` 의 매개변수를 전체 키에서 접미사로 바꾸며 호출부 하나를 놓침 | `git grep "process\.env\.BELLOWS_\|process\.env\['BELLOWS"` 가 `p-quaestor` 안에서 0건인지 확인. 단, `lib/env.js` 의 `OLD_PREFIX` 상수는 예외 |
| 삼항 선택을 truthiness 로 써서 `''` 의미가 바뀜 | §3-2 의 `undefined` 규칙. `lib/env.js` 소스에 `\|\|` 기반 선택이 없음을 단언 |
| 새 모듈이 `claude` grep 테스트에 걸림 | `lib/env.js` 에는 URL 이 없다. 기존 테스트가 그대로 잡아낸다 |
| 테스트가 `process.env` 를 복구하지 않아 뒤 테스트를 오염 | 모든 env 테스트를 `try/finally` 로 감싸고, 원래 값이 `undefined` 였으면 `delete` 로 되돌린다 |
| 실기동 검증 유혹(`node watch-loop.js` 단독 실행) | 🔒 금지. Chrome 이 9222 로 떠 있어야 하고 실제 STOP.json 을 건드린다. 실기동은 `run-bellows.ps1` 로 USER_GATE 에서 |
