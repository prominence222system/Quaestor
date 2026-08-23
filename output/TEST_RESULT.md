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
