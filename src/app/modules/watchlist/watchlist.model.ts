import { Model, Schema, model, Types } from 'mongoose';

export interface IWatchlist {
  userId?: Types.ObjectId;
  guestId?: string;
  contentId: Types.ObjectId;
  status: 'added' | 'removed';
}

export type WatchlistModel = Model<IWatchlist, Record<string, unknown>>;

const watchlistSchema = new Schema<IWatchlist>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    guestId: { type: String, required: false, index: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
    status: { type: String, enum: ['added', 'removed'], default: 'added' },
  },
  {
    timestamps: true,
  },
);

watchlistSchema.index(
  { userId: 1, contentId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } }
);
watchlistSchema.index(
  { guestId: 1, contentId: 1 },
  { unique: true, partialFilterExpression: { guestId: { $type: 'string' } } }
);

export const Watchlist = model<IWatchlist, WatchlistModel>('Watchlist', watchlistSchema);
