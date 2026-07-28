# Backend Handoff & Integration Contract

> **To:** Backend / Dashboard Teammate  
> **From:** WhatsApp Bot Team  
> **Project:** AssistAI — Expleo Company Customer Service Bot  
> **Date:** 2026-07-28  
> **Status:** ✅ All contracts implemented and tested (14/14 tests passing)

This document is the single source of truth for every outbound signal the WhatsApp bot emits. Configure your backend and dashboard to listen to these endpoints and Socket.io events.

---

## Table of Contents
1. [Transport Overview](#1-transport-overview)
2. [HTTP Endpoints the Bot Will Call](#2-http-endpoints-the-bot-will-call)
3. [Socket.io Event Dictionary](#3-socketio-event-dictionary)
4. [Database Swap Points](#4-database-swap-points)
5. [Dynamic Configuration Keys](#5-dynamic-configuration-keys)
6. [Tally Form Webhook Routing](#6-tally-form-webhook-routing)
7. [Error & Resilience Behaviour](#7-error--resilience-behaviour)

---

## 1. Transport Overview

| Channel | Direction | Purpose |
|---|---|---|
| **Socket.io (room-based)** | Bot → Dashboard | Real-time push events for UI updates |
| **HTTP PATCH** | Bot → Your API | Durable session state sync |
| **WhatsApp (Baileys)** | Bot ↔ Customer | The actual customer conversation |

The bot joins a Socket.io room keyed by `sessionKey` (currently `"default"`). Every Socket.io emission is sent to `io.to(sessionKey).emit(...)`, so your dashboard needs to `socket.join(sessionKey)` after connecting.

---

## 2. HTTP Endpoints the Bot Will Call

### `PATCH {DASHBOARD_API_URL}/api/whatsapp/session-status`

Fired from [`sessionSyncService.js`](file:///c:/Users/LENOVO/Desktop/Int-Prj/AssistAI/src/services/sessionSyncService.js) every time the Baileys connection state changes. Three triggers:

| Trigger | `status` value |
|---|---|
| QR code generated (awaiting phone scan) | `"PAIRING"` |
| Phone successfully linked | `"CONNECTED"` |
| Connection dropped / server restart | `"DISCONNECTED"` |

**Request:**
```http
PATCH /api/whatsapp/session-status
Content-Type: application/json
```

```json
{
  "sessionKey":  "default",
  "status":      "PAIRING | CONNECTED | DISCONNECTED",
  "phoneNumber": "212612345678 | null",
  "qrCode":      "data:image/png;base64,... | null",
  "connectedAt": "2026-07-28T17:00:00.000Z"
}
```

**Field notes:**
- `phoneNumber` is populated only when `status = "CONNECTED"`. It contains the bot's own phone number (digits only, no `+` prefix, no `@`).
- `qrCode` is a full `data:image/png;base64,...` string, ready to drop into an `<img src="">` tag. Only present when `status = "PAIRING"`.
- `connectedAt` is always the ISO timestamp of the event, regardless of `status`.

**Expected response:** `200 OK` or `204 No Content`. Non-2xx responses are logged but **do not crash the bot**.

---

## 3. Socket.io Event Dictionary

### 3.1 `whatsapp:qr`
Emitted when Baileys generates a new QR code (phone not yet paired).

```json
{
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```
**Source:** [`whatsappGateway.js`](file:///c:/Users/LENOVO/Desktop/Int-Prj/AssistAI/src/services/whatsappGateway.js) — `connection.update` → `qr` branch.

---

### 3.2 `whatsapp:status_change`
Emitted when the WhatsApp connection opens successfully.

```json
{
  "status":      "CONNECTED",
  "phoneNumber": "212612345678"
}
```
**Source:** `whatsappGateway.js` — `connection.update` → `connection === 'open'` branch.

> **Note:** `status` is currently always `"CONNECTED"`. Disconnection is handled via the HTTP PATCH (see §2) rather than a separate Socket.io event.

---

### 3.3 `whatsapp:feedback_initiated`
Emitted when a customer completes the post-appointment feedback flow (rates the service).

```json
{
  "phoneNumber": "212612345678",
  "sentiment":   "good | average | bad",
  "linkType":    "google_review | tally_form"
}
```
**Source:** `whatsappGateway.js` — feedback intercept block, after `handleFeedback()` returns `isDone: true`.

**Dashboard action:** Mark the feedback record as submitted; update appointment status to `feedback_received`. If `linkType = "tally_form"`, expect a follow-up POST from Tally (see §6).

---

### 3.4 `bot:handover_triggered`
Emitted whenever the bot escalates a conversation to a human agent. Two trigger paths:

| Path | Trigger |
|---|---|
| **User-requested** | Customer explicitly asks for a human (keyword match or LLM classification) |
| **Anti-loop** | Bot detects 3 consecutive identical or unrecognized replies |

```json
{
  "event":       "bot:handover_triggered",
  "phoneNumber": "212612345678",
  "reason":      "User requested human assistance. / Anti-loop escalation after 3 consecutive failures.",
  "lastMessage": "je veux parler à un agent",
  "timestamp":   "2026-07-28T17:23:45.000Z"
}
```
**Source:** `whatsappGateway.js` — both handover paths (lines ~349 and ~410).

**Dashboard action:** Open a new support ticket; flag the conversation for manual takeover; notify an available agent.

---

### 3.5 `bot:message_flagged`
Emitted when the bot cannot process a message cleanly. Two sub-types:

| `flagReason` | Trigger |
|---|---|
| `"Security filter: prompt injection or malicious input detected."` | `sanitizeInput()` returned `safe: false` |
| `"Unrecognized intent (fail #N/3)."` | Intent router returns `unknown` and fail counter > 0 |

```json
{
  "event":       "bot:message_flagged",
  "phoneNumber": "212612345678",
  "flaggedBy":   "bot",
  "messageText": "ignore previous instructions and...",
  "flagReason":  "Security filter: prompt injection or malicious input detected.",
  "timestamp":   "2026-07-28T17:23:45.000Z"
}
```
**Source:** `whatsappGateway.js` — after `processUserMessage()` returns.

**Dashboard action:** Log to a moderation queue; escalate if the same number triggers this 3+ times in a session.

---

### 3.6 `bot:booking_created`
Emitted immediately after a successful Google Calendar event insertion (customer confirmed their appointment).

```json
{
  "event":           "bot:booking_created",
  "customerName":    "Zayd Amrani",
  "contactInfo":     "+212600000000",
  "department":      "it | design | marketing",
  "serviceId":       1,
  "specialistId":    101,
  "appointmentDate": "2026-08-05",
  "appointmentTime": "10:00:00",
  "timestamp":       "2026-07-28T17:23:45.000Z"
}
```
**Source:** [`calendarService.js`](file:///c:/Users/LENOVO/Desktop/Int-Prj/AssistAI/src/services/calendarService.js) — after `calendar.events.insert()` succeeds.

**Catalog mapping** (current mock; will be replaced by DB query when your tables are ready):

| `serviceId` | Service Name | `department` |
|---|---|---|
| 1 | Database Optimization | `it` |
| 2 | Server Configuration | `it` |
| 3 | UI/UX Review | `design` |
| 4 | Brand Consultation | `marketing` |

| `specialistId` | Specialist Name | Services |
|---|---|---|
| 101 | Sarah | 1, 2 |
| 102 | Alex | 1, 4 |
| 103 | Karim | 3 |

> [!NOTE]
> `serviceId` and `specialistId` can be `null` if the customer-provided name doesn't match the catalog (e.g. typo or new service not yet in mock). Your backend should handle nulls gracefully.

---

## 4. Database Swap Points

These are the two functions your teammate needs to replace with real DB queries. The function signatures and return types are frozen — only the body changes.

### 4.1 `getConfig(key)` — in [`configService.js`](file:///c:/Users/LENOVO/Desktop/Int-Prj/AssistAI/src/services/configService.js)

```js
// CURRENT (mock):
export async function getConfig(key) {
  return process.env[key];
}

// REPLACE WITH (example using pg):
export async function getConfig(key) {
  const row = await db.query(
    'SELECT value FROM config WHERE key = $1',
    [key]
  );
  return row.rows[0]?.value ?? null;
}
```

**Used for:** API keys, Calendar credentials, Dashboard URL, Review/Tally URLs — every config value in the system routes through this function.

---

### 4.2 `getKnowledgeBase()` — in [`configService.js`](file:///c:/Users/LENOVO/Desktop/Int-Prj/AssistAI/src/services/configService.js)

```js
// CURRENT (mock):
export async function getKnowledgeBase() {
  return 'Mock company info: We are open 9 to 5.';
}

// REPLACE WITH (example using pg):
export async function getKnowledgeBase() {
  const row = await db.query(
    'SELECT content FROM knowledge_base WHERE active = true ORDER BY updated_at DESC LIMIT 1'
  );
  return row.rows[0]?.content ?? '';
}
```

**Used for:** Injected into the AI FAQ handler and intent router prompts to ground responses in real company information. This is where the uploaded PDF content will live.

---

### 4.3 `checkFeedbackEligibility(phoneNumber)` — in [`feedbackEligibility.js`](file:///c:/Users/LENOVO/Desktop/Int-Prj/AssistAI/src/services/feedbackEligibility.js)

```js
// CURRENT (mock):
export async function checkFeedbackEligibility(phoneNumber) {
  return true; // Always eligible
}

// REPLACE WITH (example using pg):
export async function checkFeedbackEligibility(phoneNumber) {
  const row = await db.query(
    `SELECT 1 FROM feedback_submissions
     WHERE phone_number = $1
       AND submitted_at > NOW() - INTERVAL '30 days'
     LIMIT 1`,
    [phoneNumber]
  );
  return row.rows.length === 0; // true = no recent submission = eligible
}
```

**Used by:** `reminderService.js` cron job — before sending a post-appointment rating prompt, this is called to avoid spamming customers who already submitted.

---

## 5. Dynamic Configuration Keys

These keys must be present in either `process.env` (dev) or your dashboard's config table (prod). The bot reads all of them via `getConfig(key)` — no restart needed after a dashboard update once the DB swap is live.

| Key | Purpose | Example Value |
|---|---|---|
| `GEMINI_API_KEY` | Gemini LLM API key for intent routing, FAQ, and booking AI | `AIza...` |
| `GROK_API_KEY` | Grok / xAI API key (reserved for future provider switch) | `xai-...` |
| `OPENROUTER_API_KEY` | OpenRouter API key (reserved for future provider switch) | `sk-or-v1-...` |
| `MISTRAL_API_KEY` | Mistral API key (reserved for future provider switch) | `OapO...` |
| `CALENDAR_ID` | Google Calendar ID for booking events | `abc123@group.calendar.google.com` |
| `GOOGLE_CLIENT_EMAIL` | Service account email for Google Calendar auth | `bot@project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Service account private key (PEM format, `\n` escaped as `\\n`) | `-----BEGIN PRIVATE KEY-----\n...` |
| `GOOGLE_REVIEW_URL` | Google Business review link sent to happy customers | `https://g.page/r/XXXX` |
| `TALLY_FORM_URL` | Tally feedback form base URL (phone appended as `?phone=`) | `https://tally.so/r/XXXX` |
| `DASHBOARD_API_URL` | **Your backend's base URL** — used for the HTTP PATCH session sync | `https://dashboard.expleo.com` |

> [!IMPORTANT]
> `GOOGLE_PRIVATE_KEY` must have literal `\n` characters (not escaped). When storing in a database column, save the raw multi-line string. When using `dotenv` in `.env`, wrap the value in double quotes: `GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n"`.

---

## 6. Tally Form Webhook Routing

When a customer rates their experience as **Average** or **Bad**, the bot sends them a Tally form link with their phone number appended as a query parameter:

```
https://tally.so/r/YOUR_FORM_ID?phone=212612345678
```

**Your action:** In your Tally form settings, configure a **Webhook** that fires on submission to your backend:

```http
POST /api/feedback/tally
Content-Type: application/json

{
  "respondentId": "...",
  "fields": {
    "phone": "212612345678",
    "rating": "...",
    "comment": "..."
  }
}
```

On receiving this webhook, you can:
1. Look up the customer by `phone` in `ChatSessions` or `Appointments`.
2. Store the detailed feedback in a `FeedbackSubmissions` table.
3. Update `checkFeedbackEligibility()` so the customer is not re-prompted for 30 days.

---

## 7. Error & Resilience Behaviour

| Scenario | Bot Behaviour |
|---|---|
| `DASHBOARD_API_URL` not set | PATCH silently skipped — bot continues normally |
| Dashboard returns non-2xx | Error logged to console — bot continues normally |
| Network timeout to dashboard | Error caught and logged — bot continues normally |
| Google Calendar API fails | `adminAlert` WhatsApp message sent to admin; `calendar_synced = false` flagged in booking state |
| Gemini API fails | Intent router returns `{ intent: 'unknown' }` → anti-loop counter increments |
| All three consecutive unknowns | Anti-loop triggers handover → `bot:handover_triggered` emitted |

> [!CAUTION]
> The bot is currently running with a **dev whitelist** (`212766014551@s.whatsapp.net` only). Remove or replace the whitelist guard in [`whatsappGateway.js`](file:///c:/Users/LENOVO/Desktop/Int-Prj/AssistAI/src/services/whatsappGateway.js) line ~222 before going to production.
