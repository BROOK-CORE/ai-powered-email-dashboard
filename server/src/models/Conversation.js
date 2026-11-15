import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    senderName: String,
    senderEmail: String,
    direction: { type: String, enum: ['inbound', 'outbound'], default: 'inbound' },
    body: String,
    sentAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const conversationSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailAccount', required: true, index: true },
    clientName: { type: String, required: true },
    provider: { type: String, default: 'gmail' },
    subject: { type: String, required: true },
    participants: [{ name: String, email: String, _id: false }],
    snippet: { type: String, default: '' },
    messages: [messageSchema],

    responsibility: {
      type: String,
      enum: ['assistant_to_reply', 'client_to_reply', 'no_reply_needed'],
      required: true,
      index: true,
    },
    aiConfidence: { type: Number, min: 0, max: 1, default: 0.9 },
    needsReview: { type: Boolean, default: false },
    manualOverride: { type: Boolean, default: false },
    classificationReason: { type: String, default: '' },
    clientActionWhy: { type: String, default: '' },
    responsibilityHistory: [
      {
        from: String,
        to: String,
        reason: String,
        source: { type: String, enum: ['ai', 'ai-reconsider', 'assistant', 'client'], default: 'ai' },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],

    oneLineTakeaway: { type: String, default: '' },
    aiSummary: { type: String, default: '' },
    highlights: [{ type: String }],
    extractedDates: [
      {
        label: String,
        dateText: String,
        isoDate: String,
        type: { type: String, enum: ['meeting', 'deadline', 'followup'], default: 'meeting' },
        _id: false,
      },
    ],
    quickActionChips: [
      {
        label: String,
        intentPrompt: String,
        actionType: { type: String, enum: ['approve', 'schedule', 'counter', 'decline'], default: 'approve' },
        _id: false,
      },
    ],
    segments: [{ type: String }],

    status: {
      type: String,
      enum: ['open', 'waiting_response', 'completed', 'archived'],
      default: 'open',
      index: true,
    },
    isUnread: { type: Boolean, default: true },
    isImportant: { type: Boolean, default: false },

    stagedForClient: { type: Boolean, default: false },
    paContextNote: { type: String, default: '' },
    snoozedUntil: { type: Date, default: null },
    undoableSendUntil: { type: Date, default: null },
    draftReply: {
      body: { type: String, default: '' },
      tone: { type: String, default: 'professional' },
      approved: { type: Boolean, default: false },
      updatedAt: Date,
    },
    delegatedByClientNote: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model('Conversation', conversationSchema);
