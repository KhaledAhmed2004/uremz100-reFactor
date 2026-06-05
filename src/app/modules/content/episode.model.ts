import { Model, Schema, model, Types } from 'mongoose';

export interface IEpisode {
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: number; // in minutes
  releaseDate: Date;
  planStatus: 'FREE' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL';
  status: 'PUBLISHED' | 'DRAFT';
  seriesId: Types.ObjectId;
  seasonId: Types.ObjectId; // Linked to the Season model
  seasonNumber: number; // For easy sorting and display
  episodeNumber: number;
}

export type EpisodeModel = Model<IEpisode, Record<string, unknown>>;

const episodeSchema = new Schema<IEpisode>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    thumbnail: { type: String, required: true },
    videoUrl: { type: String, required: true },
    duration: { type: Number, required: true },
    releaseDate: { type: Date, required: true },
    planStatus: {
      type: String,
      enum: ['FREE', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ALL'],
      default: 'FREE',
    },
    status: {
      type: String,
      enum: ['PUBLISHED', 'DRAFT'],
      default: 'PUBLISHED',
    },
    seriesId: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
    seasonId: { type: Schema.Types.ObjectId, ref: 'Season', required: true },
    seasonNumber: { type: Number, required: true },
    episodeNumber: { type: Number, required: true },
  },
  {
    timestamps: true,
  },
);

export const Episode = model<IEpisode, EpisodeModel>('Episode', episodeSchema);
