import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: '' },
    role: { type: String, enum: ['assistant', 'client'], required: true },
    // Clients are linked to the assistant that manages their inbox.
    assistantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    title: { type: String, default: '' },
    onboardingCompleted: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
    voiceTone: { type: String, default: 'executive' },
    tokenVersion: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    title: this.title,
    onboardingCompleted: this.onboardingCompleted,
    assistantId: this.assistantId,
    initials: this.name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  };
};

export const User = mongoose.model('User', userSchema);
