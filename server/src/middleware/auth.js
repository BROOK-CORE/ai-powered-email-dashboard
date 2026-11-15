import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

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
  return jwt.sign({ sub: String(user._id), role: user.role }, getSecret(), {
    algorithm: 'HS256',
    expiresIn: '7d',
  });
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token || token.length > 2048) return res.status(401).json({ error: 'Authentication required' });

    const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
    const user = await User.findById(payload.sub);
    if (!user || user.role !== payload.role) return res.status(401).json({ error: 'User no longer exists' });

    req.user = user;
    // Clients operate inside their assistant's workspace.
    req.ownerId = user.role === 'assistant' ? user._id : user.assistantId;
    if (!req.ownerId) return res.status(403).json({ error: 'No assistant workspace linked to this account' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireAssistant(req, res, next) {
  if (req.user.role !== 'assistant') return res.status(403).json({ error: 'Assistant access only' });
  next();
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
