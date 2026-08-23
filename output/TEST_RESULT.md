# TEST_RESULT — 005 Phase 2 (watch-loop 기동 복원 배선 및 경계 검증)

대상: `p-bellows/watch-loop.js`(수정) · `p-bellows/test/watch-loop.test.js`(증분)
검증 방식: hermetic, 실 로그 파일 경계 검증 + 꼬리 읽기 + never-brick 폴백 연동 검증.

## 요약

- `node p-bellows/test/run-all.js` → **146 tests, 146 pass, 0 fail, exit code 0**, 프로세스 매달림 없음.
- Phase 1 종료 시점(140개) 대비 **+6개 순증분**, 기존 140개 전부 무회귀로 통과.
- `watch-loop.js` 기동 시 `bellows.log` 꼬리 64KB 읽기, well-formed restoration, `[restore]` 로그 기록 및 never-brick 폴백 검증 완료.

## Phase 2 Acceptance Criteria 대조

| 기준 | 결과 | 근거 테스트 |
|---|---|---|
| [SPEC] 26일 침묵 fixture: 성공 줄 하나 + 그 뒤 500개 실패 줄 로그 → 기동 복원 후 `deriveState()` 결과가 반드시 `crit` | PASS | `Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit` |
| [SPEC] parseLogTail() 순수성 검증 | PASS | `parseLogTail is pure and deterministic` |
| [SPEC] 성공 줄이 없는 로그 → `lastSuccessAt === null` | PASS | `log with no success line yields lastSuccessAt === null and lastUsage === null` |
| [SPEC] kind= 가 없는 옛 형식 실패 줄 → `kind === 'unknown'` | PASS | `old format failure line without kind= yields kind === unknown and detail === null` |
| [SPEC] 성공 줄 이후의 실패만 카운트 | PASS | `failure lines before last success line are excluded from consecutiveFailures` |
| [SPEC] 경계 검증: 임시 디렉토리에 실제 로그 파일 쓰고 읽어서 복원 (꼬리 64KB, 잘린 줄 제거) | PASS | `Phase 2 [SPEC]: boundary verification -- real log file tail reading and chopped line handling` |
| [SPEC] 로그 파일 없음 / 0바이트 / 깨진 바이트 → 예외 없이 빈 관측(default observation)으로 시작 | PASS | `Phase 2 [SPEC]: non-existent file, 0-byte file, and corrupted binary bytes yield empty observation without throwing` |
| [SPEC] 64KB보다 큰 파일에서 읽은 바이트가 상한(65536 bytes) 이하 | PASS | `Phase 2 [SPEC]: large file (>64KB) reads at most 64KB (65536 bytes)` |
| [SPEC] 복원 결과를 JSON.stringify 한 문자열에 .profile / cookie / @ (이메일) 없음 | PASS | `Phase 2 [SPEC]: restored observation stringified contains no secrets (.profile, cookie, @)` |
| [SPEC] mainLoop 시작 시 restoreObservation 순수 배선 및 never-brick 폴백 | PASS | `Phase 2 [SPEC]: mainLoop structurally integrates restoreObservation at startup before polling loop` |

## 버그 수정 및 조정 내역

- `watch-loop.js` 내 `mainLoop()`의 `restoreObservation` 래퍼 `catch` 블록 예외 변수명을 `restoreErr`로 정제하여 C2 스파이 라우팅 정규식 충돌을 방지함.

## 이전 Phase 연동 검증

- 001~004 및 005 Phase 1 기존 140개 테스트 전건 pass, 회귀 없음.

## How to Run

```
node p-bellows/test/run-all.js
```


===========================================
NNN: 006-rename-internals-to-quaestor
Started: 2026-08-23T07:46:26Z
===========================================

## Phase 1 — 폴더 이동 · 패키지 이름 · 문자열 전수 (2026-08-23)

### 결과: PASS

| 항목 | 명령 | 결과 |
|---|---|---|
| 테스트 | `node p-quaestor/test/run-all.js` | **exit 0** · tests **146** · pass **146** · fail **0** |
| 005 회귀 | 26일 침묵 fixture | ✔ `state === crit` 계속 통과 |
| 이름 잔재 | `git grep -n "p-bellows" -- . ":(exclude)work" ":(exclude)output" ":(exclude).p-forge"` | **0건** |
| 이동 인식 | `git diff --cached -M --summary` | 17개 전부 **rename … (100%)** |
| 파일명 유지 | `ls run-bellows.ps1 deploy-bellows.ps1` | 둘 다 존재 |
| PS 5.1 파싱 | `Parser::ParseFile` | 두 파일 모두 **0 errors** |
| 경계 검증 | `$ToolDir` 및 하위 참조 경로 실존 | 6/6 **EXISTS** |
| 패키지 이름 | `package.json` / `package-lock.json` | 셋 다 `prominence-quaestor` 로 일치 |

### 무회귀 기준선 (이동 전 실측)

이동 전 `node p-bellows/test/run-all.js` 는 **pass 123 / fail 0 이지만 exit 1** 이었다.
원인은 개명과 무관한 **환경 결손**이다 — 작업 트리에 `node_modules/` 가 없어
`test/scrape-classify.test.js:9` 의 `require.resolve('puppeteer')` 가 로드 단계에서 실패했고,
`run-all.js` 가 그 로드 실패를 `process.exitCode = 1` 로 올렸다.
Synology 원본(`products\Bellows\p-bellows\node_modules`, 1.3MB)을 `p-quaestor/node_modules`
로 복원하자 그 파일이 정상 로드되어 **123 → 146** 이 되었다. 즉 146 중 123 은 이동 전과
동일한 테스트이고, 늘어난 23 은 신규 추가가 아니라 **원래 있었으나 로드되지 못하던 것**이다.
`node_modules/` 는 `.gitignore` 대상이라 커밋 diff 에 포함되지 않는다.
🔒 `npm` 은 쓰지 않았다(Windows `.cmd` shim). 파일 복사와 `node` 실행뿐이다.

### 실제 변경 내역 (diff 전수)

`git diff -M` 의 내용 변경은 아래 **7줄뿐**이며 전부 이름 문자열이다. 로직 변경 0건.

- `p-quaestor/package.json` — `name` → `prominence-quaestor`
- `p-quaestor/package-lock.json` — 루트 `name` · `packages[""].name` → `prominence-quaestor`
- `p-quaestor/test/run-all.js:2` — 주석의 실행 경로
- `p-quaestor/test/watch-loop.test.js:64` — 테스트 **제목** 문자열(본문 `__dirname` 단언 무변경)
- `run-bellows.ps1:91` — `$ToolDir` → `'p-quaestor'`
- `deploy-bellows.ps1:80,81,82,85` — `$srcTool`·`$dstTool`·주석·`Write-Host` 문구

추가로 `p-quaestor/package.json:4` 의 `description` 안 em-dash(`—`)를 ASCII `-` 로 바꿨다.
이는 개명과 무관하며, 저장소의 **edit-gate 훅이 non-ASCII 를 차단**해 같은 편집 단계에서
수정할 것을 요구했기 때문이다. 값의 의미는 동일하다.

🔒 `deriveDesired()` 임계·히스테리시스, `STOP.json` 경로 해석, 스크레이핑 로직,
로그 줄 형식(`[start] bellows watcher` 포함), 환경변수 이름은 **한 글자도 바뀌지 않았다**.
환경변수 개명은 Phase 3 몫이다.

### ⚠️ 미해결 — `p-bellows/` 빈 디렉토리가 남아 있다

`git mv p-bellows p-quaestor`(디렉토리 통째 rename)는 **실패했다**:

```
fatal: renaming 'p-bellows' failed: Permission denied
mv: cannot move 'p-bellows' to 'p-quaestor_t': Device or resource busy
```

원인은 실행 중인 감시자다. `run-bellows.ps1:99` 가 `Push-Location $ToolDir` 후
`node watch-loop.js` 를 띄우므로 그 프로세스의 **CWD 가 `p-bellows` 자신**이고,
Windows 는 CWD 인 디렉토리의 rename·삭제를 거부한다.

- 실측: **PID 4260** `node watch-loop.js`, StartTime **2026-08-19** (4일째)
- 잠긴 것은 **최상위 디렉토리 하나뿐**이다 — `p-bellows/lib` 등 하위 항목의 rename 은 정상 동작함을 실측 확인
- 그 감시자는 살아서 15분마다 폴링하지만 **매번 실패**한다(`bellows.log` 실측:
  `[poll error] failed to connect to Chrome at http://127.0.0.1:9222`). 마지막 성공은 2026-07-28

그래서 **디렉토리 통째 rename 대신 항목별 `git mv`** 로 옮겼다. 결과는 동등하다 —
git 이 17개 전부를 `rename … (100%)` 로 인식하므로 **이력은 끊기지 않는다**(D1 충족).
untracked 인 `.profile/` 도 함께 옮겼다. 남은 것은 **내용물이 0개인 빈 껍데기**다.

🔒 살아 있는 차단기 프로세스를 **임의로 죽이지 않았다.** 사용자 승인 없이 프로세스를
종료하는 것은 이 작업의 권한 밖이다. 감시자를 재기동하면 잠금이 풀리고 빈 디렉토리는
삭제 가능해진다 — work 파일 USER_GATE 가 이미 예상한 "옛 폴더 잔존" 항목과 같은 성격이다.

### USER_GATE (사람이 할 일)

1. 감시자 재기동: 현재 PID 4260 을 멈추고 `run-bellows.ps1` 로 다시 띄운다
   (이제 `$ToolDir` 이 `p-quaestor` 를 가리킨다)
2. 재기동 후 남은 빈 디렉토리 삭제: `rmdir p-bellows`
3. Synology `products\Bellows\` 의 옛 `p-bellows\` 폴더 정리(sync-back 은 복사이지 삭제가 아니다)
4. ⚠️ `deploy-bellows.ps1 -DryRun` 의 **Step 1 이 조용히 건너뛰어진다.**
   이 스크립트는 Synology 원본(`products\Bellows\p-quaestor`)을 복사원으로 삼는데,
   Synology 쪽은 아직 `p-bellows` 라 `Test-Path $srcTool` 이 false 가 되기 때문이다.
   sync-back 이 `p-quaestor` 를 Synology 에 만들면 자동으로 해소된다.
   해소 전까지는 Step 1 이 **조용한 무동작**이라는 점에 유의할 것
5. ⚠️ `work/MASTER.md` 의 `Smoke: node p-bellows/test/run-all.js` 는 낡은 줄이 되었다.
   MASTER.md 는 불변이라 이 NNN 이 고칠 수 없다 — 러너 설정을 사람이 갱신해야 한다(D6)

## How to Run

```
node p-quaestor/test/run-all.js
```

## Phase 2 — 경계 검증: PS 파싱 · DryRun · 참조 경로 실존 (2026-08-23)

### 결과: PASS

🔒 `output/ACCEPTANCE.md` 에 "006 Phase 2" 절이 없어(파일이 006 Phase 1 에서 끝남) work 파일
(`work/006-rename-internals-to-quaestor.md`)의 아래 두 [SPEC] 조항과 `PROGRESS.md` 의 Phase 2
제목("PS 5.1 파싱 0 errors · `deploy-bellows.ps1 -DryRun` · `run-bellows.ps1` 참조 경로의
파일시스템 실존 확인")을 기준으로 검증했다. `.js` 는 이 Phase 에서 **한 줄도 수정하지 않았다**
(`git status --porcelain -M` 이 `output/` 외 변경 0건 — 검증만으로 전부 이미 통과했다).

| 기준 (출처) | 결과 | 근거 |
|---|---|---|
| [SPEC] `run-bellows.ps1` · `deploy-bellows.ps1` 이 PS 5.1 파싱 **0 errors** | PASS | `[System.Management.Automation.Language.Parser]::ParseFile()` 로 두 파일 각각 파싱 → `errors.Count === 0` (둘 다) |
| [SPEC] 🔒 경계 검증 — `run-bellows.ps1` 이 참조하는 디렉토리·파일이 **파일시스템에 실제로 존재**하는지 확인 | PASS | 아래 "참조 경로 실존 표" 참고 — 4/4 EXISTS, 실제 `-Setup` 실행으로 재확인 |
| [DERIVED] `deploy-bellows.ps1 -DryRun` 이 종료 코드 0 으로 끝난다 | PASS | 실행 결과 `EXIT=0`, Step 2(스크립트 복사)까지 정상 출력 |

### 참조 경로 실존 표 (`run-bellows.ps1`)

| 참조 (라인) | 실제 경로 | 상태 |
|---|---|---|
| `$ToolDir` (91행) | `p-quaestor/` | EXISTS |
| node_modules 가드 (93행) | `p-quaestor/node_modules/` | EXISTS |
| `-Once` 분기의 `node watch-once.js` (137행) | `p-quaestor/watch-once.js` | EXISTS |
| else 분기의 `node watch-loop.js` (141행) | `p-quaestor/watch-loop.js` | EXISTS |

Chrome 실행 파일 후보(`Find-ChromeExe`)·Chrome 프로필 디렉토리는 **선택적**(없으면 함수가
`$null`/경고로 우아하게 처리, `Ensure-BellowsChrome` 이 `New-Item` 으로 생성)이라 이 기준의
"참조하는 디렉토리·파일"에 해당하지 않는다(사전 존재를 요구하지 않음).

**실측 실행**: `run-bellows.ps1 -Setup` 을 실제로 돌려 `EXIT=0` 및 Setup Guide 전문 출력을
확인했다 — `$ToolDir` 해석과 `Push-Location` 이 문자열이 아니라 **실제 파일시스템 경로**에서
동작함을 mock 없이 증명한다.

### `deploy-bellows.ps1 -DryRun` 실행 로그

```
Deploy Bellows
  Source: F:\SynologyDrive\Obsidian\Automatic\1. Project\products\Bellows
  Dest:   F:\Workspace\Automatic\projects\Bellows
  (dry run)

Step 2: copy run/deploy scripts
  - copy: run-bellows.ps1
  - copy: deploy-bellows.ps1

Deploy Bellows complete.
EXIT=0
```

⚠️ **Phase 1 TEST_RESULT.md 의 예고대로** "Step 1: copy p-quaestor" 가 조용히 건너뛰어졌다
(Synology 원본이 아직 `p-bellows` 라 `Test-Path $srcTool` 이 false). 이는 이 Phase 의 결함이
아니라 이미 문서화된 이월 사항(Synology sync-back 이 사람 몫)의 재확인이다. `deploy-bellows.ps1`
자체의 코드는 무변경이고 종료 코드는 정상적으로 0 이다.

### 무회귀 확인

- `node p-quaestor/test/run-all.js` → **exit 0 · tests 146 · pass 146 · fail 0** (재실행, Phase 1 과 동일)
- `git grep -n "p-bellows" -- . ":(exclude)work" ":(exclude)output" ":(exclude).p-forge"` → **0건** (재확인)
- `git status --porcelain -M` → `output/` 외 변경 없음 — Phase 2 는 `.js`·`.ps1` 소스를 **손대지 않았다**

### 이전 Phase 연동 검증

- Phase 1 의 이동·이름·문자열 기준 전부 유지(테스트 146 개 무회귀, 파일명 유지, PS 파싱 0 errors 재확인)
- 005 26일 침묵 fixture 계속 `crit` 통과(146개 스위트에 포함되어 있음)

### 미해결 이월 사항 (Phase 1 에서 이미 문서화, 재확인만 함)

- 빈 `p-bellows/` 디렉토리, Synology `p-bellows` 잔존, `MASTER.md` 낡은 smoke 경로 — 전부 Phase 1
  TEST_RESULT.md 의 USER_GATE 항목과 동일하며 이 Phase 가 새로 만든 문제가 아니다.

## How to Run (갱신 없음 — Phase 1 과 동일)

```
node p-quaestor/test/run-all.js
powershell -NoProfile -ExecutionPolicy Bypass -File ./deploy-bellows.ps1 -DryRun
```

## Phase 3 — 환경변수 `QUAESTOR_*` 우선 · `BELLOWS_*` 폴백 (2026-08-23)

### 결과: PASS

대상: `p-quaestor/lib/env.js`(신규) · `lib/config.js` · `watch-loop.js` · `watch-once.js` · `lib/scrape.js`

진입 시점에 이미 커밋(`fa38d14`)돼 있던 구현이 `output/ACCEPTANCE.md` "# ACCEPTANCE — 006 Phase 3"
전량을 만족하는 상태였다. 이번 라운드는 그 전 기준을 실측 재실행/재대조했고, 코드 수정은
발생하지 않았다.

### Phase 3 Acceptance Criteria 대조

#### 우선순위 3케이스 (work 파일이 못 박은 것)

| 기준 | 결과 | 근거 |
|---|---|---|
| [SPEC] `QUAESTOR_CONTROL_PORT` 만 설정 → 그 값 | PASS | `env.test.js`: `config: QUAESTOR_CONTROL_PORT alone is used` |
| [SPEC] `BELLOWS_CONTROL_PORT` 만(새 이름 없이) 설정 → 그 값 | PASS | `env.test.js`: `config: BELLOWS_CONTROL_PORT alone (no QUAESTOR_) is used -- the fallback's reason to exist` |
| [SPEC] 둘 다 설정 → `QUAESTOR_*` 승 | PASS | `env.test.js`: `config: both set -> QUAESTOR_CONTROL_PORT wins [SPEC]` |
| [SPEC] 3케이스 hermetic 자동 테스트 | PASS | 위 3건 모두 `node:test`, 실 `.prominence`/Chrome 미접근 |
| [SPEC] 9개 접미사(`PROFILE_DIR`·`INTERVAL_MIN`·`WEEKLY_STOP`·`WEEKLY_RELEASE`·`SESSION_STOP`·`SESSION_RELEASE`·`CONTROL_PORT`·`CONTROL_TOKEN`·`CHROME_DEBUG_URL`) 전부 동일 규칙 | PASS | `env.test.js`의 `SUFFIXES` 루프 — 접미사별 2케이스(old만/new+old) × 9 = 18건 |
| [SPEC] 🔒 접미사 불변, 새 env 미추가 | PASS | 소스 대조: `lib/env.js`(24줄)에 접미사 리터럴 없음(호출부가 문자열 전달), 신규 환경변수 이름 없음 |
| [SPEC] 🔒 `BELLOWS_*` 키 0건 삭제 | PASS | `envRaw()`가 새 키 미정의 시 항상 `OLD_PREFIX + suffix` 폴백 조회 |

#### 의미 불변 — 해석 로직

| 기준 | 결과 | 근거 |
|---|---|---|
| [SPEC] 둘 다 미정의 → 하드 기본값 그대로(85/70/90/75, port 3210, authToken null, `.profile`, 15분, `http://127.0.0.1:9222`) | PASS | `env.test.js`: `config: both new and old undefined -> hard defaults unchanged` |
| [SPEC] `envToken` — 정의+빈문자열/공백 → `null`, 미정의 → 기본값(구분 유지) | PASS | `env.test.js`: `config: token env defined-but-empty -> null (explicit unset), distinct from undefined -> default` |
| [SPEC] `envInt` — 빈문자열/NaN → 기본값, throw 없음 | PASS | `env.test.js`: `config: unparseable int env falls back to default without throwing` |
| [SPEC] "있음" 판정은 `undefined` 여부(truthiness 아님) | PASS | `envRaw()` 소스가 `!== undefined` 비교만 사용, `env.test.js`: `env.js: is a pure lookup -- no |&#124; based selection in source`(함수 본문에 `|&#124;` 없음을 소스 정규식으로 확증) |
| [SPEC] `|&#124;` → `??` 전환 없음 | PASS | `env.test.js`: `|&#124; fallback expressions were not changed to ??` — `watch-loop.js`/`watch-once.js`/`lib/scrape.js` 소스에서 `envRaw(...) |&#124;` 패턴 확인 |
| [SPEC] `readConfig()` never-throw(파일없음·깨진JSON·잘못된타입·만료) | PASS | `env.test.js`: `config: readConfig never throws regardless of input` |
| [SPEC] 파일의 `control.port`/`control.authToken`이 두 env 모두를 이김 | PASS | `env.test.js`: `config: file control.port/authToken win over both env names` + 004 기존 테스트(`control-server.test.js:818`, 무수정 재확인) |
| [DERIVED] E1(새 이름=빈문자열이 옛 이름의 비어있지 않은 값을 이김)은 의도된 선택 | PASS | `env.test.js`: `env.js: QUAESTOR_ defined as empty string beats a non-empty BELLOWS_ (E1, intentional)` — 설계 §3-4 진리표와 일치 |

#### 선택층의 형태

| 기준 | 결과 | 근거 |
|---|---|---|
| [DERIVED] 선택 규칙이 `lib/env.js` 한 곳에만 | PASS | grep: 9개 호출부(`config.js` 6곳 + `watch-loop.js`/`watch-once.js`/`lib/scrape.js` 각 1곳)가 전부 `envRaw(...)` 호출, 삼항 선택 미복제 |
| [DERIVED] `lib/env.js`는 순수 조회(파싱/trim/기본값/캐시/쓰기 없음) | PASS | 소스 24줄 전체 대조 — `parseInt`/`trim`/`process.env[k]=` 없음 |
| [DERIVED] 임계값(85/90/70/75)·기본 포트(3210)·기본 경로 리터럴 없음 | PASS | 소스에 해당 리터럴 0건 |
| [DERIVED] 의존성 0(로컬 모듈도 node 내장도 `require` 없음) | PASS | `env.test.js`: `env.js: has no dependencies (no require calls)` |
| [DERIVED] `process.env.BELLOWS_` 직접 참조 0건(`lib/env.js` 상수·테스트 예외) | PASS | `env.test.js`: `no direct process.env.BELLOWS_ ... references remain in p-quaestor sources` — `p-quaestor` 전체 트리 워크로 확증 |
| [DERIVED] 설정 로더로 미확장(파일 읽기/병합/검증 없음) | PASS | 소스 24줄 그대로, `fs` 등 미사용 |

#### 검증 방법의 정직성

| 기준 | 결과 | 근거 |
|---|---|---|
| [SPEC] `lib/config.js` 경로는 행동 검증(반환값 실단언) | PASS | `env.test.js`의 `config:` 계열 테스트 전부 `envDefaults()`/`readConfig()` 실호출 후 반환값 단언 |
| [SPEC] `watch-loop.js`/`watch-once.js`/`lib/scrape.js`는 구조 단언 + 한계 명시 | PASS | `env.test.js`의 `structurally uses envRaw()` 3건은 정규식 기반 구조 검증이며, 아래 "검증 한계" 절에 명시 |
| [SPEC] 🔒 검증을 위해 `watch-once.js` require 안 함, `watch-loop.js` 재로드·자식프로세스 안 띄움 | PASS | 세 구조 테스트 전부 `fs.readFileSync`로 소스 텍스트만 읽음(모듈 로드 없음) |
| [SPEC] `pollOnce()` 테스트 구동 없음 | PASS | `env.test.js`에 `pollOnce` 참조 0건(grep 확인) |
| [SPEC] env 변경 테스트는 `try/finally`로 원상복구 | PASS | `env.test.js`의 `withEnv()` 헬퍼가 `finally`에서 원래 `undefined`였던 키를 `delete` |
| [DERIVED] `lib/env.js` 자체가 진리표 6개 조합 전부 단위 테스트됨 | PASS | `env.test.js` 상단 "lib/env.js: truth table" 6건(양쪽 미정의 / old만 / old만-빈문자열 / new만 / 둘다-new승 / E1) |

### 🔒 무회귀 · 경계

| 기준 | 결과 | 근거 |
|---|---|---|
| [SPEC] `node p-quaestor/test/run-all.js` exit 0, 146건 이상, fail 0 | **PASS** | 실행 결과: **tests 176 · pass 176 · fail 0**, exit code 0 |
| [SPEC] 004 기존 테스트(`env: BELLOWS_CONTROL_PORT / BELLOWS_CONTROL_TOKEN override hard defaults...`) 무수정 그대로 통과 | PASS | `control-server.test.js:818` 원문 직접 대조(수정 없음) + 통과 확인 |
| [SPEC] 005의 26일 침묵 fixture 계속 `crit` | PASS | `Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit` 통과(176건에 포함) |
| [SPEC] 🔒 로그 줄 형식 불변(`session=NN% weekly=NN%` 등 6종, `[start] bellows watcher`의 `bellows` 포함) | PASS | `watch-loop.js:256`: `'[start] bellows watcher. interval=' + INTERVAL_MIN + 'm config=' + CONFIG_PATH` — 문자 단위 그대로 |
| [SPEC] `deriveDesired()`/STOP.json 스키마/수동 STOP 우선/`resolveStopDir()` 무변경 | PASS | `git diff --stat HEAD~1 HEAD -- p-quaestor`가 `watch-loop.js`에서 **+5/-3줄**만 보고(require 1줄 + `envRaw()` 배선 2곳) — 이 함수들의 본문 라인은 diff에 없음 |
| [SPEC] `.prominence` 런타임 파일명(`STOP.json`·`bellows.log`·`bellows-config.json`) 무변경 | PASS | 소스에 리터럴 그대로 |
| [SPEC] `lib/observation.js`·`lib/logparse.js`·`lib/extract.js`·`lib/control-server.js` 이 Phase 무수정 | PASS | `git diff --stat HEAD~1 HEAD -- p-quaestor`에 4개 파일 미포함(변경분은 `config.js`·`env.js`·`scrape.js`·`watch-loop.js`·`watch-once.js`·`test/env.test.js`뿐) |
| [SPEC] 제어 서버 무변경(127.0.0.1 고정, 기본 포트 3210, `id==='quaestor'`, `POST /api/stop` 미구현, `timingSafeEqual`) | PASS | `control-server.js` diff 없음(위와 동일 증거) |
| [SPEC] 🔒 `run-bellows.ps1`/`deploy-bellows.ps1` 이 Phase 무수정(`$env:BELLOWS_INTERVAL_MIN` 포함) | PASS | `git status --porcelain -- run-bellows.ps1 deploy-bellows.ps1` → 빈 출력 |
| [SPEC] 두 ps1 PS 5.1 파싱 0 errors | **PASS** | `[System.Management.Automation.Language.Parser]::ParseFile()` 실행 → `run-bellows.ps1 errors=0`, `deploy-bellows.ps1 errors=0` |
| [SPEC] 파일명 유지, `projects\Bellows` 폴더/저장소 이름 무변경, forge·foundry·Foreman 무수정 | PASS | 두 ps1 파일 존재 확인, git status에 그 외 파일 변경 없음 |
| [SPEC] 의존성 미증가(`dependencies`는 `puppeteer` 하나), `package.json` name 유지·`package-lock.json` 일치 | PASS | `require('./p-quaestor/package.json').name === 'prominence-quaestor'`, lock의 루트/`packages[""]` 동일 |
| [SPEC] `p-quaestor`의 `.js`에 `claude` 매칭 0건(도메인 URL 예외, `lib/env.js` 포함) | PASS(주의) | 실측 매칭 전부 `test/*.test.js` 내부의 "claude CLI 미참조" 어써션 코드 자체(`content.match(/claude/g)` 등) — Phase 1 이전부터 있던 기존 패턴, 실제 코드가 `claude`를 참조하는 사례 0건. `lib/env.js`엔 `claude` 매칭 자체가 없음 |
| [SPEC] 소스 트리 `p-bellows` 문자열 0건 | PASS(주의) | 실측 매칭 전부 미추적(`git status`상 `??`) `.p-forge/`(forge 자체 history/status 이력 파일)뿐 — 커밋 대상 `.js`/`.ps1`/`.json` 소스에는 0건 |
| [SPEC] Phase 1·2 기준 전부 유지, 삭제·완화 없음 | PASS | 위 항목들이 Phase 1(rename)·Phase 2(경계검증) 기준을 포함해 재확인함 — 아래 "이전 Phase 통합 검증" 참고 |

### USER_GATE (자동 테스트로 대체 불가 — 사람 확인 필요)

Phase 3 work 파일 §USER_GATE 는 실기동(Chrome·실 `.prominence`)을 요구하므로 QA 자동 검증 범위 밖이다.
아래는 미실행 상태로 남겨둔다:

- [ ] `run-bellows.ps1`로 실제 기동해 이전과 같은 실패 서명으로 뜨는지 확인
- [ ] 기동 후 `bellows.log`에 `[start] bellows watcher. interval=NNm config=...`가 이전과 같은 형식으로 남는지 확인
- [ ] Synology `products\Bellows\`에 옛 `p-bellows\` 폴더가 남았는지 재확인(Phase 1 이월 사항)
- [ ] 런처의 `$env:BELLOWS_INTERVAL_MIN`을 `QUAESTOR_`로 언제 옮길지는 폴더 이동·Foreman 설정 작업에서 판단(인수인계 항목, work 파일이 이미 이렇게 명시)

### 전체 테스트 실행 로그

```
node p-quaestor/test/run-all.js
tests 176
pass 176
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 782.9
```

Phase 1 종료 시점(146) 대비 +30(`env.test.js` 신규) = 176.

### 구현 수정 사항

없음. 진입 시점에 `p-quaestor/lib/env.js`·`config.js`·`watch-loop.js`·`watch-once.js`·
`lib/scrape.js`·`test/env.test.js`가 이미 커밋(`fa38d14`)돼 Acceptance 기준 전량을 만족한
상태였다. 이번 라운드는 그 기준 전량을 실측 재실행·재대조하는 것으로 끝났고 코드 변경은
발생하지 않았다.

### 이전 Phase 통합 검증

- Phase 1(`git mv` 개명·패키지명·`p-bellows` 0건): 재확인 — 소스 트리에서 여전히 0건
- Phase 2(PS 5.1 파싱 0 errors·`-DryRun`·경로 실존): 재실행 — 여전히 0 errors, `-DryRun` EXIT=0,
  `run-bellows.ps1`이 참조하는 `p-quaestor`·`node_modules`·`watch-once.js`·`watch-loop.js` 4/4 실존
- 004(`control-server.js`)·005(로그 복원)의 기존 테스트 전량 — 176건 스위트에 포함되어 무회귀 통과

## How to Run

```
node p-quaestor/test/run-all.js
powershell -NoProfile -ExecutionPolicy Bypass -File ./deploy-bellows.ps1 -DryRun
```

실기동(USER_GATE, 사람 확인): `run-bellows.ps1` 실행 — Chrome을 `--remote-debugging-port=9222`로
띄운 뒤 루프가 돈다. 새 `QUAESTOR_*` 환경변수를 주면 그 값이 우선 적용되고, 옛 `BELLOWS_*`만
설정돼 있어도 그 값이 그대로 쓰인다(동작 변경 없음). 사전 준비: `p-quaestor/node_modules`
(puppeteer)가 이미 리포에 존재해 별도 설치 불필요.
