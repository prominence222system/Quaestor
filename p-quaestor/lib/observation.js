'use strict';

// Pure observation-state module. No I/O, no side effects, no wall-clock reads.
// Every timestamp is passed in as `now` (epoch ms) by the caller.

const DEFAULT_THRESHOLDS = {
  weekly_stop:     85,
  weekly_release:  70,
  session_stop:    90,
  session_release: 75
};

const STALE_WARN_MS   = 45 * 60 * 1000;   // 3 poll cycles (15min interval)
const STALE_CRIT_MS   = 120 * 60 * 1000;  // 2 hours
const FAIL_CRIT_COUNT = 4;
const NEAR_RATIO       = 0.9;

const KNOWN_HINTS = ['login-expired', 'anchor-missing', 'unknown'];

function createObservation() {
  return {
    lastSuccessAt:       null,
    lastUsage:           null,
    consecutiveFailures: 0,
    lastFailure:         null,
    totalPolls:          0,
    totalFailures:        0
  };
}

function recordSuccess(obs, usage, now) {
  const cur = obs || {};
  const u = usage || {};
  return Object.assign({}, cur, {
    lastSuccessAt: now,
    lastUsage: {
      session_pct:   u.session_pct,
      weekly_pct:    u.weekly_pct,
      session_reset: u.session_reset,
      weekly_reset:  u.weekly_reset
    },
    consecutiveFailures: 0,
    totalPolls: (cur.totalPolls || 0) + 1
  });
}

function recordFailure(obs, kind, detail, now) {
  const cur = obs || {};
  const normalizedKind = (typeof kind === 'string' && kind) ? kind : 'unknown';
  return Object.assign({}, cur, {
    consecutiveFailures: (cur.consecutiveFailures || 0) + 1,
    totalPolls:    (cur.totalPolls || 0) + 1,
    totalFailures: (cur.totalFailures || 0) + 1,
    lastFailure: {
      kind:   normalizedKind,
      detail: detail || null,
      at:     now
    }
  });
}

function normalizeThresholds(t) {
  const out = Object.assign({}, DEFAULT_THRESHOLDS);
  if (!t || typeof t !== 'object') return out;
  const keys = ['weekly_stop', 'weekly_release', 'session_stop', 'session_release'];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (typeof t[k] === 'number') out[k] = t[k];
  }
  return out;
}

function normalizeCtx(ctx) {
  const c = ctx || {};
  return {
    enabled:      typeof c.enabled === 'boolean' ? c.enabled : true,
    thresholds:   normalizeThresholds(c.thresholds),
    stop:         c.stop || null,
    configSource: c.configSource === 'file' ? 'file' : 'default'
  };
}

function normalizeObs(obs) {
  const o = obs || {};
  return {
    lastSuccessAt:       typeof o.lastSuccessAt === 'number' ? o.lastSuccessAt : null,
    lastUsage:           o.lastUsage || null,
    consecutiveFailures: typeof o.consecutiveFailures === 'number' ? o.consecutiveFailures : 0,
    lastFailure:         o.lastFailure || null,
    totalPolls:          typeof o.totalPolls === 'number' ? o.totalPolls : 0,
    totalFailures:       typeof o.totalFailures === 'number' ? o.totalFailures : 0
  };
}

function relativeTime(t, now) {
  if (t === null) return '없음';
  const diffSec = Math.floor((now - t) / 1000);
  if (diffSec < 60) return '방금';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return min + '분 전';
  const hr = Math.floor(diffSec / 3600);
  if (hr < 24) return hr + '시간 전';
  const day = Math.floor(diffSec / 86400);
  return day + '일 전';
}

function absoluteTime(t) {
  if (t === null) return null;
  return new Date(t).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function pickHint(lastFailure) {
  if (!lastFailure || !lastFailure.detail) return null;
  const hint = lastFailure.detail.hint;
  if (typeof hint === 'string' && KNOWN_HINTS.indexOf(hint) >= 0) return hint;
  return null;
}

function deriveState(obs, ctx, now) {
  const o = normalizeObs(obs);
  const c = normalizeCtx(ctx);

  const usage      = o.lastUsage || {};
  const weeklyPct  = typeof usage.weekly_pct  === 'number' ? usage.weekly_pct  : null;
  const sessionPct = typeof usage.session_pct === 'number' ? usage.session_pct : null;

  const successAgeMs = o.lastSuccessAt === null ? null : (now - o.lastSuccessAt);
  const lastSuccessLabel = o.lastSuccessAt === null ? '성공 이력 없음' : ('마지막 성공 ' + relativeTime(o.lastSuccessAt, now));
  const hint = pickHint(o.lastFailure);
  const hintSuffix = hint ? (' · ' + hint) : '';

  let state, summary;

  if (c.enabled === false) {
    state = 'idle';
    summary = '감시 꺼짐';
  } else if (o.consecutiveFailures >= FAIL_CRIT_COUNT) {
    state = 'crit';
    summary = '측정 실패 ' + o.consecutiveFailures + '회 연속 · ' + lastSuccessLabel + hintSuffix;
  } else if (o.lastSuccessAt !== null && successAgeMs > STALE_CRIT_MS) {
    state = 'crit';
    summary = '측정이 멈춤 · ' + lastSuccessLabel + hintSuffix;
  } else if (o.lastSuccessAt === null) {
    state = 'warn';
    summary = '첫 측정 대기 중';
  } else if (successAgeMs > STALE_WARN_MS) {
    state = 'warn';
    summary = '측정이 밀림 · ' + lastSuccessLabel + hintSuffix;
  } else {
    const nearWeekly  = weeklyPct  !== null && weeklyPct  >= NEAR_RATIO * c.thresholds.weekly_stop;
    const nearSession = sessionPct !== null && sessionPct >= NEAR_RATIO * c.thresholds.session_stop;

    let label, pct;
    if (sessionPct !== null && weeklyPct !== null) {
      if (sessionPct > weeklyPct) { label = '세션'; pct = sessionPct; }
      else { label = '주간'; pct = weeklyPct; }
    } else if (weeklyPct !== null) { label = '주간'; pct = weeklyPct; }
    else if (sessionPct !== null) { label = '세션'; pct = sessionPct; }
    else { label = '주간'; pct = null; }
    const pctValue = pct === null ? '-' : (pct + '%');

    if (nearWeekly || nearSession) {
      state = 'warn';
      summary = '감시 중 · ' + label + ' ' + pctValue;
    } else {
      state = 'ok';
      summary = '감시 중 · ' + label + ' ' + pctValue;
    }
  }

  const fields = [];

  // 1. last successful measurement
  {
    let fState;
    if (o.lastSuccessAt === null) fState = 'crit';
    else if (successAgeMs > STALE_CRIT_MS) fState = 'crit';
    else if (successAgeMs > STALE_WARN_MS) fState = 'warn';
    else fState = 'ok';
    const value = o.lastSuccessAt === null
      ? '없음'
      : (absoluteTime(o.lastSuccessAt) + ' (' + relativeTime(o.lastSuccessAt, now) + ')');
    fields.push({ label: '마지막 성공 측정', value: value, state: fState });
  }

  // 2. session usage
  {
    const field = { label: '세션 사용량', value: sessionPct === null ? '-' : (sessionPct + '%') };
    if (sessionPct !== null) {
      if (sessionPct >= c.thresholds.session_stop) field.state = 'crit';
      else if (sessionPct >= NEAR_RATIO * c.thresholds.session_stop) field.state = 'warn';
    }
    fields.push(field);
  }

  // 3. weekly usage
  {
    const field = { label: '주간 사용량', value: weeklyPct === null ? '-' : (weeklyPct + '%') };
    if (weeklyPct !== null) {
      if (weeklyPct >= c.thresholds.weekly_stop) field.state = 'crit';
      else if (weeklyPct >= NEAR_RATIO * c.thresholds.weekly_stop) field.state = 'warn';
    }
    fields.push(field);
  }

  // 4. consecutive failures
  {
    const field = { label: '연속 실패', value: o.consecutiveFailures + '회' };
    if (o.consecutiveFailures >= FAIL_CRIT_COUNT) field.state = 'crit';
    else if (o.consecutiveFailures >= 1) field.state = 'warn';
    fields.push(field);
  }

  // 5. last failure classification (whitelist: kind + hint only)
  {
    let value = '없음';
    if (o.lastFailure) {
      value = o.lastFailure.kind + (hint ? (' · ' + hint) : '');
    }
    fields.push({ label: '마지막 실패', value: value });
  }

  // 6. STOP status
  {
    let value = '없음';
    const field = { label: 'STOP', value: value };
    if (c.stop) {
      if (c.stop.source === 'manual') field.value = 'manual · ' + c.stop.reason;
      else field.value = 'auto · ' + c.stop.reason;
      field.state = 'warn';
    }
    fields.push(field);
  }

  // 7. applied thresholds
  fields.push({
    label: '임계값',
    value: '주간 ' + c.thresholds.weekly_stop + '/' + c.thresholds.weekly_release +
           ' · 세션 ' + c.thresholds.session_stop + '/' + c.thresholds.session_release
  });

  // 8. config source
  fields.push({ label: '설정 출처', value: c.configSource === 'file' ? '파일' : '기본값' });

  return { state: state, summary: summary, fields: fields };
}

function deriveUsage(obs, thresholds, nowMs) {
  const o = normalizeObs(obs);
  const t = normalizeThresholds(thresholds);
  const now = typeof nowMs === 'number' ? nowMs : null;

  const hasObs = o.lastSuccessAt !== null;
  const usage = o.lastUsage || {};

  const sessionPct = (hasObs && typeof usage.session_pct === 'number') ? usage.session_pct : null;
  const weeklyPct = (hasObs && typeof usage.weekly_pct === 'number') ? usage.weekly_pct : null;

  const sessionHeadroom = sessionPct !== null ? Math.max(0, t.session_stop - sessionPct) : null;
  const weeklyHeadroom = weeklyPct !== null ? Math.max(0, t.weekly_stop - weeklyPct) : null;

  const sessionReset = (hasObs && typeof usage.session_reset === 'string') ? usage.session_reset : null;
  const weeklyReset = (hasObs && typeof usage.weekly_reset === 'string') ? usage.weekly_reset : null;

  const measuredAt = hasObs ? new Date(o.lastSuccessAt).toISOString() : null;
  const ageSec = (hasObs && now !== null) ? Math.max(0, Math.floor((now - o.lastSuccessAt) / 1000)) : null;

  const successAgeMs = (hasObs && now !== null) ? (now - o.lastSuccessAt) : null;
  const stale = !hasObs || (successAgeMs === null) || (successAgeMs > STALE_WARN_MS) || (o.consecutiveFailures >= FAIL_CRIT_COUNT);

  return {
    session_pct: sessionPct,
    weekly_pct: weeklyPct,
    session_headroom: sessionHeadroom,
    weekly_headroom: weeklyHeadroom,
    session_reset: sessionReset,
    weekly_reset: weeklyReset,
    measured_at: measuredAt,
    age_sec: ageSec,
    stale: stale,
    thresholds: t
  };
}

function deriveAllowance(stopInfo, isStale, hasObservation) {
  const hasObs = Boolean(hasObservation);

  if (stopInfo) {
    const isManual = stopInfo.source === 'manual';
    return {
      allowed: false,
      reason: isManual ? 'manual-stop' : (stopInfo.reason || 'stop-active'),
      confidence: 'measured'
    };
  }

  if (!hasObs) {
    return {
      allowed: null,
      reason: 'unmeasurable',
      confidence: 'unknown'
    };
  }

  if (isStale) {
    return {
      allowed: true,
      reason: 'under-threshold',
      confidence: 'stale'
    };
  }

  return {
    allowed: true,
    reason: 'under-threshold',
    confidence: 'measured'
  };
}

module.exports = {
  createObservation,
  recordSuccess,
  recordFailure,
  deriveState,
  deriveUsage,
  deriveAllowance,
  DEFAULT_THRESHOLDS
};

