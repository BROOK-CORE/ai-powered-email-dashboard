# AI-Powered Email Management Dashboard (MERN)

Autonomous Personal Assistant & Executive Client email triage workspace built with MongoDB, Express, React, and Node.js.

- **Full Technical & Usage Documentation:** See [DOCUMENTATION.md](./DOCUMENTATION.md) for architecture diagrams, complete code/file breakdown, file location index, AI classification rules, Mongoose schemas, REST API reference, and step-by-step usage instructions.
- **Security Audit & Fixes Report:** See [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) for all audited security findings, concrete attack risks, code changes applied, and verification status.

## Key Features

1. **Executive Client Portal (`/client`):**
   - Categorized queues: **Immediate Action Required**, **Important**, **Waiting for Response**, **AI to Reply**, and custom categories.
   - Unrestricted exploration across active threads without artificial barriers.
   - 1-tap chip actions, 5-second undoable send window, voice dictation, and 30-second audio briefs.
   - On-card category reassignment and 1-click routing rule creation.
2. **Auto-Routing Engine & Custom Categories:**
   - Define custom categories with custom color tokens (e.g., *VIP Investors*, *Board Updates*, *Legal*).
   - Match rules by **Sender Email**, **Domain**, or **Subject Keywords** to auto-route incoming emails.
3. **Workspace Settings & Customization (`/settings`):**
   - **Mailbox ID Management:** Safely unlink and delete any connected mailbox identity.
   - **End-to-End Encryption (E2E):** AES-256-GCM symmetric encryption for message bodies and drafts at rest.
   - **Assistant Company Verifier:** Corporate verification form issuing cold authorization emails to HR with secure verification tokens.
   - **Dark & Light Mode:** Global theme switcher with local and profile persistence.
4. **Super Admin Dashboard for `iambrook2007@gmail.com`:**
   - Automatic super-admin privileges granting full user management, assistant credential verification approvals, cross-workspace mailbox deletion, and real-time system metrics.
5. **Assistant Command Center (`/assistant`):**
   - 3-column triage workspace, 7-card Geist Mono KPI strip, Copilot slide-over ("Ask AI"), live email simulator, and instant mailbox sync.

## Local Setup (Self-Contained on `F:`)

```bash
npm install
npm test
npm run build
npm start
```

Open `http://localhost:5000`.

- **Starts clean for your first message:** Demo mode initializes the Assistant (`Maya Lin`), Executive Client (`Arjun Mehta`), and two connected mailboxes (`arjun.mehta@gmail.com` & `arjun@lumenlabs.io`) with an empty inbox so you can send the first message immediately via **Simulate email** (use `SEED_DEMO_MESSAGES=true` if you want pre-populated sample threads on a fresh DB, or **Account menu -> Clear all messages** anytime).
- **Zero-config database:** When `MONGODB_URI` is blank, the server automatically runs `mongodb-memory-server` (cached locally in `.cache/mongodb-binaries`).
- **AI Engine:** Uses `GROQ_API_KEY`, `GEMINI_API_KEY`, or `OPENAI_API_KEY` if configured, and automatically falls back to a deterministic built-in heuristic engine when no external key is set.
- **Demo Logins:** Click **Demo as Assistant** or **Demo as Client** on the login screen.

## Free Cloud Deployment (Render + MongoDB Atlas M0)

1. Create a free **MongoDB Atlas M0** cluster, allow `0.0.0.0/0` in Network Access, create a database user, and copy the `MONGODB_URI` connection string.
2. Push this repository to GitHub.
3. On **Render**, click **New + -> Blueprint** (uses `render.yaml`) or create a **Free Web Service**:
   - **Build Command:** `npm install --include=dev && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Environment Variables:** `NODE_ENV=production`, `JWT_SECRET=<random string>`, `MONGODB_URI=<your Atlas URI>`, and optionally `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENAI_API_KEY`.
