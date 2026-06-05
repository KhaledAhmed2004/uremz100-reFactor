import { Model, Schema, model, Types } from 'mongoose';

export interface IWatchlist {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
  status: 'added' | 'removed';
}

export type WatchlistModel = Model<IWatchlist, Record<string, unknown>>;

const watchlistSchema = new Schema<IWatchlist>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
    status: { type: String, enum: ['added', 'removed'], default: 'added' },
  },
  {
    timestamps: true,
  },
);

export const Watchlist = model<IWatchlist, WatchlistModel>('Watchlist', watchlistSchema);
