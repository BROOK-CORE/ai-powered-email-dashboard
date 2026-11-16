import { Router } from 'express';
import { EmailAccount } from '../models/EmailAccount.js';
import { Conversation } from '../models/Conversation.js';
import { requireAuth, requireAssistant, asyncHandler } from '../middleware/auth.js';
import { isObjectId, isValidEmail } from '../middleware/security.js';
import { seedAccountInbox, providerColor } from '../seed/seed.js';
import { logSecurityEvent } from '../services/securityLogger.js';
import { testImapConnection, syncImapMailbox } from '../services/imapService.js';

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

// Test live IMAP connection before connecting
router.post(
  '/test-imap',
  asyncHandler(async (req, res) => {
    const { provider, email, password, host, port } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = await testImapConnection({ provider, email, password, host, port });
    res.json(result);
  })
);

// Connect a mailbox (supports live IMAP/App-Password or simulated sandbox)
router.post(
  '/connect',
  asyncHandler(async (req, res) => {
    const { provider, clientName, clientEmail, connectionType, appPassword, imapHost, imapPort } = req.body || {};
    if (!['gmail', 'outlook', 'custom_api'].includes(provider)) return res.status(400).json({ error: 'Unsupported provider' });
    if (typeof clientName !== 'string' || typeof clientEmail !== 'string' || !clientName.trim() || !clientEmail.trim()) {
      return res.status(400).json({ error: 'Client name and email are required' });
    }
    const cleanName = clientName.trim().slice(0, 120);
    const cleanEmail = clientEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (await EmailAccount.findOne({ ownerId: req.ownerId, clientEmail: cleanEmail, provider })) {
      return res.status(409).json({ error: 'This mailbox is already connected' });
    }

    const isLive = connectionType === 'imap_live' && Boolean(appPassword);

    const account = await EmailAccount.create({
      ownerId: req.ownerId,
      clientName: cleanName,
      clientEmail: cleanEmail,
      provider,
      connectionType: isLive ? 'imap_live' : connectionType === 'api_key_bridge' || provider === 'custom_api' ? 'api_key_bridge' : 'oauth_simulated',
      status: 'syncing',
      imapHost: imapHost || '',
      imapPort: Number(imapPort) || 993,
      color: providerColor(provider),
    });

    let imported = 0;
    try {
      if (isLive) {
        const syncRes = await syncImapMailbox({
          ownerId: req.ownerId,
          account,
          password: appPassword,
          limit: 15,
          replaceExisting: true,
          req,
        });
        imported = syncRes.count;
      } else {
        imported = await seedAccountInbox(req.ownerId, account, req.user.name);
      }
    } catch (err) {
      await account.deleteOne().catch(() => {});
      logSecurityEvent({ event: 'admin.account_connect_failed', severity: 'warn', outcome: 'failure', req, meta: { error: err.message, status: 400 } });
      return res.status(400).json({ error: err.message || 'Unable to connect to mailbox.' });
    }

    logSecurityEvent({ event: 'admin.account_connected', outcome: 'success', req, targetId: account._id, meta: { provider, count: imported, isLive, status: 201 } });
    res.status(201).json({ account: (await withCounts(req.ownerId, [account]))[0], imported, isLive });
  })
);

router.post(
  '/:id/sync',
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) {
      logSecurityEvent({ event: 'validation.failed', severity: 'warn', outcome: 'rejected', req, meta: { field: 'accountId', rule: 'invalid_object_id', status: 400 } });
      return res.status(400).json({ error: 'Invalid account id' });
    }
    const account = await EmailAccount.findOne({ _id: req.params.id, ownerId: req.ownerId });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const { appPassword } = req.body || {};
    let imported = 0;
    let isLive = false;

    if (appPassword || account.encryptedPassword) {
      try {
        const syncRes = await syncImapMailbox({
          ownerId: req.ownerId,
          account,
          password: appPassword,
          limit: 15,
          replaceExisting: false,
          req,
        });
        imported = syncRes.count;
        isLive = true;
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    } else {
      account.lastSyncedAt = new Date();
      account.status = 'connected';
      await account.save();
    }

    res.json({ account: (await withCounts(req.ownerId, [account]))[0], imported, isLive });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) {
      logSecurityEvent({ event: 'validation.failed', severity: 'warn', outcome: 'rejected', req, meta: { field: 'accountId', rule: 'invalid_object_id', status: 400 } });
      return res.status(400).json({ error: 'Invalid account id' });
    }
    const account = await EmailAccount.findOne({ _id: req.params.id, ownerId: req.ownerId });
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await Conversation.deleteMany({ accountId: account._id });
    const deletedProvider = account.provider;
    await account.deleteOne();
    logSecurityEvent({ event: 'admin.account_deleted', severity: 'warn', outcome: 'success', req, targetId: req.params.id, meta: { provider: deletedProvider, status: 200 } });
    res.json({ ok: true });
  })
);

export default router;
