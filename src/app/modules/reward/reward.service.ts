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

const claimWatchTimeReward = async (userId: string, videoDuration: number) => {
  if (videoDuration < 5) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'ভিডিও 5 মিনিট দেখতে হবে রিওয়ার্ড পেতে।');
  }

  let rewardAmount = 0;
  if (videoDuration >= 5 && videoDuration < 10) rewardAmount = 10;
  else if (videoDuration >= 10 && videoDuration < 20) rewardAmount = 15;
  else if (videoDuration >= 20 && videoDuration < 30) rewardAmount = 20;
  else if (videoDuration >= 30 && videoDuration < 40) rewardAmount = 25;
  else if (videoDuration >= 40) rewardAmount = 30;

  if (rewardAmount === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'ভিডিও 5 মিনিট দেখতে হবে রিওয়ার্ড পেতে।');
  }

  const session = await startSession();
  session.startTransaction();
  try {
    const progress = await UserRewardProgress.findOne({ user: userId }).session(session);
    if (!progress) throw new ApiError(StatusCodes.NOT_FOUND, 'Reward progress not found');

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const lastClaimDate = progress.dailyWatchReward?.lastClaimDate;
    if (lastClaimDate) {
      const lastClaimed = new Date(lastClaimDate);
      lastClaimed.setUTCHours(0, 0, 0, 0);

      if (today.getTime() === lastClaimed.getTime()) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'আপনি আজকে রিওয়ার্ড নিয়েছেন। পরের দিনে আবার চেষ্টা করুন।');
      }
    }

    await grantBonusCoins(session, userId, rewardAmount, TransactionSource.WATCH_TIME, `Watched ${videoDuration} Minutes (Daily Reward)`);

    progress.dailyWatchReward = {
      lastClaimDate: new Date(),
      claimedDuration: videoDuration,
    };
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
    const todayUTC = new Date(today);
    todayUTC.setUTCHours(0, 0, 0, 0);

    // Initialize streak structure for backwards compatibility
    if (!progress.checkInStreak) {
      progress.checkInStreak = {
        currentDay: 1,
        totalStreaksCompleted: 0,
        isStreakActive: true,
      };
    }
    if (!progress.checkInRewards) {
      progress.checkInRewards = new Map();
    }

    let lastClaimDateUTC: Date | null = null;
    if (progress.checkInStreak.lastClaimDate) {
      lastClaimDateUTC = new Date(progress.checkInStreak.lastClaimDate);
      lastClaimDateUTC.setUTCHours(0, 0, 0, 0);
    }

    if (lastClaimDateUTC && lastClaimDateUTC.getTime() === todayUTC.getTime()) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Already claimed today');
    }

    let currentDay = progress.checkInStreak.currentDay || 1;

    if (lastClaimDateUTC) {
      const daysMissed = Math.round((todayUTC.getTime() - lastClaimDateUTC.getTime()) / (1000 * 60 * 60 * 24));
      if (daysMissed > 1) {
        currentDay = 1;
        progress.checkInStreak.isStreakActive = false;
        progress.checkInRewards.clear();
      }
    }

    const rewardCoins = REWARD_CONFIG.DAILY_CHECK_IN[currentDay as keyof typeof REWARD_CONFIG.DAILY_CHECK_IN] || 10;

    await grantBonusCoins(session, userId, rewardCoins, TransactionSource.DAILY_CHECK_IN, `Day ${currentDay} Check-in`);

    progress.checkInRewards.set(`day${currentDay}`, { claimed: true, claimedAt: today });
    progress.checkInStreak.lastClaimDate = today;
    progress.checkInStreak.isStreakActive = true;

    if (currentDay === 7) {
      progress.checkInStreak.currentDay = 1;
      progress.checkInStreak.totalStreaksCompleted = (progress.checkInStreak.totalStreaksCompleted || 0) + 1;
      // We don't clear checkInRewards immediately so the UI can show Day 7 claimed, 
      // it will be cleared automatically on the next check-in because daysMissed logic or a cycle reset.
      // Actually, standard is to clear on the start of the next cycle. Let's leave it, 
      // but if currentDay was 7, next checkin will start at 1 anyway.
    } else {
      progress.checkInStreak.currentDay = currentDay + 1;
    }

    await progress.save({ session });
    await session.commitTransaction();
    session.endSession();

    return { 
      success: true,
      coinsEarned: rewardCoins, 
      streakDay: currentDay,
      nextStreakDay: progress.checkInStreak.currentDay
    };
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

const claimSocialReward = async (userId: string, platform: 'facebook' | 'instagram' | 'youtube') => {
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
    if (platform === 'youtube' && progress.hasClaimedYoutubeReward) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'YouTube reward already claimed');
    }

    let rewardAmount = 0;
    let source: TransactionSource;

    if (platform === 'facebook') {
      rewardAmount = REWARD_CONFIG.FOLLOW_FACEBOOK;
      source = TransactionSource.FOLLOW_FACEBOOK;
    } else if (platform === 'instagram') {
      rewardAmount = REWARD_CONFIG.FOLLOW_INSTAGRAM;
      source = TransactionSource.FOLLOW_INSTAGRAM;
    } else {
      rewardAmount = REWARD_CONFIG.FOLLOW_YOUTUBE;
      source = TransactionSource.FOLLOW_YOUTUBE;
    }

    await grantBonusCoins(session, userId, rewardAmount, source, `Followed on ${platform}`);

    if (platform === 'facebook') progress.hasClaimedFacebookReward = true;
    if (platform === 'instagram') progress.hasClaimedInstagramReward = true;
    if (platform === 'youtube') progress.hasClaimedYoutubeReward = true;
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
