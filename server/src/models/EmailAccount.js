import mongoose from 'mongoose';

const emailAccountSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clientName: { type: String, required: true },
    clientEmail: { type: String, required: true },
    provider: { type: String, enum: ['gmail', 'outlook', 'custom_api'], required: true },
    connectionType: {
      type: String,
      enum: ['oauth_simulated', 'api_key_bridge', 'imap_live'],
      default: 'oauth_simulated',
    },
    encryptedPassword: { type: String, default: null },
    imapHost: { type: String, default: '' },
    imapPort: { type: Number, default: 993 },
    status: {
      type: String,
      enum: ['connected', 'syncing', 'attention_needed', 'disconnected'],
      default: 'connected',
    },
    lastSyncedAt: { type: Date, default: Date.now },
    syncedCount: { type: Number, default: 0 },
    color: { type: String, default: '#4F46E5' },
  },
  { timestamps: true }
);

export const EmailAccount = mongoose.model('EmailAccount', emailAccountSchema);
