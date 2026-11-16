import { classifyAndAnalyzeThread } from './aiService.js';
import { Conversation } from '../models/Conversation.js';
import { Notification } from '../models/Notification.js';
import { ClientRule } from '../models/ClientRule.js';
import { encryptConversationMessages, decryptConversationMessages } from './encryptionService.js';

/**
 * Apply client rules defined by the executive / client onto the conversation.
 * Rules can match from_email, domain, or subject keywords and route to categories.
 */
export async function applyClientRules(conv) {
  if (!conv || !conv.ownerId) return conv;
  try {
    const rules = await ClientRule.find({ ownerId: conv.ownerId, isActive: true }).sort({ priority: 1, createdAt: 1 });
    if (!rules || rules.length === 0) return conv;

    const senders = (conv.participants || []).map((p) => (p.email || '').toLowerCase().trim());
    const subject = (conv.subject || '').toLowerCase();

    for (const rule of rules) {
      const val = (rule.matchValue || '').toLowerCase().trim();
      let matched = false;

      if (rule.matchType === 'from_email') {
        matched = senders.some((s) => s === val || s.includes(val));
      } else if (rule.matchType === 'domain') {
        const domain = val.replace(/^@/, '');
        matched = senders.some((s) => s.endsWith('@' + domain) || s.includes('@' + domain));
      } else if (rule.matchType === 'subject_contains') {
        matched = subject.includes(val);
      }

      if (matched) {
        const cat = rule.targetCategory;
        if (cat === 'important') {
          conv.isImportant = true;
          if (!conv.segments.includes('important')) conv.segments.push('important');
          conv.customCategory = 'Important';
        } else if (cat === 'action_required') {
          if (!conv.segments.includes('action_required')) conv.segments.push('action_required');
          conv.status = 'open';
          conv.customCategory = 'Immediate Action Required';
        } else if (cat === 'waiting_response') {
          conv.status = 'waiting_response';
          if (!conv.segments.includes('waiting_response')) conv.segments.push('waiting_response');
          conv.customCategory = 'Waiting for Response';
        } else if (cat === 'ai_reply') {
          conv.responsibility = 'assistant_to_reply';
          conv.customCategory = 'AI to Reply';
        } else {
          conv.customCategory = cat;
          if (!conv.segments.includes(cat)) conv.segments.push(cat);
        }

        conv.classificationReason = (conv.classificationReason ? `${conv.classificationReason} · ` : '') + `Rule: "${rule.name}"`;
        conv.responsibilityHistory.push({
          from: null,
          to: conv.responsibility,
          reason: `Client rule: "${rule.name}" -> ${cat}`,
          source: 'client',
        });
        break; // Match highest priority rule
      }
    }
  } catch (err) {
    console.error('[rules] error applying client rules:', err.message);
  }
  return conv;
}

/**
 * Apply an AI analysis result onto a conversation document (does not save).
 * Handles manual-override protection and records responsibility changes in history.
 */
export function applyAnalysis(conv, analysis, { reconsider = false } = {}) {
  const prev = conv.responsibility;
  let next = analysis.responsibility;
  let source = reconsider ? 'ai-reconsider' : 'ai';

  if (conv.manualOverride && prev && next !== prev) {
    // Respect the assistant's correction unless the AI is now clearly confident the thread changed.
    if (analysis.confidence >= 0.8) {
      conv.manualOverride = false;
    } else {
      next = prev;
      source = null;
    }
  }

  conv.responsibility = next;
  conv.aiConfidence = analysis.confidence;
  conv.needsReview = conv.manualOverride ? false : analysis.needsReview;
  conv.classificationReason = analysis.classificationReason;
  conv.clientActionWhy = next === 'client_to_reply' ? analysis.clientActionWhy : '';
  conv.oneLineTakeaway = analysis.oneLineTakeaway;
  conv.aiSummary = analysis.aiSummary;
  conv.highlights = analysis.highlights;
  conv.extractedDates = analysis.extractedDates;
  conv.quickActionChips = next === 'client_to_reply' ? analysis.quickActionChips : [];
  conv.segments = analysis.segments;

  if (!prev || (prev !== next && source)) {
    conv.responsibilityHistory.push({ from: prev || null, to: next, reason: analysis.classificationReason, source: source || 'ai' });
  }
  return conv;
}

export async function analyzeConversation(conv, opts = {}) {
  const analysis = await classifyAndAnalyzeThread(conv);
  applyAnalysis(conv, analysis, opts);
  await applyClientRules(conv);
  return conv;
}

export function refreshSnippet(conv) {
  const last = conv.messages[conv.messages.length - 1];
  conv.snippet = (last?.body || '').replace(/\s+/g, ' ').slice(0, 140);
  conv.lastMessageAt = last?.sentAt || new Date();
  conv.participants = Array.from(
    new Map(conv.messages.map((m) => [m.senderEmail, { name: m.senderName, email: m.senderEmail }])).values()
  );
}

export async function notify(ownerId, { conversationId = null, type = 'info', title, body = '' }) {
  return Notification.create({ ownerId, conversationId, type, title, body });
}

export async function findOwned(ownerId, id) {
  if (!/^[a-f\d]{24}$/i.test(String(id))) return null;
  return Conversation.findOne({ _id: id, ownerId });
}

/** Segment filters shared by list endpoint. */
export function segmentQuery(segment) {
  switch (segment) {
    case 'assistant_to_reply':
    case 'ai_reply':
      return { responsibility: 'assistant_to_reply', status: { $in: ['open', 'waiting_response'] } };
    case 'client_to_reply':
      return { responsibility: 'client_to_reply', status: { $in: ['open', 'waiting_response'] } };
    case 'no_reply_needed':
      return { responsibility: 'no_reply_needed', status: { $in: ['open', 'waiting_response'] } };
    case 'action_required':
      return { segments: 'action_required', status: 'open' };
    case 'waiting_response':
      return { status: 'waiting_response' };
    case 'meetings':
      return { segments: 'meetings', status: { $in: ['open', 'waiting_response'] } };
    case 'important':
      return {
        $or: [{ isImportant: true }, { segments: 'important' }, { customCategory: 'Important' }],
        status: { $in: ['open', 'waiting_response'] },
      };
    case 'general':
      return { segments: 'general', status: { $in: ['open', 'waiting_response'] } };
    case 'unread':
      return { isUnread: true, status: { $in: ['open', 'waiting_response'] } };
    case 'needs_review':
      return { needsReview: true, status: { $in: ['open', 'waiting_response'] } };
    case 'completed':
      return { status: 'completed' };
    case 'archived':
      return { status: 'archived' };
    default:
      if (segment && segment !== 'all') {
        return {
          $or: [{ customCategory: segment }, { segments: segment }],
          status: { $in: ['open', 'waiting_response'] },
        };
      }
      return { status: { $in: ['open', 'waiting_response'] } };
  }
}
