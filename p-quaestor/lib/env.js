'use strict';
// Selection layer only -- no dependencies (not even node builtins).
// Picks between QUAESTOR_<suffix> (new) and BELLOWS_<suffix> (old) by
// *definedness*, not truthiness, so an explicitly-set empty string is not
// confused with "unset". See output/DESIGN.md D7/D10 for the rationale.
//
// This module does not interpret values (no parseInt/trim/fallback) and
// does not write to process.env or cache anything -- it reads
// process.env at call time so callers (and tests) can rely on that.

const NEW_PREFIX = 'QUAESTOR_';
const OLD_PREFIX = 'BELLOWS_';

// Returns the raw string value for the given suffix, preferring
// QUAESTOR_<suffix> over BELLOWS_<suffix>. Returns undefined if neither
// is defined.
function envRaw(suffix) {
  const newKey = NEW_PREFIX + suffix;
  if (process.env[newKey] !== undefined) return process.env[newKey];
  const oldKey = OLD_PREFIX + suffix;
  return process.env[oldKey];
}

module.exports = { envRaw, NEW_PREFIX, OLD_PREFIX };
