import { classifyAndAnalyzeThread } from './aiService.js';
import { Conversation } from '../models/Conversation.js';
import { Notification } from '../models/Notification.js';

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
    case 'client_to_reply':
    case 'no_reply_needed':
      return { responsibility: segment, status: { $in: ['open', 'waiting_response'] } };
    case 'action_required':
      return { segments: 'action_required', status: 'open' };
    case 'waiting_response':
      return { status: 'waiting_response' };
    case 'meetings':
      return { segments: 'meetings', status: { $in: ['open', 'waiting_response'] } };
    case 'important':
      return { $or: [{ isImportant: true }, { segments: 'important' }], status: { $in: ['open', 'waiting_response'] } };
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
      return { status: { $in: ['open', 'waiting_response'] } };
  }
}
