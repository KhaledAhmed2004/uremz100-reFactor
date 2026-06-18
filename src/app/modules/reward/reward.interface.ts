import { Model, Types } from 'mongoose';

export interface IBonusLedger {
  amount: number;
  expiresAt: Date;
  source: string;
}

export interface IWallet {
  user?: Types.ObjectId;
  guestId?: string;
  goldBalance: number;
  bonusLedger: IBonusLedger[];
}

export type WalletModel = Model<IWallet, Record<string, unknown>>;

export enum TransactionType {
  EARN = 'earn',
  SPEND = 'spend',
}

export enum CurrencyType {
  GOLD = 'gold',
  BONUS = 'bonus',
}

export enum TransactionSource {
  WATCH_TIME = 'watch_time',
  DAILY_CHECK_IN = 'daily_check_in',
  WATCH_AD = 'watch_ad',
  ENABLE_NOTIFICATION = 'enable_notification',
  PROFILE_COMPLETION = 'profile_completion',
  FOLLOW_FACEBOOK = 'follow_facebook',
  FOLLOW_INSTAGRAM = 'follow_instagram',
  FOLLOW_YOUTUBE = 'follow_youtube',
  BIND_EMAIL = 'bind_email',
  FRESH_DRAMA = 'fresh_drama',
  LOGIN_REWARD = 'login_reward',
  SPEND_UNLOCK = 'spend_unlock',
}

export interface ITransaction {
  wallet: Types.ObjectId;
  amount: number;
  type: TransactionType;
  currencyType: CurrencyType;
  source: TransactionSource;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TransactionModel = Model<ITransaction, Record<string, unknown>>;

export interface IUserRewardProgress {
  user?: Types.ObjectId;
  guestId?: string;
  checkInStreak: {
    currentDay: number;
    lastClaimDate?: Date;
    totalStreaksCompleted: number;
    isStreakActive: boolean;
  };
  checkInRewards: Record<
    string,
    {
      claimed: boolean;
      claimedAt?: Date;
    }
  >;
  adsWatchedToday: number;
  lastAdWatchDate?: Date;
  dailyWatchReward: {
    lastClaimDate?: Date;
    claimedDuration?: number;
  };
  hasClaimedNotificationReward: boolean;
  hasClaimedProfileReward: boolean;
  hasClaimedFacebookReward: boolean;
  hasClaimedInstagramReward: boolean;
  hasClaimedYoutubeReward: boolean;
  hasClaimedBindEmailReward: boolean;
  hasClaimedLoginReward: boolean;
  freshDramaWatchTimeClaimed: number[];
}

export type UserRewardProgressModel = Model<IUserRewardProgress, Record<string, unknown>>;
