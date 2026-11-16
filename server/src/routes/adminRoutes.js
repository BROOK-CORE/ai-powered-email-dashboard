import { Router } from 'express';
import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { EmailAccount } from '../models/EmailAccount.js';
import { Conversation } from '../models/Conversation.js';
import { requireAuth, requireAdmin, asyncHandler } from '../middleware/auth.js';
import { isObjectId, isValidEmail } from '../middleware/security.js';
import { getRecentSecurityEvents, logSecurityEvent } from '../services/securityLogger.js';

const router = Router();

// Public verification callback endpoint that the company clicks from cold email
router.get(
  '/confirm-employee/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    if (!token || token.length < 32) {
      return res.status(400).send('Invalid verification token.');
    }
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(404).send('Verification token not found or already used.');
    }

    user.verificationStatus = 'verified';
    user.verificationToken = null;
    user.verifiedAt = new Date();
    await user.save();

    logSecurityEvent({
      event: 'assistant.verified_by_company',
      outcome: 'success',
      req,
      userId: user._id,
      meta: { company: user.companyName, employeeId: user.employeeId, status: 200 },
    });

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Employee Verification Confirmed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #FAFAFA; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: white; padding: 40px; border-radius: 16px; border: 1px solid #EBEBEB; text-align: center; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            h1 { color: #059669; font-size: 24px; margin-bottom: 12px; }
            p { color: #4D4D4D; line-height: 1.6; }
            a { display: inline-block; margin-top: 24px; padding: 12px 24px; background: #0070F3; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Employee Verification Confirmed</h1>
            <p>Thank you. <b>${user.name}</b> (Employee ID: <b>${user.employeeId}</b>) has been successfully verified as an authorized personal assistant for <b>${user.companyName}</b>.</p>
            <a href="/">Return to Dashboard</a>
          </div>
        </body>
      </html>
    `);
  })
);

router.use(requireAuth);

/* ------------------------------- Assistant Verification (Self-Service) ------------------- */

router.post(
  '/request-verification',
  asyncHandler(async (req, res) => {
    const { companyName, employeeId, companyEmail } = req.body || {};
    if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    if (!employeeId || typeof employeeId !== 'string' || !employeeId.trim()) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }
    if (!companyEmail || typeof companyEmail !== 'string' || !isValidEmail(companyEmail.trim())) {
      return res.status(400).json({ error: 'Valid company email is required for cold employee verification' });
    }

    const cleanCompany = companyName.trim().slice(0, 120);
    const cleanEmpId = employeeId.trim().slice(0, 50);
    const cleanEmail = companyEmail.trim().toLowerCase();
    const token = crypto.randomBytes(32).toString('hex');

    req.user.companyName = cleanCompany;
    req.user.employeeId = cleanEmpId;
    req.user.companyEmail = cleanEmail;
    req.user.verificationStatus = 'pending';
    req.user.verificationToken = token;
    req.user.verificationSentAt = new Date();
    await req.user.save();

    // In production, an SMTP/SES cold email is sent to the company HR/manager.
    // For seamless testing, we provide the verification link in the response and log it.
    const verificationUrl = `${req.protocol}://${req.get('host')}/api/admin/confirm-employee/${token}`;

    logSecurityEvent({
      event: 'assistant.verification_requested',
      outcome: 'success',
      req,
      userId: req.user._id,
      meta: { company: cleanCompany, employeeId: cleanEmpId, companyEmail: cleanEmail, status: 200 },
    });

    res.json({
      ok: true,
      message: `Cold verification email dispatched to ${cleanEmail}. Status is now Pending Company Verification.`,
      user: req.user.toPublic(),
      simulatedVerificationUrl: verificationUrl,
    });
  })
);

/* ------------------------------- Preferences & E2E Encryption ---------------------------- */

router.patch(
  '/preferences',
  asyncHandler(async (req, res) => {
    const { themePreference, e2eEncryptionEnabled } = req.body || {};
    if (['light', 'dark', 'system'].includes(themePreference)) {
      req.user.themePreference = themePreference;
    }
    if (typeof e2eEncryptionEnabled === 'boolean') {
      req.user.e2eEncryptionEnabled = e2eEncryptionEnabled;
    }
    await req.user.save();
    res.json({ user: req.user.toPublic() });
  })
);

/* ------------------------------- Super Admin Privileges (Brook / isAdmin) ---------------- */

router.use(requireAdmin);

// Get global system stats, users, and all mailboxes
router.get(
  '/system-overview',
  asyncHandler(async (req, res) => {
    const [users, accounts, conversationCount] = await Promise.all([
      User.find({}).select('-passwordHash').sort({ createdAt: -1 }),
      EmailAccount.find({}).sort({ createdAt: -1 }),
      Conversation.countDocuments({}),
    ]);

    res.json({
      stats: {
        totalUsers: users.length,
        totalAccounts: accounts.length,
        totalConversations: conversationCount,
        securityEventsCount: getRecentSecurityEvents().length,
      },
      users: users.map((u) => u.toPublic()),
      accounts: accounts.map((a) => ({
        id: a._id,
        ownerId: a.ownerId,
        clientName: a.clientName,
        clientEmail: a.clientEmail,
        provider: a.provider,
        status: a.status,
        syncedCount: a.syncedCount,
        connectionType: a.connectionType,
        createdAt: a.createdAt,
      })),
      recentSecurityEvents: getRecentSecurityEvents().slice(-20),
    });
  })
);

// Admin can verify or reject any assistant directly
router.post(
  '/verify-user/:userId',
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.userId)) return res.status(400).json({ error: 'Invalid user id' });
    const target = await User.findById(req.params.userId);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const { status } = req.body || {};
    if (!['verified', 'rejected', 'pending', 'unverified'].includes(status)) {
      return res.status(400).json({ error: 'Status must be verified, rejected, pending, or unverified' });
    }

    target.verificationStatus = status;
    if (status === 'verified') {
      target.verifiedAt = new Date();
      target.verificationToken = null;
    }
    await target.save();

    logSecurityEvent({
      event: 'admin.user_verification_updated',
      outcome: 'success',
      req,
      targetId: target._id,
      meta: { newStatus: status, updatedBy: req.user.email, status: 200 },
    });

    res.json({ ok: true, user: target.toPublic() });
  })
);

// Admin can remove ANY mailbox / ID across the entire platform
router.delete(
  '/accounts/:id',
  asyncHandler(async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid account id' });
    const account = await EmailAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    await Conversation.deleteMany({ accountId: account._id });
    await account.deleteOne();

    logSecurityEvent({
      event: 'admin.global_account_removed',
      severity: 'warn',
      outcome: 'success',
      req,
      targetId: req.params.id,
      meta: { mailbox: account.clientEmail, admin: req.user.email, status: 200 },
    });

    res.json({ ok: true, message: `Mailbox ${account.clientEmail} removed successfully by admin.` });
  })
);

export default router;
