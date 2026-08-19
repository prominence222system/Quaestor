# Task: Cleanup Foundry-side Usage Poller

## Overview
구버전 PS 폴러 제거. Bellows로 기능 이관 전제. Foundry는 STOP.json **소비자**
역할만 (Phase 3에서). 폴러 launch 책임 제거.

## Files to Delete

```powershell
Remove-Item 'F:\Workspace\Automatic\Prominence-Foundry\usage-poller.ps1' -ErrorAction SilentlyContinue
Remove-Item 'F:\Workspace\Automatic\Prominence-Foundry\p-foundry\usage-poller.ps1' -ErrorAction SilentlyContinue
```

(EVAL_FEEDBACK에 따르면 실제 위치는 `Prominence-Foundry\usage-poller.ps1` 루트.
`p-foundry/` 하위에도 stub 잔재 있음. 둘 다 제거.)

## Files to Modify

### `F:\Workspace\Automatic\Prominence-Foundry\run-foundry.ps1`

다음 제거:
1. `[switch]$NoPoller` 파라미터 (param 블록에서 삭제)
2. 데몬 시작 시 `Start-Job -Name 'prominence-usage-poller' ...` 블록 전체
3. shutdown / finally 블록의 `Stop-Job` / `Remove-Job` for `'prominence-usage-poller'` 블록
4. 폴러 관련 모든 주석 / Write-Host 메시지 (`'usage-poller'`, `'poller'` 키워드 검색)

수정 후 PS 5.1 파싱 0 errors 유지.

## Verification

```powershell
# 1. Files deleted
Test-Path 'F:\Workspace\Automatic\Prominence-Foundry\usage-poller.ps1'
# Expect: False
Test-Path 'F:\Workspace\Automatic\Prominence-Foundry\p-foundry\usage-poller.ps1'
# Expect: False

# 2. run-foundry.ps1 has no poller references
$hits = Select-String -Path 'F:\Workspace\Automatic\Prominence-Foundry\run-foundry.ps1' `
                     -Pattern 'usage-poller|NoPoller|prominence-usage-poller'
"poller references in run-foundry (should be 0): $(@($hits).Count)"

# 3. PS 5.1 parses
$errors=$null
[System.Management.Automation.Language.Parser]::ParseFile(
  'F:\Workspace\Automatic\Prominence-Foundry\run-foundry.ps1',
  [ref]$null, [ref]$errors) | Out-Null
"run-foundry errors: $($errors.Count)"  # Expect: 0
```

## Cautions
- 이 시점에 사용자가 외부 PowerShell 창에서 폴러를 돌리고 있을 수 있음.
  코드 변경은 향후 launch만 막는 것 — 현재 실행 중 프로세스는 사용자가 Ctrl+C로 멈춰야 함.
- Synology source-of-truth (`1. Project\Prominence-Foundry\p-foundry\usage-poller.ps1`)
  도 sync-back 또는 명시 삭제로 정리. 단 forge가 직접 Synology를 건드리는 컨벤션이
  없으면 Workspace만 정리하고 sync-back 흐름에 맡김.

## Completion Criteria
- [ ] Workspace의 usage-poller.ps1 삭제됨 (양쪽 위치)
- [ ] run-foundry.ps1에서 poller 관련 코드/메시지 0건
- [ ] PS 5.1 파싱 0 errors

## Out of Scope
- Bellows 도구 자체 → 001-bellows.md
- forge stop hook / dispatcher respect / hearth UI
