// src/services/configService.js
//
// Centralized configuration gateway.

/**
 * Returns a configuration value by key.
 *
 * @param {string} key - The configuration key to look up.
 * @returns {Promise<string|undefined>}
 */
export async function getConfig(key) {
  return process.env[key];
}

/**
 * Returns the company knowledge base text used to ground AI responses.
 *
 * Fetches the most recent content from the backend's knowledge_base table
 * via the dashboard API (POST /api/business/upload populates it).
 *
 * Falls back to an empty string if the backend is unreachable or the table
 * is empty — the bot stays operational, it just won't have company context.
 *
 * @returns {Promise<string>}
 */
export async function getKnowledgeBase() {
  try {
    const baseUrl = (await getConfig('DASHBOARD_API_URL')) || 'http://localhost:5000';
    const response = await fetch(`${baseUrl}/api/business/knowledge-base`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.warn(`[ConfigService] knowledge-base fetch returned ${response.status} — using empty context.`);
      return '';
    }

    const data = await response.json();
    return data.content || '';
  } catch (err) {
    // Network error or backend not yet running — degrade gracefully.
    console.warn(`[ConfigService] Could not fetch knowledge base: ${err.message} — using empty context.`);
    return '';
  }
}

/**
 * Returns the structured company profile data (e.g., hours, locations, professionals)
 *
 * @returns {Promise<Object|null>}
 */
export async function getCompanyProfile() {
  try {
    const baseUrl = (await getConfig('DASHBOARD_API_URL')) || 'http://localhost:5000';
    const response = await fetch(`${baseUrl}/api/business/profile`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.warn(`[ConfigService] profile fetch returned ${response.status} — using null.`);
      return null;
    }

    const data = await response.json();
    return data.profile || null;
  } catch (err) {
    console.warn(`[ConfigService] Could not fetch company profile: ${err.message} — using null.`);
    return null;
  }
}

/**
 * Returns the active services catalog from the database
 *
 * @returns {Promise<Object>}
 */
export async function getCompanyCatalog() {
  try {
    const baseUrl = (await getConfig('DASHBOARD_API_URL')) || process.env.DASHBOARD_API_URL || 'http://localhost:5000';
    const response = await fetch(`${baseUrl}/api/business/services`);
    if (!response.ok) {
      console.error(`[ConfigService] Failed to fetch services: ${response.statusText}`);
      return { services: [], specialists: [] };
    }
    const data = await response.json();
    return { services: data.services || [], specialists: [] };
  } catch (error) {
    console.error(`[ConfigService] Error fetching services:`, error.message);
    return { services: [], specialists: [] };
  }
}
