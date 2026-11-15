import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
    type: {
      type: String,
      enum: ['client_delegated', 'client_handled', 'client_sent', 'needs_review', 'new_client_item', 'info'],
      default: 'info',
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema);
