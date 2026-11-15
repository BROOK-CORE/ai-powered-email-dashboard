# AI-Powered Email Management Dashboard (MERN)

Personal Assistant & Executive Client email triage workspace built with MongoDB, Express, React, and Node.js.

- **Full Technical & Usage Documentation:** See [DOCUMENTATION.md](./DOCUMENTATION.md) for architecture diagrams, complete code/file breakdown, AI classification rules, Mongoose schemas, REST API reference, and step-by-step usage instructions.

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
