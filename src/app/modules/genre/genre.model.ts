import { Model, Schema, model } from 'mongoose';

export interface IGenre {
  name: string;
  description?: string;
}

export type GenreModel = Model<IGenre, Record<string, unknown>>;

const genreSchema = new Schema<IGenre>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete (ret as any).__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        delete (ret as any).__v;
        return ret;
      },
    },
  },
);

export const Genre = model<IGenre, GenreModel>('Genre', genreSchema);
