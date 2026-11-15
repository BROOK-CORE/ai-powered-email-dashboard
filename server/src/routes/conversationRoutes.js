import { Router } from 'express';
import { Conversation } from '../models/Conversation.js';
import { EmailAccount } from '../models/EmailAccount.js';
import { requireAuth, requireAssistant, asyncHandler } from '../middleware/auth.js';
import { analyzeConversation, refreshSnippet, notify, findOwned, segmentQuery } from '../services/conversationService.js';
import { draftReply, expandQuickIntentToReply, audioBrief } from '../services/aiService.js';

const router = Router();
router.use(requireAuth);

const UNDO_WINDOW_MS = 5000;
const ACTIVE = { $in: ['open', 'waiting_response'] };

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function view(c) {
  const o = c.toObject ? c.toObject() : c;
  return { ...o, id: o._id };
}

function listView(c) {
  const o = view(c);
  // Keep list payloads light: full bodies only on detail.
  o.messageCount = o.messages?.length || 0;
  delete o.messages;
  return o;
}

async function computeStats(ownerId, accountId) {
  const base = { ownerId, ...(accountId ? { accountId } : {}) };
  const [total, unread, important, actionRequired, waiting, assistantToReply, clientToReply, needsReview, completed, noReply] = await Promise.all([
    Conversation.countDocuments({ ...base, status: ACTIVE }),
    Conversation.countDocuments({ ...base, status: ACTIVE, isUnread: true }),
    Conversation.countDocuments({ ...base, status: ACTIVE, $or: [{ isImportant: true }, { segments: 'important' }] }),
    Conversation.countDocuments({ ...base, status: 'open', segments: 'action_required' }),
    Conversation.countDocuments({ ...base, status: 'waiting_response' }),
    Conversation.countDocuments({ ...base, status: ACTIVE, responsibility: 'assistant_to_reply' }),
    Conversation.countDocuments({ ...base, status: ACTIVE, responsibility: 'client_to_reply' }),
    Conversation.countDocuments({ ...base, status: ACTIVE, needsReview: true }),
    Conversation.countDocuments({ ...base, status: 'completed' }),
    Conversation.countDocuments({ ...base, status: ACTIVE, responsibility: 'no_reply_needed' }),
  ]);
  return { total, unread, important, actionRequired, waitingResponse: waiting, assistantToReply, clientToReply, needsReview, completed, noReplyNeeded: noReply };
}

async function upcomingEvents(ownerId) {
  const convs = await Conversation.find({ ownerId, status: ACTIVE, 'extractedDates.0': { $exists: true } })
    .select('subject clientName extractedDates responsibility')
    .lean();
  const events = [];
  for (const c of convs) {
    for (const d of c.extractedDates) {
      events.push({
        conversationId: c._id,
        clientName: c.clientName,
        subject: c.subject,
        label: d.label || c.subject,
        dateText: d.dateText,
        isoDate: d.isoDate || null,
        type: d.type,
      });
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  return events
    .filter((e) => !e.isoDate || e.isoDate >= today)
    .sort((a, b) => (a.isoDate || '9999').localeCompare(b.isoDate || '9999'))
    .slice(0, 6);
}

/* ------------------------------- Client portal ------------------------------------------ */

async function clientQueue(ownerId) {
  const now = new Date();
  const items = await Conversation.find({
    ownerId,
    responsibility: 'client_to_reply',
    status: 'open',
    $or: [{ snoozedUntil: null }, { snoozedUntil: { $lte: now } }],
  }).sort({ isImportant: -1, stagedForClient: -1, lastMessageAt: -1 });
  const snoozed = await Conversation.countDocuments({ ownerId, responsibility: 'client_to_reply', status: 'open', snoozedUntil: { $gt: now } });
  const handled = await Conversation.countDocuments({ ownerId, responsibility: 'client_to_reply', status: { $in: ['completed', 'waiting_response'] } });
  return { items, snoozed, handled };
}

router.get(
  '/client-queue',
  asyncHandler(async (req, res) => {
    const { items, snoozed, handled } = await clientQueue(req.ownerId);
    const name = req.user.role === 'client' ? req.user.name : (await import('../models/User.js').then((m) => m.User.findOne({ assistantId: req.ownerId, role: 'client' })))?.name;
    res.json({
      clientName: name || null,
      items: items.map(view),
      snoozedCount: snoozed,
      handledCount: handled,
      audioBriefText: audioBrief(items, name),
    });
  })
);

/* ------------------------------- Listing ------------------------------------------------ */

router.get(
  '/',
  requireAssistant,
  asyncHandler(async (req, res) => {
    const { segment, accountId, search, needsReview } = req.query;
    const q = { ownerId: req.ownerId, ...segmentQuery(segment) };
    if (accountId) q.accountId = accountId;
    if (needsReview === 'true') q.needsReview = true;
    if (search && String(search).trim()) {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      q.$and = [{ $or: [{ subject: rx }, { clientName: rx }, { snippet: rx }, { aiSummary: rx }, { 'messages.senderName': rx }, { 'messages.senderEmail': rx }, { 'messages.body': rx }] }];
    }
    const [items, stats, upcoming] = await Promise.all([
      Conversation.find(q).sort({ lastMessageAt: -1 }).limit(200),
      computeStats(req.ownerId, accountId),
      upcomingEvents(req.ownerId),
    ]);
    res.json({ items: items.map(listView), stats, upcoming });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const conv = await findOwned(req.ownerId, req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (req.user.role === 'client' && conv.responsibility !== 'client_to_reply' && conv.status === 'open') {
      return res.status(403).json({ error: 'Not available in the client view' });
    }
    res.json({ conversation: view(conv) });
  })
);

/* ------------------------------- Assistant actions -------------------------------------- */

router.patch(
  '/:id',
  requireAssistant,
  asyncHandler(async (req, res) => {
    const conv = await findOwned(req.ownerId, req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const b = req.body || {};

    if (b.responsibility && b.responsibility !== conv.responsibility) {
      if (!['assistant_to_reply', 'client_to_reply', 'no_reply_needed'].includes(b.responsibility)) return res.status(400).json({ error: 'Invalid responsibility' });
      conv.responsibilityHistory.push({ from: conv.responsibility, to: b.responsibility, reason: 'Changed manually by the assistant', source: 'assistant' });
      conv.responsibility = b.responsibility;
      conv.manualOverride = true;
      conv.needsReview = false;
      conv.classificationReason = 'Set manually by the assistant.';
      if (b.responsibility !== 'client_to_reply') {
        conv.stagedForClient = false;
        conv.clientActionWhy = '';
      } else if (!conv.clientActionWhy) {
        conv.clientActionWhy = 'Your assistant marked this as needing your personal reply.';
      }
    }
    if (b.dismissReview) conv.needsReview = false;
    if (typeof b.isImportant === 'boolean') conv.isImportant = b.isImportant;
    if (typeof b.isUnread === 'boolean') conv.isUnread = b.isUnread;
    if (['open', 'waiting_response', 'completed', 'archived'].includes(b.status)) conv.status = b.status;
    if (typeof b.stagedForClient === 'boolean') conv.stagedForClient = b.stagedForClient;
    if (typeof b.paContextNote === 'string') conv.paContextNote = b.paContextNote.slice(0, 400);
    if (typeof b.draftBody === 'string') {
      conv.draftReply = { body: b.draftBody, tone: b.tone || conv.draftReply?.tone || 'professional', approved: false, updatedAt: new Date() };
    }
    await conv.save();
    res.json({ conversation: view(conv) });
  })
);

router.post(
  '/:id/reply',
  requireAssistant,
  asyncHandler(async (req, res) => {
    const conv = await findOwned(req.ownerId, req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Reply body is required' });
    const account = await EmailAccount.findById(conv.accountId);
    conv.messages.push({ senderName: `${req.user.name} (for ${conv.clientName.split(' ')[0]})`, senderEmail: account?.clientEmail || 'assistant', direction: 'outbound', body, sentAt: new Date() });
    conv.status = 'waiting_response';
    conv.isUnread = false;
    conv.stagedForClient = false;
    conv.draftReply = { body: '', approved: false };
    refreshSnippet(conv);
    await conv.save();
    res.json({ conversation: view(conv) });
  })
);

router.post(
  '/simulate',
  requireAssistant,
  asyncHandler(async (req, res) => {
    const { conversationId, accountId, fromName, fromEmail, subject, body } = req.body || {};
    if (!body || String(body).trim().length < 5) return res.status(400).json({ error: 'Write the email body to simulate' });

    let conv;
    let created = false;
    if (conversationId) {
      conv = await findOwned(req.ownerId, conversationId);
      if (!conv) return res.status(404).json({ error: 'Conversation not found' });
      const last = [...conv.messages].reverse().find((m) => m.direction === 'inbound');
      conv.messages.push({ senderName: fromName || last?.senderName || 'Sender', senderEmail: fromEmail || last?.senderEmail || 'sender@example.com', direction: 'inbound', body, sentAt: new Date() });
      if (conv.status === 'completed' || conv.status === 'waiting_response') conv.status = 'open';
    } else {
      const account = accountId ? await EmailAccount.findOne({ _id: accountId, ownerId: req.ownerId }) : await EmailAccount.findOne({ ownerId: req.ownerId }).sort({ createdAt: 1 });
      if (!account) return res.status(400).json({ error: 'Connect an email account first' });
      if (!subject) return res.status(400).json({ error: 'Subject is required for a new email' });
      created = true;
      conv = new Conversation({
        ownerId: req.ownerId,
        accountId: account._id,
        clientName: account.clientName,
        provider: account.provider,
        subject,
        messages: [{ senderName: fromName || 'New Sender', senderEmail: fromEmail || 'sender@example.com', direction: 'inbound', body, sentAt: new Date() }],
        responsibility: 'assistant_to_reply',
      });
    }
    conv.isUnread = true;
    refreshSnippet(conv);
    const before = conv.responsibility;
    await analyzeConversation(conv, { reconsider: !created });
    await conv.save();

    if (conv.responsibility === 'client_to_reply') {
      await notify(req.ownerId, { conversationId: conv._id, type: 'new_client_item', title: 'New item needs the client', body: conv.oneLineTakeaway });
    } else if (conv.needsReview) {
      await notify(req.ownerId, { conversationId: conv._id, type: 'needs_review', title: 'AI unsure — please review', body: conv.subject });
    }
    res.status(created ? 201 : 200).json({ conversation: view(conv), created, changedFrom: before !== conv.responsibility && !created ? before : null });
  })
);

/* ------------------------------- Client actions ----------------------------------------- */

function tomorrowMorning() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

async function sendAsClient(conv, req, body) {
  const account = await EmailAccount.findById(conv.accountId);
  conv.messages.push({ senderName: conv.clientName, senderEmail: account?.clientEmail || 'client', direction: 'outbound', body, sentAt: new Date() });
  conv.status = 'waiting_response';
  conv.isUnread = false;
  conv.stagedForClient = false;
  conv.snoozedUntil = null;
  conv.draftReply = { body: '', approved: true, updatedAt: new Date() };
  conv.undoableSendUntil = new Date(Date.now() + UNDO_WINDOW_MS);
  refreshSnippet(conv);
}

router.post(
  '/:id/client-action',
  asyncHandler(async (req, res) => {
    const conv = await findOwned(req.ownerId, req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const { action, note, chipIndex, text } = req.body || {};
    const clientFirst = conv.clientName.split(' ')[0];
    let message = '';

    switch (action) {
      case 'approve_and_send': {
        const body = String(text || conv.draftReply?.body || '').trim();
        if (!body) return res.status(400).json({ error: 'There is no draft to send yet' });
        await sendAsClient(conv, req, body);
        await notify(req.ownerId, { conversationId: conv._id, type: 'client_sent', title: `${clientFirst} approved & sent a reply`, body: conv.subject });
        message = 'Sent';
        break;
      }
      case 'quick_chip': {
        const chip = conv.quickActionChips?.[Number(chipIndex)];
        if (!chip) return res.status(400).json({ error: 'Unknown action' });
        const body = await expandQuickIntentToReply(conv, chip.intentPrompt);
        await sendAsClient(conv, req, body);
        await notify(req.ownerId, { conversationId: conv._id, type: 'client_sent', title: `${clientFirst} replied: “${chip.label}”`, body: conv.subject });
        message = `Sent: ${chip.label}`;
        break;
      }
      case 'quick_intent': {
        const intent = String(text || '').trim();
        if (intent.length < 3) return res.status(400).json({ error: 'Tell me in a few words what you want to say' });
        const body = await expandQuickIntentToReply(conv, intent);
        conv.draftReply = { body, tone: 'executive', approved: false, updatedAt: new Date() };
        conv.stagedForClient = true;
        message = 'Draft ready to review';
        break;
      }
      case 'snooze':
        conv.snoozedUntil = tomorrowMorning();
        message = 'Snoozed until tomorrow morning';
        break;
      case 'mark_handled':
        conv.status = 'completed';
        conv.isUnread = false;
        conv.snoozedUntil = null;
        await notify(req.ownerId, { conversationId: conv._id, type: 'client_handled', title: `${clientFirst} marked an item as handled`, body: conv.subject });
        message = 'Marked as handled';
        break;
      case 'delegate_to_assistant':
        conv.responsibilityHistory.push({ from: conv.responsibility, to: 'assistant_to_reply', reason: note ? `Client delegated: ${note}` : 'Client asked the assistant to take over', source: 'client' });
        conv.responsibility = 'assistant_to_reply';
        conv.manualOverride = true;
        conv.needsReview = false;
        conv.stagedForClient = false;
        conv.clientActionWhy = '';
        conv.quickActionChips = [];
        conv.snoozedUntil = null;
        conv.delegatedByClientNote = String(note || '').slice(0, 400);
        conv.classificationReason = 'The client asked the assistant to take over.';
        await notify(req.ownerId, { conversationId: conv._id, type: 'client_delegated', title: `${clientFirst} handed an email back to you`, body: note ? `“${note}” — ${conv.subject}` : conv.subject });
        message = 'Handed to your assistant';
        break;
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
    await conv.save();
    res.json({ conversation: view(conv), message, undoUntil: conv.undoableSendUntil });
  })
);

router.post(
  '/:id/undo-send',
  asyncHandler(async (req, res) => {
    const conv = await findOwned(req.ownerId, req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!conv.undoableSendUntil || conv.undoableSendUntil < new Date()) return res.status(409).json({ error: 'The undo window has passed' });
    const last = conv.messages[conv.messages.length - 1];
    if (last?.direction !== 'outbound') return res.status(409).json({ error: 'Nothing to undo' });
    conv.draftReply = { body: last.body, tone: 'executive', approved: false, updatedAt: new Date() };
    conv.messages.pop();
    conv.status = 'open';
    conv.undoableSendUntil = null;
    conv.stagedForClient = true;
    refreshSnippet(conv);
    await conv.save();
    res.json({ conversation: view(conv), message: 'Send undone' });
  })
);

/* ------------------------------- AI helpers --------------------------------------------- */

router.post(
  '/:id/reanalyze',
  requireAssistant,
  asyncHandler(async (req, res) => {
    const conv = await findOwned(req.ownerId, req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    await analyzeConversation(conv, { reconsider: true });
    await conv.save();
    res.json({ conversation: view(conv) });
  })
);

router.post(
  '/:id/draft',
  requireAssistant,
  asyncHandler(async (req, res) => {
    const conv = await findOwned(req.ownerId, req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const { tone = 'professional', instruction = '', asClient = false } = req.body || {};
    const body = await draftReply(conv, { tone, instruction, asClient });
    conv.draftReply = { body, tone, approved: false, updatedAt: new Date() };
    await conv.save();
    res.json({ conversation: view(conv), draft: body });
  })
);

export default router;
