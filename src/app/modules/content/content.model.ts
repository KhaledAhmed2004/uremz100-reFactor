import { Model, Schema, Types, model } from 'mongoose';

export type IGenre = string;

export interface IContent {
  title: string;
  description: string;
  genres: Types.ObjectId[];
  poster?: string;
  videoUrl: string;
  trailerUrl?: string;
  duration: number; // in minutes
  releaseYear: number;
  rating: number;
  views: number;
  cast?: string[];
  type: 'SERIES' | 'MOVIE';
  isPremium?: boolean;
  isRecent?: boolean;
  isPopularSeries: boolean;
  youtubeId?: string;
  channelName?: string;
  publishedAt?: Date;
  planStatus: ('FREE' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL')[];
  status: 'PUBLISHED' | 'DRAFT';
  seasonsCount?: number;
  totalEpisodes?: number;
}

export type ContentModel = Model<IContent, Record<string, unknown>>;

const contentSchema = new Schema<IContent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    genres: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Genre' }],
      required: true,
      default: [],
    },
    poster: { type: String },
    videoUrl: {
      type: String,
      required: function (this: any) {
        return this.type === 'MOVIE';
      },
    },
    trailerUrl: { type: String },
    duration: { type: Number, required: true },
    releaseYear: { type: Number, required: true },
    rating: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    cast: { type: [String], default: [] },
    type: { type: String, enum: ['SERIES', 'MOVIE'], required: true },
    isPremium: { type: Boolean },
    isRecent: { type: Boolean },
    isPopularSeries: { type: Boolean, default: false },
    youtubeId: { type: String },
    channelName: { type: String },
    publishedAt: { type: Date },
    planStatus: {
      type: [String],
      enum: ['FREE', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ALL'],
      default: ['FREE'],
    },
    status: {
      type: String,
      enum: ['PUBLISHED', 'DRAFT'],
      default: 'PUBLISHED',
    },
    seasonsCount: { type: Number, default: 0 },
    totalEpisodes: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

export const Content = model<IContent, ContentModel>('Content', contentSchema);
