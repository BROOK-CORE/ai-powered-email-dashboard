import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { requireAuth, signToken, asyncHandler } from '../middleware/auth.js';
import { ensureDemoData } from '../seed/seed.js';

const router = Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await User.findOne({ email: String(email).toLowerCase() })) return res.status(409).json({ error: 'An account with this email already exists' });
    const user = await User.create({
      name,
      email,
      role: 'assistant',
      title: 'Personal Assistant',
      passwordHash: await bcrypt.hash(password, 10),
    });
    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: String(email || '').toLowerCase() });
    if (!user || user.isDemo || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user: user.toPublic() });
  })
);

// One-click demo entry for evaluators.
router.post(
  '/demo',
  asyncHandler(async (req, res) => {
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
