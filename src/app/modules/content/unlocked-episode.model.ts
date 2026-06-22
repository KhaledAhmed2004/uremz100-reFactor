import { Model, Schema, Types, model } from 'mongoose';

export interface IUnlockedEpisode {
  userId: Types.ObjectId;
  episodeId: Types.ObjectId;
  unlockedAt: Date;
}

export type UnlockedEpisodeModel = Model<IUnlockedEpisode, Record<string, unknown>>;

const unlockedEpisodeSchema = new Schema<IUnlockedEpisode>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    episodeId: { type: Schema.Types.ObjectId, ref: 'Episode', required: true },
    unlockedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: true,
  },
);

unlockedEpisodeSchema.index({ userId: 1, episodeId: 1 }, { unique: true });

export const UnlockedEpisode = model<IUnlockedEpisode, UnlockedEpisodeModel>('UnlockedEpisode', unlockedEpisodeSchema);
