import crypto from 'node:crypto';

const EPHEMERAL_LOG_SALT = crypto.randomBytes(32).toString('hex');
const SENSITIVE_KEY_RX = /pass|token|secret|auth|key|cookie|body|prompt|question|subject|email|note|draft|uri|snippet|header/i;
const SAFE_META_KEYS = new Set([
  'action', 'alertReason', 'allSessions', 'code', 'count', 'deletedConversations', 'deletedNotifications',
  'emailHash', 'field', 'from', 'to', 'hasConversationId', 'limiter', 'max', 'name', 'provider',
  'reason', 'rule', 'status', 'windowMs',
]);

const RECENT_EVENTS = [];
const MAX_RECENT_EVENTS = 200;
const COUNTER_BUCKETS = new Map();

const ALERT_RULES = {
  'auth.login_failed': { windowMs: 5 * 60 * 1000, threshold: 5, reason: 'brute_force_spike', owner: 'backend-security' },
  'auth.account_locked': { windowMs: 15 * 60 * 1000, threshold: 1, reason: 'account_lockout_triggered', owner: 'backend-security' },
  'auth.demo_blocked': { windowMs: 5 * 60 * 1000, threshold: 5, reason: 'blocked_demo_probe', owner: 'platform-ops' },
  'authz.role_denied': { windowMs: 5 * 60 * 1000, threshold: 5, reason: 'repeated_role_denial', owner: 'backend-security' },
  'authz.client_scope_denied': { windowMs: 5 * 60 * 1000, threshold: 3, reason: 'client_idor_probe', owner: 'backend-security' },
  'cors.origin_denied': { windowMs: 5 * 60 * 1000, threshold: 5, reason: 'cors_preflight_probe', owner: 'backend-security' },
  'ratelimit.exceeded': { windowMs: 5 * 60 * 1000, threshold: 3, reason: 'rate_limit_abuse', owner: 'platform-ops' },
  'validation.failed': { windowMs: 5 * 60 * 1000, threshold: 15, reason: 'validation_probe_spike', owner: 'backend-security' },
  'ai.provider_fallback': { windowMs: 5 * 60 * 1000, threshold: 5, reason: 'llm_provider_degraded', owner: 'ai-infra' },
  'admin.workspace_cleared': { windowMs: 60 * 1000, threshold: 1, reason: 'destructive_workspace_clear', owner: 'workspace-owner' },
  'admin.account_deleted': { windowMs: 60 * 1000, threshold: 1, reason: 'mailbox_disconnected', owner: 'workspace-owner' },
};

function logSalt() {
  return process.env.LOG_SALT || process.env.JWT_SECRET || EPHEMERAL_LOG_SALT;
}

/** Stable pseudonymous identifier for correlation (never reversible to raw IP or email). */
export function hashForLog(value) {
  if (!value || typeof value !== 'string') return null;
  return crypto.createHmac('sha256', logSalt()).update(value).digest('hex').slice(0, 12);
}

/** Scrub bearer tokens, URL API keys, and Mongo credentials from error text. */
export function scrubText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:api_?key|key|token|secret)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(mongodb(?:\+srv)?:\/\/)[^\s]+/gi, '$1[REDACTED]')
    .slice(0, 160);
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const clean = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!SAFE_META_KEYS.has(k) && SENSITIVE_KEY_RX.test(k)) continue;
    if (v === undefined) continue;
    if (typeof v === 'string') clean[k] = scrubText(v);
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) clean[k] = v;
  }
  return clean;
}

function evaluateAlert(event, key) {
  const rule = ALERT_RULES[event];
  if (!rule) return null;

  const now = Date.now();
  if (COUNTER_BUCKETS.size > 4000) {
    for (const [k, b] of COUNTER_BUCKETS) {
      if (b.resetAt <= now) COUNTER_BUCKETS.delete(k);
    }
  }
  const bucketKey = `${event}:${key}`;
  let entry = COUNTER_BUCKETS.get(bucketKey);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + rule.windowMs };
    COUNTER_BUCKETS.set(bucketKey, entry);
  }
  entry.count += 1;
  if (entry.count >= rule.threshold) {
    return { alert: true, alertReason: rule.reason, alertOwner: rule.owner, windowCount: entry.count };
  }
  return null;
}

/** Correlate logs per HTTP request without storing private payload details. */
export function attachRequestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const valid = typeof incoming === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(incoming);
  req.id = valid ? incoming : crypto.randomUUID().slice(0, 12);
  res.setHeader('X-Request-Id', req.id);
  next();
}

export function getRecentSecurityEvents() {
  return [...RECENT_EVENTS];
}

export function clearSecurityEvents() {
  RECENT_EVENTS.length = 0;
  COUNTER_BUCKETS.clear();
}

/** Emit redacted structured JSON security log entry and trigger anomaly alert flags. */
export function logSecurityEvent({ event, severity = 'info', outcome = 'info', req, userId, actorRole, targetId, meta } = {}) {
  const rawIp = req ? req.ip || req.socket?.remoteAddress || '' : '';
  const ipHash = hashForLog(rawIp);
  const resolvedActorId = userId ? String(userId) : req?.user?._id ? String(req.user._id) : null;
  const resolvedRole = actorRole || req?.user?.role || 'anonymous';
  const cleanMeta = sanitizeMeta(meta);
  const correlationKey = cleanMeta.emailHash || resolvedActorId || ipHash || 'global';
  const alertInfo = evaluateAlert(event, correlationKey);

  const entry = {
    ts: new Date().toISOString(),
    channel: 'security',
    event,
    severity: alertInfo ? 'warn' : severity,
    outcome,
    requestId: req?.id || null,
    method: req?.method || null,
    path: req?.originalUrl?.split('?')[0] || req?.path || null,
    ipHash,
    ua: req?.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 80) : null,
    actorId: resolvedActorId,
    actorRole: resolvedRole,
    targetId: targetId ? String(targetId) : null,
    meta: cleanMeta,
    ...(alertInfo || { alert: false }),
  };

  RECENT_EVENTS.push(entry);
  if (RECENT_EVENTS.length > MAX_RECENT_EVENTS) RECENT_EVENTS.shift();

  const shouldPrint = process.env.VITEST !== 'true' || process.env.SECURITY_LOG_STDOUT === 'true';
  if (shouldPrint) {
    const line = JSON.stringify(entry);
    if (entry.severity === 'error' || entry.alert) console.error(line);
    else if (entry.severity === 'warn') console.warn(line);
    else console.log(line);
  }

  const webhook = process.env.SECURITY_ALERT_WEBHOOK_URL;
  if (entry.alert && webhook && /^https:\/\//i.test(webhook) && process.env.VITEST !== 'true') {
    fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }

  return entry;
}
