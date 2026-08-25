param(
  [switch]$Setup,
  [switch]$Once,
  [switch]$Loop,
  [int]$IntervalMinutes = 15,
  [switch]$SkipChromeAutoLaunch,
  [string]$ChromePath = '',
  [string]$ChromeProfileDir = ''
)

function Test-ChromeDebuggerListening {
    param([int]$Port = 9222)
    try {
        $tcp = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return ($null -ne $tcp -and @($tcp).Count -gt 0)
    } catch { return $false }
}

function Find-ChromeExe {
    $x86 = ${env:ProgramFiles(x86)}
    $candidates = @(
        (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
        (Join-Path $x86 'Google\Chrome\Application\chrome.exe'),
        (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    return $null
}

function Start-QuaestorChrome {
    param(
        [string]$ChromePath,
        [string]$ProfileDir,
        [int]$Port = 9222,
        [int]$WaitSec = 10
    )
    if (-not $ChromePath -or -not (Test-Path $ChromePath)) {
        Write-Host '[quaestor-chrome] chrome.exe not found. Pass -ChromePath or install Chrome to default location.' -ForegroundColor Yellow
        return $false
    }
    if (-not (Test-Path $ProfileDir)) {
        New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null
    }
    Write-Host "[quaestor-chrome] launching Chrome: --remote-debugging-port=$Port --user-data-dir=`"$ProfileDir`""
    $cArgs = @(
        "--remote-debugging-port=$Port",
        "--user-data-dir=`"$ProfileDir`""
    )
    try {
        Start-Process -FilePath $ChromePath -ArgumentList $cArgs -ErrorAction Stop | Out-Null
    } catch {
        Write-Host "[quaestor-chrome] launch failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    for ($i = 0; $i -lt $WaitSec; $i++) {
        Start-Sleep -Seconds 1
        if (Test-ChromeDebuggerListening -Port $Port) {
            Write-Host "[quaestor-chrome] ready on port $Port"
            return $true
        }
    }
    Write-Host "[quaestor-chrome] WARNING: port $Port not listening after ${WaitSec}s. Quaestor may fail to scrape until login completes." -ForegroundColor Yellow
    return $false
}

function Ensure-QuaestorChrome {
    param(
        [string]$ChromePath,
        [string]$ProfileDir,
        [switch]$Skip
    )
    if ($Skip) {
        Write-Host '[quaestor-chrome] auto-launch skipped (-SkipChromeAutoLaunch)' -ForegroundColor DarkGray
        return
    }
    if (Test-ChromeDebuggerListening) {
        Write-Host '[quaestor-chrome] port 9222 already listening - reusing existing Chrome' -ForegroundColor DarkGray
        return
    }
    if (-not $ChromePath) { $ChromePath = Find-ChromeExe }
    if (-not $ProfileDir) {
        $ProfileDir = Join-Path $env:LOCALAPPDATA 'Google\Chrome\BellowsProfile'
    }
    [void](Start-QuaestorChrome -ChromePath $ChromePath -ProfileDir $ProfileDir)
}

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ToolDir   = Join-Path $ScriptDir 'p-quaestor'

if (-not (Test-Path (Join-Path $ToolDir 'node_modules'))) {
  Write-Host '[run-quaestor] installing dependencies (first run, may take a few minutes)...'
  Push-Location $ToolDir
  try { npm install } finally { Pop-Location }
}

Push-Location $ToolDir
try {
  if ($Setup) {
    Write-Host ''
    Write-Host '======================================================================'
    Write-Host '  Quaestor Setup Guide'
    Write-Host '======================================================================'
    Write-Host ''
    Write-Host '  Quaestor connects to a user-controlled Chrome instance via remote'
    Write-Host '  debugging port. You need a dedicated Chrome session.'
    Write-Host ''
    Write-Host '  STEP 1. Create a Chrome shortcut with these flags:'
    Write-Host ''
    Write-Host '    Target:'
    Write-Host '      "C:\Program Files\Google\Chrome\Application\chrome.exe"'
    Write-Host '        --remote-debugging-port=9222'
    Write-Host '        --user-data-dir="%LOCALAPPDATA%\Google\Chrome\BellowsProfile"'
    Write-Host ''
    Write-Host '    (adjust chrome.exe path if installed elsewhere)'
    Write-Host ''
    Write-Host '  STEP 2. Launch Chrome via that shortcut.'
    Write-Host ''
    Write-Host '  STEP 3. In that Chrome window, go to https://claude.ai/login'
    Write-Host '          and complete login (Google OAuth or other).'
    Write-Host ''
    Write-Host '  STEP 4. Navigate to https://claude.ai/settings/usage'
    Write-Host '          to verify usage data renders.'
    Write-Host ''
    Write-Host '  STEP 5. Keep that Chrome window open. Quaestor polling needs it.'
    Write-Host ''
    Write-Host '  STEP 6. To verify the watcher can scrape, run:'
    Write-Host '          .\run-quaestor.ps1 -Once'
    Write-Host ''
    Write-Host '======================================================================'
    Write-Host ''
    exit 0
  } elseif ($Once) {
    Ensure-QuaestorChrome -ChromePath $ChromePath -ProfileDir $ChromeProfileDir -Skip:$SkipChromeAutoLaunch
    node watch-once.js
  } else {
    Ensure-QuaestorChrome -ChromePath $ChromePath -ProfileDir $ChromeProfileDir -Skip:$SkipChromeAutoLaunch
    $env:QUAESTOR_INTERVAL_MIN = "$IntervalMinutes"
    node watch-loop.js
  }
} finally {
  Pop-Location
}
