param([string]$Target = 'F:\Workspace\Automatic\Prominence-Bellows')
$ErrorActionPreference = 'Stop'

# Find Synology source
$candidates = @(
  'D:\SynologyDrive\Obsidian\Automatic\1. Project\Prominence-Bellows',
  'F:\SynologyDrive\Obsidian\Automatic\1. Project\Prominence-Bellows'
)
$SrcRoot = $null
foreach ($c in $candidates) { if (Test-Path $c) { $SrcRoot = $c; break } }
if (-not $SrcRoot) { throw 'Bellows source not found in Synology' }

# Copy p-bellows source files (NOT node_modules, NOT .profile, NOT *.log)
$srcTool = Join-Path $SrcRoot 'p-bellows'
$dstTool = Join-Path $Target  'p-bellows'
if (-not (Test-Path $dstTool)) { New-Item -ItemType Directory -Path $dstTool -Force | Out-Null }

robocopy $srcTool $dstTool /MIR /XD node_modules .profile /XF *.log | Out-Null

# Copy run/deploy scripts (overwrite)
Copy-Item (Join-Path $SrcRoot 'run-bellows.ps1')    (Join-Path $Target 'run-bellows.ps1')    -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $SrcRoot 'deploy-bellows.ps1') (Join-Path $Target 'deploy-bellows.ps1') -Force -ErrorAction SilentlyContinue

Write-Host "[deploy-bellows] deployed: $SrcRoot -> $Target"
