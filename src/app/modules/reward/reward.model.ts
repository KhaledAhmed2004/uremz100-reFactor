import { Schema, model } from 'mongoose';
import {
  IWallet,
  WalletModel,
  ITransaction,
  TransactionModel,
  IUserRewardProgress,
  UserRewardProgressModel,
  TransactionType,
  TransactionSource,
  CurrencyType,
} from './reward.interface';

const bonusLedgerSchema = new Schema(
  {
    amount: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    source: { type: String, required: true },
  },
  { _id: false }
);

const walletSchema = new Schema<IWallet, WalletModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    goldBalance: { type: Number, required: true, default: 0 },
    bonusLedger: { type: [bonusLedgerSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

export const Wallet = model<IWallet, WalletModel>('Wallet', walletSchema);

const transactionSchema = new Schema<ITransaction, TransactionModel>(
  {
    wallet: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: Object.values(TransactionType), required: true },
    currencyType: { type: String, enum: Object.values(CurrencyType), required: true },
    source: { type: String, enum: Object.values(TransactionSource), required: true },
    description: { type: String },
  },
  {
    timestamps: true,
  },
);

export const Transaction = model<ITransaction, TransactionModel>('Transaction', transactionSchema);

const userRewardProgressSchema = new Schema<IUserRewardProgress, UserRewardProgressModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    dailyStreak: { type: Number, default: 0 },
    lastCheckInDate: { type: Date },
    adsWatchedToday: { type: Number, default: 0 },
    lastAdWatchDate: { type: Date },
    watchTimeMilestonesClaimed: { type: [Number], default: [] },
    hasClaimedNotificationReward: { type: Boolean, default: false },
    hasClaimedProfileReward: { type: Boolean, default: false },
    hasClaimedFacebookReward: { type: Boolean, default: false },
    hasClaimedInstagramReward: { type: Boolean, default: false },
    hasClaimedBindEmailReward: { type: Boolean, default: false },
    hasClaimedLoginReward: { type: Boolean, default: false },
    freshDramaWatchTimeClaimed: { type: [Number], default: [] },
  },
  {
    timestamps: true,
  },
);

export const UserRewardProgress = model<IUserRewardProgress, UserRewardProgressModel>(
  'UserRewardProgress',
  userRewardProgressSchema,
);

