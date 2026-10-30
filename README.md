# TwinFlow — Gamified Lead Deck & Signal Intelligence Pipeline

A modern TypeScript monorepo featuring a gamified, mobile-first lead triage deck powered by React, Tailwind CSS, and Framer Motion on the frontend, and a high-performance Cloudflare Worker backend powered by Hono, Drizzle ORM, Cloudflare D1, SerpAPI, Firecrawl, OpenAI (gpt-4o-mini), and Apollo.

---

## 🏗️ Repository Architecture

```
TwinFlow/
├── client/                      # Vite + React 18 + Tailwind CSS v3 + Framer Motion
│   ├── src/
│   │   ├── components/          # DeckView, SwipeCard, LeadDetailPane, ActionControls, etc.
│   │   ├── data/                # Mock fallback intelligence dataset
│   │   ├── types/               # Lead, DecisionMaker, EmailDraft, and API response types
│   │   ├── utils/               # Web Audio API sound synthesizer
│   │   ├── App.tsx              # Connected deck shell with Scout News button & API sync
│   │   ├── main.tsx
│   │   └── index.css            # Tailwind directives & glassmorphism theme tokens
│   ├── tailwind.config.js       # Curated dark palette, fonts (Outfit & Inter), glow shadows
│   └── vite.config.ts           # Vite config with /api proxy to http://localhost:8788
│
├── server/                      # Cloudflare Worker API
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle ORM schema: users, signals, contacts, outreach_drafts, credit_transactions
│   │   │   └── index.ts         # D1 database client & typing
│   │   ├── services/            # Modular Service Adapters (Steps 3 & 4)
│   │   │   ├── serpNews.ts      # SerpAPI Google News query adapter
│   │   │   ├── firecrawl.ts     # Firecrawl web scraping adapter
│   │   │   ├── llmEnricher.ts   # OpenAI (gpt-4o-mini) structured signal & pitch enricher
│   │   │   ├── apollo.ts        # Apollo decision-maker contact & email matching adapter
│   │   │   ├── ghl.ts           # GoHighLevel (GHL) CRM adapter (upsertContact, createNote, createOpportunity)
│   │   │   └── index.ts
│   │   ├── routes/
│   │   │   ├── health.ts        # Health check endpoint (GET /api/health)
│   │   │   └── signals.ts       # Deck triage, AI ingestion, approval workflow, credit balance & replenishment
│   │   └── index.ts             # Hono Worker entry point with CORS and routing
│   ├── drizzle/
│   │   ├── migrations/          # Drizzle Kit generated SQL migrations for D1 (0000_init, 0001_credit_tx_and_ghl)
│   │   └── seed.sql             # Realistic business signal cards with linked contacts & drafts
│   ├── drizzle.config.ts        # Drizzle config for D1 SQLite dialect
│   ├── wrangler.toml            # Cloudflare Worker & D1 binding configuration (port 8788)
│   ├── .dev.vars                # Local development API keys
│   ├── .dev.vars.example        # Template for API keys
│   └── services/ghl.ts          # Root-level service adapter export
│
└── package.json                 # Monorepo task runner
```

---

## 🚀 Quick Start

### 1. Database Setup (Cloudflare D1 & Drizzle)

From the repository root:
```bash
# 1. Apply D1 migrations to local database
npm run db:migrate

# 2. Seed realistic business signal cards with contacts & email drafts
npm run db:seed
```

Or run both in one step:
```bash
npm run db:setup
```

---

### 2. Configure Environment Keys (`.dev.vars`)

Create or update `server/.dev.vars` (see `server/.dev.vars.example`):
```env
SERP_API_KEY=your_serpapi_key_here
FIRECRAWL_API_KEY=your_firecrawl_key_here
OPENAI_API_KEY=sk-your_openai_key_here
APOLLO_API_KEY=your_apollo_key_here

# GoHighLevel (GHL) API v2 Integration (Step 4)
GHL_API_KEY=your_ghl_private_integration_token
GHL_LOCATION_ID=your_ghl_subaccount_location_id
GHL_PIPELINE_ID=your_ghl_pipeline_id_optional
GHL_STAGE_ID=your_ghl_pipeline_stage_id_optional
```
> **Note**: If any key is left blank, all services gracefully fall back to high-fidelity simulated market data, heuristic extraction, and mock GHL CRM sync with detailed console logging, allowing end-to-end local testing without external paid subscriptions.

---

### 3. Start the Backend Worker (`/server`)

```bash
npm run dev:server
```
The Cloudflare Worker will start on **http://localhost:8788** with access to local D1.

#### Endpoints:
- `GET /api/health`: Health check route returning worker status, uptime, and Cloudflare D1 connection state.
- `GET /api/signals/deck`: Returns up to 10 unreviewed signals (`status = 'queued'`) with linked contact and outreach draft, plus the active operator user's credit balance, streak, and points.
- `POST /api/signals/ingest`: Ingests and enriches real-time news into the queue:
  - Accepts `{ query?: string, limit?: number }` (default query: `"Series A OR expansion OR hired CEO"`, limit: `3`).
  - Orchestrates: **SerpAPI** (News discovery) $\rightarrow$ **Firecrawl** (Article markdown extraction) $\rightarrow$ **OpenAI gpt-4o-mini** (Extraction of 3-point summary, decision-maker, hook, and cold draft) $\rightarrow$ **Apollo** (Verified email & LinkedIn matching).
  - Deduplicates by article URL and company name.
- `POST /api/signals/:id/action`: Accepts `{ action: 'approve' | 'pass' }`.
  - **`approve`**:
    * Verifies operator has at least 10 credits (returns HTTP 402 with `insufficientCredits: true` if balance $< 10$).
    * Debits 10 credits from `users.credit_balance` and records an immutable audit log in `credit_transactions`.
    * Invokes `ghl.upsertContact` to push or update the lead with company, custom signal fields, and contact information.
    * Invokes `ghl.createNote` to attach the 3-bullet executive summary and cold outreach draft directly to the CRM record.
    * Optionally invokes `ghl.createOpportunity` if pipeline IDs are configured.
    * Sets `signals.status = 'approved'` and `outreach_drafts.status = 'queued'`.
    * Increments streak (`+1`) and awards XP/points (`+50` + streak bonus).
    * Returns `{ success: true, action: 'approve', signal, user, ghl: { contactId, synced, mock }, creditsDeducted: 10, pointsAwarded }`.
  - **`pass`**: Marks signal as `'dismissed'`, costs 0 credits, and resets streak to `0`.
- `GET /api/signals/credits`: Returns current user credit balance and recent audit transactions from `credit_transactions`.
- `POST /api/signals/credits/replenish`: Dev top-up endpoint (`{ amount?: number }`, defaults to `+100` credits).
- `GET /api/signals/ghl/subaccounts`: Queries the agency API to list all available sub-accounts (`Eagle1`, `FeedMeSports`, `BinderBrief`, etc.).
- `GET /api/user/profile`: Fetches the current user profile, credit stats, and active GoHighLevel sub-account connection status.
- `POST /api/user/ghl-config`: Saves user's sub-account location ID and Private Integration Token to their profile in D1, with live credential verification against GHL.
- `POST /api/auth/signup`: Registers a new user with Name, Email, Password, and Organization. Automatically provisions a dedicated sub-account in GoHighLevel via Agency API Key, awards 500 starter credits, and creates an active session.
- `POST /api/auth/login`: Authenticates user with email & password, issuing a 30-day session token.
- `POST /api/auth/google`: Google OAuth / SSO authentication (supports Google ID tokens or verified credentials), auto-provisioning a GHL sub-account if the user is new.
- `GET /api/auth/me`: Validates session token and returns the current user profile.
- `POST /api/auth/logout`: Invalidates the active session token in Cloudflare D1.
- `POST /api/user/onboarding`: Saves user's Ideal Customer Profile (target industries, triggers, decision-maker roles, and value proposition), derives a tailored SerpAPI query, and automatically seeds their initial deck with matching news signals.
- `GET /api/signals/:id/branches`: Returns related competitor companies and alternative executive peer roles for a given signal card.
- `POST /api/signals/:id/branch-scout`: Executes targeted scouting on a selected competitor or internal peer role:
  * For competitors: Launches SerpAPI + Firecrawl + LLM run for recent competitor news, creating a new signal linked via `parent_signal_id`.
  * For internal peers: Queries Apollo for a secondary contact at the same domain matching the target title.
  * Debits 5 credits, marks entity as explored, awards +25 Combo XP multiplier, and returns the new signal prepended to the user's active deck.

---

### 4. Start the Frontend Client (`/client`)

```bash
npm run dev:client
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

#### Frontend Features:
- **Authentication & User Management**:
  * Tap **"Sign In"** in the top navigation bar to access the Auth modal.
  * Register with Name, Email, Password, and Organization, or use **"Continue with Google"**.
  * User Avatar dropdown in the top bar displays operator name, email, organization badge, GHL subaccount status, and **"Log Out"**.
- **Interactive ICP Onboarding Questionnaire**:
  * New users are guided through a 4-step wizard tailored to any B2B vertical:
    1. **Target Industries**: Multi-sector taxonomy with quick-filter tabs across 8 economic sectors (Commercial Real Estate & AEC, Healthcare & Medical Practices, Legal & Accounting / Financial Advisory, Manufacturing & Industrial, Retail & Franchise, Logistics, Energy, and Software & Tech + custom write-in).
    2. **Trigger Signals**: Broad business catalysts (New Location / Facility Opening, Major Contract / RFP Awarded, Executive / Managing Partner Hire, Mergers & Succession, Capital Investment, Commercial Debt / Financing, Regulatory Shift, Private Equity / Venture Funding).
    3. **Target Roles**: Universal executive decision-makers (Owner / Founder / Principal, Managing Partner / Practice Director, President / GM, COO, CFO, VP Operations, Director of Procurement, VP Sales / BD, CMO, CTO / IT Director).
    4. **Value Proposition**: User's core commercial offer with one-click industry templates, injected into OpenAI `gpt-4o-mini` to customize pitch angles and commercial hooks.
  * Upon finishing, the wizard dynamically scans Google News via SerpAPI for their customized query and seeds their deck with live enriched signals.
- **"Branch Out" Knowledge Graph Modal & Lead Multiplier**:
  * Tap the **"Branch Out"** button on any swipe card or click **"Explore Web"** in the context pane.
  * Opens an interactive drawer displaying:
    - **Similar Companies (Competitors)**: Key peer companies in the same sector with one-line positioning and live scout buttons.
    - **Other Key Roles (Internal Peers)**: Alternative executive decision-makers (e.g., CPO, VP RevOps, VP Engineering) worth reaching out to.
  * Tapping **"Scout Competitor"** or **"Scout Contact"** executes `POST /api/signals/:id/branch-scout`, debits 5 credits, awards +25 XP, marks the node as explored, and slides the newly generated card to the very top of your triage deck.
- **Branching Streak / Combo Counter**:
  * Active branching builds a combo streak shown in the header HUD (e.g., `x3 Combo! +75 XP`).
  * Branched cards are distinguished in the swipe deck with a dedicated `Branched` cyan badge and origin metadata.
- **GoHighLevel Sub-Account Setup Modal**: Click the `GHL` pill in the top navigation bar to open the setup modal. It includes:
  - Live connection status (Connected vs Mock mode)
  - One-click copy for required scopes (`contacts.readonly contacts.write opportunities.readonly opportunities.write`)
  - Quick-pick buttons automatically populated from your agency's active sub-accounts
  - Live token verification and secure profile storage in Cloudflare D1
- **Live Credit & Streak Counters**: Real-time credit pill in the top navigation bar displays balance; clicking it opens the `UpgradeModal`.
- **"Scout News" Button**: Click the pulsing radar button in the top navigation bar (or in the cleared-deck screen) to trigger the live AI ingestion pipeline (`POST /api/signals/ingest`), populate fresh cards, and play tactile feedback.
- **Swipe Triage**:
  - **Swipe Right** or tap **"Approve & Queue Pitch"**: Deducts 10 credits, syncs lead & draft to GoHighLevel (using the user's specific sub-account credentials), shows animated toast (`"Lead Pushed to GoHighLevel (-10 credits)"`), and awards streak/points.
  - **Swipe Left** or tap **"Pass"**: Dismisses lead in D1 (0 credits) and resets streak.
- **Credit Protection & Upgrade Modal**:
  - If credit balance falls below 10, the "Approve" button dynamically switches to `"Need 10 Credits (Top Up)"` and right-swipes are blocked.
  - Clicking opens the **Upgrade / Top Up Modal** with tier pricing options and an instant **"+100 Dev Demo Credits"** replenishment button that syncs directly with D1.
- **Split-Pane Layout**: Full context details (dossier, signal triad, email studio) on the right for desktop screens ($> 768$px).

