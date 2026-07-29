// src/services/configService.js
//
// Centralized configuration gateway.
//
// ─── ARCHITECTURE NOTE ───────────────────────────────────────────────────────
// Both exported functions are async by design. Right now they read from
// process.env (fast, synchronous under the hood), but the async contract means
// your teammate can swap the body to a DB/API call at any time without touching
// any of the callers — they already await the result.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a configuration value by key.
 * Future: replace `process.env[key]` with a DB query such as:
 *   const row = await db.query('SELECT value FROM config WHERE key = $1', [key]);
 *   return row.rows[0]?.value ?? null;
 *
 * @param {string} key - The configuration key to look up.
 * @returns {Promise<string|undefined>}
 */
export async function getConfig(key) {
  // TODO: swap with DB call when the dashboard config table is ready.
  return process.env[key];
}

/**
 * Returns the company knowledge base text used to ground AI responses.
 * Future: replace with a DB query that retrieves parsed PDF/document text, e.g.:
 *   const row = await db.query('SELECT content FROM knowledge_base WHERE active = true LIMIT 1');
 *   return row.rows[0]?.content ?? '';
 *
 * @returns {Promise<string>}
 */
export async function getKnowledgeBase() {
  // TODO: swap with DB/storage call when PDF ingestion pipeline is ready.
  return [
    'Mock company info:',
    '- Business name: Expleo Company',
    '- Services offered: Database Optimization, Server Configuration, UI/UX Review, Brand Consultation.',
    '- Business hours: Monday to Friday, 09:00 to 17:00 (Casablanca time).',
    '- Location: Casablanca, Morocco.',
    '- Contact email: support@expleo.com',
    '- Booking policy: Appointments must be made at least 24 hours in advance.',
    '- Cancellation policy: Notify us at least 12 hours before the appointment.',
  ].join('\n');
}
