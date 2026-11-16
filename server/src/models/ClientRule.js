import mongoose from 'mongoose';

const clientRuleSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    matchType: {
      type: String,
      enum: ['from_email', 'subject_contains', 'domain'],
      required: true,
    },
    matchValue: { type: String, required: true, trim: true },
    targetCategory: {
      type: String,
      required: true,
      trim: true,
      // Can be: 'important', 'action_required', 'waiting_response', 'ai_reply', or a custom category slug
    },
    action: {
      type: String,
      enum: ['route_to_category', 'mark_important', 'auto_draft'],
      default: 'route_to_category',
    },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const ClientRule = mongoose.model('ClientRule', clientRuleSchema);
