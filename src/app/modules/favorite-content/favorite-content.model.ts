import { Model, Schema, model, Types } from 'mongoose';

export interface IFavoriteContent {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
}

export type FavoriteContentModel = Model<IFavoriteContent, Record<string, unknown>>;

const favoriteContentSchema = new Schema<IFavoriteContent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// One favorite per (user, content) pair.
favoriteContentSchema.index({ userId: 1, contentId: 1 }, { unique: true });

export const FavoriteContent = model<IFavoriteContent, FavoriteContentModel>(
  'FavoriteContent',
  favoriteContentSchema,
);
