import { Model, Schema, model } from 'mongoose';

export interface IVisitor {
  ipAddress: string;
  userAgent: string;
  path: string;
  referrer: string;
  metadata?: Record<string, unknown>;
}

export type VisitorModel = Model<IVisitor, Record<string, unknown>>;

const visitorSchema = new Schema<IVisitor>(
  {
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    path: { type: String, required: true },
    referrer: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  },
);

export const Visitor = model<IVisitor, VisitorModel>('Visitor', visitorSchema);
