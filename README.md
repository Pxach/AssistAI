# AssistAI

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Knex.js](https://img.shields.io/badge/Knex.js-3.x-E16426?logoColor=white)](https://knexjs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.x-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Baileys](https://img.shields.io/badge/Baileys-WhatsApp_Gateway-25D366?logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

---

**AssistAI** is a **multi-tenant AI booking and context injection engine** delivered over WhatsApp. It enables businesses to deploy a fully autonomous conversational AI assistant capable of handling end-to-end appointment scheduling, FAQ resolution, sentiment-aware human handover, and post-appointment feedback — all driven by business-specific context extracted from uploaded documents.

The platform is architected around a **hybrid database model** that strictly enforces tenant isolation: relational tables govern transactional data integrity, while a JSONB configuration column delivers dynamic, schema-free business context directly into every AI prompt at runtime.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Architecture & Data Flow](#2-architecture--data-flow)
   - [System Components](#21-system-components)
   - [Single Source of Truth (SSOT) Design](#22-single-source-of-truth-ssot-design)
   - [The Relational Services Table](#23-the-relational-services-table)
   - [The company\_configs.profile\_data JSONB Column](#24-the-company_configsprofile_data-jsonb-column)
   - [AI Conversation Pipeline](#25-ai-conversation-pipeline)
   - [Multi-Provider AI Gateway with Failover](#26-multi-provider-ai-gateway-with-failover)
   - [Cross-Service Synchronization](#27-cross-service-synchronization)
3. [AI Document Extraction Pipeline](#3-ai-document-extraction-pipeline)
4. [Database Schema Reference](#4-database-schema-reference)
5. [Local Development & Testing Environment](#5-local-development--testing-environment)
   - [Prerequisites](#51-prerequisites)
   - [Environment Configuration](#52-environment-configuration)
   - [Database Setup & Migrations](#53-database-setup--migrations)
   - [Running Services Locally](#54-running-services-locally)
   - [E2E CLI Testing: testBookingFlow.js](#55-e2e-cli-testing-testbookingflowjs)
6. [API Reference](#6-api-reference)
7. [Deployment Guide](#7-deployment-guide)
   - [Pre-Deployment Checklist](#71-pre-deployment-checklist)
   - [Database Migration in Production](#72-database-migration-in-production)
   - [Starting the Production Server](#73-starting-the-production-server)
   - [Multi-Tenant Database Security](#74-multi-tenant-database-security)
8. [Cron Schedulers](#8-cron-schedulers)

---

## 1. Project Structure

The monorepo is organized into three independently deployable services:

```
AssistAI/
├── backend/                   # REST API — Express + Knex + PostgreSQL
│   ├── src/
│   │   ├── controllers/       # Request handlers (appointments, auth, documents, etc.)
│   │   ├── database/
│   │   │   ├── migrations/    # Knex migration history (ordered, versioned)
│   │   │   └── seeds/         # Optional seed scripts
│   │   ├── middleware/        # JWT authentication guard
│   │   ├── routes/            # Express router definitions
│   │   ├── services/          # LLM service, calendar service, booking handler
│   │   └── index.js           # HTTP + Socket.io server bootstrap
│   ├── knexfile.js            # Knex environment configuration
│   └── .env.example
│
├── backend-engine/            # WhatsApp Bot Engine — Baileys + AI + Cron
│   ├── scripts/
│   │   ├── testBookingFlow.js # E2E CLI booking flow test harness
│   │   └── testFullSystem.js  # Full system integration test
│   ├── src/
│   │   ├── controllers/
│   │   │   └── chatController.js      # Core message dispatch entry point
│   │   ├── handlers/
│   │   │   ├── bookingHandler.js      # Stateful booking state machine
│   │   │   ├── faqHandler.js          # RAG-grounded FAQ responder
│   │   │   ├── feedbackHandler.js     # Post-appointment feedback collector
│   │   │   └── handoverHandler.js     # Human escalation trigger
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── intentRouter.js    # Multi-class intent classifier
│   │   │   │   └── llmClient.js       # Multi-provider AI gateway w/ failover
│   │   │   ├── calendarService.js     # Google Calendar event creation
│   │   │   ├── configService.js       # Config + knowledge base + profile gateway
│   │   │   ├── reminderService.js     # Cron: daily appointment reminders
│   │   │   ├── sessionSyncService.js  # HTTP bridge: engine -> backend REST API
│   │   │   └── whatsappGateway.js     # Baileys connection manager + message router
│   │   ├── locales/                   # i18n string templates (en, fr, ar, darija)
│   │   └── utils/
│   │       ├── security.js            # Input sanitization guards
│   │       └── stateMinifier.js       # Prompt token optimization
│   └── index.js                       # Bot engine bootstrap
│
├── frontend/                  # Next.js Admin Dashboard (UI)
│   └── app/                   # App Router pages and components
│
├── docker-compose.yml         # PostgreSQL 16 + pgAdmin local stack
└── docs/
    └── openapi.yaml           # OpenAPI 3.0 API specification
```

---

## 2. Architecture & Data Flow

### 2.1 System Components

AssistAI is composed of three tightly integrated services communicating via HTTP and WebSocket:

```
+------------------------------------------------------------------+
|                         WhatsApp Network                         |
+-------------------------------+----------------------------------+
                                | Baileys WebSocket
                                v
+------------------------------------------------------------------+
|                    backend-engine  (port 3001)                   |
|  +--------------+  +----------------+  +-------------------+    |
|  | WhatsApp     |  | Intent Router  |  | Multi-Provider AI |    |
|  | Gateway      |->| (LLM classify) |->| Gateway (failover)|    |
|  | (Baileys)    |  +----------------+  +-------------------+    |
|  +------+-------+         |                                      |
|         |          +------v---------------------------+          |
|         |          |  Handler Dispatch                |          |
|         |          |  booking / faq / handover /      |          |
|         |          |  feedback                        |          |
|         |          +------------------+---------------+          |
|         |                             | HTTP POST                |
|         |  sessionSyncService.js -----+                          |
|         |  (appointments/sync, session-status, chat-messages)   |
+---------+------------------------------------------------------------+
          | Socket.io (outbound WA send)
          v
+------------------------------------------------------------------+
|                      backend  (port 5000)                        |
|  Express REST API + Socket.io Server                             |
|  +-------------------------------------------------------------+ |
|  |  /api/business/*   /api/appointments/*   /api/auth/*        | |
|  |  /api/whatsapp/*   /api/dashboard/*      /api/settings/*    | |
|  +------------------------------+---------------------------------+ |
|                                 | Knex ORM                      |
|                                 v                               |
|  +-------------------------------------------------------------+ |
|  |              PostgreSQL 16  (assist_ai_db)                  | |
|  +-------------------------------------------------------------+ |
+------------------------------------------------------------------+
          ^
          | HTTP / WebSocket
          |
+---------+------------------------------------------------------------+
|                      frontend  (port 3000)                       |
|                    Next.js Admin Dashboard                       |
+------------------------------------------------------------------+
```

---

### 2.2 Single Source of Truth (SSOT) Design

The system implements a **hybrid SSOT model** that is critical to its correctness. Every AI prompt — whether classifying intent, resolving a FAQ, or executing a booking — receives context from **two distinct, complementary database sources**:

| Data Type | Storage Location | Governs |
|---|---|---|
| Bookable services catalog (name, department, duration, `service_id`) | `services` table (relational) | What can be booked; maps to `appointments.service_id` |
| Staff / specialists, working hours, and business hours | `company_configs.profile_data` (JSONB) | Scheduling constraint enforcement |
| Free-text business context | `knowledge_base` table | FAQ grounding (RAG) |
| AI provider keys, calendar credentials, integration URLs | `company_configs` (relational columns) | Engine configuration |

The AI is explicitly instructed in every prompt that **the relational services list is the authoritative catalog** and must override any service-related text found in the `profile_data` JSONB. This separation of concerns ensures that service IDs remain database-consistent while staff scheduling rules remain schema-free and dynamically editable.

---

### 2.3 The Relational `services` Table

The `services` table is the **booking ID authority**. It stores every bookable service as a first-class relational record:

```sql
CREATE TABLE services (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR NOT NULL,
  department       VARCHAR NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  company_id       UUID REFERENCES "Company"("CompanyID") ON DELETE CASCADE
);
```

**Multi-tenancy enforcement** is implemented via the `company_id` foreign key (added in migration `20260810104500_make_services_multitenant.js`). Every query against the `services` table in a tenant-aware context is scoped by `company_id`, guaranteeing that Tenant A's service catalog is never visible to Tenant B.

When a booking is confirmed, the `bookingHandler` extracts the integer `service_id` from the LLM response. This ID is the **canonical booking reference** written to the `appointments` table, creating a permanent foreign-key link between the confirmed appointment and the service record:

```sql
-- appointments: stores a service_id FK and a denormalized specialist_name snapshot
ALTER TABLE appointments
  ADD COLUMN company_id       UUID REFERENCES "Company"("CompanyID"),
  ADD COLUMN specialist_name  VARCHAR;  -- historical snapshot at time of booking
```

> **Note:** The legacy `specialists` and `specialist_services` junction tables were **permanently dropped** in migration `20260810103500_drop_legacy_specialist_tables.js`. Staff data is now exclusively managed through `company_configs.profile_data`.

---

### 2.4 The `company_configs.profile_data` JSONB Column

The `profile_data` column (added in migration `20260807120000_add_profile_data_to_configs.js`) is the **dynamic configuration layer** of the platform. It stores structured, schema-free business data that the AI reads at runtime to enforce scheduling constraints.

**Schema shape — populated automatically by the document ingestion pipeline:**

```json
{
  "professionals": [
    {
      "name": "Sarah Connor",
      "services": ["Server Configuration", "Database Optimization"],
      "working_hours": "9:00 AM - 4:00 PM"
    },
    {
      "name": "John Reese",
      "services": ["Network Security Audit"],
      "working_hours": "10:00 AM - 6:00 PM"
    }
  ],
  "business_hours": "Monday-Friday, 9 AM to 6 PM",
  "location": "123 Tech Street, Casablanca"
}
```

This object is retrieved by `configService.getCompanyProfile()` at runtime and injected into AI prompts. The `bookingHandler` uses it to enforce the **Critical Scheduling Rule**: if a user requests an appointment outside a specialist's `working_hours`, the AI is forbidden from confirming the booking.

This rule is reinforced by a **server-side hard guard** that vetoes any LLM response claiming confirmation with missing fields — providing a deterministic safety layer independent of model instruction-following:

```javascript
// CRIT-4 fix: hard server-side veto — a hallucinating model cannot
// set user_confirmed=true if any required booking field is null.
if (currentBookingState.user_confirmed && !allRequiredFieldsPresent) {
  console.error('State machine guard: LLM set user_confirmed=true with missing fields. Vetoing.');
  currentBookingState.user_confirmed = false;
}
```

---

### 2.5 AI Conversation Pipeline

Incoming WhatsApp messages flow through a sequential, stateful pipeline:

```
User Message (WhatsApp)
        |
        v
whatsappGateway.js
  |-- Security validation (sanitization, dev message whitelist)
  |-- Anti-loop detection (FAIL_THRESHOLD = 3 consecutive failures)
  +-- Inactivity session cleanup (2-hour TTL)
        |
        v
chatController.processUserMessage()
        |
        v
intentRouter.routeIntent()   <-- callAI() with full company context injected
  Classifies into: booking | faq | handover | review | unknown
  Detects language: en | fr | ar | darija
        |
        |--[booking]--> bookingHandler.handleBooking()
        |                 |-- fetchCompanyCatalogFromDB()  <-- services table (SSOT)
        |                 |-- getCompanyProfile()          <-- profile_data JSONB
        |                 |-- callAI() [jsonMode: true]    <-- structured state extraction
        |                 |-- Server-side guard: veto hallucinated confirmations
        |                 |-- insertEvent()                <-- Google Calendar
        |                 +-- syncAppointment()            <-- POST /api/appointments/sync
        |
        |--[faq]------> faqHandler.handleFaq()
        |                 |-- getKnowledgeBase()           <-- knowledge_base table (RAG)
        |                 |-- getCompanyProfile()          <-- profile_data JSONB
        |                 +-- callAI()                     <-- grounded response
        |
        |--[handover]-> handoverHandler
        |                 +-- syncHandover()              <-- POST /api/whatsapp/sync-handover
        |
        +--[review]---> feedbackHandler.handleFeedback()
                          +-- Collects rating, routes to Google Review or Tally form
```

All session state (`bookingState`, `history`, `clientLanguage`) is maintained in-memory within `whatsappGateway.js`'s `userSessions` map, keyed by the user's WhatsApp JID.

---

### 2.6 Multi-Provider AI Gateway with Failover

`llmClient.js` implements a **provider-agnostic AI gateway** with automatic sequential failover. Providers are evaluated at call time — no server restart is needed to activate a newly added API key.

**Failover priority order:**

| Priority | Provider | Endpoint | Default Model |
|---|---|---|---|
| 1 | **Gemini** (Primary) | `generativelanguage.googleapis.com` | `gemini-3.5-flash-lite` |
| 2 | **Groq** | `api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| 3 | **Mistral** | `api.mistral.ai/v1` | `open-mistral-nemo` |
| 4 | **NVIDIA NIM** | `integrate.api.nvidia.com/v1` | `meta/llama-3.1-70b-instruct` |

Gemini HTTP 429 rate-limit hits trigger an automatic in-provider model downgrade to `gemini-3.1-flash-lite` before rotating to the next provider. Retriable status codes (`429`, `500`, `502`, `503`, `504`) initiate provider rotation; hard client errors (`400`, `401`, `403`) are treated as fatal and are not retried.

To add a new provider, append a single entry to the `PROVIDER_REGISTRY` array in `llmClient.js` — no other changes are required.

---

### 2.7 Cross-Service Synchronization

The `backend-engine` never writes to PostgreSQL directly. All persistence operations are delegated to the `backend` REST API via `sessionSyncService.js`:

| Event | Method | Endpoint |
|---|---|---|
| WhatsApp connection state change | `PATCH` | `/api/whatsapp/session-status` |
| New chat message (inbound or outbound) | `POST` | `/api/whatsapp/sync-message` |
| Human handover triggered | `POST` | `/api/whatsapp/sync-handover` |
| Booking confirmed | `POST` | `/api/appointments/sync` |

All sync calls are fire-and-forget with full error containment — a network hiccup during a sync operation never interrupts the Baileys message processing loop.

---

## 3. AI Document Extraction Pipeline

The document ingestion pipeline (`POST /api/business/upload`) is the mechanism by which a tenant's business context is loaded into the system. It operates as a fully automated, atomic pipeline:

```
POST /api/business/upload  (multipart/form-data)
Field: "document"  |  Accepted: .txt .pdf .doc .docx  |  Max size: 10 MB
        |
        v  Step 1 — Text Extraction
        |-- .txt  -> Buffer.toString('utf-8')
        |-- .pdf  -> pdf-parse library
        +-- .docx -> mammoth.extractRawText()
        |
        v  Step 2 — LLM Structured Extraction  (jsonMode: true)
        callAI(buildExtractionPrompt(rawText))
        Returns a validated JSON object:
        {
          "services":     [...],    // Bookable service records
          "company_info": "...",    // Free-text business context (RAG)
          "profile_data": {         // Staff + hours (JSONB column)
            "professionals": [...]
          }
        }
        |
        |-- Step 3 (Atomic Knex Transaction)
        |   seedServices(): DELETE WHERE company_id = $tenant
        |                   INSERT new service rows WITH company_id
        |
        |-- Step 4 (Upsert)
        |   upsertKnowledgeBase(): DELETE then INSERT into knowledge_base
        |
        +-- Step 5 (Upsert)
            INSERT INTO company_configs (company_id, profile_data)
            ON CONFLICT (company_id) DO UPDATE SET profile_data = excluded.profile_data
        |
        v  Step 6 — Response
        HTTP 200: { success: true,  services[], knowledge_base, profile_data }
        HTTP 207: { success: false, per-operation error keys }  <- partial failure
```

**Key design decisions:**

- **Atomic catalog replacement**: `seedServices()` wraps its `DELETE` + `INSERT` in a Knex transaction, ensuring the services catalog is never in a partially-updated state during a re-upload.
- **Tenant isolation**: The `company_id` derived from the JWT payload (`req.user.companyId`) is applied to every write operation. A tenant can only overwrite their own records.
- **Simultaneous dual-write**: A single upload atomically updates both the relational `services` table **and** the `company_configs.profile_data` JSONB column, keeping both data layers permanently synchronized.
- **Graceful partial failure**: If one of the three write steps fails independently, the controller returns HTTP `207 Multi-Status` with granular per-operation error keys rather than rolling back the entire ingestion.

---

## 4. Database Schema Reference

All migrations live in `backend/src/database/migrations/` and are applied in chronological filename order via `npx knex migrate:latest`.

| Migration Timestamp | File | Description |
|---|---|---|
| `20260721112610` | `create_initial_tables` | Core schema: Company, AdminUser, Customer, services, ChatSession, ChatLogs, Review, conversations, FlaggedMessages, company_configs, company_documents, whatsapp_sessions. Includes mock analytics seed data. |
| `20260806120000` | `create_knowledge_base_table` | Adds `knowledge_base` table for RAG context storage |
| `20260807120000` | `add_profile_data_to_configs` | Adds `profile_data JSONB` column to `company_configs` |
| `20260810103500` | `drop_legacy_specialist_tables` | Drops `specialists` and `specialist_services` tables; adds `company_id` FK and `specialist_name` snapshot column to `appointments` |
| `20260810104500` | `make_services_multitenant` | Adds `company_id` FK to both `services` and `knowledge_base` tables |

**Core table relationships:**

```
Company (1) --< AdminUser (N)
Company (1) --< whatsapp_sessions (N)
Company (1) --< services (N)           <- SSOT: booking catalog
Company (1) --  company_configs (1)    <- profile_data JSONB lives here
Company (1) --< company_documents (N)
Company (1) --< appointments (N)
appointments.service_id --> services.id
appointments.company_id --> Company.CompanyID
Customer (1) --< ChatLogs (N)
Customer (1) --< Review (N)
Customer (1) --< conversations (N)
conversations (1) --< FlaggedMessages (N)
```

---

## 5. Local Development & Testing Environment

### 5.1 Prerequisites

| Requirement | Minimum Version | Notes |
|---|---|---|
| Node.js | 22.x | Required for ES Module support (`"type": "module"`) |
| PostgreSQL | 16.x | Via Docker (recommended) or local install |
| Docker & Docker Compose | Latest stable | Manages PostgreSQL + pgAdmin stack |

---

### 5.2 Environment Configuration

Each service has its own `.env` file. Copy the examples and populate your credentials:

```bash
cp backend/.env.example backend/.env
cp backend-engine/.env.example backend-engine/.env
```

**`backend/.env` — required variables:**

```dotenv
PORT=5000
NODE_ENV=development

# Auth
JWT_SECRET=<min_32_character_cryptographically_random_secret>

# AI Provider Keys (failover: gemini -> groq -> mistral -> nvidia)
# Set at least ONE. Leave unused providers blank to skip them silently.
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
GROQ_API_KEY=your_groq_api_key_here
MISTRAL_API_KEY=
NVIDIA_API_KEY=

# PostgreSQL Connection
DB_HOST=localhost
DB_PORT=5432        # Use 5433 if using the docker-compose stack
DB_USER=postgres
DB_PASSWORD=your_db_password_here
DB_NAME=assist_ai_db

# Engine-to-Backend bridge URL
DASHBOARD_API_URL=http://localhost:5000
```

**`backend-engine/.env` — required variables:**

```dotenv
PORT=3001
NODE_ENV=development   # Set to 'production' to disable dev message whitelist

# AI Providers (same failover order as backend)
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Google Calendar — Service Account credentials
CALENDAR_ID=your_calendar_id@group.calendar.google.com
GOOGLE_CLIENT_EMAIL=your-sa@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_key_here\n-----END PRIVATE KEY-----\n"

# Post-appointment feedback routing
GOOGLE_REVIEW_URL=https://g.page/r/YOUR_REVIEW_LINK
TALLY_FORM_URL=https://tally.so/r/YOUR_FORM_ID

# Backend API URL (for sessionSyncService HTTP bridge)
DASHBOARD_API_URL=http://localhost:5000

# Admin WhatsApp JID — receives escalation alerts
# Format: <country_code><number>@s.whatsapp.net
WA_ADMIN_JID=212600000000@s.whatsapp.net
```

> **Important:** `GOOGLE_PRIVATE_KEY` must be a single-line string with literal `\n` escape sequences representing newlines. Replace actual line breaks in the PEM file with the two-character sequence `\n`.

---

### 5.3 Database Setup & Migrations

**Step 1 — Start the PostgreSQL container:**

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL 16** on `localhost:5433` (host port mapped from container port `5432`)
- **pgAdmin 4** on `http://localhost:5050` — login: `admin@assist.ai` / `admin`

> The `docker-compose.yml` maps the container port `5432` to host port `5433`. Set `DB_PORT=5433` in `backend/.env` when using this stack.

**Step 2 — Install backend dependencies:**

```bash
cd backend
npm install
```

**Step 3 — Apply all migrations:**

```bash
cd backend
npx knex migrate:latest
```

This executes all five migrations in chronological order, builds the full schema, and seeds mock analytics data for immediate dashboard testing.

**Check migration state:**

```bash
npx knex migrate:status
```

**Roll back (development only):**

```bash
# Most recent batch only
npx knex migrate:rollback

# Full clean slate
npx knex migrate:rollback --all
```

---

### 5.4 Running Services Locally

Open three separate terminal sessions:

**Terminal 1 — Backend REST API:**

```bash
cd backend
npm run dev
# Listening on http://localhost:5000
```

**Terminal 2 — Bot Engine:**

```bash
cd backend-engine
npm install
npm run dev
# QR code printed in terminal — scan with WhatsApp mobile app
```

**Terminal 3 — Frontend Dashboard:**

```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:3000
```

Once the engine starts, scan the QR code via **WhatsApp > Settings > Linked Devices > Link a Device**. The Baileys session is persisted to `backend-engine/auth_info_baileys/` and survives process restarts.

---

### 5.5 E2E CLI Testing: `testBookingFlow.js`

`backend-engine/scripts/testBookingFlow.js` is a **headless, network-silent end-to-end test harness** for the booking pipeline. It simulates a complete multi-turn WhatsApp booking conversation without requiring an active WhatsApp connection, and verifies that all downstream integrations — Google Calendar and the backend database sync — are correctly triggered.

#### What It Tests

The script runs a predefined 6-step conversation written in Moroccan Darija, engineered to exercise specific AI constraint guardrails:

| Step | Input Message | Guardrail Under Test |
|---|---|---|
| 1 | `"Bghit nched rdv"` | Booking intent detection from Darija |
| 2 | `"Server Configuration"` | Service selection against live DB catalog |
| 3 | `"Bghit m3a Sarah Connor ghada f 4:30 PM"` | **Out-of-hours block** — shift ends at 4:00 PM |
| 4 | `"Zayd"` | Customer name extraction |
| 5 | `"zayd@mail.me"` | Contact info email format validation |
| 6 | `"Oui kolchi mzian"` | Confirmation gating — all fields must be non-null |

Step 3 is the critical guardrail test: the requested time of 4:30 PM exceeds the specialist's 4:00 PM shift end. The AI must return `"appointment_time": null` in its JSON state output — the booking is strictly blocked, and the state machine does not advance.

#### Prerequisites

Before running:

1. **Backend REST API** must be running on `http://localhost:5000` — the test fires a real HTTP `POST` to `/api/appointments/sync` and validates the write reaches PostgreSQL.
2. At least one valid AI provider key must be configured in `backend-engine/.env`.
3. The `services` catalog must be populated (run the document upload, or ensure migration seed data is present).

#### Running the Test

```bash
cd backend-engine

# Via the npm script alias
npm run test:booking

# Or directly
node scripts/testBookingFlow.js
```

#### Interpreting the Output

The script prints a step-by-step trace with full booking state JSON at each turn, followed by a final verification block:

```
==================================================================
STARTING E2E BOOKING FLOW CLI TEST FOR: test_user@s.whatsapp.net
==================================================================

Step 1/6 | User: "Bghit nched rdv"
AI Reply: "Bien sur! Voici nos services disponibles: ..."
Updated Booking State: { "status": "pending", "service_requested": null, ... }

------------------------------------------------------------------
Step 3/6 | User: "Bghit m3a Sarah Connor ghada f 4:30 PM"
AI Reply: "Je suis desole, Sarah Connor travaille de 9h a 16h.
           Veuillez choisir un creneau avant 16h00."
Updated Booking State: { "appointment_time": null }
                                               ^-- CORRECT: time blocked

==================================================================
VERIFYING FINAL CONFIRMATION INTEGRATIONS
==================================================================
1. Google Calendar Event API Invoked: YES
2. Backend syncAppointment REST Request Fired: YES
   Synced Payload: { "customer_name": "Zayd", "contact_info": "zayd@mail.me", ... }
3. Baileys Send Functions Bypassed (No WhatsApp traffic): YES

SUCCESS: Full booking flow executed and verified end-to-end!
```

#### Spy Architecture

**Google Calendar spy** — Monkey-patches `google.calendar` to intercept `events.insert` calls. In environments without live service account credentials, authentication errors are caught and swallowed while the invocation intent is recorded via the `calendarApiInvoked` flag.

**Backend sync spy** — Intercepts `fetch` calls to `/api/appointments/sync`, records the payload, then **passes the request straight through** to the real Express server. A mock response would be a false positive — the database write would be silently skipped.

**No WhatsApp traffic** — `sock.sendMessage` is never called. Messages are injected directly into `processUserMessage()`, making the harness safe to run in any environment with no WhatsApp account required.

**Exit behavior:**

```bash
npm run test:booking; echo "Exit code: $?"
# 0 = both integrations invoked (pass)
# 1 = Calendar or DB sync not triggered (fail)
```

The `process.exit(1)` on failure makes this script suitable for use as a CI/CD smoke-test gate.

---

## 6. API Reference

The full OpenAPI 3.0 contract is available in `docs/openapi.yaml`. Key endpoint groups:

| Route Group | Base Path | Description |
|---|---|---|
| Auth | `/api/auth/*` | Admin login, JWT issuance |
| Business | `/api/business/*` | Document upload, knowledge base, services catalog, company profile |
| Appointments | `/api/appointments/*` | Sync from engine, CRUD management, reminder queries |
| WhatsApp | `/api/whatsapp/*` | Session status, message sync, handover events |
| Dashboard | `/api/dashboard/*` | Analytics aggregation for frontend charts |
| Settings | `/api/settings/*` | Tenant configuration management |
| Handover | `/api/handover/*` | Live agent intervention endpoints |
| Reviews | `/api/reviews/*` | Customer review ingestion |

**Critical cross-service endpoints:**

```
POST   /api/business/upload               Document ingestion (LLM extraction + dual DB write)
GET    /api/business/knowledge-base       Active RAG context  (polled by engine configService)
GET    /api/business/services             Active services catalog (polled by engine)
GET    /api/business/profile              company_configs.profile_data (polled by engine)
PATCH  /api/whatsapp/session-status       Engine -> backend: WhatsApp connection state changes
POST   /api/whatsapp/sync-message         Engine -> backend: Persist inbound/outbound messages
POST   /api/whatsapp/sync-handover        Engine -> backend: Record human escalation events
POST   /api/appointments/sync             Engine -> backend: Persist a confirmed booking
GET    /api/appointments/tomorrow         Reminder cron: appointments scheduled for tomorrow
GET    /api/appointments/concluded-today  Feedback cron: appointments that ended today
```

---

## 7. Deployment Guide

### 7.1 Pre-Deployment Checklist

```
[ ] PostgreSQL 16 provisioned and network-accessible from all services
[ ] SSL/TLS certificate configured at the backend REST API
[ ] All .env files populated with production values — zero placeholder strings
[ ] JWT_SECRET is a cryptographically random string, minimum 64 characters
[ ] NODE_ENV=production set in backend-engine/.env (disables dev whitelist)
[ ] At least one AI provider API key is live with verified quota remaining
[ ] Google Service Account credentials present (calendar-key.json)
[ ] WA_ADMIN_JID set to a reachable WhatsApp number for escalation alerts
[ ] DASHBOARD_API_URL in backend-engine/.env points to production backend URL
[ ] CORS ALLOWED_ORIGINS in backend/src/index.js updated to production frontend domain
[ ] docker-compose.yml default DB password changed if using containerized PostgreSQL
[ ] pgAdmin port (5050) is firewalled — not publicly accessible in production
[ ] auth_info_baileys/ directory backed up (contains WhatsApp session credentials)
```

---

### 7.2 Database Migration in Production

Migrations run from the `backend` directory. Ensure all `DB_*` variables target the production database before executing.

**Apply all pending migrations:**

```bash
cd backend
NODE_ENV=production npx knex migrate:latest
```

**Verify applied state:**

```bash
NODE_ENV=production npx knex migrate:status
```

**Inspect migration history directly in the database:**

```sql
SELECT * FROM knex_migrations ORDER BY id ASC;
```

> **Warning:** Never run `migrate:rollback --all` against a production database. Rollbacks are destructive — they drop tables and permanently delete all contained data. Apply rollbacks individually and only after a verified backup has been restored and validated.

---

### 7.3 Starting the Production Server

**Direct Node.js (minimum viable):**

```bash
cd backend
NODE_ENV=production node src/index.js

cd ../backend-engine
NODE_ENV=production node index.js
```

**Recommended: PM2 process manager**

```bash
npm install -g pm2

# Backend REST API
cd backend
pm2 start src/index.js --name "assistai-backend"

# Bot Engine
cd ../backend-engine
pm2 start index.js --name "assistai-engine"

# Persist process list across reboots
pm2 save
pm2 startup
```

**Monitor and manage:**

```bash
pm2 status
pm2 logs assistai-backend --lines 100
pm2 logs assistai-engine --lines 100
pm2 reload assistai-backend   # zero-downtime restart for API
```

---

### 7.4 Multi-Tenant Database Security

The platform enforces tenant isolation through four independent layers:

**Layer 1 — JWT-bound tenant identity**
The `authenticate` middleware (`backend/src/middleware/auth.js`) decodes the JWT on every protected request and populates `req.user.companyId`. This value is the root of all tenant-scoped queries and is never accepted from the request body or query string.

**Layer 2 — Query-level row scoping**
All database operations on tenant-owned data (services, knowledge base, document uploads, appointments) are filtered with `WHERE company_id = req.user.companyId`. Cross-tenant data access is structurally impossible at the ORM layer.

**Layer 3 — Atomic ingestion isolation**
`seedServices()` and `upsertKnowledgeBase()` in `documentController.js` both receive `companyId` from the authenticated JWT. A new ingestion only clears and repopulates records belonging to the authenticated tenant. The delete-then-insert pattern runs inside a Knex transaction, eliminating partial-state windows.

**Layer 4 — Cascade delete integrity**
All tenant-owned tables define `ON DELETE CASCADE` on their `company_id` foreign key referencing `Company.CompanyID`. Deleting a `Company` record atomically purges all associated services, configs, documents, appointments, and chat history across every dependent table.

---

## 8. Cron Schedulers

Two automated schedulers are initialized on engine startup in `backend-engine/index.js`:

| Scheduler | Schedule | Timezone | Action |
|---|---|---|---|
| `initReminderScheduler` | Daily at **08:00** | Africa/Casablanca | Queries `GET /api/appointments/tomorrow`, sends localized appointment reminder messages via WhatsApp to each confirmed customer |
| `initFeedbackScheduler` | Daily at **20:00** | Africa/Casablanca | Queries `GET /api/appointments/concluded-today`, arms the `waitingForFeedback` session flag, dispatches the 3-option rating prompt |

**Feedback routing logic:**

- Rating **above** the configured threshold → customer receives `GOOGLE_REVIEW_URL` (public review link)
- Rating **at or below** the threshold → customer receives `TALLY_FORM_URL` (detailed internal feedback form)

Both schedulers are initialized with the live `sock` instance returned by `connectToWhatsApp()`, enabling direct WhatsApp message dispatch without additional HTTP round-trips.

---

*AssistAI — Multi-Tenant AI Booking and Context Injection Engine*
