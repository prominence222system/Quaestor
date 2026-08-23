'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Capture whether puppeteer was already loaded BEFORE requiring lib/scrape.js,
// so we can prove the require() below does not eagerly pull in the driver.
const puppeteerPath = require.resolve('puppeteer');
const cachedBeforeLibRequire = !!require.cache[puppeteerPath];

const {
  scrapeUsage,
  hintFrom,
  collectDiagnostics,
  FAILURE_KINDS,
  HINTS
} = require('../lib/scrape');

const cachedAfterLibRequire = !!require.cache[puppeteerPath];

const SCRAPE_SRC = fs.readFileSync(path.join(__dirname, '..', 'lib', 'scrape.js'), 'utf8');

// Swap require.cache['puppeteer'] for a fake module for the duration of a test.
// scrape.js does `require('puppeteer')` lazily inside scrapeUsage(), so this
// lets us drive every branch of the real function without Chrome or network.
function withFakePuppeteer(fakeModule) {
  const prev = require.cache[puppeteerPath];
  require.cache[puppeteerPath] = {
    id: puppeteerPath,
    filename: puppeteerPath,
    loaded: true,
    exports: fakeModule
  };
  return function restore() {
    if (prev) require.cache[puppeteerPath] = prev;
    else delete require.cache[puppeteerPath];
  };
}

// ---------------------------------------------------------------------------
// hintFrom -- pure classification
// ---------------------------------------------------------------------------

test('hintFrom: login path -> login-expired', () => {
  assert.strictEqual(
    hintFrom({ url: 'https://claude.ai/login?next=%2Fsettings%2Fusage', textHead: '' }),
    'login-expired'
  );
});

test('hintFrom: target origin + non-empty body, no login -> anchor-missing', () => {
  assert.strictEqual(
    hintFrom({ url: 'https://claude.ai/settings/usage', textHead: 'usage page text' }),
    'anchor-missing'
  );
});

test('hintFrom: unknown when evidence is missing or inconclusive', () => {
  assert.strictEqual(hintFrom({}), 'unknown');
  assert.strictEqual(hintFrom(undefined), 'unknown');
  assert.strictEqual(hintFrom({ url: '', textHead: 'x' }), 'unknown');
  assert.strictEqual(hintFrom({ url: null, textHead: 'x' }), 'unknown');
  assert.strictEqual(hintFrom({ url: 123, textHead: 'x' }), 'unknown');
  assert.strictEqual(hintFrom({ url: 'https://sso.example.com/authorize', textHead: 'text' }), 'unknown');
  assert.strictEqual(hintFrom({ url: 'https://claude.ai/settings/usage', textHead: '' }), 'unknown');
  assert.strictEqual(hintFrom({ url: 'https://claude.ai/settings/usage', textHead: null }), 'unknown');
});

test('hintFrom: malformed url strings do not throw and fall back to unknown', () => {
  assert.doesNotThrow(() => hintFrom({ url: 'not a url at all :::', textHead: 'x' }));
  assert.strictEqual(hintFrom({ url: 'not a url at all :::', textHead: 'x' }), 'unknown');
});

test('hintFrom: pure -- does not mutate its input, same input gives same output', () => {
  const input = { url: 'https://claude.ai/login', textHead: 'abc' };
  const before = JSON.stringify(input);
  const r1 = hintFrom(input);
  const r2 = hintFrom(input);
  assert.strictEqual(JSON.stringify(input), before);
  assert.strictEqual(r1, r2);
});

test('HINTS enumerates exactly the three known hint values', () => {
  assert.deepStrictEqual(HINTS.slice().sort(), ['anchor-missing', 'login-expired', 'unknown'].sort());
});

// ---------------------------------------------------------------------------
// collectDiagnostics -- async, injected page, never throws
// ---------------------------------------------------------------------------

test('collectDiagnostics reproduces all three hints via an injected fake page', async () => {
  const loginPage = {
    url: () => 'https://claude.ai/login?next=%2F',
    evaluate: async () => 'please sign in to continue'
  };
  const r1 = await collectDiagnostics(loginPage);
  assert.strictEqual(r1.hint, 'login-expired');

  const missingAnchorPage = {
    url: () => 'https://claude.ai/settings/usage',
    evaluate: async () => 'usage page rendered, anchor text is just gone'
  };
  const r2 = await collectDiagnostics(missingAnchorPage);
  assert.strictEqual(r2.hint, 'anchor-missing');

  const otherDomainPage = {
    url: () => 'https://sso.example.com/authorize',
    evaluate: async () => 'unrelated sso screen'
  };
  const r3 = await collectDiagnostics(otherDomainPage);
  assert.strictEqual(r3.hint, 'unknown');
});

test('collectDiagnostics never throws, even when url()/evaluate() throw or page is null', async () => {
  const throwingPage = {
    url: () => { throw new Error('url() boom'); },
    evaluate: async () => { throw new Error('evaluate() boom'); }
  };
  const r1 = await collectDiagnostics(throwingPage);
  assert.strictEqual(r1.hint, 'unknown');
  assert.strictEqual(r1.url, null);
  assert.strictEqual(r1.textHead, null);

  const r2 = await collectDiagnostics(null);
  assert.strictEqual(r2.hint, 'unknown');

  const r3 = await collectDiagnostics(undefined);
  assert.strictEqual(r3.hint, 'unknown');
});

test('collectDiagnostics caps textHead at 200 chars', async () => {
  const longText = 'x'.repeat(500);
  const page = { url: () => 'https://claude.ai/settings/usage', evaluate: async () => longText };
  const r = await collectDiagnostics(page);
  assert.strictEqual(r.textHead.length, 200);
});

// ---------------------------------------------------------------------------
// scrapeUsage -- err.kind classification via injected puppeteer module
// ---------------------------------------------------------------------------

test('connect() failure classified as chrome-unreachable, existing message preserved', async () => {
  const restore = withFakePuppeteer({
    connect: async () => { throw new Error('ECONNREFUSED fake'); }
  });
  try {
    await assert.rejects(
      scrapeUsage(null, { debugUrl: 'http://127.0.0.1:9999' }),
      (err) => {
        assert.strictEqual(err.kind, 'chrome-unreachable');
        assert.ok(err.message.indexOf('failed to connect to Chrome') >= 0);
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('browser.newPage() failure classified as chrome-unreachable, message/stack preserved', async () => {
  const restore = withFakePuppeteer({
    connect: async () => ({
      newPage: async () => { throw new Error('newPage boom'); },
      disconnect: async () => {}
    })
  });
  try {
    await assert.rejects(scrapeUsage(null, {}), (err) => {
      assert.strictEqual(err.kind, 'chrome-unreachable');
      assert.strictEqual(err.message, 'newPage boom');
      return true;
    });
  } finally {
    restore();
  }
});

test('page.goto() failure classified as nav-failed', async () => {
  const restore = withFakePuppeteer({
    connect: async () => ({
      newPage: async () => ({
        goto: async () => { throw new Error('nav boom'); },
        close: async () => {}
      }),
      disconnect: async () => {}
    })
  });
  try {
    await assert.rejects(scrapeUsage(null, {}), (err) => {
      assert.strictEqual(err.kind, 'nav-failed');
      assert.strictEqual(err.message, 'nav boom');
      return true;
    });
  } finally {
    restore();
  }
});

test('waitForFunction() failure classified as anchor-timeout, with diagnostics collected before close()', async () => {
  let closed = false;
  const restore = withFakePuppeteer({
    connect: async () => ({
      newPage: async () => ({
        goto: async () => {},
        waitForFunction: async () => { throw new Error('Waiting failed: 20000ms exceeded'); },
        url: () => 'https://claude.ai/login?next=%2Fsettings%2Fusage',
        evaluate: async () => {
          assert.strictEqual(closed, false, 'diagnostics must be collected before page.close()');
          return 'please log in to continue';
        },
        close: async () => { closed = true; }
      }),
      disconnect: async () => {}
    })
  });
  try {
    await assert.rejects(scrapeUsage(null, {}), (err) => {
      assert.strictEqual(err.kind, 'anchor-timeout');
      assert.strictEqual(err.message, 'Waiting failed: 20000ms exceeded');
      assert.ok(err.detail);
      assert.strictEqual(err.detail.hint, 'login-expired');
      assert.strictEqual(err.detail.url, 'https://claude.ai/login?next=%2Fsettings%2Fusage');
      return true;
    });
    assert.strictEqual(closed, true);
  } finally {
    restore();
  }
});

test('waitForFunction() failure with unrecognizable page yields hint unknown, never login-expired by default', async () => {
  const restore = withFakePuppeteer({
    connect: async () => ({
      newPage: async () => ({
        goto: async () => {},
        waitForFunction: async () => { throw new Error('Waiting failed: 20000ms exceeded'); },
        url: () => null,
        evaluate: async () => { throw new Error('cannot read body'); },
        close: async () => {}
      }),
      disconnect: async () => {}
    })
  });
  try {
    await assert.rejects(scrapeUsage(null, {}), (err) => {
      assert.strictEqual(err.kind, 'anchor-timeout');
      assert.strictEqual(err.detail.hint, 'unknown');
      return true;
    });
  } finally {
    restore();
  }
});

test('page.evaluate() extraction failure classified as invalid-extraction', async () => {
  const restore = withFakePuppeteer({
    connect: async () => ({
      newPage: async () => ({
        goto: async () => {},
        waitForFunction: async () => {},
        evaluate: async () => { throw new Error('extract boom'); },
        close: async () => {}
      }),
      disconnect: async () => {}
    })
  });
  try {
    await assert.rejects(scrapeUsage(null, {}), (err) => {
      assert.strictEqual(err.kind, 'invalid-extraction');
      assert.strictEqual(err.message, 'extract boom');
      return true;
    });
  } finally {
    restore();
  }
});

test('success path returns usage and only disconnects (never closes) the browser', async () => {
  let disconnected = false;
  let browserClosed = false;
  const restore = withFakePuppeteer({
    connect: async () => ({
      newPage: async () => ({
        goto: async () => {},
        waitForFunction: async () => {},
        evaluate: async () => ({ session_pct: 10, weekly_pct: 20 }),
        close: async () => {}
      }),
      disconnect: async () => { disconnected = true; },
      close: async () => { browserClosed = true; }
    })
  });
  try {
    const usage = await scrapeUsage(null, {});
    assert.deepStrictEqual(usage, { session_pct: 10, weekly_pct: 20 });
    assert.strictEqual(disconnected, true);
    assert.strictEqual(browserClosed, false);
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Vocabulary and leak-boundary checks
// ---------------------------------------------------------------------------

test('FAILURE_KINDS has exactly the 5 expected values', () => {
  assert.deepStrictEqual(
    FAILURE_KINDS.slice().sort(),
    ['anchor-timeout', 'chrome-unreachable', 'invalid-extraction', 'nav-failed', 'unknown'].sort()
  );
});

test('HINTS matches the hint vocabulary observation.js recognizes (whitelist round-trip)', () => {
  const { createObservation, recordFailure, deriveState } = require('../lib/observation');
  for (const h of HINTS) {
    const obs = recordFailure(createObservation(), 'anchor-timeout', { hint: h }, Date.now());
    const r = deriveState(obs, {}, Date.now());
    const field = r.fields.find((f) => f.label === '\uB9C8\uC9C0\uB9C9 \uC2E4\uD328');
    assert.ok(
      field.value.indexOf(h) >= 0,
      'hint "' + h + '" from scrape.js should surface through observation.js, got: ' + field.value
    );
  }
});

test('err.detail carries url/textHead for diagnosis, but only hint is meant to reach deriveState fields', () => {
  const { createObservation, recordFailure, deriveState } = require('../lib/observation');
  const detail = {
    hint: 'login-expired',
    url: 'https://claude.ai/login?next=%2F',
    textHead: 'account: someone@example.com'
  };
  assert.ok(detail.url && detail.textHead, 'detail retains url/textHead for logs');

  const obs = recordFailure(createObservation(), 'anchor-timeout', detail, Date.now());
  const r = deriveState(obs, {}, Date.now());
  const str = JSON.stringify(r);
  assert.ok(!str.includes('example.com'));
  assert.ok(!str.includes('login?next'));
});

// ---------------------------------------------------------------------------
// Regression / never-brick
// ---------------------------------------------------------------------------

test('scrapeUsage keeps its existing signature and is still exported', () => {
  assert.strictEqual(typeof scrapeUsage, 'function');
  assert.strictEqual(scrapeUsage.length, 2);
});

test('lib/scrape.js references the claude.ai domain exactly once (constant only)', () => {
  const matches = SCRAPE_SRC.match(/claude/g) || [];
  assert.strictEqual(matches.length, 1);
});

test('lib/scrape.js does not require puppeteer at the top level (lazy load)', () => {
  assert.ok(
    !/^const\s+puppeteer\s*=\s*require/m.test(SCRAPE_SRC),
    'puppeteer must be required lazily inside scrapeUsage(), not at module top level'
  );
});

test('requiring lib/scrape.js does not eagerly load the puppeteer module', () => {
  assert.strictEqual(cachedBeforeLibRequire, false, 'test invariant: puppeteer must not already be cached');
  assert.strictEqual(cachedAfterLibRequire, false, 'require(../lib/scrape) must not pull in puppeteer');
});
