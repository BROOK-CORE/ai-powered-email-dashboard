import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { RevokedToken } from '../models/RevokedToken.js';
import { requireAuth, signToken, asyncHandler } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/security.js';
import { ensureDemoData } from '../seed/seed.js';

const router = Router();
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many authentication attempts, try again later.' });
const DUMMY_BCRYPT_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;

function isValidEmail(email) {
  return (
    typeof email === 'string' &&
    email.length <= 200 &&
    !email.includes('..') &&
    /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/.test(email) &&
    /\.[a-z]{2,}$/i.test(email)
  );
}

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Name, email and password must be strings' });
    }
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName || cleanName.length > 100) return res.status(400).json({ error: 'Enter a valid name' });
    if (!isValidEmail(cleanEmail)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'Password must be 8-72 characters' });
    }
    if (await User.findOne({ email: cleanEmail })) {
      return res.status(400).json({ error: 'Unable to complete registration. Check your details or sign in.' });
    }
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      role: 'assistant',
      title: 'Personal Assistant',
      passwordHash: await bcrypt.hash(password, 10),
    });
    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  })
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || cleanEmail.length > 200 || !password || password.length > 128) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (user && !user.isDemo && user.lockUntil && user.lockUntil > new Date()) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      return res.status(429).json({ error: 'Too many failed login attempts. Try again later.' });
    }

    const match = await bcrypt.compare(password, user?.passwordHash || DUMMY_BCRYPT_HASH);
    if (!user || user.isDemo || !match) {
      if (user && !user.isDemo) {
        const attempts = (user.failedLoginAttempts || 0) + 1;
        user.failedLoginAttempts = attempts;
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          user.lockUntil = new Date(Date.now() + LOCKOUT_MS);
        }
        await user.save();
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }
    res.json({ token: signToken(user), user: user.toPublic() });
  })
);

// Revoke the current session token cleanly (and optionally all sessions via allSessions=true).
router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { jti, exp } = req.tokenPayload || {};
    if (jti && exp) {
      await RevokedToken.updateOne(
        { jti },
        { $setOnInsert: { jti, expiresAt: new Date(exp * 1000) } },
        { upsert: true }
      );
    }
    if (req.body?.allSessions === true && !req.user.isDemo) {
      req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
      await req.user.save();
    }
    res.json({ ok: true });
  })
);

router.post(
  '/change-password',
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    if (req.user.isDemo) return res.status(403).json({ error: 'Demo accounts cannot change passwords' });
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Current and new passwords must be strings' });
    }
    if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
      return res.status(400).json({ error: 'New password must be 8-72 characters' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must differ from current password' });
    }
    if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    req.user.passwordHash = await bcrypt.hash(newPassword, 10);
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();
    res.json({ token: signToken(req.user), user: req.user.toPublic() });
  })
);

// One-click demo entry for evaluators (can be turned off with DISABLE_DEMO_LOGIN=true).
router.post(
  '/demo',
  authLimiter,
  asyncHandler(async (req, res) => {
    if (process.env.DISABLE_DEMO_LOGIN === 'true') {
      return res.status(403).json({ error: 'Demo login is disabled in this environment' });
    }
    const role = req.body?.role === 'client' ? 'client' : 'assistant';
    await ensureDemoData();
    const user = await User.findOne({ email: role === 'client' ? 'arjun@client.demo' : 'maya@assistant.demo' });
    res.json({ token: signToken(user), user: user.toPublic() });
  })
);

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));

router.patch(
  '/onboarding',
  requireAuth,
  asyncHandler(async (req, res) => {
    req.user.onboardingCompleted = true;
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  })
);

export default router;
