'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { envRaw } = require('../lib/env');
const { readConfig, envDefaults, HARD_DEFAULTS } = require('../lib/config');

// ---- helpers -----------------------------------------------------------
// Save/restore a single env var around a test body, deleting the key
// afterward if it was originally undefined (never leaks state to later
// tests, per output/DESIGN.md 3-9 / ACCEPTANCE Phase 3).
function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  try {
    for (const k of Object.keys(vars)) {
      if (vars[k] === undefined) delete process.env[k];
      else process.env[k] = vars[k];
    }
    fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

// ---- lib/env.js: truth table (design §3-4, 6 combinations) ------------

test('env.js: both undefined -> undefined', () => {
  withEnv({ QUAESTOR_X_TEST: undefined, BELLOWS_X_TEST: undefined }, () => {
    assert.strictEqual(envRaw('X_TEST'), undefined);
  });
});

test('env.js: only BELLOWS_ set -> old value wins (fallback exists)', () => {
  withEnv({ QUAESTOR_X_TEST: undefined, BELLOWS_X_TEST: 'v' }, () => {
    assert.strictEqual(envRaw('X_TEST'), 'v');
  });
});

test('env.js: only BELLOWS_ set to empty string -> empty string passes through', () => {
  withEnv({ QUAESTOR_X_TEST: undefined, BELLOWS_X_TEST: '' }, () => {
    assert.strictEqual(envRaw('X_TEST'), '');
  });
});

test('env.js: only QUAESTOR_ set -> new value used', () => {
  withEnv({ QUAESTOR_X_TEST: 'v2', BELLOWS_X_TEST: undefined }, () => {
    assert.strictEqual(envRaw('X_TEST'), 'v2');
  });
});

test('env.js: both set -> QUAESTOR_ wins [SPEC]', () => {
  withEnv({ QUAESTOR_X_TEST: 'v2', BELLOWS_X_TEST: 'v' }, () => {
    assert.strictEqual(envRaw('X_TEST'), 'v2');
  });
});

test('env.js: QUAESTOR_ defined as empty string beats a non-empty BELLOWS_ (E1, intentional)', () => {
  withEnv({ QUAESTOR_X_TEST: '', BELLOWS_X_TEST: 'v' }, () => {
    assert.strictEqual(envRaw('X_TEST'), '');
  });
});

test('env.js: is a pure lookup -- no || based selection in source', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'env.js'), 'utf8');
  const bodyMatch = src.match(/function envRaw\([\s\S]*?\n\}/);
  assert.ok(bodyMatch, 'expected envRaw function body');
  assert.ok(!/\|\|/.test(bodyMatch[0]), 'envRaw() must select by definedness (!== undefined), not truthiness (||)');
});

test('env.js: has no dependencies (no require calls)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'env.js'), 'utf8');
  assert.ok(!/require\s*\(/.test(src), 'lib/env.js must not require anything');
});

// ---- lib/config.js: the 3 cases the work file pins down [SPEC] --------

test('config: QUAESTOR_CONTROL_PORT alone is used', () => {
  withEnv({ QUAESTOR_CONTROL_PORT: '4001', BELLOWS_CONTROL_PORT: undefined }, () => {
    assert.strictEqual(envDefaults().control.port, 4001);
  });
});

test('config: BELLOWS_CONTROL_PORT alone (no QUAESTOR_) is used -- the fallback\'s reason to exist', () => {
  withEnv({ QUAESTOR_CONTROL_PORT: undefined, BELLOWS_CONTROL_PORT: '4002' }, () => {
    assert.strictEqual(envDefaults().control.port, 4002);
  });
});

test('config: both set -> QUAESTOR_CONTROL_PORT wins [SPEC]', () => {
  withEnv({ QUAESTOR_CONTROL_PORT: '4001', BELLOWS_CONTROL_PORT: '4002' }, () => {
    assert.strictEqual(envDefaults().control.port, 4001);
  });
});

// ---- same priority rule applies to all 9 suffixes ----------------------

const SUFFIXES = [
  'PROFILE_DIR', 'INTERVAL_MIN', 'WEEKLY_STOP', 'WEEKLY_RELEASE',
  'SESSION_STOP', 'SESSION_RELEASE', 'CONTROL_PORT', 'CONTROL_TOKEN', 'CHROME_DEBUG_URL'
];

for (const suffix of SUFFIXES) {
  test('env.js applies uniformly to suffix ' + suffix, () => {
    const newKey = 'QUAESTOR_' + suffix;
    const oldKey = 'BELLOWS_' + suffix;
    withEnv({ [newKey]: undefined, [oldKey]: 'old-' + suffix }, () => {
      assert.strictEqual(envRaw(suffix), 'old-' + suffix);
    });
    withEnv({ [newKey]: 'new-' + suffix, [oldKey]: 'old-' + suffix }, () => {
      assert.strictEqual(envRaw(suffix), 'new-' + suffix);
    });
  });
}

// ---- semantics preserved: threshold defaults, token empty-string, ------
// ---- int NaN handling, never-brick, file-over-env priority -------------

test('config: both new and old undefined -> hard defaults unchanged', () => {
  withEnv({
    QUAESTOR_WEEKLY_STOP: undefined, BELLOWS_WEEKLY_STOP: undefined,
    QUAESTOR_CONTROL_PORT: undefined, BELLOWS_CONTROL_PORT: undefined,
    QUAESTOR_CONTROL_TOKEN: undefined, BELLOWS_CONTROL_TOKEN: undefined
  }, () => {
    const d = envDefaults();
    assert.strictEqual(d.thresholds.weekly_stop, HARD_DEFAULTS.thresholds.weekly_stop);
    assert.strictEqual(d.thresholds.weekly_release, HARD_DEFAULTS.thresholds.weekly_release);
    assert.strictEqual(d.thresholds.session_stop, HARD_DEFAULTS.thresholds.session_stop);
    assert.strictEqual(d.thresholds.session_release, HARD_DEFAULTS.thresholds.session_release);
    assert.strictEqual(d.control.port, HARD_DEFAULTS.control.port);
    assert.strictEqual(d.control.authToken, HARD_DEFAULTS.control.authToken);
  });
});

test('config: token env defined-but-empty -> null (explicit unset), distinct from undefined -> default', () => {
  withEnv({ QUAESTOR_CONTROL_TOKEN: '   ', BELLOWS_CONTROL_TOKEN: undefined }, () => {
    assert.strictEqual(envDefaults().control.authToken, null);
  });
  withEnv({ QUAESTOR_CONTROL_TOKEN: undefined, BELLOWS_CONTROL_TOKEN: undefined }, () => {
    assert.strictEqual(envDefaults().control.authToken, HARD_DEFAULTS.control.authToken);
  });
});

test('config: unparseable int env falls back to default without throwing', () => {
  withEnv({ QUAESTOR_CONTROL_PORT: 'not-a-number', BELLOWS_CONTROL_PORT: undefined }, () => {
    assert.doesNotThrow(() => {
      const d = envDefaults();
      assert.strictEqual(d.control.port, HARD_DEFAULTS.control.port);
    });
  });
});

test('config: readConfig never throws regardless of input (never-brick, unchanged after env-layer insertion)', () => {
  const os = require('node:os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quaestor-env-test-'));
  const brokenJson = path.join(tmpDir, 'broken.json');
  fs.writeFileSync(brokenJson, '{ not valid json', 'utf8');
  try {
    assert.doesNotThrow(() => readConfig(undefined));
    assert.doesNotThrow(() => readConfig(path.join(tmpDir, 'missing.json')));
    assert.doesNotThrow(() => readConfig(brokenJson));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('config: file control.port/authToken win over both env names', () => {
  const os = require('node:os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quaestor-env-test-'));
  const cfgPath = path.join(tmpDir, 'config.json');
  fs.writeFileSync(cfgPath, JSON.stringify({ control: { port: 9999, authToken: 'file-token' } }), 'utf8');
  try {
    withEnv({ QUAESTOR_CONTROL_PORT: '4001', BELLOWS_CONTROL_PORT: '4002', QUAESTOR_CONTROL_TOKEN: 'env-token', BELLOWS_CONTROL_TOKEN: 'env-token-2' }, () => {
      const cfg = readConfig(cfgPath);
      assert.strictEqual(cfg.control.port, 9999);
      assert.strictEqual(cfg.control.authToken, 'file-token');
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---- structural checks: module-load-time files can't be behaviorally --
// ---- re-tested (see design §3-9), so assert source wiring instead ------

test('watch-loop.js structurally uses envRaw() and no longer reads process.env.BELLOWS_* directly', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'watch-loop.js'), 'utf8');
  assert.ok(/require\(\s*['"]\.\/lib\/env['"]\s*\)/.test(src), 'watch-loop.js must require ./lib/env');
  assert.ok(/envRaw\(\s*['"]PROFILE_DIR['"]\s*\)/.test(src), 'watch-loop.js must select PROFILE_DIR via envRaw');
  assert.ok(/envRaw\(\s*['"]INTERVAL_MIN['"]\s*\)/.test(src), 'watch-loop.js must select INTERVAL_MIN via envRaw');
  assert.ok(!/process\.env\.BELLOWS_/.test(src), 'watch-loop.js must not reference process.env.BELLOWS_* directly');
});

test('watch-once.js structurally uses envRaw() and no longer reads process.env.BELLOWS_* directly', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'watch-once.js'), 'utf8');
  assert.ok(/require\(\s*['"]\.\/lib\/env['"]\s*\)/.test(src), 'watch-once.js must require ./lib/env');
  assert.ok(/envRaw\(\s*['"]PROFILE_DIR['"]\s*\)/.test(src), 'watch-once.js must select PROFILE_DIR via envRaw');
  assert.ok(!/process\.env\.BELLOWS_/.test(src), 'watch-once.js must not reference process.env.BELLOWS_* directly');
});

test('lib/scrape.js structurally uses envRaw() and no longer reads process.env.BELLOWS_* directly', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'scrape.js'), 'utf8');
  assert.ok(/require\(\s*['"]\.\/env['"]\s*\)/.test(src), 'lib/scrape.js must require ./env');
  assert.ok(/envRaw\(\s*['"]CHROME_DEBUG_URL['"]\s*\)/.test(src), 'lib/scrape.js must select CHROME_DEBUG_URL via envRaw');
  assert.ok(!/process\.env\.BELLOWS_/.test(src), 'lib/scrape.js must not reference process.env.BELLOWS_* directly');
});

test('|| fallback expressions were not changed to ?? (empty string must still fall through to default)', () => {
  const watchLoopSrc = fs.readFileSync(path.join(__dirname, '..', 'watch-loop.js'), 'utf8');
  const watchOnceSrc = fs.readFileSync(path.join(__dirname, '..', 'watch-once.js'), 'utf8');
  const scrapeSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'scrape.js'), 'utf8');
  assert.ok(/envRaw\(\s*['"]PROFILE_DIR['"]\s*\)\s*\|\|/.test(watchLoopSrc), 'watch-loop.js PROFILE_DIR must still use ||');
  assert.ok(/envRaw\(\s*['"]INTERVAL_MIN['"]\s*\)\s*\|\|/.test(watchLoopSrc), 'watch-loop.js INTERVAL_MIN must still use ||');
  assert.ok(/envRaw\(\s*['"]PROFILE_DIR['"]\s*\)\s*\|\|/.test(watchOnceSrc), 'watch-once.js PROFILE_DIR must still use ||');
  assert.ok(/envRaw\(\s*['"]CHROME_DEBUG_URL['"]\s*\)\s*\|\|/.test(scrapeSrc), 'lib/scrape.js CHROME_DEBUG_URL must still use ||');
});

// ---- no direct process.env.BELLOWS_ reference anywhere in p-quaestor --
// (lib/env.js's OLD_PREFIX constant and this test file's intentional env
// mutation are the allowed exceptions.)

test('no direct process.env.BELLOWS_ / process.env[\'BELLOWS references remain in p-quaestor sources', () => {
  const root = path.join(__dirname, '..');
  const skip = new Set(['node_modules', '.profile', '.git', 'test']);
  const offenders = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.js') && full !== path.join(__dirname, '..', 'lib', 'env.js')) {
        const content = fs.readFileSync(full, 'utf8');
        if (/process\.env\.BELLOWS_|process\.env\[\s*['"]BELLOWS_/.test(content)) {
          offenders.push(full);
        }
      }
    }
  })(root);
  assert.deepStrictEqual(offenders, [], 'unexpected direct process.env.BELLOWS_ references: ' + offenders.join(', '));
});
