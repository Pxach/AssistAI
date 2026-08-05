// src/utils/stateMinifier.js

/**
 * Minifies a state object by stripping null, undefined, and empty string properties
 * to significantly reduce token size in LLM prompts and avoid 429 TPM Rate Limits.
 *
 * @param {Object} state - The raw state object.
 * @returns {Object} A new object containing only active, non-null properties.
 */
export function minifyState(state) {
  if (!state || typeof state !== 'object') return {};
  
  const minified = {};
  for (const [key, value] of Object.entries(state)) {
    if (value !== null && value !== undefined && value !== '') {
      minified[key] = value;
    }
  }
  return minified;
}
