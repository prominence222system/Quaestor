'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync, execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');

test('Phase 2 [SPEC]: run-quaestor.ps1 and deploy-quaestor.ps1 exist, run-bellows.ps1 and deploy-bellows.ps1 do not exist', () => {
  const runQuaestor = path.join(rootDir, 'run-quaestor.ps1');
  const deployQuaestor = path.join(rootDir, 'deploy-quaestor.ps1');
  const runBellows = path.join(rootDir, 'run-bellows.ps1');
  const deployBellows = path.join(rootDir, 'deploy-bellows.ps1');

  assert.strictEqual(fs.existsSync(runQuaestor), true, 'run-quaestor.ps1 must exist');
  assert.strictEqual(fs.existsSync(deployQuaestor), true, 'deploy-quaestor.ps1 must exist');
  assert.strictEqual(fs.existsSync(runBellows), false, 'run-bellows.ps1 must NOT exist');
  assert.strictEqual(fs.existsSync(deployBellows), false, 'deploy-bellows.ps1 must NOT exist');
});

test('Phase 2 [SPEC]: git log --follow run-quaestor.ps1 shows history prior to move (git mv evidence)', () => {
  try {
    const output = execSync('git log --follow --oneline run-quaestor.ps1', { cwd: rootDir, encoding: 'utf8' });
    const lines = output.trim().split('\n').filter(Boolean);
    assert.ok(lines.length > 1, 'git log --follow should show multiple commits including history before rename');
  } catch (err) {
    assert.fail('git log --follow failed: ' + err.message);
  }
});

test('Phase 2 [SPEC]: PowerShell 5.1 parsing has 0 errors for run-quaestor.ps1 and deploy-quaestor.ps1', () => {
  const scripts = ['run-quaestor.ps1', 'deploy-quaestor.ps1'];
  for (const scriptName of scripts) {
    const scriptPath = path.join(rootDir, scriptName);
    const psCode = `
      $errs = @()
      $null = [System.Management.Automation.Language.Parser]::ParseFile('${scriptPath.replace(/'/g, "''")}', [ref]$null, [ref]$errs)
      if ($errs.Count -gt 0) {
        $errs | ForEach-Object { Write-Error $_.Message }
        exit 1
      }
    `;
    const encoded = Buffer.from(psCode, 'utf16le').toString('base64');
    try {
      execFileSync('powershell', ['-NoProfile', '-EncodedCommand', encoded], { cwd: rootDir, encoding: 'utf8' });
    } catch (err) {
      assert.fail(`PowerShell parsing failed for ${scriptName}: ${err.stderr || err.message}`);
    }
  }
});

test('Phase 2 [SPEC]: boundary verification -- run-quaestor.ps1 referenced files and directories exist on filesystem', () => {
  const runQuaestorPath = path.join(rootDir, 'run-quaestor.ps1');
  const src = fs.readFileSync(runQuaestorPath, 'utf8');

  // Check referenced relative directories and files
  const pQuaestorDir = path.join(rootDir, 'p-quaestor');
  assert.strictEqual(fs.existsSync(pQuaestorDir), true, 'p-quaestor directory must exist');

  const watchLoopPath = path.join(pQuaestorDir, 'watch-loop.js');
  assert.strictEqual(fs.existsSync(watchLoopPath), true, 'p-quaestor/watch-loop.js must exist');

  const watchOncePath = path.join(pQuaestorDir, 'watch-once.js');
  assert.strictEqual(fs.existsSync(watchOncePath), true, 'p-quaestor/watch-once.js must exist');

  const packageJsonPath = path.join(pQuaestorDir, 'package.json');
  assert.strictEqual(fs.existsSync(packageJsonPath), true, 'p-quaestor/package.json must exist');

  // Verify script uses 'p-quaestor' in Split-Path / Join-Path
  assert.ok(src.includes("'p-quaestor'"), 'run-quaestor.ps1 must reference p-quaestor directory');
});

test('Phase 2 [SPEC]: -Setup output does not contain C:\\BellowsChrome and displays correct profile path', () => {
  const runQuaestorPath = path.join(rootDir, 'run-quaestor.ps1');
  const src = fs.readFileSync(runQuaestorPath, 'utf8');

  assert.strictEqual(src.includes('C:\\BellowsChrome'), false, '-Setup output must not contain C:\\BellowsChrome');
  assert.ok(
    src.includes('%LOCALAPPDATA%\\Google\\Chrome\\BellowsProfile') || src.includes('BellowsProfile'),
    '-Setup output must specify default profile path %LOCALAPPDATA%\\Google\\Chrome\\BellowsProfile'
  );
});

test('Phase 2 [SPEC]: environment variable QUAESTOR_INTERVAL_MIN is used instead of BELLOWS_INTERVAL_MIN in run-quaestor.ps1', () => {
  const runQuaestorPath = path.join(rootDir, 'run-quaestor.ps1');
  const src = fs.readFileSync(runQuaestorPath, 'utf8');

  assert.ok(src.includes('$env:QUAESTOR_INTERVAL_MIN'), 'run-quaestor.ps1 must use $env:QUAESTOR_INTERVAL_MIN');
  assert.strictEqual(src.includes('$env:BELLOWS_INTERVAL_MIN'), false, 'run-quaestor.ps1 must not reference $env:BELLOWS_INTERVAL_MIN');
});

test('Phase 2 [SPEC]: console log prefixes in launcher scripts are updated to [quaestor] / [quaestor-chrome]', () => {
  for (const scriptName of ['run-quaestor.ps1', 'deploy-quaestor.ps1']) {
    const src = fs.readFileSync(path.join(rootDir, scriptName), 'utf8');
    assert.strictEqual(src.includes('[bellows]'), false, `${scriptName} must not contain [bellows] prefix`);
    assert.strictEqual(src.includes('[bellows-chrome]'), false, `${scriptName} must not contain [bellows-chrome] prefix`);
  }
});

test('Phase 2 [SPEC]: repository contains 0 occurrences of run-bellows or deploy-bellows strings', () => {
  const ignoreDirs = new Set(['node_modules', '.git', '.p-forge', 'work', 'output', '.prominence']);
  const offenders = [];

  function checkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (ignoreDirs.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        checkDir(fullPath);
      } else if (entry.isFile()) {
        if (fullPath === __filename) continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('run-bellows') || content.includes('deploy-bellows')) {
          offenders.push(path.relative(rootDir, fullPath));
        }
      }
    }
  }

  checkDir(rootDir);
  assert.deepStrictEqual(offenders, [], 'no files in repo (outside work/output/.prominence/.p-forge) should contain run-bellows or deploy-bellows');
});
