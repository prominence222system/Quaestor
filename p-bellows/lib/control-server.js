'use strict';
// Control HTTP surface for the supervised-tool contract (see
// _guides/SUPERVISED_TOOL_CONTRACT.md). This product is the contract's
// target side; it does not depend on or know about the supervisor.
// Exposes GET /api/health and GET /api/status over node:http only -- no
// new dependencies.
//
// Phase 1 scope: listener + routing + health/status. No auth yet (Phase 2),
// no watch-loop.js wiring yet (Phase 3).
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
const { deriveState } = require('./observation');

const HOST = '127.0.0.1';       // [SPEC] fixed. not configurable via opts.
const DEFAULT_PORT = 3210;
const SERVICE_ID = 'quaestor'; // [SPEC] product id, not the folder name "Bellows".

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

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

// GET /api/health -- observation-free by design. Only process-level facts.
function handleHealth(res, ctx) {
  sendJson(res, 200, {
    ok: true,
    id: SERVICE_ID,
    version: ctx.version,
    startedAt: ctx.startedAt
  });
}

// GET /api/status -- a thin projection of deriveState(). No judgement here.
function handleStatus(res, ctx) {
  let snap;
  try {
    snap = ctx.getSnapshot();
  } catch (e) {
    sendJson(res, 500, { ok: false, error: 'status unavailable' });
    return;
  }
  if (!snap || typeof snap !== 'object') {
    sendJson(res, 500, { ok: false, error: 'status unavailable' });
    return;
  }
  let st;
  try {
    st = deriveState(snap.observation, snap.ctx, Date.now());
  } catch (e) {
    sendJson(res, 500, { ok: false, error: 'status unavailable' });
    return;
  }
  sendJson(res, 200, {
    ok: true,
    summary: st.summary,
    state: st.state,
    fields: st.fields,
    updatedAt: new Date().toISOString()
  });
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

  const ctx = { getSnapshot, version, startedAt };

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

module.exports = { startControlServer, HOST, DEFAULT_PORT, SERVICE_ID };
