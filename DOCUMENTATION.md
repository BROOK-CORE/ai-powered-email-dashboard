# Inboxly — AI-Powered Email Management Dashboard Documentation

Complete architecture, feature, usage, API, and code reference for **Inboxly** (`F:\Ai powered email dashboard`).

---

## 1. Overview & Problem Solved

Busy executives rely on personal assistants (PAs) to manage high-volume Gmail and Outlook inboxes, yet traditional email clients force both the assistant and client to wade through the same unfiltered stream. **Inboxly** solves this with a dual-view workflow:

1. **Assistant Workspace (`/assistant`):** Automatically analyzes every incoming or existing thread and assigns reply ownership (`assistant_to_reply`, `client_to_reply`, or `no_reply_needed`), extracts deadlines/meetings, flags low-confidence threads (`< 0.75`) for human review, drafts tone-matched replies, lets the assistant stage drafts + context notes for the client, and provides an interactive **Ask AI** inbox copilot.
2. **Executive Client Portal (`/client`):** Presents the executive with *only* open `client_to_reply` items that are not snoozed — each reduced to a 1-line AI takeaway, an explanation of why personal input is needed, contextual one-tap reply chips, pre-staged draft approval with a 5-second undo window, short-intent / voice-dictation expansion, a 30-second spoken brief, snooze-until-tomorrow, and one-click delegation back to the assistant.

### High-Level Architecture

```text
+-------------------------------------------------------------------+
| React 18 + Vite 6 + Tailwind CSS v4 SPA (client/)                 |
|  Login | Onboarding | Assistant Dashboard | Client View | Accounts|
+---------------------------------+---------------------------------+
                                  | JSON over HTTP + Bearer JWT
                                  v
+-------------------------------------------------------------------+
| Express 4 REST Server (server/src/app.js)                         |
|  /api/auth  /api/accounts  /api/conversations  /api/ai            |
|  /api/notifications  /api/health  (+ static client/dist in prod)  |
+----------------+----------------------------------+---------------+
                 |                                  |
                 v                                  v
+---------------------------------+  +------------------------------+
| AI Service (aiService.js)       |  | Mongoose 8 -> MongoDB        |
|  1. Groq (GROQ_API_KEY)         |  |  - MONGODB_URI set -> Atlas  |
|  2. Gemini (GEMINI_API_KEY)     |  |  - Unset -> In-memory server |
|  3. OpenAI (OPENAI_API_KEY)     |  |    cached in .cache/         |
|  4. Built-in Heuristic Fallback |  +------------------------------+
+---------------------------------+
```

### Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Frontend | React 18 (`react-router-dom` v6), Vite 6, Tailwind CSS v4, `lucide-react` | Responsive SPA for Desktop & Mobile (`390px+`) |
| Backend | Node.js (`>=20`, ESM), Express 4, `cors`, `dotenv` | REST API + single-service static SPA delivery |
| Auth | `jsonwebtoken` (7-day JWT), `bcryptjs` | Role-scoped workspace auth (`assistant` vs `client`) |
| Database | MongoDB via `mongoose` 8 + `mongodb-memory-server` 10 | Atlas M0 in production, zero-config local fallback |
| AI Engine | Native `fetch` adapter + deterministic heuristic engine | Zero-SDK multi-provider AI + guaranteed offline fallback |
| Testing | `vitest` + `supertest` | Full API integration suite (`server/tests/api.test.js`) |

---

## 2. Project Directory & Code Structure

```text
F:\Ai powered email dashboard\
|-- .env                        # Local runtime env vars (gitignored)
|-- .env.example                # Documented optional env var template
|-- .gitignore                  # Ignores node_modules, .cache, dist, .env, *.log
|-- .npmrc                      # npm workspace settings
|-- DOCUMENTATION.md            # This technical & usage guide
|-- SECURITY_AUDIT.md           # Security audit findings, risk scenarios & fixes
|-- README.md                   # Quick-start & deployment summary
|-- render.yaml                 # Render Free Web Service Blueprint spec
|-- package.json                # Root npm workspaces & scripts (dev, build, start, test)
|
|-- client/
|   |-- index.html              # HTML shell + metadata
|   |-- vite.config.js          # Vite dev server (:5173) proxying /api -> :5000
|   |-- package.json            # Client dependencies & Vite scripts
|   |-- public/favicon.svg      # Inboxly brand icon
|   `-- src/
|       |-- main.jsx            # React DOM mount
|       |-- index.css           # Tailwind v4 setup + custom utility animations
|       |-- App.jsx             # Router & role-based route guards (AuthGate, Guard)
|       |-- api.js              # Fetch client (Bearer JWT + automatic 401 logout event)
|       |-- auth.jsx            # AuthProvider context (demo, login, register, onboarding)
|       |-- components/
|       |   |-- ui.jsx          # Design tokens, RESP badges, Modal, Drawer, ToastProvider
|       |   |-- ConnectWizard.jsx   # Multi-step Gmail/Outlook/API-key connection wizard
|       |   |-- ThreadList.jsx      # Segment/search list + empty-inbox "Simulate first message" CTA
|       |   |-- ThreadDetail.jsx      # AI insights, ownership history, draft composer & staging
|       |   |-- CopilotDrawer.jsx     # Slide-over "Ask AI" Q&A drawer with thread shortcuts
|       |   |-- SimulateModal.jsx     # Live incoming email & follow-up thread simulator
|       |   `-- NotificationBell.jsx  # Real-time assistant alert dropdown + mark-all-read
|       `-- pages/
|           |-- Login.jsx           # Standard auth + 1-click "Demo as Assistant" / "Demo as Client"
|           |-- Onboarding.jsx      # 2-step first-run assistant intro + inbox wizard
|           |-- Assistant.jsx       # 3-column triage dashboard, KPIs, segments, clear-inbox action
|           |-- Client.jsx          # Focused Executive Client Portal with audio brief & 1-tap cards
|           `-- Accounts.jsx        # Connected mailbox cards, manual sync & disconnect
|
`-- server/
    |-- package.json                # Server dependencies & Vitest script
    |-- vitest.config.js            # Vitest config pinning F: binary cache & heuristic test mode
    |-- tests/api.test.js           # Automated API test suite
    `-- src/
        |-- index.js                # Entry point: loads .env, connects DB, seeds users/accounts, listens
        |-- app.js                  # Express middleware, /api routes, /api/health, client/dist SPA fallback
        |-- config/db.js            # Connects MONGODB_URI or starts local cached MongoMemoryServer
        |-- middleware/
        |   |-- auth.js             # JWT signing (1d HS256, jti + tv revocation, prod guard), requireAuth, requireAssistant, asyncHandler
        |   `-- security.js         # strictCors, securityHeaders (strict CSP, HTTPS-only HSTS), enforceHttps, rate limits, isObjectId
        |-- models/
        |   |-- User.js             # Assistant & linked client profiles (tokenVersion + lockout fields)
        |   |-- RevokedToken.js     # TTL-indexed JWT denylist (`jti`) for immediate server-side logout
        |   |-- EmailAccount.js     # Connected Gmail/Outlook/custom API mailboxes
        |   |-- Conversation.js     # Threads, embedded messages, AI insights, drafts, undo window
        |   `-- Notification.js     # Assistant alerts triggered by triage & client actions
        |-- routes/
        |   |-- authRoutes.js       # /api/auth/*
        |   |-- accountRoutes.js    # /api/accounts/*
        |   |-- conversationRoutes.js # /api/conversations/* (including DELETE / & client-actions)
        |   |-- aiRoutes.js         # /api/ai/query
        |   `-- notificationRoutes.js # /api/notifications/*
        |-- services/
        |   |-- aiService.js        # LLM HTTP transport + heuristic classification/drafting/Q&A
        |   `-- conversationService.js # Ownership reconciliation, snippets, notifications, segment queries
        `-- seed/
            |-- seed.js             # ensureDemoData() (empty inbox by default) & seedAccountInbox()
            `-- seedData.js         # Optional sample email dataset for Connect Wizard / test runs
```

---

## 3. Core Features & Behavior Explained

### A. Smart Reply Ownership Classification
Every incoming or re-analyzed thread is classified into one of three owners:
- **`assistant_to_reply`:** Routine scheduling, rescheduling, logistics, travel itineraries, admin follow-ups, billing/invoices.
- **`client_to_reply`:** Investor/term sheet/equity items, legal documents/NDAs, compensation, keynote invitations, or messages explicitly requesting the executive's personal decision.
- **`no_reply_needed`:** Automated receipts, newsletters, FYI notifications, resolved acknowledgments, or threads where the latest message is already `outbound` (`waiting_response`).

### B. Confidence Thresholds, Review Queue & Manual Overrides
- If `aiConfidence < 0.75`, `needsReview` is automatically set to `true` and surfaced in the **Needs review** sidebar segment and Overview banner.
- When an assistant manually reassigns ownership (`PATCH /api/conversations/:id`), `manualOverride` becomes `true`, `needsReview` clears, and the choice is logged in `responsibilityHistory` (`source: 'assistant'`).
- On subsequent incoming messages in that thread (`reconsider: true`), `applyAnalysis()` in `conversationService.js` preserves the manual override unless the AI reaches high confidence (`>= 0.80`) that ownership changed — preventing oscillation while still reacting to genuine escalations.

### C. Executive Client Portal Low-Friction Features (`/client`)
1. **Filtered Priority Feed:** Queries `GET /api/conversations/client-queue` returning only `responsibility === 'client_to_reply'`, `status === 'open'`, and `snoozedUntil <= now` (or `null`), sorted by importance and staged status.
2. **One-Line Takeaway + Rationale:** Shows `oneLineTakeaway` alongside `clientActionWhy` and an optional `paContextNote` written by the assistant.
3. **Staged Draft + 5-Second Undo:** Assistants can stage a draft via `Stage for client`. Tapping **Approve & send** sends immediately and sets `undoableSendUntil = now + 5000ms`, rendering an active **Undo** toast button (`POST /api/conversations/:id/undo-send`) that reverts the outbound message back to `draftReply`.
4. **Contextual One-Tap Chips:** AI extracts up to 3 `quickActionChips` (`Approve`, `Accept`, `Decline politely`, `Need a call first`, or date confirmation). One click expands the chip prompt into a full reply and sends it.
5. **Quick Intent & Voice Dictation:** A brief prompt (or Web Speech API `SpeechRecognition` dictation) expands via `expandQuickIntentToReply()` into a 2–5 sentence first-person draft for confirmation.
6. **30-Second Audio Brief:** Reads the summarized client queue aloud using the browser's `window.speechSynthesis` API (`audioBrief()`).
7. **Snooze / Hand Back / Mark Handled:**
   - **Later (`snooze`):** Hides the item until `9:00 AM` the next day.
   - **Have assistant handle this (`delegate_to_assistant`):** Reassigns back to `assistant_to_reply` with an optional client note and notifies the assistant.
   - **Mark as handled (`mark_handled`):** Marks conversation `completed`.

### D. Empty-Start Mode & Clearing Messages
- By default (`SEED_DEMO_MESSAGES` unset or not `'true'`), `ensureDemoData()` initializes the demo **Maya Lin** (Assistant) and **Arjun Mehta** (Client) accounts along with two connected mailboxes (`arjun.mehta@gmail.com` and `arjun@lumenlabs.io`) with **0 messages**, so you can send the very first message via **Simulate email** (`POST /api/conversations/simulate`).
- Clicking **Account menu -> Clear all messages** in the Assistant header calls `DELETE /api/conversations`, removing all conversations and notifications for the workspace while preserving connected mailboxes (`syncedCount: 0`).
- Connecting a *brand-new* mailbox inside **Connect inbox** (`POST /api/accounts/connect`) still imports sample threads for exploring multi-mailbox sync. To launch locally with pre-seeded demo threads on both default accounts, set `SEED_DEMO_MESSAGES=true`.

---

## 4. AI Engine Internals (`server/src/services/aiService.js`)

### Provider Selection Order
`activeProvider()` checks environment variables in order:
1. `GROQ_API_KEY` -> Groq OpenAI-compatible endpoint (`GROQ_MODEL`, default `llama-3.3-70b-versatile`)
2. `GEMINI_API_KEY` -> Google Gemini REST endpoint (`GEMINI_MODEL`, default `gemini-2.0-flash`)
3. `OPENAI_API_KEY` -> OpenAI Chat Completions (`OPENAI_MODEL`, default `gpt-4o-mini`)
4. **Fallback (`heuristic`):** Used automatically when no API key is configured, or if a remote LLM call times out (`20s`) or returns a non-2xx HTTP status.

### Deterministic Heuristic Engine
When running in `heuristic` mode:
- **Ownership Scoring:** Counts keyword matches across `SIGNALS.noReply`, `SIGNALS.client` (plus regex dollar-amount boosts like `$20M` / `$20,000`), and `SIGNALS.assistant`, alongside question marks / request verbs and whether the last message is outbound (`waitingOnOthers`).
- **Date & Deadline Extraction:** `extractDates()` scans messages for weekday+time meetings, month+day dates, and deadline phrases (`by Friday`, `by tomorrow`, `EOD`, etc.) to populate `extractedDates` (`meeting` vs `deadline`) and the Overview calendar panel.
- **Drafting & Q&A:** `heuristicDraft()` adapts greetings by tone (`professional`, `concise`, `warm`, `executive`) and `heuristicQuery()` handles natural-language filters (`client attention`, `waiting`, `assistant`, `meetings`, `needs review`, `urgent`, or keyword search).

---

## 5. Data Models (`server/src/models/`)

- **`User` (`User.js`):** `name`, `email` (unique, lowercase), `passwordHash`, `role` (`assistant` | `client`), `assistantId` (links a client to their assistant's workspace), `title`, `onboardingCompleted`, `isDemo`, `voiceTone`.
- **`EmailAccount` (`EmailAccount.js`):** `ownerId`, `clientName`, `clientEmail`, `provider` (`gmail` | `outlook` | `custom_api`), `connectionType` (`oauth_simulated` | `api_key_bridge`), `status`, `lastSyncedAt`, `syncedCount`, `color`.
- **`Conversation` (`Conversation.js`):** `ownerId`, `accountId`, `clientName`, `provider`, `subject`, `participants[]`, `snippet`, embedded `messages[]` (`senderName`, `senderEmail`, `direction`, `body`, `sentAt`), triage fields (`responsibility`, `aiConfidence`, `needsReview`, `manualOverride`, `classificationReason`, `clientActionWhy`, `responsibilityHistory[]`), insights (`oneLineTakeaway`, `aiSummary`, `highlights[]`, `extractedDates[]`, `quickActionChips[]`, `segments[]`), workflow state (`status`: `open` | `waiting_response` | `completed` | `archived`, `isUnread`, `isImportant`, `stagedForClient`, `paContextNote`, `snoozedUntil`, `undoableSendUntil`, `draftReply`, `delegatedByClientNote`, `lastMessageAt`).
- **`Notification` (`Notification.js`):** `ownerId`, `conversationId`, `type` (`client_delegated` | `client_handled` | `client_sent` | `needs_review` | `new_client_item` | `info`), `title`, `body`, `read`.

---

## 6. REST API Reference

All `/api/*` endpoints except `/api/health`, `/api/auth/register`, `/api/auth/login`, and `/api/auth/demo` require `Authorization: Bearer <token>`.

### System & Auth
| Method & Path | Access | Description |
|---|---|---|
| `GET /api/health` | Public | Returns `{ ok: true, ai, time }` (`ai` is active provider) |
| `POST /api/auth/register` | Public | Create assistant account (`{ name, email, password }`) -> `{ token, user }` |
| `POST /api/auth/login` | Public | Email/password login (`{ email, password }`, per-account lockout) |
| `POST /api/auth/logout` | Auth | Revokes active session token (`jti` denylist; `allSessions=true` bumps `tokenVersion`) |
| `POST /api/auth/change-password` | Auth | Verifies current password, updates hash, bumps `tokenVersion`, returns fresh token |
| `POST /api/auth/demo` | Public | 1-click demo session (`{ role: 'assistant' | 'client' }`) |
| `GET /api/auth/me` | Auth | Returns current user profile |
| `PATCH /api/auth/onboarding` | Auth | Marks `onboardingCompleted = true` |

### Mailboxes & Notifications
| Method & Path | Access | Description |
|---|---|---|
| `GET /api/accounts` | Assistant | Lists connected mailboxes with live `totalCount` & `unreadCount` |
| `POST /api/accounts/connect` | Assistant | Connects simulated Gmail/Outlook/API mailbox & imports sample threads |
| `POST /api/accounts/:id/sync` | Assistant | Updates `lastSyncedAt` and refreshes counts |
| `DELETE /api/accounts/:id` | Assistant | Removes mailbox and its conversations |
| `GET /api/notifications` | Assistant | Latest 25 notifications + `unread` count |
| `PATCH /api/notifications/read-all` | Assistant | Marks all unread notifications read |

### Conversations, Client Actions & AI
| Method & Path | Access | Description |
|---|---|---|
| `GET /api/conversations` | Assistant | Filters by `segment`, `accountId`, `search`, `needsReview`; returns `{ items, stats, upcoming }` |
| `DELETE /api/conversations` | Assistant | Clears all conversations & notifications for workspace; resets `syncedCount: 0` |
| `GET /api/conversations/client-queue` | Auth | Returns `{ clientName, items, snoozedCount, handledCount, audioBriefText }` |
| `GET /api/conversations/:id` | Auth | Full thread detail with embedded messages (`403` if client accesses non-client or archived thread) |
| `PATCH /api/conversations/:id` | Assistant | Override `responsibility`, `status`, `isImportant`, `isUnread`, `stagedForClient`, `paContextNote`, `draftBody` |
| `POST /api/conversations/:id/reply` | Assistant | Sends explicit assistant reply, transitions thread to `waiting_response` |
| `POST /api/conversations/simulate` | Assistant | Injects a new thread or follow-up message, runs AI classification + notifications |
| `POST /api/conversations/:id/reanalyze` | Assistant | Re-runs AI analysis on the full thread |
| `POST /api/conversations/:id/draft` | Assistant | Generates AI draft in `{ tone, instruction, asClient }` |
| `POST /api/conversations/:id/client-action` | Auth | Executes `approve_and_send`, `quick_chip`, `quick_intent`, `snooze`, `mark_handled`, `delegate_to_assistant` |
| `POST /api/conversations/:id/undo-send` | Auth | Reverts client reply back to staged draft within the 5-second window |
| `POST /api/ai/query` | Assistant | Natural-language inbox Q&A (`{ question, conversationId? }`) |

---

## 7. Usage Guide (Local & Live)

### Running Locally on `F:` (Zero-Config)
All dependencies, npm cache, and MongoDB binaries are isolated inside `F:\Ai powered email dashboard` (`.cache/`).

```powershell
# Prepend F: Node/Git if your default shell resolves another installation
$env:Path = "F:\DevTools\NodeJS;F:\DevTools\Git\cmd;" + $env:Path
cd "F:\Ai powered email dashboard"

npm test         # Runs server Vitest suite (in-memory MongoDB)
npm run build    # Builds React SPA into client/dist
npm start        # Starts unified server on http://localhost:5000
```

For concurrent hot-reloading during development (`:5173` Vite + `:5000` Express):

```powershell
npm run dev
```

### Sending Your First Message & Testing Both Views
1. Open the app (`http://localhost:5000` locally or `https://ai-powered-email-dashboard.onrender.com` live) and click **Demo as Assistant**.
2. With an empty inbox, click **Simulate first message** (or **Simulate email** in the top bar).
3. Choose a preset (for example *Investor decision* or *Scheduling request*) or write a custom sender, subject, and body, then click **Deliver email**.
4. Inspect the AI classification, confidence score, extracted deadlines, and generated summary.
5. For `client_to_reply` items, add an optional note or draft and click **Stage for client**, then switch to **Account menu -> Switch to Client view** (`/client`) to test one-tap approval, Undo, quick intent, snooze, or delegation back to the assistant.
6. To wipe all threads and restart from zero messages at any time, open **Account menu -> Clear all messages**.

### Environment Variables & Free Cloud Deployment

| Variable | Required? | Purpose |
|---|---|---|
| `PORT` | Optional (default `5000`) | HTTP listen port (`10000` injected automatically by Render) |
| `JWT_SECRET` | Recommended in prod | Secret key for signing 7-day JWT sessions |
| `MONGODB_URI` | Prod / Atlas | MongoDB Atlas URI; if omitted locally, `db.js` runs cached `MongoMemoryServer` |
| `SEED_DEMO_MESSAGES` | Optional (`'true'`) | Pre-seeds 13 sample threads on a fresh demo DB when set to `'true'` |
| `ALLOWED_ORIGINS` | Optional | Comma-separated allowlist of extra CORS origins permitted for cross-origin API calls |
| `DISABLE_DEMO_LOGIN` | Optional (`'true'`) | Disables public one-click `POST /api/auth/demo` login in hardened deployments |
| `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENAI_API_KEY` | Optional | Enables live LLM inference (falls back to built-in `heuristic` engine when empty) |

See [render.yaml](file:///F:/Ai%20powered%20email%20dashboard/render.yaml) for the Render Free Web Service Blueprint (`npm install --include=dev && npm run build` and `npm start`).
