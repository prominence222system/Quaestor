param(
  [switch]$Setup,
  [switch]$Once,
  [switch]$Loop,
  [int]$IntervalMinutes = 15
)
$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ToolDir   = Join-Path $ScriptDir 'p-bellows'

if (-not (Test-Path (Join-Path $ToolDir 'node_modules'))) {
  Write-Host '[run-bellows] installing dependencies (first run, may take a few minutes)...'
  Push-Location $ToolDir
  try { npm install } finally { Pop-Location }
}

Push-Location $ToolDir
try {
  if ($Setup) {
    Write-Host ''
    Write-Host '======================================================================'
    Write-Host '  Bellows Setup Guide'
    Write-Host '======================================================================'
    Write-Host ''
    Write-Host '  Bellows connects to a user-controlled Chrome instance via remote'
    Write-Host '  debugging port. You need a dedicated Chrome session.'
    Write-Host ''
    Write-Host '  STEP 1. Create a Chrome shortcut with these flags:'
    Write-Host ''
    Write-Host '    Target:'
    Write-Host '      "C:\Program Files\Google\Chrome\Application\chrome.exe"'
    Write-Host '        --remote-debugging-port=9222'
    Write-Host '        --user-data-dir="C:\BellowsChrome"'
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
    Write-Host '  STEP 5. Keep that Chrome window open. Bellows polling needs it.'
    Write-Host ''
    Write-Host '  STEP 6. To verify the watcher can scrape, run:'
    Write-Host '          .\run-bellows.ps1 -Once'
    Write-Host ''
    Write-Host '======================================================================'
    Write-Host ''
    exit 0
  } elseif ($Once) {
    node watch-once.js
  } else {
    $env:BELLOWS_INTERVAL_MIN = "$IntervalMinutes"
    node watch-loop.js
  }
} finally {
  Pop-Location
}
