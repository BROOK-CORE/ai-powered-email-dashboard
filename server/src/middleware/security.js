import cors from 'cors';

const DEV_ORIGINS = new Set([
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function allowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function safeConnectOrigins() {
  const extra = [...allowedOrigins(), process.env.PUBLIC_API_ORIGIN || '']
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\/[^;\s'"]+$/i.test(s));
  return ["'self'", ...new Set(extra)].join(' ');
}

/** Reject or redirect plain HTTP forwarded requests in production before processing API/SPA routes. */
export function enforceHttps(req, res, next) {
  if (process.env.NODE_ENV !== 'production') return next();
  const forwarded = req.headers['x-forwarded-proto']?.split(',')[0]?.trim().toLowerCase();
  if (forwarded !== 'http') return next();

  const host = req.get('host');
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
    return res.status(400).json({ error: 'Invalid Host header' });
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.redirect(308, `https://${host}${req.originalUrl}`);
  }
  return res.status(426).json({ error: 'HTTPS is required' });
}

/** Strict CORS policy: rejects wildcard (*) and permits only same-host, configured origins, or dev servers. */
export const strictCors = cors((req, cb) => {
  const origin = req.headers.origin;
  if (!origin) return cb(null, { origin: false });

  const host = req.get('host');
  const proto = req.headers['x-forwarded-proto']?.split(',')[0]?.trim() || req.protocol;
  const sameOrigin = host ? `${proto}://${host}` === origin : false;
  const allow = sameOrigin || allowedOrigins().has(origin) || (process.env.NODE_ENV !== 'production' && DEV_ORIGINS.has(origin));

  return cb(null, {
    origin: allow,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
});

/** HTTP hardening headers protecting against XSS, clickjacking, MIME-sniffing, and protocol downgrade. */
export function securityHeaders(req, res, next) {
  const isHttps = req.secure || req.headers['x-forwarded-proto']?.split(',')[0]?.trim() === 'https';
  const styleDirective =
    process.env.NODE_ENV === 'production'
      ? "style-src 'self' https://fonts.googleapis.com"
      : "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com";

  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    styleDirective,
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    `connect-src ${safeConnectOrigins()}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isHttps ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // RFC 6797 §7.2: emit HSTS strictly over secure HTTPS responses (never over plain HTTP).
  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}

/** Lightweight sliding-window in-memory rate limiter keyed by client IP + bucket name. */
export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests, please try again later.' } = {}) {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }

    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      return res.status(429).json({ error: message });
    }
    return next();
  };
}

export function isObjectId(v) {
  return typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);
}
