import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { requireAuth, signToken, asyncHandler } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/security.js';
import { ensureDemoData } from '../seed/seed.js';

const router = Router();
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many authentication attempts, try again later.' });

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
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail) || cleanEmail.length > 200) return res.status(400).json({ error: 'Enter a valid email address' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8-128 characters' });
    if (await User.findOne({ email: cleanEmail })) return res.status(409).json({ error: 'An account with this email already exists' });
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
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || user.isDemo || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user: user.toPublic() });
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
