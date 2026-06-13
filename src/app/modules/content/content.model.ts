import { Model, Schema, Types, model } from 'mongoose';

export type IGenre = string;

export interface IContent {
  title: string;
  description: string;
  genres: Types.ObjectId[];
  posterUrl?: string;
  videoUrl: string;
  trailerUrl?: string;
  duration: number; // in minutes
  releaseYear: number;
  rating: number;
  views: number;
  dailyViews: number;
  weeklyViews: number;
  totalWatchTime: number; // in seconds
  engagementScore: number;
  trendingScore: number;
  cast?: string[];
  type: 'SERIES' | 'MOVIE';
  isPremium?: boolean;
  releaseDate?: Date;
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
    posterUrl: { type: String },
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
    dailyViews: { type: Number, default: 0 },
    weeklyViews: { type: Number, default: 0 },
    totalWatchTime: { type: Number, default: 0 },
    engagementScore: { type: Number, default: 0 },
    trendingScore: { type: Number, default: 0 },
    cast: { type: [String], default: [] },
    type: { type: String, enum: ['SERIES', 'MOVIE'], required: true },
    isPremium: { type: Boolean },
    releaseDate: { type: Date },
    isPopularSeries: { type: Boolean, default: false },
    youtubeId: { type: String },
    channelName: { type: String },
    publishedAt: { type: Date, default: () => new Date(), index: true },
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

contentSchema.virtual('isRecent').get(function() {
  // If publishedAt exists, use it; otherwise use createdAt
  const date = this.publishedAt || (this as any).createdAt;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  return date && date >= thirtyDaysAgo;
});

export const Content = model<IContent, ContentModel>('Content', contentSchema);
