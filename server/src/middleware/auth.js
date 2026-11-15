import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const SECRET = () => process.env.JWT_SECRET || 'dev-only-secret-change-me';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, SECRET(), { expiresIn: '7d' });
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, SECRET());
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User no longer exists' });
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
