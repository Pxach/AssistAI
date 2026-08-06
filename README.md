<div align="center">

# AssistAI

**AI-powered WhatsApp customer support, intelligent booking, and live intervention platform**

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Directory Structure](#4-directory-structure)
5. [Prerequisites](#5-prerequisites)
6. [Setup & Installation](#6-setup--installation)
7. [Environment Variables](#7-environment-variables)
8. [Running the Services](#8-running-the-services)
9. [Database Schema](#9-database-schema)
10. [Key Features & API Endpoints](#10-key-features--api-endpoints)
11. [Testing & Verification](#11-testing--verification)
12. [Deployment Notes](#12-deployment-notes)

---

## 1. Project Overview

AssistAI is a full-stack SaaS platform that connects businesses to their WhatsApp customers through an AI-powered conversation engine. It handles three core workflows autonomously — with live human intervention always one click away.

| Capability | Description |
|---|---|
| **Dynamic Q&A (RAG)** | Answers customer questions in real time using a knowledge base built from uploaded business documents (PDF, DOCX, TXT). |
| **Intelligent Booking** | Guides customers through a natural multi-turn appointment booking flow: service selection → specialist → date/time → confirmation → Google Calendar event. |
| **Human Handover** | Detects frustrated or stuck users via an anti-loop circuit breaker, escalates to a human agent on WhatsApp, and alerts the dashboard in real time via Socket.io. |
| **Feedback Collection** | Automatically sends post-appointment satisfaction prompts; routes positive reviews to Google Reviews and negative feedback to a Tally form. |
| **Admin Dashboard** | Next.js dashboard with live conversation monitoring, booking/review analytics, document management, and WhatsApp gateway control. |

**Languages supported:** French · English · Arabic · Moroccan Darija (auto-detected per session)

---

## 2. Tech Stack

### Backend API (`backend/`)

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 + ES Modules |
| Framework | Express 5 |
| Database ORM | Knex 3 (query builder + migrations) |
| Database | PostgreSQL 16 |
| Authentication | JWT (cookie-based, `jsonwebtoken`) |
| File ingestion | Multer (disk + memory storage) |
| Document parsing | `pdf-parse`, `mammoth` (DOCX) |
| Real-time | Socket.io 4 |

### Backend Engine (`backend-engine/`)

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 + ES Modules |
| WhatsApp Gateway | `@whiskeysockets/baileys` 7 (multi-device) |
| LLM Client | Multi-provider with auto-failover: **Gemini 3.5** → Groq → Mistral → Nvidia NIM → OpenRouter |
| Calendar | Google Calendar API v3 (Service Account) |
| Scheduling | `node-cron` (daily reminder & feedback crons) |
| Security | AI-powered prompt-injection classifier (fail-closed) |
| Real-time | Socket.io-client (pushes events to dashboard) |

### Frontend (`frontend/`)

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Real-time | Socket.io-client |
| Auth | Cookie-based JWT, Next.js Middleware |

---

## 3. Architecture

### End-to-End Message Pipeline

```mermaid
flowchart TD
    WA[("📱 WhatsApp\nCustomer")]
    GW["⚙️ WhatsApp Gateway\nBaileys / backend-engine"]
    SEC["🛡️ Security Classifier\nPrompt-injection filter"]
    LANG["🌐 Language Detector\nfr · en · ar · darija"]
    IR["🧭 Intent Router\nLLM-powered classification"]

    FAQ["📚 FAQ Handler\nRAG · Knowledge Base"]
    BOOK["📅 Booking Engine\nMulti-turn state machine"]
    HAND["🤝 Handover Handler\nHuman escalation"]
    FEED["⭐ Feedback Handler\nPost-appointment rating"]

    KB[("📄 Knowledge Base\nPostgreSQL")]
    GCAL[("📆 Google Calendar\nService Account API")]
    PG[("🐘 PostgreSQL\nAppointments · Sessions\nReviews · Chat Logs")]

    SYNC["🔄 Session Sync\nHTTP PATCH / POST"]
    DASH["🖥️ Dashboard\nNext.js + Socket.io"]
    ADMIN["👤 Human Agent\nWhatsApp manager"]

    WA -->|"Inbound message"| GW
    GW --> SEC
    SEC -->|"Safe"| LANG
    SEC -->|"Blocked"| WA
    LANG --> IR
    IR -->|"faq"| FAQ
    IR -->|"booking"| BOOK
    IR -->|"handover"| HAND
    IR -->|"feedback flag"| FEED

    FAQ --> KB
    BOOK --> GCAL
    BOOK --> PG
    HAND --> PG

    GW --> SYNC
    SYNC --> PG
    SYNC -->|"Socket.io events"| DASH
    DASH -->|"Outbound msg"| GW
    GW -->|"Reply"| WA

    HAND -->|"Alert"| ADMIN
    ADMIN -->|"Manual reply"| WA
```

### Anti-Loop Circuit Breaker

```
Consecutive unknown intents or repeated replies
         ↓
  FAIL_THRESHOLD = 3 reached
         ↓
  Bot sends escalation message to user
  Alert sent to admin WhatsApp JID
  Session flagged as handover = true
  Dashboard receives bot:handover_triggered event
```

### RAG Document Ingestion Pipeline

```
Upload PDF/DOCX/TXT via Dashboard
         ↓
  Text extraction (pdf-parse / mammoth)
         ↓
  LLM structured extraction:
    { services: [...], company_info: "..." }
         ↓
  Seed 'services' table
  Upsert 'knowledge_base' table
         ↓
  Engine reads knowledge base on each FAQ query
  (fetched live from backend API at call time)
```

---

## 4. Directory Structure

```
AssistAI/
│
├── backend/                        # REST API — dashboard data, auth, document ingestion
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.js       # Register, login, logout (JWT)
│   │   │   ├── appointmentController.js# CRUD + sync for appointments
│   │   │   ├── dashboardController.js  # Analytics aggregations + CSV export
│   │   │   ├── documentController.js   # RAG ingestion pipeline (PDF/DOCX → LLM → DB)
│   │   │   ├── handoverController.js   # Handover request management
│   │   │   ├── reviewController.js     # Review submission & listing
│   │   │   └── whatsappController.js   # Gateway status, session sync, chat logs
│   │   ├── routes/
│   │   │   ├── index.js                # Route aggregator
│   │   │   ├── authRoutes.js           # POST /api/auth/register|login|logout
│   │   │   ├── appointmentRoutes.js    # GET|POST /api/appointments/*
│   │   │   ├── businessRoutes.js       # POST /api/business/upload (doc ingestion)
│   │   │   ├── dashboardRoutes.js      # GET /api/dashboard/stats|booking-stats|...
│   │   │   ├── handoverRoutes.js       # GET|POST /api/handover/*
│   │   │   ├── reviewRoutes.js         # GET|POST /api/reviews/*
│   │   │   ├── settings.js             # GET|POST /api/settings/configs|documents
│   │   │   └── whatsappRoutes.js       # /api/whatsapp/* (status, sync, logs)
│   │   ├── services/
│   │   │   ├── llmService.js           # Multi-provider LLM client (Gemini→Groq→Mistral)
│   │   │   ├── calendarService.js      # Google Calendar link generator
│   │   │   └── bookingHandler.js       # Booking data normaliser
│   │   ├── middleware/
│   │   │   └── auth.js                 # JWT cookie verification middleware
│   │   ├── database/
│   │   │   ├── db.js                   # Knex instance
│   │   │   ├── migrations/             # Schema migrations (run with knex migrate:latest)
│   │   │   └── seeds/                  # Optional seed data
│   │   └── utils/
│   │       └── csvFormatter.js         # Converts DB rows to CSV string
│   ├── uploads/                        # Uploaded documents stored here
│   ├── knexfile.js                     # Knex environment config (reads from .env)
│   ├── package.json
│   ├── .env                            # ← git-ignored, copy from .env.example
│   └── .env.example                    # ← template for all required keys
│
├── backend-engine/                 # WhatsApp AI Engine — real-time message processing
│   ├── src/
│   │   ├── controllers/
│   │   │   └── chatController.js       # processUserMessage() — security → intent → handler
│   │   ├── handlers/
│   │   │   ├── bookingHandler.js       # Multi-turn booking state machine (LLM extraction)
│   │   │   ├── faqHandler.js           # RAG Q&A via knowledge base + Gemini
│   │   │   ├── feedbackHandler.js      # Post-appointment rating collection (no LLM)
│   │   │   └── handoverHandler.js      # Human escalation trigger
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── llmClient.js        # Multi-provider AI gateway (Gemini→Groq→Mistral→Nvidia→OpenRouter)
│   │   │   │   └── intentRouter.js     # LLM intent classification with context awareness
│   │   │   ├── whatsappGateway.js      # Baileys socket, session management, anti-loop, circuit breaker
│   │   │   ├── calendarService.js      # Google Calendar event creation (Service Account)
│   │   │   ├── configService.js        # Async config gateway (env → future DB)
│   │   │   ├── reminderService.js      # Daily cron: appointment reminders + feedback prompts
│   │   │   ├── sessionSyncService.js   # HTTP sync to backend (session status, chat logs, handover)
│   │   │   └── feedbackEligibility.js  # Checks if user can submit feedback
│   │   ├── locales/
│   │   │   └── strings.js              # i18n dictionary (fr · en · ar · darija)
│   │   └── utils/
│   │       ├── security.js             # AI-powered prompt-injection classifier (fail-closed)
│   │       └── stateMinifier.js        # Strips null/empty fields from LLM state payloads
│   ├── scripts/
│   │   └── testFullSystem.js           # E2E CLI test: Q&A + Booking + Handover flows
│   ├── auth_info_baileys/              # ← git-ignored, Baileys WhatsApp session credentials
│   ├── index.js                        # Entry point: connectToWhatsApp() + cron schedulers
│   ├── package.json
│   ├── .env                            # ← git-ignored, copy from .env.example
│   └── .env.example                    # ← template for all required keys
│
├── frontend/                       # Admin Dashboard — Next.js 16 App Router
│   ├── app/
│   │   ├── page.jsx                    # Login / registration page (public)
│   │   ├── layout.js                   # Root layout
│   │   ├── globals.css                 # Global styles (Tailwind base)
│   │   ├── dashboard/                  # Home dashboard — stats, activity chart, interventions
│   │   ├── booking-analytics/          # Booking funnel charts and time-slot heatmaps
│   │   ├── chat-analytics/             # Conversation breakdown, flagged messages
│   │   ├── review-analytics/           # Sentiment analysis, category breakdown
│   │   ├── LiveIntervention/           # Live chat monitor — human agent reply UI
│   │   ├── connect-device/             # WhatsApp QR pairing page
│   │   ├── settings-page/              # API key config, document upload, company profile
│   │   └── hooks/                      # Shared React hooks (socket, auth, etc.)
│   ├── middleware.js                   # Route protection — redirects unauthenticated users
│   ├── next.config.mjs
│   └── package.json
│
├── frontend-dashboard/             # (Reserved — currently empty)
│
├── docker-compose.yml              # PostgreSQL 16 + pgAdmin containers
└── README.md                       # This file
```

---

## 5. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 22 | ES Modules required |
| npm | ≥ 10 | |
| PostgreSQL | 16 | Via Docker (recommended) or local install |
| Google Service Account | — | For Google Calendar integration |
| At least one LLM API key | — | Gemini, Groq, Mistral, Nvidia NIM, or OpenRouter |

---

## 6. Setup & Installation

### Step 1 — Clone & install dependencies

```bash
git clone <repo-url> AssistAI
cd AssistAI

# Install all three packages
npm install --prefix backend
npm install --prefix backend-engine
npm install --prefix frontend
```

### Step 2 — Start the database

```bash
# Starts PostgreSQL on port 5433 and pgAdmin on port 5050
docker-compose up -d

# pgAdmin: http://localhost:5050
#   Email:    admin@assist.ai
#   Password: admin
```

### Step 3 — Configure environment variables

```bash
# Backend API
cp backend/.env.example backend/.env

# Backend Engine
cp backend-engine/.env.example backend-engine/.env
```

Edit both `.env` files with your credentials. See the [Environment Variables](#7-environment-variables) section for a full reference.

### Step 4 — Run database migrations

```bash
cd backend
npx knex migrate:latest
```

This creates all tables: `Company`, `AdminUser`, `whatsapp_sessions`, `Customer`, `services`, `specialists`, `appointments`, `ChatSession`, `ChatLogs`, `Review`, `FlaggedMessages`, `company_configs`, `company_documents`, `knowledge_base`.

### Step 5 — Configure Google Calendar *(optional for booking)*

1. Create a Google Cloud project and enable the **Google Calendar API**
2. Create a **Service Account** and download the JSON key
3. Share your Google Calendar with the service account email (Editor permission)
4. Add the service account credentials to `backend-engine/.env`:

```env
CALENDAR_ID=your-calendar-id@group.calendar.google.com
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## 7. Environment Variables

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default: `5000`) |
| `NODE_ENV` | No | `development` or `production` |
| `JWT_SECRET` | **Yes** | Secret for signing JWT tokens — minimum 32 characters |
| `DB_HOST` | No | PostgreSQL host (default: `localhost`) |
| `DB_PORT` | No | PostgreSQL port (default: `5432`) |
| `DB_USER` | **Yes** | PostgreSQL username |
| `DB_PASSWORD` | **Yes** | PostgreSQL password |
| `DB_NAME` | No | Database name (default: `assist_ai_db`) |
| `GEMINI_API_KEY` | Partial* | Google Gemini API key |
| `GEMINI_MODEL` | No | Model name (default: `gemini-3.5-flash-lite`) |
| `GROQ_API_KEY` | Partial* | Groq API key |
| `GROQ_MODEL` | No | Model name (default: `llama-3.3-70b-versatile`) |
| `MISTRAL_API_KEY` | Partial* | Mistral AI key |
| `NVIDIA_API_KEY` | Partial* | Nvidia NIM key |
| `OPENROUTER_API_KEY` | Partial* | OpenRouter aggregator key |
| `DASHBOARD_API_URL` | No | Backend URL for engine sync (default: `http://localhost:5000`) |

> *At least **one** LLM key must be set for the document ingestion pipeline to function.

### `backend-engine/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default: `4000`) |
| `NODE_ENV` | **Yes** | `development` (enables test whitelist) or `production` (all messages) |
| `GEMINI_API_KEY` | Partial* | Primary LLM provider — Google Gemini |
| `GEMINI_MODEL` | No | Default: `gemini-3.5-flash-lite` |
| `GROQ_API_KEY` | Partial* | Fallback LLM — Groq |
| `GROQ_MODEL` | No | Default: `llama-3.3-70b-versatile` |
| `MISTRAL_API_KEY` | Partial* | Fallback LLM — Mistral AI |
| `NVIDIA_API_KEY` | Partial* | Fallback LLM — Nvidia NIM |
| `OPENROUTER_API_KEY` | Partial* | Fallback LLM — OpenRouter aggregator |
| `OPENROUTER_SITE_URL` | No | Your app URL (sent in OpenRouter headers) |
| `OPENROUTER_MODEL` | No | Default: `google/gemma-2-9b-it:free` |
| `CALENDAR_ID` | Booking | Google Calendar ID for booking events |
| `GOOGLE_CLIENT_EMAIL` | Booking | Service account email |
| `GOOGLE_PRIVATE_KEY` | Booking | Service account RSA private key (`\n`-escaped) |
| `GOOGLE_REVIEW_URL` | Feedback | Google Maps review link (sent to satisfied customers) |
| `TALLY_FORM_URL` | Feedback | Tally form URL (sent to dissatisfied customers) |
| `DB_HOST` | No | PostgreSQL host |
| `DB_PORT` | No | PostgreSQL port |
| `DB_USER` | **Yes** | PostgreSQL username |
| `DB_PASSWORD` | **Yes** | PostgreSQL password |
| `DB_NAME` | No | Database name |
| `DASHBOARD_API_URL` | No | Backend URL for session sync (default: `http://localhost:5000`) |
| `WA_ADMIN_JID` | No | Admin WhatsApp JID for escalation alerts (e.g. `212600000000@s.whatsapp.net`) |

> *At least **one** LLM key must be set. The engine tries providers in order: Gemini → Groq → Mistral → Nvidia → OpenRouter, auto-failing over on HTTP errors or 429 rate limits.

---

## 8. Running the Services

All three services must run concurrently. Open three terminal windows:

### Terminal 1 — Backend API

```bash
cd backend
npm run dev
# → Listening on http://localhost:5000
```

### Terminal 2 — Backend Engine (WhatsApp AI)

```bash
cd backend-engine
npm run dev
# → QR code appears in terminal on first run
# → Scan with WhatsApp on your phone to pair
```

### Terminal 3 — Frontend Dashboard

```bash
cd frontend
npm run dev
# → http://localhost:3000
```

### First-time WhatsApp pairing

On first launch, the engine prints a QR code in the terminal. Alternatively, navigate to **Connect Device** in the dashboard (`/connect-device`) to scan via the web UI. Credentials are stored in `backend-engine/auth_info_baileys/` (git-ignored).

---

## 9. Database Schema

The following tables are created by `knex migrate:latest`:

| Table | Purpose |
|---|---|
| `Company` | Registered businesses |
| `AdminUser` | Dashboard admin accounts (bcrypt-hashed passwords) |
| `whatsapp_sessions` | WhatsApp connection state per session key (PAIRING / CONNECTED / DISCONNECTED) |
| `Customer` | WhatsApp contacts identified by phone number |
| `services` | Business services seeded from document ingestion |
| `specialists` | Staff/specialists with optional Google Calendar IDs |
| `specialist_services` | Many-to-many junction (specialists ↔ services) |
| `appointments` | Booking records (date, time, status, customer, specialist) |
| `ChatSession` | Active WhatsApp sessions (handover state, language) |
| `ChatLogs` | Full message audit trail (customer / bot / human_agent) |
| `Review` | Customer feedback (rating, sentiment, category) |
| `FlaggedMessages` | Messages flagged by customer or bot for review |
| `company_configs` | Per-company API keys and integration settings (Settings UI) |
| `company_documents` | Uploaded document records |
| `knowledge_base` | Extracted company knowledge from documents (RAG context) |

---

## 10. Key Features & API Endpoints

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create company + admin account |
| `POST` | `/api/auth/login` | Authenticate and receive JWT cookie |
| `POST` | `/api/auth/logout` | Clear JWT cookie |

### Dashboard Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/stats?timeframe=` | Conversations, bookings, reviews, alerts overview |
| `GET` | `/api/dashboard/booking-stats?timeframe=` | Booking funnel, peak month, most popular time slot |
| `GET` | `/api/dashboard/review-stats?timeframe=` | Sentiment breakdown, categories, chart data |
| `GET` | `/api/dashboard/chat-stats?timeframe=` | Bot vs human vs unanswered, flagged messages |
| `GET` | `/api/dashboard/export-csv` | Download appointments as CSV |

Accepted `timeframe` values: `Today` · `This Week` · `This Month` · `This Year` · `All-time`

### Appointments

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/appointments` | List all appointments |
| `GET` | `/api/appointments/tomorrow` | Fetch tomorrow's confirmed appointments (reminder cron) |
| `GET` | `/api/appointments/concluded-today` | Fetch today's completed appointments (feedback cron) |
| `GET` | `/api/appointments/check-availability?date=&time=` | Check slot availability |
| `POST` | `/api/appointments` | Create a manual appointment |
| `POST` | `/api/appointments/sync` | Sync an appointment from the engine after booking confirmation |

### WhatsApp Gateway Sync

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/whatsapp/status` | Current connection status (DISCONNECTED / PAIRING / CONNECTED) |
| `POST` | `/api/whatsapp/connect` | Initiate QR pairing |
| `POST` | `/api/whatsapp/disconnect` | Log out session |
| `PATCH` | `/api/whatsapp/session-status` | Engine → Backend: report connection state change |
| `POST` | `/api/whatsapp/sync-message` | Engine → Backend: log a chat message |
| `POST` | `/api/whatsapp/sync-handover` | Engine → Backend: update handover flag |
| `POST` | `/api/whatsapp/send-message` | Dashboard → Engine: send outbound human agent message |
| `POST` | `/api/whatsapp/toggle-handover` | Toggle handover state from dashboard |
| `GET` | `/api/whatsapp/sessions` | List active chat sessions |
| `GET` | `/api/whatsapp/logs/:phoneNumber` | Fetch chat message history for a number |

### Business & Document Ingestion

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/business/upload` | Upload document → extract text → LLM parse → seed DB |
| `GET` | `/api/business/knowledge-base` | Retrieve current knowledge base content (used by engine) |
| `GET` | `/api/business/services` | List all seeded services |

### Settings (UI Sync)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/settings/configs` | Fetch company API key configuration |
| `POST` | `/api/settings/configs` | Save config → updates DB + writes both `.env` files |
| `GET` | `/api/settings/documents` | List uploaded company documents |
| `POST` | `/api/settings/documents` | Upload a document to `company_documents` |
| `DELETE` | `/api/settings/documents/:id` | Delete document record and disk file |

### Reviews & Handover

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reviews` | List all customer reviews |
| `POST` | `/api/reviews` | Submit a customer review |
| `GET` | `/api/handover` | List active handover requests |
| `POST` | `/api/handover/request` | Flag a session for human intervention |
| `POST` | `/api/handover/respond` | Accept or decline a handover (ACCEPT / DECLINE) |

---

## 11. Testing & Verification

### Full System E2E Test

The engine ships with a CLI integration test that exercises all three core flows without needing a running server — it calls `processUserMessage()` directly with real LLM providers.

```bash
cd backend-engine
node scripts/testFullSystem.js
```

**Expected output:**

```
==================================================================
🧪 STARTING E2E FULL SYSTEM TEST
==================================================================

--- 1. Testing Q&A Flow ---
👤 User: "What are your business hours and location?"
🤖 AI Reply: "..."
📊 Intent: faq

--- 2. Testing Booking Flow ---
👤 User: "I want to book a service"  →  🤖 "What service would you like?"
👤 User: "Database Optimization"      →  🤖 "What date would you prefer?"
👤 User: "Tomorrow at 10 AM"          →  🤖 "Could you tell me your name?"
👤 User: "John Doe"                   →  🤖 "What is your contact info?"
👤 User: "john@example.com"           →  🤖 "Please confirm your booking..."
👤 User: "Yes, please confirm"        →  🤖 "Your appointment is confirmed! 🎉"

--- 3. Testing Handover Flow ---
👤 User: "I demand to speak to a human!"
🤖 AI Reply: "I understand. Let me connect you to a representative."

VERIFYING FINAL STATE
1. Q&A Flow executed:                 ✅ YES
2. Google Calendar Event API Invoked: ✅ YES
3. Backend syncAppointment Fired:     ✅ YES
4. Handover State Triggered:          ✅ YES

🎉 SUCCESS: All flows executed and verified end-to-end!
```

**Notes on test warnings:**
- `[ConfigService] Could not fetch knowledge base: fetch failed` — Expected. The backend server isn't running in standalone test mode. The engine gracefully falls back to empty context.
- `[SessionSync] Failed to sync appointment: fetch failed` — Expected. The REST endpoint isn't live during testing, but the HTTP call is fired correctly (confirmed by the fetch spy).
- LLM `429` warnings indicate Gemini rate limits; the engine automatically falls back to Groq.

### Verifying the WhatsApp Pairing

1. Start the engine: `cd backend-engine && npm run dev`
2. Open the dashboard at `http://localhost:3000` and navigate to **Connect Device**
3. Scan the QR code with WhatsApp on your phone
4. The dashboard status indicator should change to **CONNECTED**

---

## 12. Deployment Notes

### Environment Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production` in **both** backend and engine `.env` files
- [ ] Set a strong, unique `JWT_SECRET` (≥ 32 random characters)
- [ ] Set `WA_ADMIN_JID` to the manager's WhatsApp JID
- [ ] Replace all placeholder URLs (`DASHBOARD_API_URL`, `GOOGLE_REVIEW_URL`, `TALLY_FORM_URL`) with production values
- [ ] Ensure `DB_USER` and `DB_PASSWORD` in `backend/.env` match your production database
- [ ] Verify `calendar-key.json` is **not** committed (listed in `.gitignore`)
- [ ] Run `npx knex migrate:latest` against your production database

### `NODE_ENV=production` — What Changes

Setting `NODE_ENV=production` in `backend-engine/.env` disables the **development message whitelist** in `whatsappGateway.js`. In development mode, only whitelisted test numbers receive AI responses; in production, **all** incoming WhatsApp messages are processed.

### Docker (Database only)

The `docker-compose.yml` manages PostgreSQL and pgAdmin. For production, replace with a managed database service and remove `docker-compose.yml` from deployment.

```bash
docker-compose up -d      # Start
docker-compose down       # Stop
docker-compose down -v    # Stop + delete data volumes
```

---

<div align="center">

Built with ❤️ by the AssistAI team.

</div>
