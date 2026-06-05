import { Model, Schema, model, Types } from 'mongoose';

export interface ISeason {
  title: string;
  poster: string;
  seriesId: Types.ObjectId;
  seasonNumber: number;
}

export type SeasonModel = Model<ISeason, Record<string, unknown>>;

const seasonSchema = new Schema<ISeason>(
  {
    title: { type: String, required: true, trim: true },
    poster: { type: String, required: true },
    seriesId: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
    seasonNumber: { type: Number, required: true },
  },
  {
    timestamps: true,
  },
);

export const Season = model<ISeason, SeasonModel>('Season', seasonSchema);
