# Security Audit & Remediation Report — Inboxly (`F:\Ai powered email dashboard`)

**Target Application:** Inboxly — AI-Powered Email Management Dashboard (MERN stack: Express 4 API + React 18 SPA + MongoDB/Mongoose)  
**Audit Scope:** Full source code & configuration audit (`server/`, `client/`, `render.yaml`, `.env.example`, `.gitignore`, git history) plus live HTTP security header findings from the **SecureScanr** scan of `https://ai-powered-email-dashboard.onrender.com` (initial grade **F 0/100**).  
**Status:** Vulnerabilities identified, explained, fixed across the backend/frontend codebase, and verified with automated regression tests (`20/20` passing in Vitest + production Vite build).

---

## Executive Summary

| ID | Finding | Category | Severity | Fix Status |
|---|---|---|---|---|
| SEC-01 | Missing `Content-Security-Policy` (CSP) header | Configuration / XSS | **Critical** | **Fixed** |
| SEC-02 | Missing `Strict-Transport-Security` (HSTS) header | Configuration / TLS | **Critical** | **Fixed** |
| SEC-03 | Client role privilege escalation & IDOR on `GET /:id`, `POST /:id/client-action`, `POST /:id/undo-send` | AuthZ / IDOR | **High** | **Fixed** |
| SEC-04 | Hardcoded fallback JWT secret (`'dev-only-secret-change-me'`) & unpinned JWT algorithm | Auth / Session | **High** | **Fixed** |
| SEC-05 | Wildcard CORS policy (`Access-Control-Allow-Origin: *`) | Configuration / CSRF | **High** | **Fixed** |
| SEC-06 | Missing `X-Content-Type-Options` & `X-Frame-Options` headers | Configuration | **Medium** | **Fixed** |
| SEC-07 | NoSQL operator injection & missing type/ObjectId validation (`accountId`, `req.body`, query parser) | Input Handling | **Medium** | **Fixed** |
| SEC-08 | Missing rate limiting on auth & AI endpoints | Auth / Availability | **Medium** | **Fixed** |
| SEC-09 | JWT stored in browser `localStorage` instead of `HttpOnly` cookie | Session Handling | **Medium** | **Documented + CSP Mitigated** |
| SEC-10 | Unauthenticated public `/api/auth/demo` sandbox access & weak password minimum (`6` chars) | Auth / Access Control | **Medium** | **Mitigated (`DISABLE_DEMO_LOGIN` + 8-char min)** |
| SEC-11 | Framework disclosure (`X-Powered-By: Express`), unhandled `500` error details, large JSON payload limit | Configuration / Exposure | **Low** | **Fixed** |
| SEC-12 | Missing `Permissions-Policy`, `Referrer-Policy`, `COOP`, `CORP`, and `/api` `Cache-Control: no-store` | Configuration | **Low** | **Fixed** |

---

## Detailed Findings, Risks & Changes Applied

### SEC-01: Missing `Content-Security-Policy` Header
- **Severity:** Critical *(SecureScanr: -20 pts)*
- **Original Evidence:** `server/src/app.js` lines 15–35 (no CSP header configured anywhere on Express responses; also observed missing in SecureScanr header scan).
- **Why It Was a Problem & Concrete Attack Scenario:** Without CSP, the browser permits inline `<script>` tags, arbitrary external script origins, framing, and unintended network calls. If any future XSS or dependency tampering occurs, an attacker script can read `localStorage.getItem('inboxly_token')` (see SEC-09) and silently exfiltrate the user's 7-day JWT session token to an attacker-controlled domain.
- **Changes Made:** Created `securityHeaders` middleware in [server/src/middleware/security.js](server/src/middleware/security.js) and registered it in [server/src/app.js](server/src/app.js). Sets:
  - `default-src 'self'`
  - `script-src 'self'` *(no `'unsafe-inline'`; verified `client/dist/index.html` uses only external bundled module scripts)*
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` *(allows Tailwind CSS bundle, React progress-bar inline styles, and Inter/Plus Jakarta Sans stylesheet)*
  - `font-src 'self' https://fonts.gstatic.com data:`
  - `img-src 'self' data: blob:`
  - `connect-src 'self'`
  - `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  - Adds `upgrade-insecure-requests` automatically on HTTPS / Render proxy requests.

---

### SEC-02: Missing `Strict-Transport-Security` (HSTS) Header
- **Severity:** Critical *(SecureScanr: -20 pts)*
- **Original Evidence:** `server/src/app.js` lines 15–35 (did not configure `trust proxy` or `Strict-Transport-Security`).
- **Why It Was a Problem & Concrete Attack Scenario:** Without HSTS, a user visiting `http://ai-powered-email-dashboard.onrender.com` on untrusted Wi-Fi before TLS upgrade can be intercepted by a network attacker performing an SSL-stripping / protocol-downgrade attack to capture Bearer tokens or login credentials.
- **Changes Made:** Enabled `app.set('trust proxy', 1)` in [server/src/app.js](server/src/app.js) so Express inspects `X-Forwarded-Proto` behind Render/Cloudflare, and set `Strict-Transport-Security: max-age=31536000; includeSubDomains` whenever `NODE_ENV === 'production'` or the request arrived over HTTPS.

---

### SEC-03: Client Role Authorization Bypass & IDOR Across Conversation Endpoints
- **Severity:** High
- **Original Evidence:**
  - `server/src/routes/conversationRoutes.js` line 149 (pre-clear line 131): `if (req.user.role === 'client' && conv.responsibility !== 'client_to_reply' && conv.status === 'open')`
  - `server/src/routes/conversationRoutes.js` lines 280–366 (pre-clear lines 262–348): `POST /:id/client-action` and `POST /:id/undo-send` had **no** check enforcing `conv.responsibility === 'client_to_reply'` or `conv.status === 'open'`.
- **Why It Was a Problem & Concrete Attack Scenario:**
  1. On `GET /api/conversations/:id`, the guard only rejected non-client threads when `conv.status === 'open'`. Any logged-in `client` user could fetch `assistant_to_reply` or `no_reply_needed` threads in `waiting_response`, `completed`, or `archived` state by supplying their conversation ID (horizontal/role data leak).
  2. On `POST /api/conversations/:id/client-action` and `POST /api/conversations/:id/undo-send`, a `client` user could directly call `approve_and_send` with arbitrary `text`, `mark_handled`, `snooze`, or `delegate_to_assistant` on **any** conversation owned by their assistant's workspace — including private/administrative `assistant_to_reply` threads or already-archived threads.
- **Changes Made:**
  - Updated `GET /api/conversations/:id` in [server/src/routes/conversationRoutes.js](server/src/routes/conversationRoutes.js) to reject `client` access whenever `conv.responsibility !== 'client_to_reply' || conv.status === 'archived'`.
  - Updated `POST /api/conversations/:id/client-action` to enforce `403` when `req.user.role === 'client' && conv.responsibility !== 'client_to_reply'` and `409` whenever `conv.status !== 'open'`.
  - Updated `POST /api/conversations/:id/undo-send` to enforce `403` when `req.user.role === 'client' && conv.responsibility !== 'client_to_reply'`.
  - Added automated regression tests in [server/tests/api.test.js](server/tests/api.test.js).

---

### SEC-04: Hardcoded Fallback JWT Secret & Missing Algorithm / Role Pinning
- **Severity:** High
- **Original Evidence:** `server/src/middleware/auth.js` lines 4–17: `const SECRET = () => process.env.JWT_SECRET || 'dev-only-secret-change-me';`, `jwt.sign(..., SECRET(), { expiresIn: '7d' })`, `jwt.verify(token, SECRET())`.
- **Why It Was a Problem & Concrete Attack Scenario:** If the server starts in production without `JWT_SECRET` (for example in a manual deployment outside `render.yaml`), it silently falls back to the public string `'dev-only-secret-change-me'`. Any attacker reading the repository can forge valid admin/assistant JWTs for any `sub` user ID and take full control of workspaces. Additionally, `jwt.verify` did not pin `algorithms: ['HS256']`, and `requireAuth` did not check that the user's current DB `role` matches `payload.role`.
- **Changes Made:** Updated [server/src/middleware/auth.js](server/src/middleware/auth.js):
  - Generates an ephemeral 48-byte CSPRNG fallback secret (`crypto.randomBytes(48).toString('hex')`) only for non-production dev/test.
  - Throws a startup error in `NODE_ENV === 'production'` if `JWT_SECRET` is missing, shorter than 16 characters, or set to weak placeholder strings (`'change-me'`, `'dev-only-secret-change-me'`).
  - Pins `algorithm: 'HS256'` on signing, `algorithms: ['HS256']` on verification, rejects oversized bearer tokens (`> 2048` chars), and checks `user.role === payload.role`.
  - Updated test secret in [server/vitest.config.js](server/vitest.config.js) line 18 to `'test-secret-key-for-vitest-only'`.

---

### SEC-05: Wildcard CORS Policy (`Access-Control-Allow-Origin: *`)
- **Severity:** High *(SecureScanr: Important, -5 pts)*
- **Original Evidence:** `server/src/app.js` line 17: `app.use(cors());`
- **Why It Was a Problem & Concrete Attack Scenario:** Default `cors()` emits `Access-Control-Allow-Origin: *` on every API response, allowing any third-party website to issue cross-origin API requests and read responses (or combine with leaked/cached credentials or public unauthenticated routes).
- **Changes Made:** Replaced `cors()` with `strictCors` in [server/src/middleware/security.js](server/src/middleware/security.js) and [server/src/app.js](server/src/app.js). Same-host requests and explicitly configured `ALLOWED_ORIGINS` (plus localhost Vite dev origins outside production) receive exact origin reflection + `Vary: Origin`. Requests with no `Origin` header or unrecognized origins do **not** receive `Access-Control-Allow-Origin: *`.

---

### SEC-06: Missing Clickjacking (`X-Frame-Options`) & MIME-Sniffing (`X-Content-Type-Options`) Headers
- **Severity:** Medium *(SecureScanr: Important, -10 pts each)*
- **Original Evidence:** `server/src/app.js` lines 15–35 (neither header was set).
- **Why It Was a Problem & Concrete Attack Scenario:**
  - Without `X-Frame-Options: DENY` (and CSP `frame-ancestors 'none'`), an attacker can embed `/assistant` or `/client` inside a hidden `<iframe>` and trick a signed-in executive/assistant into clicking **Approve & send** or **Clear all messages** (clickjacking).
  - Without `X-Content-Type-Options: nosniff`, older or permissive browsers can MIME-sniff non-script responses into executable scripts.
- **Changes Made:** `securityHeaders` in [server/src/middleware/security.js](server/src/middleware/security.js) now enforces `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` on every response.

---

### SEC-07: NoSQL Operator Injection & Missing Server-Side Type / ObjectId Validation
- **Severity:** Medium
- **Original Evidence:**
  - `server/src/app.js` (default Express `'extended'` query parser parses `?accountId[$ne]=...` into `{ $ne: ... }`).
  - `server/src/routes/conversationRoutes.js` lines 111–116 (`if (accountId) q.accountId = accountId;`, unbounded `search`), line 230 (unvalidated `accountId`), lines 187, 200, 218, 285, 388 (missing `typeof === 'string'` checks, length limits, and tone enum validation).
  - `server/src/routes/authRoutes.js` lines 12–34 (`String(email)` / `String(password)` coerced non-string objects such as `{ $ne: '' }` into `"[object Object]"` which passed password length checks).
  - `server/src/routes/accountRoutes.js` lines 36–77 (`accountId` params on `/:id/sync` and `DELETE /:id` not pre-validated with ObjectId regex; `clientName`/`clientEmail` lacked `typeof === 'string'` checks).
  - `server/src/routes/aiRoutes.js` line 12 (lacked `typeof === 'string'` and max length cap on `question`).
- **Why It Was a Problem & Concrete Attack Scenario:** Express's extended query parser turns crafted bracketed query strings (`?accountId[$ne]=1`) into MongoDB query operator objects, enabling filter bypass or unintended Mongoose query behavior/errors, while unbounded inputs (`body`, `search`, `question`) expose APIs to oversized payload abuse and malformed regex CPU spikes.
- **Changes Made:**
  - Set `app.set('query parser', 'simple')` in [server/src/app.js](server/src/app.js) so query parameters are never parsed into nested operator objects.
  - Added `isObjectId()` helper in [server/src/middleware/security.js](server/src/middleware/security.js) and enforced it on `GET /api/conversations` (`accountId`), `POST /api/conversations/simulate` (`accountId`), `POST /api/ai/query` (`conversationId`), `POST /api/accounts/:id/sync`, and `DELETE /api/accounts/:id`.
  - Enforced strict `typeof === 'string'` validation, enum checks (`VALID_TONES`), and length bounds across [authRoutes.js](server/src/routes/authRoutes.js), [accountRoutes.js](server/src/routes/accountRoutes.js), [conversationRoutes.js](server/src/routes/conversationRoutes.js), and [aiRoutes.js](server/src/routes/aiRoutes.js).
  - Added automated tests in [server/tests/api.test.js](server/tests/api.test.js).

---

### SEC-08: Missing Rate Limiting on Authentication & AI Endpoints
- **Severity:** Medium
- **Original Evidence:** `server/src/app.js`, `server/src/routes/authRoutes.js`, `server/src/routes/aiRoutes.js`, `server/src/routes/conversationRoutes.js` (no request throttling existed on `/api/auth/*`, `/api/ai/query`, `/simulate`, `/reanalyze`, or `/draft`).
- **Why It Was a Problem & Concrete Attack Scenario:** Attackers could run unlimited password brute-force / credential stuffing attempts against `/api/auth/login` or flood `/api/ai/query` and `/draft` to exhaust Groq/Gemini/OpenAI API quotas and increase MongoDB/CPU load.
- **Changes Made:** Added `createRateLimiter` in [server/src/middleware/security.js](server/src/middleware/security.js) with bounded in-memory bucket eviction and `RateLimit-*` headers:
  - `/api/*` global limit: `300` requests / 15 min per IP
  - `/api/auth/*` (`/register`, `/login`, `/demo`): `30` requests / 15 min per IP
  - AI/LLM-invoking routes (`/api/ai/*`, `/simulate`, `/:id/reanalyze`, `/:id/draft`): `60` requests / 15 min per IP

---

### SEC-09: JWT Stored in `localStorage` Instead of `HttpOnly` Cookie
- **Severity:** Medium
- **Original Evidence:** `client/src/api.js` lines 3–4 (`localStorage.getItem('inboxly_token')`, `localStorage.setItem('inboxly_token', t)`).
- **Why It Was a Problem & Concrete Attack Scenario:** Unlike `HttpOnly; Secure; SameSite=Lax` cookies, JavaScript code running on the origin can read `localStorage`. If an XSS flaw were ever introduced (for instance via a compromised dependency), the attacker could read `inboxly_token` directly.
- **Remediation Status & Trade-Off:** Preserved Bearer JWT transport in `localStorage` intentionally so the existing stateless REST API & Vitest `Authorization: Bearer` contract remain intact, while **eliminating XSS vectors** via strict CSP (`script-src 'self'`, `object-src 'none'`, `base-uri 'self'`) and zero `dangerouslySetInnerHTML` / `innerHTML` usage across `client/`. For an enterprise rollout, migrate `POST /api/auth/*` to issue an `HttpOnly; Secure; SameSite=Lax` cookie alongside CSRF protection.

---

### SEC-10: Shared One-Click Demo Endpoint & Weak Password Policy
- **Severity:** Medium
- **Original Evidence:** `server/src/routes/authRoutes.js` lines 14 & 40–48 (minimum password length was `6` characters; `POST /api/auth/demo` unconditionally issued live tokens for the shared demo Assistant/Client workspace).
- **Why It Was a Problem & Concrete Attack Scenario:** Weak 6-character passwords are trivial to guess if rate limits are bypassed across multiple IPs. Meanwhile, keeping `POST /api/auth/demo` enabled in production means any visitor can read/modify/clear the shared demo workspace (`maya@assistant.demo` / `arjun@client.demo`).
- **Changes Made:**
  - Raised password minimum length on `POST /api/auth/register` from `6` to `8` characters (`8–128`) and updated the placeholder in [client/src/pages/Login.jsx](client/src/pages/Login.jsx) line 113.
  - Added an environment kill switch (`DISABLE_DEMO_LOGIN=true`) to `POST /api/auth/demo` in [server/src/routes/authRoutes.js](server/src/routes/authRoutes.js) so evaluators can still use the live demo by default while production deployments can disable one-click demo logins via configuration without code edits.

---

### SEC-11: Information Disclosure (`X-Powered-By`, Unhandled `500` Error Messages) & Oversized Payload Limit
- **Severity:** Low *(SecureScanr: Minor, -3 pts for `X-Powered-By`)*
- **Original Evidence:** `server/src/app.js` lines 16–41 (`X-Powered-By: Express` enabled by default, `express.json({ limit: '1mb' })`, error handler returned `err.message` on `500` errors).
- **Why It Was a Problem & Concrete Attack Scenario:** Returning `X-Powered-By: Express` assists automated attacker fingerprinting, and returning raw `err.message` on unhandled `500` errors (database driver errors, network timeouts) can expose internal hostnames or stack fragments.
- **Changes Made:** Disabled `X-Powered-By` via `app.disable('x-powered-by')`, lowered JSON payload limit to `'256kb'`, and masked `>= 500` error messages as `'Internal server error'` when `NODE_ENV === 'production'` in [server/src/app.js](server/src/app.js).

---

### SEC-12: Missing `Permissions-Policy`, `Referrer-Policy`, `Cross-Origin-*`, and API `Cache-Control` Headers
- **Severity:** Low *(SecureScanr: Minor, -5 pts each for `Permissions-Policy` & `Referrer-Policy`)*
- **Original Evidence:** `server/src/app.js` lines 15–35 (none of these headers were emitted).
- **Why It Was a Problem & Concrete Attack Scenario:** Without `Permissions-Policy`, embedded content or scripts are not explicitly barred from camera, geolocation, payment, or USB APIs; without `Referrer-Policy`, cross-origin navigations could leak full URLs/paths; without `Cache-Control: no-store` on `/api/*`, shared proxies or browsers could cache sensitive JSON email payloads.
- **Changes Made:** Added in `securityHeaders` ([server/src/middleware/security.js](server/src/middleware/security.js)):
  - `Permissions-Policy: camera=(), geolocation=(), microphone=(self), payment=(), usb=()` *(restricts all sensitive sensors while preserving same-origin Web Speech dictation on `/client`)*
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Cross-Origin-Opener-Policy: same-origin` & `Cross-Origin-Resource-Policy: same-origin`
  - `Cache-Control: no-store` on all `/api/*` responses.

---

## Checks That Passed (No Vulnerability Found)

- **Git History & Client Secret Exposure (`git log -p --all` & `client/` scan):** Confirmed zero API keys (`GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`), zero `MONGODB_URI` connection strings, and zero `.env` files exist in client source/build bundles or git commit history (`.env` is gitignored).
- **DOM XSS Sinks:** Searched `client/` and `server/` for `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `eval(`, `new Function`, and `document.write` — zero occurrences found; React auto-escapes all rendered email subjects, senders, notes, and bodies.
- **File Upload Safety:** Verified no file upload middleware (`multer`, `busboy`, `formidable`, `multipart/form-data`) or upload endpoints exist anywhere in the codebase.

---

## Verification Summary (Post-Fix)

- **Automated Backend + Security Test Suite (`npm --workspace=server test`):** `1 passed (1)` test file, **`20 passed (20)`** tests (including 3 new security tests covering HTTP headers + HTTPS HSTS + strict CORS rejection, client-role IDOR blocks, and NoSQL/input-type rejection).
- **Production Client Build (`npm --workspace=client run build`):** Succeeded (`1590 modules transformed`, emitted `dist/index.html` with external bundled assets only — compatible with `script-src 'self'`).

---

## Areas Not Verified Due to Lack of Access

1. **Live Production Deployment Re-Scan on Render (`https://ai-powered-email-dashboard.onrender.com`):** These security fixes are implemented and verified locally (`F:\Ai powered email dashboard`), **not yet pushed** to `BROOK-CORE/ai-powered-email-dashboard` or re-scanned on SecureScanr (because automated `git push` requires interactive Windows Git authentication on your machine).
2. **Render Dashboard Secret Environment Variables:** Could not directly read or audit the live `JWT_SECRET` strength or other encrypted environment variable values currently stored inside Render service `srv-dbst3poae00c7390mg2g`.
3. **MongoDB Atlas Infrastructure & Audit Logs:** Could not inspect Atlas TLS cipher suites, database audit logs, VPC peering/private endpoints, or verify whether `0.0.0.0/0` Network Access should be narrowed to Render's outbound static IP list (paid feature) instead of open `0.0.0.0/0`.
4. **Cloudflare / Render Upstream Proxy Header Manipulation:** SecureScanr reported `Server: cloudflare`; upstream CDN/proxy header overrides, DDoS/WAF rules, and edge TLS certificates on `.onrender.com` are controlled by Render/Cloudflare and cannot be modified from Express.
5. **Live External LLM Provider API Behavior (`Groq` / `Gemini` / `OpenAI`):** All external LLM API keys are currently unset (`heuristic` engine active), so live prompt-injection behavior and TLS/timeout handling against third-party LLM endpoints were not tested at runtime.
6. **Persistent Distributed Rate Limiting:** The in-memory IP rate limiter protects a single Node.js instance; multi-instance horizontal scaling or shared Render IP pools without Redis cannot be stress-tested here.
