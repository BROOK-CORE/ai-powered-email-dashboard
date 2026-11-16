import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { RevokedToken } from '../models/RevokedToken.js';
import { logSecurityEvent } from '../services/securityLogger.js';

const EPHEMERAL_DEV_SECRET = crypto.randomBytes(48).toString('hex');

function getSecret() {
  const env = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!env || env === 'change-me' || env === 'dev-only-secret-change-me' || env.length < 16) {
      throw new Error('JWT_SECRET must be set to a strong secret (>= 16 chars) in production');
    }
    return env;
  }
  return env || EPHEMERAL_DEV_SECRET;
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      tv: user.tokenVersion ?? 0,
      jti: crypto.randomUUID(),
    },
    getSecret(),
    {
      algorithm: 'HS256',
      expiresIn: '1d',
    }
  );
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token || token.length > 2048) {
      logSecurityEvent({ event: 'auth.token_rejected', severity: 'warn', outcome: 'denied', req, meta: { reason: token ? 'oversized_token' : 'missing_token', status: 401 } });
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
    if (!payload.jti || typeof payload.jti !== 'string') {
      logSecurityEvent({ event: 'auth.token_rejected', severity: 'warn', outcome: 'denied', req, meta: { reason: 'missing_jti', status: 401 } });
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    if (await RevokedToken.exists({ jti: payload.jti })) {
      logSecurityEvent({ event: 'auth.token_rejected', severity: 'warn', outcome: 'denied', req, userId: payload.sub, actorRole: payload.role, meta: { reason: 'revoked_jti', status: 401 } });
      return res.status(401).json({ error: 'Session has been signed out' });
    }

    const user = await User.findById(payload.sub);
    if (!user || user.role !== payload.role || (payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      logSecurityEvent({
        event: 'auth.token_rejected',
        severity: 'warn',
        outcome: 'denied',
        req,
        userId: payload.sub,
        actorRole: payload.role,
        meta: { reason: !user ? 'user_missing' : user.role !== payload.role ? 'role_mismatch' : 'token_version_mismatch', status: 401 },
      });
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = user;
    req.tokenPayload = payload;
    // Clients operate inside their assistant's workspace; fail closed if linked assistant no longer exists.
    if (user.role === 'assistant') {
      req.ownerId = user._id;
    } else {
      if (!user.assistantId) {
        logSecurityEvent({ event: 'authz.role_denied', severity: 'warn', outcome: 'denied', req, userId: user._id, actorRole: user.role, meta: { reason: 'missing_assistant_link', status: 403 } });
        return res.status(403).json({ error: 'No assistant workspace linked to this account' });
      }
      const ownerExists = await User.exists({ _id: user.assistantId, role: 'assistant' });
      if (!ownerExists) {
        logSecurityEvent({ event: 'authz.role_denied', severity: 'warn', outcome: 'denied', req, userId: user._id, actorRole: user.role, meta: { reason: 'orphaned_client_workspace', status: 403 } });
        return res.status(403).json({ error: 'Linked assistant workspace no longer exists' });
      }
      req.ownerId = user.assistantId;
    }
    next();
  } catch {
    logSecurityEvent({ event: 'auth.token_rejected', severity: 'warn', outcome: 'denied', req, meta: { reason: 'invalid_or_expired_jwt', status: 401 } });
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireAssistant(req, res, next) {
  if (req.user.role !== 'assistant') {
    logSecurityEvent({ event: 'authz.role_denied', severity: 'warn', outcome: 'denied', req, meta: { reason: 'assistant_only_endpoint', status: 403 } });
    return res.status(403).json({ error: 'Assistant access only' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  const isAdmin = req.user?.email === 'iambrook2007@gmail.com' || Boolean(req.user?.isAdmin);
  if (!isAdmin) {
    logSecurityEvent({
      event: 'authz.admin_denied',
      severity: 'warn',
      outcome: 'denied',
      req,
      meta: { reason: 'admin_only_endpoint', status: 403 },
    });
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
