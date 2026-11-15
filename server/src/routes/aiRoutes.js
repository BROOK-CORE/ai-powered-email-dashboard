import { Router } from 'express';
import { Conversation } from '../models/Conversation.js';
import { requireAuth, requireAssistant, asyncHandler } from '../middleware/auth.js';
import { answerInboxQuery } from '../services/aiService.js';

const router = Router();
router.use(requireAuth, requireAssistant);

router.post(
  '/query',
  asyncHandler(async (req, res) => {
    const question = String(req.body?.question || '').trim();
    if (question.length < 2) return res.status(400).json({ error: 'Ask a question about your inbox' });
    const { conversationId } = req.body || {};
    let convs = await Conversation.find({ ownerId: req.ownerId, status: { $in: ['open', 'waiting_response', 'completed'] } }).sort({ lastMessageAt: -1 }).limit(80);

    // Thread-scoped questions ("summarize this conversation", "why was this assigned to the client?").
    if (conversationId && /^[a-f\d]{24}$/i.test(conversationId)) {
      const focus = convs.find((c) => String(c._id) === conversationId);
      if (focus && /(this|conversation|thread|email)/i.test(question) && /(summar|why|explain|what)/i.test(question)) {
        const why = /why/i.test(question);
        const answer = why
          ? `${focus.classificationReason}${focus.responsibility === 'client_to_reply' && focus.clientActionWhy ? ` ${focus.clientActionWhy}` : ''} (AI confidence ${Math.round(focus.aiConfidence * 100)}%)`
          : `${focus.oneLineTakeaway}\n\n${focus.aiSummary}${focus.highlights?.length ? `\n\nKey points: ${focus.highlights.join(' · ')}` : ''}`;
        return res.json({ answer, conversationIds: [String(focus._id)], engine: 'thread' });
      }
    }
    const result = await answerInboxQuery(question, convs);
    const items = await Conversation.find({ _id: { $in: result.conversationIds }, ownerId: req.ownerId }).select('subject clientName responsibility status oneLineTakeaway isUnread');
    const order = new Map(result.conversationIds.map((id, i) => [id, i]));
    items.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));
    res.json({ answer: result.answer, engine: result.engine, conversations: items.map((c) => ({ id: c._id, subject: c.subject, clientName: c.clientName, responsibility: c.responsibility, status: c.status, takeaway: c.oneLineTakeaway, isUnread: c.isUnread })) });
  })
);

export default router;
