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
|       |-- index.css           # Tailwind v4 setup + dark mode tokens & utility animations
|       |-- theme.jsx           # ThemeProvider, ThemeToggle & dark/light persistence
|       |-- App.jsx             # Router, ThemeProvider wrap & role-based route guards (AuthGate, Guard)
|       |-- api.js              # Fetch client (Bearer JWT + automatic 401 logout event)
|       |-- auth.jsx            # AuthProvider context (demo, login, register, onboarding)
|       |-- components/
|       |   |-- ui.jsx          # Design tokens, RESP badges, Modal, Drawer, ToastProvider
|       |   |-- ConnectWizard.jsx   # Multi-step Gmail/Outlook/API-key connection wizard
|       |   |-- RuleManagerModal.jsx# Client & assistant auto-routing rule + custom category modal
|       |   |-- ThreadList.jsx      # Segment/search list + empty-inbox "Simulate first message" CTA
|       |   |-- ThreadDetail.jsx    # AI insights, ownership history, draft composer & staging
|       |   |-- CopilotDrawer.jsx   # Slide-over "Ask AI" Q&A drawer with thread shortcuts
|       |   |-- SimulateModal.jsx   # Live incoming email & follow-up thread simulator
|       |   `-- NotificationBell.jsx# Real-time assistant alert dropdown + mark-all-read
|       `-- pages/
|           |-- Login.jsx           # Standard auth + 1-click "Demo as Assistant" / "Demo as Client"
|           |-- Onboarding.jsx      # 2-step first-run assistant intro + inbox wizard
|           |-- Assistant.jsx       # 3-column triage dashboard, KPIs, custom categories, verification banner
|           |-- Client.jsx          # Categorized views (Action, Important, Waiting, AI Reply), rules, 1-tap cards
|           |-- Accounts.jsx        # Connected mailbox cards, manual sync & disconnect
|           `-- Settings.jsx        # Dedicated Settings: Disconnect ID, E2E toggle, Assistant verifier, Super Admin
|
`-- server/
    |-- package.json                # Server dependencies & Vitest script
    |-- vitest.config.js            # Vitest config pinning F: binary cache & heuristic test mode
    |-- tests/api.test.js           # Automated API test suite (28 passing tests)
    `-- src/
        |-- index.js                # Entry point: loads .env, connects DB, seeds users/accounts, listens
        |-- app.js                  # Express middleware, /api routes, /api/health, client/dist SPA fallback
        |-- config/db.js            # Connects MONGODB_URI or starts local cached MongoMemoryServer
        |-- middleware/
        |   |-- auth.js             # JWT signing, requireAuth, requireAssistant, requireAdmin, asyncHandler
        |   `-- security.js         # strictCors, securityHeaders (strict CSP, HSTS), rate limits, isObjectId
        |-- models/
        |   |-- User.js             # User profiles, super-admin (iambrook2007), employee verifier fields, theme
        |   |-- ClientRule.js       # Auto-routing rules (sender, domain, subject keywords -> target category)
        |   |-- CustomCategory.js   # User-defined categories (name, slug, color, icon)
        |   |-- RevokedToken.js     # TTL-indexed JWT denylist (`jti`) for immediate server-side logout
        |   |-- EmailAccount.js     # Connected Gmail/Outlook/custom API mailboxes + credentials
        |   |-- Conversation.js     # Threads, embedded messages, customCategory, isEncrypted flag
        |   `-- Notification.js     # Assistant alerts triggered by triage & client actions
        |-- routes/
        |   |-- authRoutes.js       # /api/auth/*
        |   |-- accountRoutes.js    # /api/accounts/*
        |   |-- conversationRoutes.js # /api/conversations/* (with client-queue categories & E2E decryption)
        |   |-- ruleRoutes.js       # /api/rules/* (CRUD for rules & custom categories)
        |   |-- adminRoutes.js      # /api/admin/* (employee verifier, user prefs, super-admin panel)
        |   |-- aiRoutes.js         # /api/ai/query
        |   `-- notificationRoutes.js # /api/notifications/*
        |-- services/
        |   |-- aiService.js        # LLM HTTP transport + heuristic classification/drafting/Q&A
        |   |-- encryptionService.js# AES-256-GCM symmetric encryption for email bodies and drafts at rest
        |   |-- conversationService.js # Triage engine with applyClientRules() integration
        |   `-- securityLogger.js   # Redacted JSON security logger, request IDs & threshold alerting
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

### E. Client Categorized Views & Removal of Restrictions (`/client`)
1. **Unrestricted Exploration:** Removed the legacy block so clients are never locked out of other active inbox threads. Clients can navigate across all open threads and review categorized groupings.
2. **Dedicated Category Tabs:**
   - **Immediate Action Required (`action_required`):** Urgent contracts, term sheets, compensation approvals, and items with impending deadlines.
   - **Important (`important`):** High-priority executive updates, key stakeholder messages, and starred items.
   - **Waiting for Response (`waiting_response`):** Outbound threads awaiting a reply from third parties.
   - **AI to Reply (`ai_reply`):** Low-touch logistics and scheduling where the assistant or AI has composed an automated draft ready for one-tap dispatch.
   - **User Custom Categories:** Any custom categories created by the client or assistant appear dynamically in the tab strip with active counters.
3. **Card Quick Actions:**
   - **Reassign Category:** Change the category of a conversation directly on the card with instant persistence (`POST /api/conversations/:id/client-action` with `{ action: 'assign_category', customCategory: '...' }`).
   - **Create Quick Rule:** Turn any sender or subject into an automated routing rule with one click (`+ Rule`).

### F. Auto-Routing Rules & Custom Categories Engine
1. **Custom Category Model (`CustomCategory.js`):**
   - Enables defining arbitrary executive categories (e.g., *VIP Investors*, *Board Updates*, *Legal & Compliance*, *Press & Media*).
   - Each category carries `name`, unique URL-safe `slug`, hex `color` token, and `icon`.
2. **Client Rule Engine (`ClientRule.js`):**
   - Rules match incoming emails by:
     - `from_email`: Exact sender email (e.g. `partner@sequoia.com`).
     - `domain`: Sender domain (e.g. `@stripe.com`).
     - `subject_contains`: Keywords in email subject (e.g. `urgent`, `Q4 audit`).
   - Automatic Action: Directs match to `targetCategory` (e.g. `important`, `action_required`, or a custom category slug) and sets responsibility (`client_to_reply`, `assistant_to_reply`, `no_reply_needed`).
3. **AI Triage Integration (`applyClientRules()` in `conversationService.js`):**
   - Runs before and after AI classification. If a rule matches, its `targetCategory` and `responsibility` override the AI default with high confidence (`0.95`).
   - Works seamlessly in both live IMAP ingestion and email simulation (`SimulateModal.jsx`).

### G. Dedicated Settings & Customization Page (`/settings`)
Accessible to both assistants and clients at `/settings` with dedicated tabs:
1. **Remove Connected Mailbox IDs:** View all connected inboxes with their sync status and disconnect/delete any identity permanently.
2. **End-to-End Encryption (E2E) at Rest:**
   - Toggle switch enabling AES-256-GCM encryption (`encryptionService.js`).
   - When enabled, message bodies, snippets, and drafts are encrypted with a 256-bit key before writing to MongoDB.
   - Automatically decrypted on read for authorized client and assistant sessions.
3. **Dark & Light Mode Toggle:** Global theme switch persisted in `localStorage` and user preferences (`theme.jsx`), styling surfaces with crisp Tailwind `.dark` tokens.
4. **Rule Manager Modal:** View active rules, toggle active/inactive status, delete rules, or create new routing rules and custom categories.

### H. Assistant Company Credential Verifier
1. **Corporate Verification Form:**
   - Available in `/settings` under the **Verification** tab.
   - Requests **Company Name**, **Employee ID (`empId`)**, and **Company Work Email (`companyEmail`)**.
2. **Cold Email Authorization Flow:**
   - Submitting the form calls `POST /api/admin/request-verification`.
   - Generates a crypto-random `verificationToken` and simulates dropping a cold verification email to the company's HR/IT department (`companyEmail`).
   - The verification email includes an authorization link: `GET /api/admin/confirm-employee/:token`.
   - The assistant's account status transitions to `pending`, displaying a pending verification banner in the Assistant dashboard until verified.
3. **Confirmation & Badges:**
   - Clicking the authorization link or approving via Super Admin verifies the assistant (`verificationStatus = 'verified'`), granting an enterprise verification badge.

### I. Super Admin Privileges for `iambrook2007@gmail.com`
1. **Automatic Super-Admin Elevation:**
   - Any user logging in with `iambrook2007@gmail.com` is automatically granted `isAdmin: true` via pre-save hook in `User.js` and protected by `requireAdmin` middleware.
2. **Super Admin Dashboard (`/settings` -> Admin tab):**
   - **System Overview:** Total users, total active conversations, connected mailboxes, and pending verifications.
   - **Assistant Credential Approvals:** One-click review, approve, or reject employee verification requests.
   - **Workspace Mailbox Management:** Ability to disconnect/delete any mailbox account system-wide for security governance.
   - **Audit Logs:** Real-time visibility into authentication events and security alerts.

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

- **`User` (`User.js`):**
  - Core: `name`, `email` (unique, lowercase), `passwordHash`, `role` (`assistant` | `client`), `assistantId` (links client to assistant's workspace), `title`, `onboardingCompleted`, `isDemo`, `voiceTone`.
  - Super Admin: `isAdmin` (boolean, auto-assigned `true` for `iambrook2007@gmail.com`).
  - Assistant Company Verification: `companyName`, `employeeId`, `companyEmail`, `verificationStatus` (`unverified` | `pending` | `verified` | `rejected`), `verificationToken`, `verificationSentAt`, `verifiedAt`.
  - Preferences: `themePreference` (`light` | `dark`), `e2eEncryptionEnabled` (boolean, default `true`).
- **`ClientRule` (`ClientRule.js`):** `ownerId`, `matchType` (`from_email` | `domain` | `subject_contains`), `matchValue`, `targetCategory` (slug of target category or system category), `action` (`assign_category` | `set_responsibility`), `responsibility` (`client_to_reply` | `assistant_to_reply` | `no_reply_needed`), `isActive`, `priority`.
- **`CustomCategory` (`CustomCategory.js`):** `ownerId`, `name`, `slug` (unique per owner), `color` (hex token), `description`, `icon`.
- **`EmailAccount` (`EmailAccount.js`):** `ownerId`, `clientName`, `clientEmail`, `provider` (`gmail` | `outlook` | `custom_api`), `connectionType` (`oauth_simulated` | `api_key_bridge`), `status`, `lastSyncedAt`, `syncedCount`, `color`.
- **`Conversation` (`Conversation.js`):** `ownerId`, `accountId`, `clientName`, `provider`, `subject`, `participants[]`, `snippet`, embedded `messages[]` (`senderName`, `senderEmail`, `direction`, `body`, `sentAt`), `customCategory` (slug linking to a `CustomCategory`), `isEncrypted` (boolean flag denoting AES-256-GCM encrypted message bodies at rest), triage fields (`responsibility`, `aiConfidence`, `needsReview`, `manualOverride`, `classificationReason`, `clientActionWhy`, `responsibilityHistory[]`), insights (`oneLineTakeaway`, `aiSummary`, `highlights[]`, `extractedDates[]`, `quickActionChips[]`, `segments[]`), workflow state (`status`: `open` | `waiting_response` | `completed` | `archived`, `isUnread`, `isImportant`, `stagedForClient`, `paContextNote`, `snoozedUntil`, `undoableSendUntil`, `draftReply`, `delegatedByClientNote`, `lastMessageAt`).
- **`Notification` (`Notification.js`):** `ownerId`, `conversationId`, `type` (`client_delegated` | `client_handled` | `client_sent` | `needs_review` | `new_client_item` | `info`), `title`, `body`, `read`.

---

## 6. REST API Reference

All `/api/*` endpoints except `/api/health`, `/api/auth/register`, `/api/auth/login`, `/api/auth/demo`, and `/api/admin/confirm-employee/:token` require `Authorization: Bearer <token>`.

### System & Auth
| Method & Path | Access | Description |
|---|---|---|
| `GET /api/health` | Public | Returns `{ ok: true, ai, time }` (`ai` is active provider) |
| `POST /api/auth/register` | Public | Create assistant account (`{ name, email, password }`) -> `{ token, user }` |
| `POST /api/auth/login` | Public | Email/password login (`{ email, password }`, per-account lockout) |
| `POST /api/auth/logout` | Auth | Revokes active session token (`jti` denylist; `allSessions=true` bumps `tokenVersion`) |
| `POST /api/auth/change-password` | Auth | Verifies current password, updates hash, bumps `tokenVersion`, returns fresh token |
| `POST /api/auth/demo` | Public | 1-click demo session (`{ role: 'assistant' | 'client' }`) |
| `GET /api/auth/me` | Auth | Returns current user profile (including `isAdmin`, `verificationStatus`, preferences) |
| `PATCH /api/auth/onboarding` | Auth | Marks `onboardingCompleted = true` |

### Mailboxes & Notifications
| Method & Path | Access | Description |
|---|---|---|
| `GET /api/accounts` | Assistant | Lists connected mailboxes with live `totalCount` & `unreadCount` |
| `POST /api/accounts/connect` | Assistant | Connects simulated Gmail/Outlook/API mailbox & imports sample threads |
| `POST /api/accounts/:id/sync` | Assistant | Updates `lastSyncedAt` and refreshes counts |
| `DELETE /api/accounts/:id` | Assistant / Client | Removes mailbox and its conversations from the workspace |
| `GET /api/notifications` | Assistant | Latest 25 notifications + `unread` count |
| `PATCH /api/notifications/read-all` | Assistant | Marks all unread notifications read |

### Conversations, Client Actions & AI
| Method & Path | Access | Description |
|---|---|---|
| `GET /api/conversations` | Assistant | Filters by `segment`, `accountId`, `search`, `needsReview`; returns `{ items, stats, upcoming }` with automatic message decryption |
| `DELETE /api/conversations` | Assistant | Clears all conversations & notifications for workspace; resets `syncedCount: 0` |
| `GET /api/conversations/client-queue` | Auth | Supports `?category=` filter (`all`, `action_required`, `important`, `waiting_response`, `ai_reply`, or custom category slug); returns `{ clientName, items, total, actionRequiredCount, importantCount, waitingResponseCount, aiReplyCount, audioBriefText }` |
| `GET /api/conversations/:id` | Auth | Full thread detail with decrypted embedded messages |
| `PATCH /api/conversations/:id` | Assistant | Override `responsibility`, `status`, `isImportant`, `isUnread`, `stagedForClient`, `customCategory`, `paContextNote`, `draftBody` |
| `POST /api/conversations/:id/reply` | Assistant | Sends explicit assistant reply, transitions thread to `waiting_response` |
| `POST /api/conversations/simulate` | Assistant | Injects a new thread or follow-up message, runs client rule matching + AI classification |
| `POST /api/conversations/:id/reanalyze` | Assistant | Re-runs AI analysis and client rules on the full thread |
| `POST /api/conversations/:id/draft` | Assistant | Generates AI draft in `{ tone, instruction, asClient }` |
| `POST /api/conversations/:id/client-action` | Auth | Executes `approve_and_send`, `quick_chip`, `quick_intent`, `snooze`, `mark_handled`, `delegate_to_assistant`, or `assign_category` (`{ customCategory }`) |
| `POST /api/conversations/:id/undo-send` | Auth | Reverts client reply back to staged draft within the 5-second window |
| `POST /api/ai/query` | Assistant | Natural-language inbox Q&A (`{ question, conversationId? }`) |

### Auto-Routing Rules & Custom Categories (`/api/rules`)
| Method & Path | Access | Description |
|---|---|---|
| `GET /api/rules` | Auth | List all client/assistant auto-routing rules for the active workspace |
| `POST /api/rules` | Auth | Create a new routing rule (`{ matchType, matchValue, targetCategory, action, responsibility }`) |
| `PATCH /api/rules/:id` | Auth | Update rule active status or configuration |
| `DELETE /api/rules/:id` | Auth | Delete a routing rule |
| `GET /api/rules/categories` | Auth | List all custom categories for the workspace |
| `POST /api/rules/categories` | Auth | Create a custom category (`{ name, color, description, icon }`) |
| `DELETE /api/rules/categories/:id` | Auth | Delete a custom category |

### Admin & Verification (`/api/admin`)
| Method & Path | Access | Description |
|---|---|---|
| `GET /api/admin/confirm-employee/:token` | Public | HR confirmation callback from cold verification email; marks assistant `verified` |
| `POST /api/admin/request-verification` | Auth (Assistant) | Submits `{ companyName, employeeId, companyEmail }` and dispatches cold email |
| `GET /api/admin/preferences` | Auth | Returns user preferences (`{ themePreference, e2eEncryptionEnabled, verificationStatus }`) |
| `PATCH /api/admin/preferences` | Auth | Updates user preferences (`{ themePreference, e2eEncryptionEnabled }`) |
| `GET /api/admin/system-overview` | Super Admin (`iambrook2007@gmail.com`) | Returns global system stats, all registered users, mailboxes, and pending verifications |
| `POST /api/admin/verify-user/:userId` | Super Admin | Approves or rejects assistant employee verification (`{ status: 'verified' | 'rejected' }`) |
| `DELETE /api/admin/accounts/:id` | Super Admin | Permanently unlinks/deletes any mailbox across any user workspace |

---

## 7. File Locations & Where Changes Live

The table below maps every feature request directly to the exact file paths modified or created:

| Feature / Area | Exact File Path(s) | Role & Description |
|---|---|---|
| **Client Categorized Inbox** | [`client/src/pages/Client.jsx`](file:///F:/Ai%20powered%20email%20dashboard/client/src/pages/Client.jsx) | Tabbed navigation for `Immediate Action Required`, `Important`, `Waiting for Response`, `AI to Reply`, and custom categories; card reassign & quick-rule triggers. |
| **Client Queue API & Stats** | [`server/src/routes/conversationRoutes.js`](file:///F:/Ai%20powered%20email%20dashboard/server/src/routes/conversationRoutes.js) | Category filter query, breakdown stats counters, and `assign_category` handler. |
| **Routing Rules Model** | [`server/src/models/ClientRule.js`](file:///F:/Ai%20powered%20email%20dashboard/server/src/models/ClientRule.js) | Schema for email/domain/subject rule matchers and target categories. |
| **Custom Category Model** | [`server/src/models/CustomCategory.js`](file:///F:/Ai%20powered%20email%20dashboard/server/src/models/CustomCategory.js) | Schema for user-defined categories (name, slug, color, icon). |
| **Rule & Category API** | [`server/src/routes/ruleRoutes.js`](file:///F:/Ai%20powered%20email%20dashboard/server/src/routes/ruleRoutes.js) | CRUD endpoints mounted at `/api/rules`. |
| **Triage Rules Engine** | [`server/src/services/conversationService.js`](file:///F:/Ai%20powered%20email%20dashboard/server/src/services/conversationService.js) | `applyClientRules()` function matching incoming threads against rules before AI triage. |
| **Rule Manager UI** | [`client/src/components/RuleManagerModal.jsx`](file:///F:/Ai%20powered%20email%20dashboard/client/src/components/RuleManagerModal.jsx) | Modal to manage auto-routing rules and custom categories. |
| **Settings & Customization Page** | [`client/src/pages/Settings.jsx`](file:///F:/Ai%20powered%20email%20dashboard/client/src/pages/Settings.jsx) | Unified settings view: Remove Mailbox ID, E2E toggle, Assistant Verifier form, Rules, and Super Admin dashboard. |
| **Theme / Dark & Light Mode** | [`client/src/theme.jsx`](file:///F:/Ai%20powered%20email%20dashboard/client/src/theme.jsx)<br>[`client/src/index.css`](file:///F:/Ai%20powered%20email%20dashboard/client/src/index.css) | `ThemeProvider`, `ThemeToggle` component, and Tailwind `.dark` CSS tokens. |
| **End-to-End Encryption (E2E)** | [`server/src/services/encryptionService.js`](file:///F:/Ai%20powered%20email%20dashboard/server/src/services/encryptionService.js) | AES-256-GCM symmetric encryption for message bodies and drafts at rest. |
| **Assistant Verifier Flow** | [`server/src/routes/adminRoutes.js`](file:///F:/Ai%20powered%20email%20dashboard/server/src/routes/adminRoutes.js)<br>[`server/src/models/User.js`](file:///F:/Ai%20powered%20email%20dashboard/server/src/models/User.js) | Cold verification email dispatch, crypto token generation, and confirmation callback. |
| **Super Admin Elevation** | [`server/src/models/User.js`](file:///F:/Ai%20powered%20email%20dashboard/server/src/models/User.js)<br>[`server/src/middleware/auth.js`](file:///F:/Ai%20powered%20email%20dashboard/server/src/middleware/auth.js) | Automatic super-admin privileges for `iambrook2007@gmail.com` and `requireAdmin` guard. |
| **Assistant Workspace View** | [`client/src/pages/Assistant.jsx`](file:///F:/Ai%20powered%20email%20dashboard/client/src/pages/Assistant.jsx) | Added ThemeToggle, Settings shortcut, employer verification banner, and custom categories in sidebar. |
| **Router & Route Guards** | [`client/src/App.jsx`](file:///F:/Ai%20powered%20email%20dashboard/client/src/App.jsx) | Wrapped with `ThemeProvider`, added `/settings` route guarded for clients and assistants. |
| **Automated Tests** | [`server/tests/api.test.js`](file:///F:/Ai%20powered%20email%20dashboard/server/tests/api.test.js) | 28 automated tests covering rules, categories, verification tokens, admin, and encryption. |

---

## 8. Usage Guide (Local & Live)

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
| `JWT_SECRET` | Recommended in prod | Secret key for signing 1-day JWT sessions |
| `MONGODB_URI` | Prod / Atlas | MongoDB Atlas URI; if omitted locally, `db.js` runs cached `MongoMemoryServer` |
| `SEED_DEMO_MESSAGES` | Optional (`'true'`) | Pre-seeds 13 sample threads on a fresh demo DB when set to `'true'` |
| `ALLOWED_ORIGINS` | Optional | Comma-separated allowlist of extra CORS origins permitted for cross-origin API calls |
| `DISABLE_DEMO_LOGIN` | Optional (`'true'`) | Disables public one-click `POST /api/auth/demo` login in hardened deployments |
| `LOG_SALT` | Optional | Salt used for pseudonymous HMAC correlation hashes (`ipHash`, `emailHash`) in security logs |
| `SECURITY_ALERT_WEBHOOK_URL` | Optional (`https://`) | Webhook URL to receive JSON payloads whenever an alert threshold fires |
| `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENAI_API_KEY` | Optional | Enables live LLM inference (falls back to built-in `heuristic` engine when empty) |

See [render.yaml](file:///F:/Ai%20powered%20email%20dashboard/render.yaml) for the Render Free Web Service Blueprint (`npm install --include=dev && npm run build` and `npm start`).
