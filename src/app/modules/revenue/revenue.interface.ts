import { Model, Types } from 'mongoose';

export enum REVENUE_PLATFORM {
  APPLE = 'apple',
  GOOGLE = 'google',
  STRIPE = 'stripe',
  ADMIN = 'admin',
}

export enum REVENUE_STATUS {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface IRevenueTransaction {
  userId: Types.ObjectId;
  trxId: string;
  coinAmount: number;
  subscriptionAmount: number;
  totalAmount: number;
  currency: string;
  platform: REVENUE_PLATFORM;
  status: REVENUE_STATUS;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RevenueTransactionModel = Model<IRevenueTransaction, Record<string, unknown>>;
