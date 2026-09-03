'use strict';
// Pure module for validating/merging/logging PUT /api/thresholds requests.
// No fs/http/net, no wall-clock reads -- current time is injected via nowMs.
// HARD_DEFAULTS is reused from config.js (plain data, not I/O).
const { HARD_DEFAULTS } = require('./config');

// 4 threshold keys. Order fixed -- log lines and response fields follow this array.
const THRESHOLD_KEYS = ['weekly_stop', 'weekly_release', 'session_stop', 'session_release'];

// All keys allowed in the request body. Anything else is rejected (unknown-key).
const ALLOWED_KEYS = THRESHOLD_KEYS.concat(['expires_at']);

const LOOSEN_REQUIRES_EXPIRY_MSG =
  'loosening thresholds requires an expires_at (future ISO8601): a permanent loosening ' +
  'belongs in the code\'s hard defaults, not this file -- this file is for temporary overrides only';

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isValidThresholdValue(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;
}

function fail(status, reason, error) {
  return { ok: false, status, reason, error };
}

/**
 * Pure. No I/O, no wall-clock reads (nowMs injected).
 *
 * @param body              parsed request body (arbitrary value)
 * @param applied            currently applied 4 values (readConfig().thresholds)
 * @param currentExpiresAt  existing expires_at from file (string|null)
 * @param nowMs             current time in ms
 */
function validateThresholdRequest(body, applied, currentExpiresAt, nowMs) {
  // (1) body shape
  if (!isPlainObject(body)) {
    return fail(400, 'invalid-body', 'request body must be a JSON object');
  }
  const bodyKeys = Object.keys(body);
  if (bodyKeys.length === 0) {
    return fail(400, 'invalid-body', 'request body must not be empty');
  }

  // (2) unknown keys
  for (const k of bodyKeys) {
    if (ALLOWED_KEYS.indexOf(k) === -1) {
      return fail(400, 'unknown-key', 'unknown key: ' + k);
    }
  }

  // (3) value type/range for each threshold key present
  for (const k of THRESHOLD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      if (!isValidThresholdValue(body[k])) {
        return fail(400, 'invalid-value', 'invalid value for ' + k + ': must be an integer 0-100');
      }
    }
  }

  // (4) expires_at (only when key present)
  const hasExpiresKey = Object.prototype.hasOwnProperty.call(body, 'expires_at');
  let requestedExpiresAt; // undefined = not present, null = explicit release, string = parsed-valid ISO
  if (hasExpiresKey) {
    const raw = body.expires_at;
    if (raw === null) {
      requestedExpiresAt = null;
    } else if (typeof raw !== 'string') {
      return fail(400, 'invalid-expiry', 'expires_at must be a string or null');
    } else {
      const t = Date.parse(raw);
      if (isNaN(t)) {
        return fail(400, 'invalid-expiry', 'expires_at is not a valid ISO8601 timestamp');
      }
      if (t <= nowMs) {
        return fail(400, 'expiry-in-past', 'expires_at must be in the future');
      }
      requestedExpiresAt = raw;
    }
  }

  // build next = { ...applied, ...requested thresholds }
  const next = Object.assign({}, applied);
  for (const k of THRESHOLD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      next[k] = body[k];
    }
  }

  // (5) hysteresis after merge
  if (!(next.weekly_stop > next.weekly_release)) {
    return fail(400, 'hysteresis-violation', 'weekly_stop must be greater than weekly_release');
  }
  if (!(next.session_stop > next.session_release)) {
    return fail(400, 'hysteresis-violation', 'session_stop must be greater than session_release');
  }

  // (6) direction
  const direction =
    (next.weekly_stop > applied.weekly_stop || next.session_stop > applied.session_stop)
      ? 'loosen'
      : 'tighten';

  // expires_at resolution
  let expiresAt;
  if (hasExpiresKey) {
    expiresAt = requestedExpiresAt; // string (future) or null
  } else {
    expiresAt = currentExpiresAt != null ? currentExpiresAt : null;
  }

  if (hasExpiresKey && requestedExpiresAt === null) {
    // Explicit release, checked regardless of `direction`: a request that
    // does not touch the *_stop keys (e.g. {"expires_at": null} alone)
    // computes direction:'tighten' against the current applied values even
    // when those applied values are still above HARD_DEFAULTS -- this is
    // the two-call bypass (loosen with expiry, then a follow-up call that
    // only clears the expiry). Gating on `next` vs HARD_DEFAULTS instead of
    // on `direction` closes that gap.
    const withinHardDefaults =
      next.weekly_stop <= HARD_DEFAULTS.thresholds.weekly_stop &&
      next.session_stop <= HARD_DEFAULTS.thresholds.session_stop;
    if (!withinHardDefaults) {
      return fail(400, 'loosen-requires-expiry', LOOSEN_REQUIRES_EXPIRY_MSG);
    }
  } else if (direction === 'loosen') {
    if (hasExpiresKey && typeof requestedExpiresAt === 'string') {
      // valid future expiry provided -- ok
    } else {
      // no expires_at in request -- fall back to existing expires_at, must be future
      const existingIsFuture =
        typeof currentExpiresAt === 'string' &&
        !isNaN(Date.parse(currentExpiresAt)) &&
        Date.parse(currentExpiresAt) > nowMs;
      if (!existingIsFuture) {
        return fail(400, 'loosen-requires-expiry', LOOSEN_REQUIRES_EXPIRY_MSG);
      }
      expiresAt = currentExpiresAt;
    }
  }

  const previous = Object.assign({}, applied);
  const changed = [];
  for (const k of THRESHOLD_KEYS) {
    if (previous[k] !== next[k]) {
      changed.push({ key: k, from: previous[k], to: next[k] });
    }
  }

  return {
    ok: true,
    direction,
    next,
    previous,
    expiresAt: expiresAt === undefined ? null : expiresAt,
    changed
  };
}

/**
 * Pure. Builds a new object layered on top of the raw file object.
 * Does not mutate rawConfig. Preserves every key besides thresholds/expires_at.
 */
function mergeIntoConfig(rawConfig, next, expiresAt) {
  const base = isPlainObject(rawConfig) ? rawConfig : {};
  const baseThresholds = isPlainObject(base.thresholds) ? base.thresholds : {};
  const merged = Object.assign({}, base);
  merged.thresholds = Object.assign({}, baseThresholds, next);
  merged.expires_at = expiresAt === undefined ? null : expiresAt;
  return merged;
}

/** Builds one log line. Pure. */
function formatThresholdLog(direction, changed, expiresAt) {
  const parts = ['[thresholds] ' + direction + ':'];
  for (const c of changed) {
    parts.push(c.key + ' ' + c.from + '->' + c.to);
  }
  parts.push('expires_at=' + (expiresAt == null ? 'none' : expiresAt));
  return parts.join(' ');
}

module.exports = {
  THRESHOLD_KEYS,
  ALLOWED_KEYS,
  validateThresholdRequest,
  mergeIntoConfig,
  formatThresholdLog
};
