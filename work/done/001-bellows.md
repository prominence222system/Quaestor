# Task: Build Prominence-Bellows Watcher Tool

## Overview
Node.js 도구 신설. Puppeteer로 claude.ai/settings/usage 헤드리스 스크레이핑.
임계값 정책 적용해서 STOP.json 갱신. 무한 루프 + 단발 모드 + 인터랙티브 로그인
설정 모드 지원.

## Files to Create

전부 `F:\Workspace\Automatic\Prominence-Bellows\` 아래 작성. sync-back이 Synology
`1. Project\Prominence-Bellows\p-bellows\` (와 run/deploy ps1)로 복사함.

### 1. `p-bellows/package.json`
```json
{
  "name": "prominence-bellows",
  "version": "0.1.0",
  "description": "Token usage watcher for Prominence — scrapes claude.ai/settings/usage and writes STOP.json",
  "private": true,
  "scripts": {
    "setup": "node setup-login.js",
    "once": "node watch-once.js",
    "loop": "node watch-loop.js"
  },
  "dependencies": {
    "puppeteer": "^23.0.0"
  }
}
```

### 2. `p-bellows/lib/extract.js`
Page-context extraction function. Exported as a string source (or function reference)
so `watch-once`/`watch-loop` can pass it to `page.evaluate`.

```javascript
'use strict';

// IMPORTANT: this function runs inside the browser page context.
// Do not reference Node globals.
function extractUsage() {
  const text = document.body.innerText;
  function pctAfter(anchor) {
    const idx = text.indexOf(anchor);
    if (idx < 0) return null;
    const w = text.slice(idx, idx + 300);
    const m = w.match(/(\d{1,3})\s*%/);
    return m ? parseInt(m[1], 10) : null;
  }
  function resetAfter(anchor) {
    const idx = text.indexOf(anchor);
    if (idx < 0) return null;
    const w = text.slice(idx, idx + 300);
    const m = w.match(/(\([월화수목금토일]\)\s*[^\n]+에\s*재설정|[\d시간분 ]+후\s*재설정)/);
    return m ? m[0].trim() : null;
  }
  const planMatch = text.match(/Max\s*\(\s*(\d+)x\s*\)/);
  return {
    plan: planMatch ? `Max (${planMatch[1]}x)` : null,
    session_pct: pctAfter('현재 세션'),
    session_reset: resetAfter('현재 세션'),
    weekly_pct: pctAfter('모든 모델'),
    weekly_reset: resetAfter('모든 모델'),
    last_update: (text.match(/마지막 업데이트:[^\n]+/) || [null])[0]
  };
}

module.exports = { extractUsage };
```

### 3. `p-bellows/lib/scrape.js`
Puppeteer launch + navigation + extraction. Shared by `watch-once` and `watch-loop`.

```javascript
'use strict';
const puppeteer = require('puppeteer');
const { extractUsage } = require('./extract');

async function scrapeUsage(profileDir, opts) {
  opts = opts || {};
  const headless = opts.headless !== false;       // default: true
  const navTimeoutMs = opts.navTimeoutMs || 60000;
  const waitTimeoutMs = opts.waitTimeoutMs || 20000;

  const browser = await puppeteer.launch({
    headless,
    userDataDir: profileDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.goto('https://claude.ai/settings/usage', {
      waitUntil: 'networkidle2',
      timeout: navTimeoutMs
    });
    // Wait for the "last updated" text to appear, signaling data is rendered
    await page.waitForFunction(
      () => document.body.innerText.indexOf('마지막 업데이트:') >= 0,
      { timeout: waitTimeoutMs }
    );
    return await page.evaluate(extractUsage);
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeUsage };
```

### 4. `p-bellows/setup-login.js`
1회 인터랙티브 로그인. 사용자가 직접 브라우저 닫을 때까지 대기.

```javascript
'use strict';
const path = require('path');
const puppeteer = require('puppeteer');

const PROFILE_DIR = path.resolve(process.env.BELLOWS_PROFILE_DIR || './.profile');

(async () => {
  console.log('[bellows-setup] launching browser. profile=' + PROFILE_DIR);
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: PROFILE_DIR,
    defaultViewport: null,
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('https://claude.ai/login');
  console.log('');
  console.log('  >>> please complete login in the browser window <<<');
  console.log('  >>> after login, navigate to /settings/usage to verify <<<');
  console.log('  >>> then close the browser window. profile will persist. <<<');
  console.log('');
  await new Promise(function (resolve) { browser.on('disconnected', resolve); });
  console.log('[bellows-setup] browser closed. profile saved.');
})().catch(function (e) {
  console.error('[bellows-setup] error:', e);
  process.exit(1);
});
```

### 5. `p-bellows/watch-once.js`
한 번 폴링. JSON 한 줄을 stdout으로 출력하고 종료. 디버깅/검증용.

```javascript
'use strict';
const path = require('path');
const { scrapeUsage } = require('./lib/scrape');

const PROFILE_DIR = path.resolve(process.env.BELLOWS_PROFILE_DIR || './.profile');

(async () => {
  try {
    const result = await scrapeUsage(PROFILE_DIR);
    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  } catch (e) {
    console.error('[bellows-once] scrape failed:', e.message);
    process.exit(1);
  }
})();
```

### 6. `p-bellows/watch-loop.js`
무한 루프 + STOP.json 갱신. **idempotent** + **manual 보호** + **failure-silent**.

환경변수:
- `BELLOWS_INTERVAL_MIN` (default 15)
- `BELLOWS_WEEKLY_STOP` (default 85)
- `BELLOWS_WEEKLY_RELEASE` (default 70)
- `BELLOWS_SESSION_STOP` (default 90)
- `BELLOWS_SESSION_RELEASE` (default 75)
- `BELLOWS_PROFILE_DIR` (default `./.profile`)

```javascript
'use strict';
const fs = require('fs');
const path = require('path');
const { scrapeUsage } = require('./lib/scrape');

const PROFILE_DIR      = path.resolve(process.env.BELLOWS_PROFILE_DIR || './.profile');
const INTERVAL_MIN     = parseInt(process.env.BELLOWS_INTERVAL_MIN || '15', 10);
const WEEKLY_STOP      = parseInt(process.env.BELLOWS_WEEKLY_STOP || '85', 10);
const WEEKLY_RELEASE   = parseInt(process.env.BELLOWS_WEEKLY_RELEASE || '70', 10);
const SESSION_STOP     = parseInt(process.env.BELLOWS_SESSION_STOP || '90', 10);
const SESSION_RELEASE  = parseInt(process.env.BELLOWS_SESSION_RELEASE || '75', 10);

function resolveStopDir() {
  const candidates = [
    'D:\\SynologyDrive\\Obsidian\\Automatic',
    'F:\\SynologyDrive\\Obsidian\\Automatic'
  ];
  for (let i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) {
      const p = path.join(candidates[i], '.prominence');
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      return p;
    }
  }
  return null;
}

const STOP_DIR = resolveStopDir();
if (!STOP_DIR) {
  console.error('[bellows] no Synology root found (D: or F:)');
  process.exit(1);
}
const LOG_PATH  = path.join(STOP_DIR, 'bellows.log');
const STOP_PATH = path.join(STOP_DIR, 'STOP.json');

function log(msg) {
  const ts = new Date().toISOString();
  fs.appendFileSync(LOG_PATH, ts + ' ' + msg + '\n');
}

function readStopJson() {
  if (!fs.existsSync(STOP_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(STOP_PATH, 'utf8')); } catch (e) { return null; }
}

function writeStopJsonAtomic(obj) {
  const tmp = STOP_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, STOP_PATH);
}

function deriveDesired(usage) {
  const wp = usage.weekly_pct, sp = usage.session_pct;
  const weeklyOver  = wp >= WEEKLY_STOP;
  const sessionOver = sp >= SESSION_STOP;
  const weeklyOk    = wp <  WEEKLY_RELEASE;
  const sessionOk   = sp <  SESSION_RELEASE;
  if (weeklyOver || sessionOver) {
    let reason;
    if (weeklyOver && sessionOver) reason = 'both';
    else if (weeklyOver) reason = 'weekly_threshold';
    else reason = 'session_threshold';
    return { state: 'stop', reason: reason };
  }
  if (weeklyOk && sessionOk) return { state: 'release' };
  return { state: 'hold' };
}

function isValidUsage(u) {
  if (!u) return false;
  if (typeof u.session_pct !== 'number') return false;
  if (typeof u.weekly_pct !== 'number') return false;
  if (u.session_pct < 0 || u.session_pct > 100) return false;
  if (u.weekly_pct < 0 || u.weekly_pct > 100) return false;
  return true;
}

async function pollOnce() {
  log('[poll start]');
  let usage = null;
  try {
    usage = await scrapeUsage(PROFILE_DIR);
  } catch (e) {
    log('[poll error] scrape failed: ' + e.message);
    return;
  }
  if (!isValidUsage(usage)) {
    log('[poll error] invalid extraction: ' + JSON.stringify(usage));
    return;
  }
  log('session=' + usage.session_pct + '% weekly=' + usage.weekly_pct + '%');

  const existing = readStopJson();
  if (existing && existing.source === 'manual') {
    log('[stop] manual STOP active, skip auto');
    return;
  }
  const desired = deriveDesired(usage);
  if (desired.state === 'stop') {
    if (existing
        && existing.source === 'auto'
        && existing.reason === desired.reason) {
      log('[stop] holding STOP (reason=' + desired.reason + ', no rewrite)');
      return;
    }
    writeStopJsonAtomic({
      source:        'auto',
      reason:        desired.reason,
      weekly_pct:    usage.weekly_pct,
      session_pct:   usage.session_pct,
      weekly_reset:  usage.weekly_reset,
      session_reset: usage.session_reset,
      created_at:    new Date().toISOString(),
      thresholds: {
        weekly_stop:     WEEKLY_STOP,
        weekly_release:  WEEKLY_RELEASE,
        session_stop:    SESSION_STOP,
        session_release: SESSION_RELEASE
      }
    });
    log('[stop] STOP.json written (reason=' + desired.reason + ')');
  } else if (desired.state === 'release') {
    if (existing && existing.source === 'auto') {
      try { fs.unlinkSync(STOP_PATH); log('[release] STOP.json removed (recovered)'); }
      catch (e) { log('[release error] ' + e.message); }
    }
    // else: no STOP, nothing to do
  } else {
    log('[hold] hysteresis (weekly=' + usage.weekly_pct + '% session=' + usage.session_pct + '%)');
  }
}

(async () => {
  log('[start] bellows watcher. interval=' + INTERVAL_MIN + 'm thresholds=W' + WEEKLY_STOP + '/' + WEEKLY_RELEASE + ' S' + SESSION_STOP + '/' + SESSION_RELEASE);
  while (true) {
    try { await pollOnce(); }
    catch (e) { log('[poll uncaught] ' + e.message); }
    await new Promise(function (r) { setTimeout(r, INTERVAL_MIN * 60 * 1000); });
  }
})();
```

### 7. `p-bellows/.gitignore`
```
node_modules/
.profile/
*.log
```

### 8. `run-bellows.ps1` (Workspace 루트)
```powershell
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
    node setup-login.js
  } elseif ($Once) {
    node watch-once.js
  } else {
    $env:BELLOWS_INTERVAL_MIN = "$IntervalMinutes"
    node watch-loop.js
  }
} finally {
  Pop-Location
}
```

### 9. `deploy-bellows.ps1` (Workspace 루트)
형제 도구의 `deploy-X.ps1` 패턴 따름. Synology source-of-truth → Workspace.

```powershell
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
```

(deploy script가 Synology에서 자기 자신을 카피하는 모순은, 첫 deploy는 사용자가
수동으로 1회 클론/카피로 해결. 이후 self-update.)

## Verification (forge가 implement 후 실행)

```powershell
# 1. PS 5.1 parses both wrappers
$errors=$null
[System.Management.Automation.Language.Parser]::ParseFile(
  'F:\Workspace\Automatic\Prominence-Bellows\run-bellows.ps1',
  [ref]$null, [ref]$errors) | Out-Null
"run-bellows errors: $($errors.Count)"

[System.Management.Automation.Language.Parser]::ParseFile(
  'F:\Workspace\Automatic\Prominence-Bellows\deploy-bellows.ps1',
  [ref]$null, [ref]$errors) | Out-Null
"deploy-bellows errors: $($errors.Count)"

# 2. package.json valid
Get-Content 'F:\Workspace\Automatic\Prominence-Bellows\p-bellows\package.json' | ConvertFrom-Json

# 3. Required files present
@(
  'p-bellows\package.json',
  'p-bellows\setup-login.js',
  'p-bellows\watch-once.js',
  'p-bellows\watch-loop.js',
  'p-bellows\lib\extract.js',
  'p-bellows\lib\scrape.js',
  'p-bellows\.gitignore',
  'run-bellows.ps1',
  'deploy-bellows.ps1'
) | ForEach-Object {
  $p = Join-Path 'F:\Workspace\Automatic\Prominence-Bellows' $_
  if (-not (Test-Path $p)) { throw "missing: $p" }
}
'all required files present'

# 4. No claude CLI invocation in JS code
$hits = Select-String -Path 'F:\Workspace\Automatic\Prominence-Bellows\p-bellows\*.js' `
                     -Pattern '\bclaude\b' -ErrorAction SilentlyContinue |
        Where-Object { $_.Line -notmatch 'claude\.ai' }   # claude.ai URL is allowed
"claude CLI references (should be 0): $(@($hits).Count)"

# 5. STOP.json schema fields present in watch-loop.js
$hits = Select-String 'F:\Workspace\Automatic\Prominence-Bellows\p-bellows\watch-loop.js' `
                     -Pattern '"source"|"reason"|"weekly_pct"|"session_pct"|"thresholds"'
"schema field references: $(@($hits).Count)"   # expect >= 5
```

## DO NOT during implement
- **Do NOT run `npm install`** — Chromium 280MB 다운로드는 사용자 first-run에 처리.
- **Do NOT run `node setup-login.js`** — 인터랙티브 + 외부 서비스 인증 필요.
- **Do NOT run `watch-loop.js`** — 무한 루프.

`watch-once.js`도 forge 환경에서 돌릴 수 없음 (Chromium + 로그인 프로필 없음).
정적 검증으로 통과해야 함.

## Completion Criteria
- [ ] All 9 files exist at correct paths
- [ ] `package.json`이 puppeteer 의존성 선언
- [ ] `claude` CLI 호출 코드 0건 (URL 'claude.ai'는 허용)
- [ ] STOP.json 스키마 필드 5개 이상 코드에 명시
- [ ] manual 보호 분기 (`source === 'manual'`) 존재
- [ ] idempotent 가드 (같은 reason이면 재기록 안 함) 존재
- [ ] failure path 모두 silent (catch + log + return, throw 안 함)
- [ ] PS 5.1 파싱 0 errors (run/deploy 양쪽)
- [ ] `.gitignore`에 `node_modules/` `.profile/` 포함

## Out of Scope
- 기존 Foundry-side 폴러 정리 → 002-cleanup-foundry-side.md
- 실제 npm install / login / 폴링 실행 → 사용자 수동 first-run
- forge stop hook (Phase 2) / foundry dispatcher respect (Phase 3) / hearth UI (Phase 4)
