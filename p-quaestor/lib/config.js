'use strict';
const fs = require('fs');
const { envRaw } = require('./env');

// Hardcoded defaults -- used as final fallback
const HARD_DEFAULTS = {
  enabled: true,
  thresholds: {
    weekly_stop:     85,
    weekly_release:  70,
    session_stop:    90,
    session_release: 75
  },
  expires_at: null,
  control: {
    port:      3210,
    authToken: null
  }
};

function envInt(suffix, fallback) {
  const raw = envRaw(suffix);
  if (raw == null || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return isNaN(n) ? fallback : n;
}

function envToken(suffix, fallback) {
  const raw = envRaw(suffix);
  if (raw == null) return fallback;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

function envDefaults() {
  return {
    enabled: HARD_DEFAULTS.enabled,
    thresholds: {
      weekly_stop:     envInt('WEEKLY_STOP',     HARD_DEFAULTS.thresholds.weekly_stop),
      weekly_release:  envInt('WEEKLY_RELEASE',  HARD_DEFAULTS.thresholds.weekly_release),
      session_stop:    envInt('SESSION_STOP',    HARD_DEFAULTS.thresholds.session_stop),
      session_release: envInt('SESSION_RELEASE', HARD_DEFAULTS.thresholds.session_release)
    },
    expires_at: HARD_DEFAULTS.expires_at,
    control: {
      port:      envInt('CONTROL_PORT', HARD_DEFAULTS.control.port),
      authToken: envToken('CONTROL_TOKEN', HARD_DEFAULTS.control.authToken)
    }
  };
}

function isExpired(iso) {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (isNaN(t)) return false;  // unparseable -- ignore field, treat as not expired
  return Date.now() >= t;
}

// Read config from file, merging on top of env defaults.
// File missing or invalid -- return env defaults.
// expires_at past -- return env defaults (config considered expired).
function readConfig(configPath) {
  const base = envDefaults();
  if (!configPath) return base;
  if (!fs.existsSync(configPath)) return base;
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (e) {
    return base;
  }
  // Strip UTF-8 BOM if present (PowerShell 5.1 Set-Content -Encoding utf8 writes BOM)
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return Object.assign({}, base, { _parseError: e.message });
  }
  if (parsed && typeof parsed === 'object') {
    if (isExpired(parsed.expires_at)) {
      return Object.assign({}, base, { _expired: true });
    }
  } else {
    return base;
  }
  // Merge thresholds (only override fields explicitly provided)
  const merged = Object.assign({}, base);
  if (typeof parsed.enabled === 'boolean') merged.enabled = parsed.enabled;
  if (parsed.thresholds && typeof parsed.thresholds === 'object') {
    merged.thresholds = Object.assign({}, base.thresholds);
    const keys = ['weekly_stop', 'weekly_release', 'session_stop', 'session_release'];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (typeof parsed.thresholds[k] === 'number'
          && parsed.thresholds[k] >= 0
          && parsed.thresholds[k] <= 100) {
        merged.thresholds[k] = parsed.thresholds[k];
      }
    }
  }
  if (typeof parsed.expires_at === 'string') merged.expires_at = parsed.expires_at;

  // control block: port + authToken. Normalization never throws -- an
  // invalid value here just falls back to the base default, same as
  // every other field in this function (never-brick).
  merged.control = Object.assign({}, base.control);
  let controlAuthTokenProvided = false;
  if (parsed.control && typeof parsed.control === 'object') {
    if (typeof parsed.control.port === 'number'
        && Number.isInteger(parsed.control.port)
        && parsed.control.port >= 1
        && parsed.control.port <= 65535) {
      merged.control.port = parsed.control.port;
    }
    if (typeof parsed.control.authToken === 'string') {
      controlAuthTokenProvided = true;
      const t = parsed.control.authToken.trim();
      merged.control.authToken = t === '' ? null : t;
    }
  }
  // [DERIVED] top-level authToken is a fallback for the contract's
  // "bellows-config.json#authToken" fragment notation. control.authToken
  // wins if both are present.
  if (!controlAuthTokenProvided && typeof parsed.authToken === 'string') {
    const t = parsed.authToken.trim();
    merged.control.authToken = t === '' ? null : t;
  }

  return merged;
}

module.exports = { readConfig, envDefaults, HARD_DEFAULTS };
