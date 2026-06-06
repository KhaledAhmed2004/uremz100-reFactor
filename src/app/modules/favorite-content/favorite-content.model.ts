import { Model, Schema, model, Types } from 'mongoose';

export interface IFavoriteContent {
  userId?: Types.ObjectId;
  guestId?: string;
  contentId: Types.ObjectId;
}

export type FavoriteContentModel = Model<IFavoriteContent, Record<string, unknown>>;

const favoriteContentSchema = new Schema<IFavoriteContent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    guestId: { type: String, required: false, index: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// One favorite per (user/guest, content) pair.
favoriteContentSchema.index(
  { userId: 1, contentId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } }
);
favoriteContentSchema.index(
  { guestId: 1, contentId: 1 },
  { unique: true, partialFilterExpression: { guestId: { $type: 'string' } } }
);

export const FavoriteContent = model<IFavoriteContent, FavoriteContentModel>(
  'FavoriteContent',
  favoriteContentSchema,
);
