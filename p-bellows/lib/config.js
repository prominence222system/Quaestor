'use strict';
const fs = require('fs');

// Hardcoded defaults — used as final fallback
const HARD_DEFAULTS = {
  enabled: true,
  thresholds: {
    weekly_stop:     85,
    weekly_release:  70,
    session_stop:    90,
    session_release: 75
  },
  expires_at: null
};

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return isNaN(n) ? fallback : n;
}

function envDefaults() {
  return {
    enabled: HARD_DEFAULTS.enabled,
    thresholds: {
      weekly_stop:     envInt('BELLOWS_WEEKLY_STOP',     HARD_DEFAULTS.thresholds.weekly_stop),
      weekly_release:  envInt('BELLOWS_WEEKLY_RELEASE',  HARD_DEFAULTS.thresholds.weekly_release),
      session_stop:    envInt('BELLOWS_SESSION_STOP',    HARD_DEFAULTS.thresholds.session_stop),
      session_release: envInt('BELLOWS_SESSION_RELEASE', HARD_DEFAULTS.thresholds.session_release)
    },
    expires_at: HARD_DEFAULTS.expires_at
  };
}

function isExpired(iso) {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (isNaN(t)) return false;  // unparseable → ignore field, treat as not expired
  return Date.now() >= t;
}

// Read config from file, merging on top of env defaults.
// File missing or invalid → return env defaults.
// expires_at past → return env defaults (config considered expired).
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
  return merged;
}

module.exports = { readConfig, envDefaults, HARD_DEFAULTS };
