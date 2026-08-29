# TEST_RESULT — 009 Phase 2 (런처 파싱 검증, 경계값 검증, 이력/경로 존재 검증 및 통합 테스트)

- **대상 모듈**: `run-quaestor.ps1`, `deploy-quaestor.ps1`, `p-quaestor/test/launcher-rename.test.js`
- **테스트 파일**: `p-quaestor/test/launcher-rename.test.js`, `p-quaestor/test/run-all.js`
- **검증 방식**: Node.js test runner & PowerShell Parser / Git history check

---

## 요약

- `node p-quaestor/test/run-all.js` 실행 결과: **212 tests, 212 pass, 0 fail**, Exit Code 0.
- 이전 Phase 및 선행 작업(001~008) 포함 204개 기존 테스트 스위트 100% 무회귀 통과.
- Phase 2 신규 검증 테스트 8건 추가 및 전건 PASS (`p-quaestor/test/launcher-rename.test.js`).
- `run-quaestor.ps1` 및 `deploy-quaestor.ps1` PowerShell 5.1 파싱 에러 **0건** 확인.
- `git log --follow run-quaestor.ps1` 이동 이력 전수 유지 확인.

---

## Acceptance Criteria 검증 결과

### Phase 1 & Phase 2 Acceptance Criteria

| 구분 | 검증 항목 / 수용 기준 | 결과 | 근거 테스트 / 검증 방법 |
|---|---|---|---|
| [SPEC] | `run-quaestor.ps1` 및 `deploy-quaestor.ps1`이 존재하고, `run-bellows.ps1` 및 `deploy-bellows.ps1`은 존재하지 않아야 한다. | PASS | `Phase 2 [SPEC]: run-quaestor.ps1 and deploy-quaestor.ps1 exist, run-bellows.ps1 and deploy-bellows.ps1 do not exist` |
| [SPEC] | `git log --follow run-quaestor.ps1` 명령이 이동 이전 커밋 이력까지 보여주어야 한다 (`git mv` 증거). | PASS | `Phase 2 [SPEC]: git log --follow run-quaestor.ps1 shows history prior to move (git mv evidence)` |
| [SPEC] | 두 런처 파일 모두 PowerShell 5.1 파싱 0 errors이어야 한다. | PASS | `Phase 2 [SPEC]: PowerShell 5.1 parsing has 0 errors for run-quaestor.ps1 and deploy-quaestor.ps1` |
| [SPEC] 🔒 | **경계 검증**: `run-quaestor.ps1`이 참조하는 경로 및 파일(`p-quaestor`, `watch-loop.js`, `watch-once.js` 등)이 파일시스템에 실제로 존재해야 한다. | PASS | `Phase 2 [SPEC]: boundary verification -- run-quaestor.ps1 referenced files and directories exist on filesystem` |
| [SPEC] | `run-quaestor.ps1` 내의 `-Setup` 안내 메시지에서 `C:\BellowsChrome` 문자열이 나타나지 않고, 실제 사용 프로필 경로(`%LOCALAPPDATA%\Google\Chrome\BellowsProfile`)가 안내되어야 한다. | PASS | `Phase 2 [SPEC]: -Setup output does not contain C:\BellowsChrome and displays correct profile path` |
| [SPEC] | `run-quaestor.ps1` 스크립트 내 환경변수 참조 시 `$env:BELLOWS_INTERVAL_MIN` 대신 `$env:QUAESTOR_INTERVAL_MIN`이 사용되어야 한다. | PASS | `Phase 2 [SPEC]: environment variable QUAESTOR_INTERVAL_MIN is used instead of BELLOWS_INTERVAL_MIN in run-quaestor.ps1` |
| [SPEC] | 스크립트 콘솔 로그 접두어가 `[bellows]` / `[bellows-chrome]`에서 `[quaestor]` / `[quaestor-chrome]`으로 갱신되어야 한다. | PASS | `Phase 2 [SPEC]: console log prefixes in launcher scripts are updated to [quaestor] / [quaestor-chrome]` |
| [SPEC] 🔒 | 005의 26일 fixture 테스트가 계속 통과하고 `lib/logparse.js`의 로그 줄 형식(`[start] bellows watcher` 등)은 절대 변경되지 않아야 한다. | PASS | `Phase 2 [SPEC]: 26-day silence fixture restored on boot yields state === crit` |
| [SPEC] | 저장소 내(work, output, .prominence, .p-forge 제외)에 `run-bellows` 및 `deploy-bellows` 문자열이 0건이어야 한다. | PASS | `Phase 2 [SPEC]: repository contains 0 occurrences of run-bellows or deploy-bellows strings` |
| [SPEC] | `node p-quaestor/test/run-all.js` 실행 결과 exit code가 0이고 총 테스트 수가 204개 이상이어야 한다. | PASS | 212 tests pass, exit code 0 |

---

## 구현 버그 수정 내역

- 런처 파일명 개명(`git mv`) 및 내외부 경로/콘솔 텍스트 갱신 후, 경계값 검증과 PowerShell 파싱 검사를 수행하여 단 한 건의 구문 에러나 경로 어긋남 없이 정상 동작함을 확인함.

---

## 이전 Phase 연동 검증 결과

- **001 ~ 008 호환성**: 005의 로그 복원(26일 fixture test), 006의 Quaestor 내부 개명, 007/008의 사용량 허용(allowance/usage) 판정 API 및 control-server 연동 등 모든 이전 기능이 100% 무회귀로 정상 동작함.

---

## How to Run

```bash
# 전체 단위 및 통합 테스트 실행 (Windows 환경)
node p-quaestor/test/run-all.js

# 개명된 런처 단발 실행 검증
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-quaestor.ps1 -Setup
```


===========================================
NNN: 010-status-web-page
Started: 2026-08-29T14:22:39Z
===========================================
