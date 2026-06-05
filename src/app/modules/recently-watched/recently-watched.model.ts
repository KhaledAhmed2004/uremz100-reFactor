import { Model, Schema, model, Types } from 'mongoose';

export interface IRecentlyWatched {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
  lastWatchedAt: Date;
  watchedSeconds: number;
  completionPercentage: number;
}

export type RecentlyWatchedModel = Model<IRecentlyWatched, Record<string, unknown>>;

const recentlyWatchedSchema = new Schema<IRecentlyWatched>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
    lastWatchedAt: { type: Date, default: Date.now },
    watchedSeconds: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

// One recently watched record per user-content pair — update lastWatchedAt on revisit.
recentlyWatchedSchema.index({ userId: 1, contentId: 1 }, { unique: true });

export const RecentlyWatched = model<IRecentlyWatched, RecentlyWatchedModel>(
  'RecentlyWatched',
  recentlyWatchedSchema,
);
