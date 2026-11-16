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
    isAdmin: { type: Boolean, default: false },
    // Assistant Employee Verification
    companyName: { type: String, default: '' },
    employeeId: { type: String, default: '' },
    companyEmail: { type: String, default: '' },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
    },
    verificationToken: { type: String, default: null },
    verificationSentAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    // Customization & Security Preferences
    themePreference: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
    e2eEncryptionEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre('save', function (next) {
  if (this.email === 'iambrook2007@gmail.com') {
    this.isAdmin = true;
  }
  if (this.isDemo && (!this.verificationStatus || this.verificationStatus === 'unverified')) {
    this.verificationStatus = 'verified';
  }
  next();
});

userSchema.methods.toPublic = function toPublic() {
  const isSuperAdmin = this.email === 'iambrook2007@gmail.com' || Boolean(this.isAdmin);
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    title: this.title,
    isAdmin: isSuperAdmin,
    companyName: this.companyName || '',
    employeeId: this.employeeId || '',
    companyEmail: this.companyEmail || '',
    verificationStatus: this.verificationStatus || 'unverified',
    themePreference: this.themePreference || 'light',
    e2eEncryptionEnabled: this.e2eEncryptionEnabled ?? true,
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
