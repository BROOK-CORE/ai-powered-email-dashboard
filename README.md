# AI-Powered Email Management Dashboard (MERN)

Personal Assistant & Executive Client email triage workspace built with MongoDB, Express, React, and Node.js.

## Local Setup (100% self-contained)

```bash
npm install
npm test
npm run build
npm start
```

Open `http://localhost:5000`.

- **Zero-config database:** When `MONGODB_URI` is blank, the server automatically runs `mongodb-memory-server` (cached locally in `.cache/mongodb-binaries`) and seeds realistic executive inbox data.
- **AI Engine:** Uses `GROQ_API_KEY`, `GEMINI_API_KEY`, or `OPENAI_API_KEY` if provided, and automatically falls back to a deterministic built-in classifier/drafter when no external key is set.
- **Demo Logins:** Click **Demo as Assistant** or **Demo as Client** on the login screen (no password setup needed).

## Free Cloud Deployment (Render + MongoDB Atlas M0)

1. Create a free **MongoDB Atlas M0** cluster, allow `0.0.0.0/0` in Network Access, and copy the `MONGODB_URI` connection string.
2. Push this repository to GitHub (or connect it to Render).
3. On **Render**, click **New + -> Blueprint** (uses `render.yaml`) or create a **Free Web Service**:
   - **Build Command:** `npm install --include=dev && npm run build`
   - **Start Command:** `npm start`
   - **Environment Variables:** `NODE_ENV=production`, `JWT_SECRET=<random string>`, `MONGODB_URI=<your Atlas URI>`, and optionally `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENAI_API_KEY`.
