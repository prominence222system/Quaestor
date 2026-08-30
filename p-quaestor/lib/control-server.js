'use strict';
// Control HTTP surface for the supervised-tool contract (see
// _guides/SUPERVISED_TOOL_CONTRACT.md). This product is the contract's
// target side; it does not depend on or know about the supervisor.
// Exposes GET /api/health and GET /api/status over node:http only -- no
// new dependencies.
//
// Phase 1: listener + routing + health/status.
// Phase 2 (this revision): Authorization: Bearer auth gate + secret-leak
// guarantees. watch-loop.js wiring is still Phase 3.
//
// Design invariants (see output/DESIGN.md):
// - HOST is a hard constant: loopback only. Never read from opts.
// - startControlServer() never rejects and never throws to the caller --
//   the watch loop is the product, this HTTP surface is a bonus.
// - /api/health does not touch getSnapshot() -- process-alive and
//   measurement-health are different questions, answered by different
//   endpoints. Merging them would make a 3-week-silent process look green.
// - /api/status only calls deriveState() from ./observation -- it does not
//   re-implement or duplicate threshold/state judgement.

const http = require('node:http');
const crypto = require('node:crypto');
const { deriveState, deriveUsage, deriveAllowance } = require('./observation');
const { renderStatusPage } = require('./status-page');

const HOST = '127.0.0.1';       // [SPEC] fixed. not configurable via opts.
const DEFAULT_PORT = 3210;
const SERVICE_ID = 'quaestor'; // [SPEC] product id, not the folder name "Bellows".

// 이 값을 바꾸는 시점 = Agora 등록 문서(apis/Quaestor/supervised-v1.md)의 `version`을 바꾸는 시점.
// 소프트웨어 버전(package.json의 version: "0.1.0")과 계약(인터페이스) 버전("1.2.0")은 서로 다른 축이다.
// 두 축을 함께 내되 섞지 않는다 (Agora 022 §2/§3 규율).
const CONTRACTS = Object.freeze({
  'supervised-v1': '1.2.0'
});

let cachedVersion = null;
function packageVersion() {
  if (cachedVersion === null) {
    try {
      cachedVersion = require('../package.json').version;
    } catch (e) {
      cachedVersion = 'unknown';
    }
  }
  return cachedVersion;
}

// -- auth: Authorization: Bearer, constant-time, length-independent --------
//
// timingSafeEqual(a, b) throws RangeError when the two buffer lengths do not
// match. Branching on length before comparing (or throwing on mismatch)
// leaks the length itself through timing/error behavior. Hashing both sides
// to a fixed-size (32-byte) SHA-256 digest first removes the length branch
// entirely.
// [SPEC] no ===/==/startsWith/indexOf token comparison anywhere in this file.

function sha256(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest();
}

function tokensMatch(expected, provided) {
  return crypto.timingSafeEqual(sha256(expected), sha256(provided));
}

// 'Bearer <token>' -> token. Scheme match is case-insensitive (RFC 7235).
function bearerFrom(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const m = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return m ? m[1] : null;
}

// authToken unset (current on-disk default) -> always authorized; the
// defense line is the 127.0.0.1 bind, not this check. authToken set ->
// only an exact Bearer match passes.
function isAuthorized(ctx, req) {
  if (!ctx.authToken) return true;
  const provided = bearerFrom(req.headers['authorization']);
  if (provided === null) return false;
  return tokensMatch(ctx.authToken, provided);
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(html);
}

// GET /api/health -- observation-free by design. Only process-level facts.
function handleHealth(res, ctx) {
  sendJson(res, 200, {
    ok: true,
    id: SERVICE_ID,
    version: ctx.version,
    contracts: CONTRACTS,
    startedAt: ctx.startedAt
  });
}

// Single judgement point, shared by GET /api/status (JSON) and GET /
// (HTML). Both start from the exact same payload object -- see
// output/DESIGN.md 2.2. Returns { error: string } on failure instead of
// throwing, so callers pick their own response format (JSON either way).
function buildStatusPayload(ctx) {
  let snap;
  try {
    snap = ctx.getSnapshot();
  } catch (e) {
    return { error: 'status unavailable' };
  }
  if (!snap || typeof snap !== 'object') {
    return { error: 'status unavailable' };
  }
  try {
    const nowMs = Date.now();
    const st = deriveState(snap.observation, snap.ctx, nowMs);
    const thresholds = snap.ctx ? snap.ctx.thresholds : null;
    const stopInfo = snap.ctx ? snap.ctx.stop : null;
    const hasObs = Boolean(snap.observation && typeof snap.observation.lastSuccessAt === 'number');
    const usage = deriveUsage(snap.observation, thresholds, nowMs);
    const allowance = deriveAllowance(stopInfo, usage, hasObs);
    return {
      ok: true,
      allowance: allowance,
      usage: usage,
      summary: st.summary,
      state: st.state,
      fields: st.fields,
      updatedAt: new Date().toISOString()
    };
  } catch (e) {
    return { error: 'status unavailable' };
  }
}

// GET /api/status -- a thin projection of deriveState(), deriveUsage(), and deriveAllowance(). No judgement here.
function handleStatus(res, ctx) {
  const payload = buildStatusPayload(ctx);
  if (payload.error) {
    sendJson(res, 500, { ok: false, error: payload.error });
    return;
  }
  sendJson(res, 200, payload);
}

// GET / -- the same payload as /api/status, drawn as HTML by the pure
// renderer in ./status-page. No re-judgement here either (D1/D10).
function handleIndex(res, ctx) {
  const payload = buildStatusPayload(ctx);
  if (payload.error) {
    sendJson(res, 500, { ok: false, error: payload.error });
    return;
  }
  const html = renderStatusPage(payload);
  sendHtml(res, 200, html);
}

// POST /api/stop -- intentionally NOT implemented. See output/DESIGN.md D9
// and PROJECT_INTENT.md: this product's stop is a safety switch, and the
// contract lets the caller invoke it without confirmation. Do not add a
// working handler here without re-reading that decision first.
function handleStop(res) {
  sendJson(res, 501, {
    ok: false,
    error: 'not implemented',
    note: 'POST /api/stop is intentionally left unimplemented -- see PROJECT_INTENT.md'
  });
}

function requestListener(ctx) {
  return function (req, res) {
    let pathname;
    try {
      pathname = new URL(req.url, 'http://' + HOST).pathname;
    } catch (e) {
      sendJson(res, 404, { ok: false, error: 'not found' });
      return;
    }
    try {
      // [SPEC] auth gate runs before routing -- a 404 vs 401 split would
      // leak which paths exist when a token is configured.
      if (!isAuthorized(ctx, req)) {
        res.setHeader('WWW-Authenticate', 'Bearer');
        sendJson(res, 401, { ok: false, error: 'unauthorized' });
        return;
      }
      if (pathname === '/') {
        if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return; }
        handleIndex(res, ctx);
        return;
      }
      if (pathname === '/api/health') {
        if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return; }
        handleHealth(res, ctx);
        return;
      }
      if (pathname === '/api/status') {
        if (req.method !== 'GET') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return; }
        handleStatus(res, ctx);
        return;
      }
      if (pathname === '/api/stop') {
        if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return; }
        handleStop(res);
        return;
      }
      sendJson(res, 404, { ok: false, error: 'not found' });
    } catch (e) {
      try { sendJson(res, 500, { ok: false, error: 'internal error' }); } catch (e2) { /* socket already gone */ }
    }
  };
}

function noop() {}

// Starts the control server. [SPEC] Never rejects, never throws to the
// caller -- resolves { started: false, error, close } instead so a bad
// port or a bind failure can never bring down the watch loop.
function startControlServer(opts) {
  const o = opts || {};
  const getSnapshot = typeof o.getSnapshot === 'function'
    ? o.getSnapshot
    : function () { return { observation: {}, ctx: {} }; };
  const version = typeof o.version === 'string' ? o.version : packageVersion();
  const startedAt = (o.startedAt instanceof Date)
    ? o.startedAt.toISOString()
    : (typeof o.startedAt === 'number'
        ? new Date(o.startedAt).toISOString()
        : new Date().toISOString());
  const onLog = typeof o.onLog === 'function' ? o.onLog : noop;
  const port = typeof o.port === 'number' ? o.port : DEFAULT_PORT;
  // [SPEC] unset (typeof !== 'string' or empty) -> auth off, loopback-only.
  const authToken = (typeof o.authToken === 'string' && o.authToken.length > 0)
    ? o.authToken
    : null;

  const ctx = { getSnapshot, version, startedAt, authToken };

  return new Promise((resolve) => {
    let settled = false;
    const server = http.createServer(requestListener(ctx));

    function safeClose() {
      return new Promise((res2) => {
        try {
          server.close(function () { res2(); });
        } catch (e) {
          res2();
        }
      });
    }

    server.on('error', function (err) {
      onLog('[control] listen failed: ' + (err && err.message ? err.message : String(err)));
      if (!settled) {
        settled = true;
        resolve({
          started: false,
          port: null,
          address: null,
          error: (err && err.message) ? err.message : String(err),
          close: safeClose
        });
      }
      // late 'error' events after a successful start: logged above, otherwise ignored.
    });

    server.listen(port, HOST, function () {
      if (settled) return;
      settled = true;
      const addr = server.address();
      onLog('[control] listening on ' + HOST + ':' + addr.port);
      // value is never logged, only whether auth is on
      onLog('[control] auth: ' + (authToken ? 'enabled' : 'disabled (loopback only)'));
      resolve({
        started: true,
        port: addr.port,
        address: addr.address,
        error: null,
        close: safeClose
      });
    });
  });
}

module.exports = { startControlServer, HOST, DEFAULT_PORT, SERVICE_ID, CONTRACTS };
