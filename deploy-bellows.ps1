#Requires -Version 5.1
param(
    [string]$Target = 'F:\Workspace\Automatic\projects\Bellows',
    [switch]$DryRun,
    [switch]$Force
)
$ErrorActionPreference = 'Stop'

# Find Synology source
$candidates = @(
  'D:\SynologyDrive\Obsidian\Automatic\1. Project\products\Bellows',
  'F:\SynologyDrive\Obsidian\Automatic\1. Project\products\Bellows'
)
$SrcRoot = $null
foreach ($c in $candidates) { if (Test-Path $c) { $SrcRoot = $c; break } }
if (-not $SrcRoot) { throw 'Bellows source not found in Synology' }

Write-Host ""
Write-Host "Deploy Bellows" -ForegroundColor Cyan
Write-Host ("  Source: {0}" -f $SrcRoot)
Write-Host ("  Dest:   {0}" -f $Target)
if ($DryRun) { Write-Host "  (dry run)" -ForegroundColor Yellow }
if ($Force)  { Write-Host "  (-Force: overwrite mode, mtime guard disabled)" -ForegroundColor Yellow }

# --- mtime-guard helpers ---

function Copy-IfNewer {
    param(
        [string]$Source,
        [string]$Destination,
        [switch]$Force
    )
    if (-not (Test-Path $Source)) { return $false }
    if (-not $Force -and (Test-Path $Destination)) {
        $srcTime = (Get-Item $Source).LastWriteTimeUtc
        $dstTime = (Get-Item $Destination).LastWriteTimeUtc
        if ($dstTime -gt $srcTime) {
            Write-Host "[deploy] skip (workspace newer): $Destination"
            return $false
        }
    }
    $dstDir = Split-Path -Parent $Destination
    if (-not (Test-Path $dstDir)) {
        New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
    }
    Copy-Item -Path $Source -Destination $Destination -Force
    return $true
}

function Deploy-Directory {
    param(
        [string]$SourceRoot,
        [string]$DestRoot,
        [string[]]$Excludes,
        [switch]$Force,
        [switch]$DryRun
    )
    $items = Get-ChildItem $SourceRoot -Force | Where-Object { $_.Name -notin $Excludes }
    foreach ($item in $items) {
        $dstPath = Join-Path $DestRoot $item.Name
        if ($item.PSIsContainer) {
            Deploy-Directory -SourceRoot $item.FullName -DestRoot $dstPath `
                             -Excludes @() -Force:$Force -DryRun:$DryRun
        } else {
            if ($DryRun) {
                Write-Host ("  - copy: {0}" -f $item.FullName) -ForegroundColor DarkCyan
            } else {
                Copy-IfNewer -Source $item.FullName -Destination $dstPath -Force:$Force | Out-Null
            }
        }
    }
}

# --- /helpers ---

# Excluded from copy: node_modules, .profile dirs, *.log files, .git
$excludeDirs = @('node_modules', '.profile', '.git')
$excludeExts = @('.log')

# Step 1: copy p-bellows source files with mtime guard
$srcTool = Join-Path $SrcRoot 'p-bellows'
$dstTool = Join-Path $Target  'p-bellows'
if (Test-Path $srcTool) {
    Write-Host ""
    Write-Host "Step 1: copy p-bellows" -ForegroundColor Cyan
    if (-not (Test-Path $dstTool)) { New-Item -ItemType Directory -Path $dstTool -Force | Out-Null }

    $files = Get-ChildItem $srcTool -Recurse -File -Force |
             Where-Object { $_.Extension -notin $excludeExts } |
             Where-Object {
                 $parts = $_.FullName.Substring($srcTool.Length).TrimStart('\','/') -split '[/\\]'
                 -not ($parts | Where-Object { $_ -in $excludeDirs })
             }

    foreach ($file in $files) {
        $rel = $file.FullName.Substring($srcTool.Length).TrimStart('\','/')
        $dst = Join-Path $dstTool $rel
        if ($DryRun) {
            Write-Host ("  - copy: {0}" -f $rel) -ForegroundColor DarkCyan
        } else {
            Copy-IfNewer -Source $file.FullName -Destination $dst -Force:$Force | Out-Null
        }
    }
}

# Step 2: copy run/deploy scripts with mtime guard
Write-Host ""
Write-Host "Step 2: copy run/deploy scripts" -ForegroundColor Cyan
foreach ($script in @('run-bellows.ps1', 'deploy-bellows.ps1')) {
    $src = Join-Path $SrcRoot $script
    $dst = Join-Path $Target  $script
    if (Test-Path $src) {
        if ($DryRun) {
            Write-Host ("  - copy: {0}" -f $script) -ForegroundColor DarkCyan
        } else {
            Copy-IfNewer -Source $src -Destination $dst -Force:$Force | Out-Null
        }
    }
}

Write-Host ""
Write-Host "Deploy Bellows complete." -ForegroundColor Green
