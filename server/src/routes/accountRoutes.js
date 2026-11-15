import { Router } from 'express';
import { EmailAccount } from '../models/EmailAccount.js';
import { Conversation } from '../models/Conversation.js';
import { requireAuth, requireAssistant, asyncHandler } from '../middleware/auth.js';
import { isObjectId } from '../middleware/security.js';
import { seedAccountInbox, providerColor } from '../seed/seed.js';

const router = Router();
router.use(requireAuth, requireAssistant);

async function withCounts(ownerId, accounts) {
  const counts = await Conversation.aggregate([
    { $match: { ownerId, status: { $in: ['open', 'waiting_response'] } } },
    { $group: { _id: '$accountId', total: { $sum: 1 }, unread: { $sum: { $cond: ['$isUnread', 1, 0] } } } },
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c]));
  return accounts.map((a) => ({
    ...a.toObject(),
    id: a._id,
    totalCount: map.get(String(a._id))?.total || 0,
    unreadCount: map.get(String(a._id))?.unread || 0,
  }));
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const accounts = await EmailAccount.find({ ownerId: req.ownerId }).sort({ createdAt: 1 });
    res.json({ accounts: await withCounts(req.ownerId, accounts) });
  })
);

// Simulated OAuth / API-key connection: creates the account, "syncs" and imports a realistic inbox.
router.post(
  '/connect',
  asyncHandler(async (req, res) => {
    const { provider, clientName, clientEmail, connectionType } = req.body || {};
    if (!['gmail', 'outlook', 'custom_api'].includes(provider)) return res.status(400).json({ error: 'Unsupported provider' });
    if (typeof clientName !== 'string' || typeof clientEmail !== 'string' || !clientName.trim() || !clientEmail.trim()) {
      return res.status(400).json({ error: 'Client name and email are required' });
    }
    const cleanName = clientName.trim().slice(0, 120);
    const cleanEmail = clientEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail) || cleanEmail.length > 200) return res.status(400).json({ error: 'Enter a valid email address' });
    if (await EmailAccount.findOne({ ownerId: req.ownerId, clientEmail: cleanEmail, provider })) {
      return res.status(409).json({ error: 'This mailbox is already connected' });
    }
    const account = await EmailAccount.create({
      ownerId: req.ownerId,
      clientName: cleanName,
      clientEmail: cleanEmail,
      provider,
      connectionType: connectionType === 'api_key_bridge' || provider === 'custom_api' ? 'api_key_bridge' : 'oauth_simulated',
      status: 'syncing',
      color: providerColor(provider),
    });
    const imported = await seedAccountInbox(req.ownerId, account, req.user.name);
    res.status(201).json({ account: (await withCounts(req.ownerId, [account]))[0], imported });
  })
);

router.post(
  '/:id/sync',
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid account id' });
    const account = await EmailAccount.findOne({ _id: req.params.id, ownerId: req.ownerId });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    account.lastSyncedAt = new Date();
    account.status = 'connected';
    await account.save();
    res.json({ account: (await withCounts(req.ownerId, [account]))[0] });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid account id' });
    const account = await EmailAccount.findOne({ _id: req.params.id, ownerId: req.ownerId });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await Conversation.deleteMany({ accountId: account._id });
    await account.deleteOne();
    res.json({ ok: true });
  })
);

export default router;
