import { Model, Schema, model, Types } from 'mongoose';

export interface IMyCollection {
  userId: Types.ObjectId;
  itemType: 'MOVIE' | 'SERIES' | 'SEASON' | 'EPISODE';
  itemId: Types.ObjectId;
  itemModel: 'Content' | 'Season' | 'Episode';
}

export type MyCollectionModel = Model<IMyCollection, Record<string, unknown>>;

const myCollectionSchema = new Schema<IMyCollection>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    itemType: { 
      type: String, 
      enum: ['MOVIE', 'SERIES', 'SEASON', 'EPISODE'], 
      required: true 
    },
    itemId: { 
      type: Schema.Types.ObjectId, 
      required: true,
      refPath: 'itemModel' 
    },
    itemModel: {
      type: String,
      required: true,
      enum: ['Content', 'Season', 'Episode']
    }
  },
  {
    timestamps: true,
  },
);

// One unique entry per user and specific item
myCollectionSchema.index({ userId: 1, itemId: 1 }, { unique: true });

export const MyCollection = model<IMyCollection, MyCollectionModel>(
  'MyCollection',
  myCollectionSchema,
);
