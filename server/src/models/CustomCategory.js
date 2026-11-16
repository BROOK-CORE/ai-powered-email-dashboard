import mongoose from 'mongoose';

const customCategorySchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    color: { type: String, default: '#0070F3' },
    description: { type: String, default: '' },
    icon: { type: String, default: 'tag' },
  },
  { timestamps: true }
);

customCategorySchema.index({ ownerId: 1, slug: 1 }, { unique: true });

export const CustomCategory = mongoose.model('CustomCategory', customCategorySchema);
