import { Model, Schema, model, Types } from 'mongoose';

export interface IReview {
  userId: Types.ObjectId;
  contentId: Types.ObjectId;
  rating: number;
  comment: string;
}

export type ReviewModel = Model<IReview, Record<string, unknown>>;

const reviewSchema = new Schema<IReview>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

export const Review = model<IReview, ReviewModel>('Review', reviewSchema);
