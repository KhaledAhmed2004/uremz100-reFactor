import { Model, Schema, Types, model } from 'mongoose';

export interface IUnlockedContent {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
  unlockedAt: Date;
}

export type UnlockedContentModel = Model<IUnlockedContent, Record<string, unknown>>;

const unlockedContentSchema = new Schema<IUnlockedContent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
    unlockedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: true,
  },
);

unlockedContentSchema.index({ userId: 1, contentId: 1 }, { unique: true });

export const UnlockedContent = model<IUnlockedContent, UnlockedContentModel>('UnlockedContent', unlockedContentSchema);
