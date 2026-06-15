import { Schema, model } from 'mongoose';
import { IRevenueTransaction, RevenueTransactionModel, REVENUE_PLATFORM, REVENUE_STATUS } from './revenue.interface';

const revenueTransactionSchema = new Schema<IRevenueTransaction, RevenueTransactionModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trxId: { type: String, required: true, unique: true, index: true },
    coinAmount: { type: Number, required: true, default: 0 },
    subscriptionAmount: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: 'USD' },
    platform: { type: String, enum: Object.values(REVENUE_PLATFORM), required: true },
    status: { type: String, enum: Object.values(REVENUE_STATUS), required: true, default: REVENUE_STATUS.SUCCESS },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// Indexes for revenue calculations over time
revenueTransactionSchema.index({ createdAt: -1 });
revenueTransactionSchema.index({ status: 1, createdAt: -1 });

export const RevenueTransaction = model<IRevenueTransaction, RevenueTransactionModel>('RevenueTransaction', revenueTransactionSchema);
