import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { Wallet, Transaction, UserRewardProgress } from './reward.model';
import { TransactionType, TransactionSource, CurrencyType } from './reward.interface';
import { REWARD_CONFIG } from './reward.constant';
import { User } from '../user/user.model';
import { startSession } from 'mongoose';

// Helper to filter and calculate active bonus balance
const getActiveBonus = (bonusLedger: any[]) => {
  const now = new Date().getTime();
  let bonusBalance = 0;
  const activeLedgers = bonusLedger.filter((ledger) => {
    if (ledger.expiresAt.getTime() > now) {
      bonusBalance += ledger.amount;
      return true;
    }
    return false;
  });
  return { bonusBalance, activeLedgers };
};

const getWalletDetails = async (userId: string) => {
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Wallet not found for this user');
  }

  const { bonusBalance, activeLedgers } = getActiveBonus(wallet.bonusLedger);

  // If there are expired ledgers, optionally clean them up (non-blocking)
  if (activeLedgers.length !== wallet.bonusLedger.length) {
    wallet.bonusLedger = activeLedgers as any;
    wallet.save().catch(console.error); // Fire and forget
  }

  const transactions = await Transaction.find({ wallet: wallet._id })
    .sort({ createdAt: -1 })
    .limit(50); // Get recent 50 transactions

  const progress = await UserRewardProgress.findOne({ user: userId });

  return {
    goldBalance: wallet.goldBalance,
    bonusBalance,
    transactions,
    progress,
  };
};

// Generic helper to add bonus coins
const grantBonusCoins = async (
  session: any,
  userId: string,
  amount: number,
  source: TransactionSource,
  description: string
) => {
  const wallet = await Wallet.findOne({ user: userId }).session(session);
  if (!wallet) throw new ApiError(StatusCodes.NOT_FOUND, 'Wallet not found');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REWARD_CONFIG.BONUS_EXPIRATION_DAYS);

  wallet.bonusLedger.push({ amount, expiresAt, source });
  await wallet.save({ session });

  await Transaction.create(
    [
      {
        wallet: wallet._id,
        amount,
        type: TransactionType.EARN,
        currencyType: CurrencyType.BONUS,
        source,
        description,
      },
    ],
    { session }
  );

  return wallet;
};

const claimWatchTimeReward = async (userId: string, minutes: number) => {
  const allowedMilestones = Object.keys(REWARD_CONFIG.WATCH_TIME).map(Number);
  if (!allowedMilestones.includes(minutes)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid milestone. Allowed milestones: ${allowedMilestones.join(', ')}`);
  }

  const rewardAmount = REWARD_CONFIG.WATCH_TIME[minutes as keyof typeof REWARD_CONFIG.WATCH_TIME];

  const session = await startSession();
  session.startTransaction();
  try {
    const progress = await UserRewardProgress.findOne({ user: userId }).session(session);
    if (!progress) throw new ApiError(StatusCodes.NOT_FOUND, 'Reward progress not found');

    if (progress.watchTimeMilestonesClaimed.includes(minutes)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `Milestone ${minutes} minutes already claimed`);
    }

    await grantBonusCoins(session, userId, rewardAmount, TransactionSource.WATCH_TIME, `Watched ${minutes} Minutes`);

    progress.watchTimeMilestonesClaimed.push(minutes);
    await progress.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { rewardAmount };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const claimFreshWatchTimeReward = async (userId: string, minutes: number) => {
  const allowedMilestones = Object.keys(REWARD_CONFIG.FRESH_DRAMA).map(Number);
  if (!allowedMilestones.includes(minutes)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid milestone. Allowed milestones: ${allowedMilestones.join(', ')}`);
  }

  const rewardAmount = REWARD_CONFIG.FRESH_DRAMA[minutes as keyof typeof REWARD_CONFIG.FRESH_DRAMA];

  const session = await startSession();
  session.startTransaction();
  try {
    const progress = await UserRewardProgress.findOne({ user: userId }).session(session);
    if (!progress) throw new ApiError(StatusCodes.NOT_FOUND, 'Reward progress not found');

    if (progress.freshDramaWatchTimeClaimed.includes(minutes)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `Milestone ${minutes} minutes already claimed for fresh dramas`);
    }

    await grantBonusCoins(session, userId, rewardAmount, TransactionSource.FRESH_DRAMA, `Watched Fresh Drama ${minutes} Minutes`);

    progress.freshDramaWatchTimeClaimed.push(minutes);
    await progress.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { rewardAmount };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const claimDailyCheckIn = async (userId: string) => {
  const session = await startSession();
  session.startTransaction();
  try {
    const progress = await UserRewardProgress.findOne({ user: userId }).session(session);
    if (!progress) throw new ApiError(StatusCodes.NOT_FOUND, 'Reward progress not found');

    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    let lastCheckInUTC: Date | null = null;
    if (progress.lastCheckInDate) {
      const last = progress.lastCheckInDate;
      lastCheckInUTC = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
    }

    if (lastCheckInUTC && lastCheckInUTC.getTime() === todayUTC.getTime()) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Already checked in today');
    }

    let currentStreak = progress.dailyStreak;
    if (lastCheckInUTC && todayUTC.getTime() - lastCheckInUTC.getTime() === 24 * 60 * 60 * 1000) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }

    if (currentStreak > 7) currentStreak = 1;

    const rewardAmount = REWARD_CONFIG.DAILY_CHECK_IN[currentStreak as keyof typeof REWARD_CONFIG.DAILY_CHECK_IN] || 20;

    await grantBonusCoins(session, userId, rewardAmount, TransactionSource.DAILY_CHECK_IN, `Day ${currentStreak} Check-in`);

    progress.dailyStreak = currentStreak;
    progress.lastCheckInDate = todayUTC;
    await progress.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { rewardAmount, currentStreak };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const claimWatchAdReward = async (userId: string) => {
  const session = await startSession();
  session.startTransaction();
  try {
    const progress = await UserRewardProgress.findOne({ user: userId }).session(session);
    if (!progress) throw new ApiError(StatusCodes.NOT_FOUND, 'Reward progress not found');

    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    let lastAdDateUTC: Date | null = null;
    if (progress.lastAdWatchDate) {
      const last = progress.lastAdWatchDate;
      lastAdDateUTC = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
    }

    if (!lastAdDateUTC || lastAdDateUTC.getTime() !== todayUTC.getTime()) {
      progress.adsWatchedToday = 0;
    }

    if (progress.adsWatchedToday >= REWARD_CONFIG.WATCH_AD.MAX_ADS_PER_DAY) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Maximum ad rewards reached for today');
    }

    const rewardAmount = REWARD_CONFIG.WATCH_AD.REWARD_PER_AD;

    await grantBonusCoins(session, userId, rewardAmount, TransactionSource.WATCH_AD, `Watched Ad`);

    progress.adsWatchedToday += 1;
    progress.lastAdWatchDate = todayUTC;
    await progress.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { rewardAmount, adsWatchedToday: progress.adsWatchedToday };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const claimNotificationReward = async (userId: string) => {
  const session = await startSession();
  session.startTransaction();
  try {
    const progress = await UserRewardProgress.findOne({ user: userId }).session(session);
    if (!progress) throw new ApiError(StatusCodes.NOT_FOUND, 'Reward progress not found');

    if (progress.hasClaimedNotificationReward) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Notification reward already claimed');
    }

    const rewardAmount = REWARD_CONFIG.ENABLE_NOTIFICATION;

    await grantBonusCoins(session, userId, rewardAmount, TransactionSource.ENABLE_NOTIFICATION, `Enabled Notifications`);

    progress.hasClaimedNotificationReward = true;
    await progress.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { rewardAmount };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const claimSocialReward = async (userId: string, platform: 'facebook' | 'instagram') => {
  const session = await startSession();
  session.startTransaction();
  try {
    const progress = await UserRewardProgress.findOne({ user: userId }).session(session);
    if (!progress) throw new ApiError(StatusCodes.NOT_FOUND, 'Reward progress not found');

    if (platform === 'facebook' && progress.hasClaimedFacebookReward) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Facebook reward already claimed');
    }
    if (platform === 'instagram' && progress.hasClaimedInstagramReward) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Instagram reward already claimed');
    }

    const rewardAmount = platform === 'facebook' ? REWARD_CONFIG.FOLLOW_FACEBOOK : REWARD_CONFIG.FOLLOW_INSTAGRAM;
    const source = platform === 'facebook' ? TransactionSource.FOLLOW_FACEBOOK : TransactionSource.FOLLOW_INSTAGRAM;

    await grantBonusCoins(session, userId, rewardAmount, source, `Followed on ${platform}`);

    if (platform === 'facebook') progress.hasClaimedFacebookReward = true;
    if (platform === 'instagram') progress.hasClaimedInstagramReward = true;
    await progress.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { rewardAmount };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const claimBindEmailReward = async (userId: string) => {
  const session = await startSession();
  session.startTransaction();
  try {
    const progress = await UserRewardProgress.findOne({ user: userId }).session(session);
    if (!progress) throw new ApiError(StatusCodes.NOT_FOUND, 'Reward progress not found');

    if (progress.hasClaimedBindEmailReward) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Bind Email reward already claimed');
    }

    const user = await User.findById(userId);
    if (!user || !user.email || !user.isVerified) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Email is not verified or bound');
    }

    const rewardAmount = REWARD_CONFIG.BIND_EMAIL;

    await grantBonusCoins(session, userId, rewardAmount, TransactionSource.BIND_EMAIL, `Bound Email`);

    progress.hasClaimedBindEmailReward = true;
    await progress.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { rewardAmount };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const claimLoginReward = async (userId: string) => {
  const session = await startSession();
  session.startTransaction();
  try {
    const progress = await UserRewardProgress.findOne({ user: userId }).session(session);
    if (!progress) throw new ApiError(StatusCodes.NOT_FOUND, 'Reward progress not found');

    if (progress.hasClaimedLoginReward) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Login reward already claimed');
    }

    const rewardAmount = REWARD_CONFIG.LOGIN_REWARD;

    await grantBonusCoins(session, userId, rewardAmount, TransactionSource.LOGIN_REWARD, `Initial Login Reward`);

    progress.hasClaimedLoginReward = true;
    await progress.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { rewardAmount };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const claimProfileCompletionReward = async (userId: string) => {
  const session = await startSession();
  session.startTransaction();
  try {
    const progress = await UserRewardProgress.findOne({ user: userId }).session(session);
    if (!progress) throw new ApiError(StatusCodes.NOT_FOUND, 'Reward progress not found');

    if (progress.hasClaimedProfileReward) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Profile completion reward already claimed');
    }

    const user = await User.findById(userId);
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');

    const isProfileComplete = user.name && user.email && user.profileImage;
    if (!isProfileComplete) throw new ApiError(StatusCodes.BAD_REQUEST, 'Profile is not 100% complete');

    const rewardAmount = REWARD_CONFIG.PROFILE_COMPLETION;

    await grantBonusCoins(session, userId, rewardAmount, TransactionSource.PROFILE_COMPLETION, `Profile Completed`);

    progress.hasClaimedProfileReward = true;
    await progress.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { rewardAmount };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const RewardService = {
  getWalletDetails,
  claimWatchTimeReward,
  claimFreshWatchTimeReward,
  claimDailyCheckIn,
  claimWatchAdReward,
  claimNotificationReward,
  claimSocialReward,
  claimBindEmailReward,
  claimLoginReward,
  claimProfileCompletionReward,
};
