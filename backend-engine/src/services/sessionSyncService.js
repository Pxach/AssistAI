// src/services/sessionSyncService.js
//
// Fire-and-forget HTTP PATCH helper that keeps the teammate's backend in sync
// with every WhatsApp connection state change.
//
// ─── CONTRACT ─────────────────────────────────────────────────────────────────
// PATCH  {DASHBOARD_API_URL}/api/whatsapp/session-status
// Body:
// {
//   "sessionKey":   string,            // e.g. "default"
//   "status":       "PAIRING" | "CONNECTED" | "DISCONNECTED",
//   "phoneNumber":  string | null,     // E.164 digits only, null when not yet known
//   "qrCode":       string | null,     // base64 data-URL, only present during PAIRING
//   "connectedAt":  string             // ISO-8601 timestamp
// }
// ─────────────────────────────────────────────────────────────────────────────

import { getConfig } from './configService.js';

/**
 * Sends an HTTP PATCH to the dashboard backend reporting a WhatsApp connection
 * state change. Errors are caught and logged — never thrown — so a network
 * hiccup cannot interrupt the Baileys message loop.
 *
 * @param {object} params
 * @param {string} params.sessionKey   - Identifier for this WhatsApp session (e.g. "default")
 * @param {'PAIRING'|'CONNECTED'|'DISCONNECTED'} params.status
 * @param {string|null} params.phoneNumber - Clean phone digits, or null
 * @param {string|null} params.qrCode      - base64 data-URL QR image, or null
 * @param {string}      [params.connectedAt] - ISO timestamp; defaults to now
 */
export async function patchSessionStatus({
  sessionKey,
  status,
  phoneNumber = null,
  qrCode = null,
  connectedAt = new Date().toISOString(),
}) {
  try {
    const baseUrl = await getConfig('DASHBOARD_API_URL');

    if (!baseUrl) {
      // Dashboard URL not configured yet — silently skip (expected in dev/test)
      console.log(`[SessionSync] DASHBOARD_API_URL not set. Skipping PATCH for status: ${status}`);
      return;
    }

    const url = `${baseUrl}/api/whatsapp/session-status`;
    const body = {
      sessionKey,
      status,
      phoneNumber,
      qrCode,
      connectedAt,
    };

    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[SessionSync] PATCH ${url} failed (${response.status}): ${text}`);
    } else {
      console.log(`[SessionSync] ✅ Session status synced → ${status} (session: ${sessionKey})`);
    }
  } catch (err) {
    // Network error, DNS failure, etc. — log but never propagate.
    console.error(`[SessionSync] ❌ Failed to sync session status (${status}):`, err.message);
  }
}
