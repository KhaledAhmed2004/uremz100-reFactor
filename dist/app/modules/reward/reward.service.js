"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RewardService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const reward_model_1 = require("./reward.model");
const reward_interface_1 = require("./reward.interface");
const reward_constant_1 = require("./reward.constant");
const user_model_1 = require("../user/user.model");
const mongoose_1 = require("mongoose");
// Helper to filter and calculate active bonus balance
const getActiveBonus = (bonusLedger) => {
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
const getWalletDetails = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const wallet = yield reward_model_1.Wallet.findOne({ user: userId });
    if (!wallet) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Wallet not found for this user');
    }
    const { bonusBalance, activeLedgers } = getActiveBonus(wallet.bonusLedger);
    // If there are expired ledgers, optionally clean them up (non-blocking)
    if (activeLedgers.length !== wallet.bonusLedger.length) {
        wallet.bonusLedger = activeLedgers;
        wallet.save().catch(console.error); // Fire and forget
    }
    const transactions = yield reward_model_1.Transaction.find({ wallet: wallet._id })
        .sort({ createdAt: -1 })
        .limit(50); // Get recent 50 transactions
    const progress = yield reward_model_1.UserRewardProgress.findOne({ user: userId });
    return {
        goldBalance: wallet.goldBalance,
        bonusBalance,
        transactions,
        progress,
    };
});
// Generic helper to add bonus coins
const grantBonusCoins = (session, userId, amount, source, description) => __awaiter(void 0, void 0, void 0, function* () {
    const wallet = yield reward_model_1.Wallet.findOne({ user: userId }).session(session);
    if (!wallet)
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Wallet not found');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + reward_constant_1.REWARD_CONFIG.BONUS_EXPIRATION_DAYS);
    wallet.bonusLedger.push({ amount, expiresAt, source });
    yield wallet.save({ session });
    yield reward_model_1.Transaction.create([
        {
            wallet: wallet._id,
            amount,
            type: reward_interface_1.TransactionType.EARN,
            currencyType: reward_interface_1.CurrencyType.BONUS,
            source,
            description,
        },
    ], { session });
    return wallet;
});
const claimWatchTimeReward = (userId, minutes) => __awaiter(void 0, void 0, void 0, function* () {
    const allowedMilestones = Object.keys(reward_constant_1.REWARD_CONFIG.WATCH_TIME).map(Number);
    if (!allowedMilestones.includes(minutes)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid milestone. Allowed milestones: ${allowedMilestones.join(', ')}`);
    }
    const rewardAmount = reward_constant_1.REWARD_CONFIG.WATCH_TIME[minutes];
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const progress = yield reward_model_1.UserRewardProgress.findOne({ user: userId }).session(session);
        if (!progress)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Reward progress not found');
        if (progress.watchTimeMilestonesClaimed.includes(minutes)) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Milestone ${minutes} minutes already claimed`);
        }
        yield grantBonusCoins(session, userId, rewardAmount, reward_interface_1.TransactionSource.WATCH_TIME, `Watched ${minutes} Minutes`);
        progress.watchTimeMilestonesClaimed.push(minutes);
        yield progress.save({ session });
        yield session.commitTransaction();
        session.endSession();
        return { rewardAmount };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const claimFreshWatchTimeReward = (userId, minutes) => __awaiter(void 0, void 0, void 0, function* () {
    const allowedMilestones = Object.keys(reward_constant_1.REWARD_CONFIG.FRESH_DRAMA).map(Number);
    if (!allowedMilestones.includes(minutes)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid milestone. Allowed milestones: ${allowedMilestones.join(', ')}`);
    }
    const rewardAmount = reward_constant_1.REWARD_CONFIG.FRESH_DRAMA[minutes];
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const progress = yield reward_model_1.UserRewardProgress.findOne({ user: userId }).session(session);
        if (!progress)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Reward progress not found');
        if (progress.freshDramaWatchTimeClaimed.includes(minutes)) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Milestone ${minutes} minutes already claimed for fresh dramas`);
        }
        yield grantBonusCoins(session, userId, rewardAmount, reward_interface_1.TransactionSource.FRESH_DRAMA, `Watched Fresh Drama ${minutes} Minutes`);
        progress.freshDramaWatchTimeClaimed.push(minutes);
        yield progress.save({ session });
        yield session.commitTransaction();
        session.endSession();
        return { rewardAmount };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const claimDailyCheckIn = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const progress = yield reward_model_1.UserRewardProgress.findOne({ user: userId }).session(session);
        if (!progress)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Reward progress not found');
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        let lastCheckInUTC = null;
        if (progress.lastCheckInDate) {
            const last = progress.lastCheckInDate;
            lastCheckInUTC = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
        }
        if (lastCheckInUTC && lastCheckInUTC.getTime() === todayUTC.getTime()) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Already checked in today');
        }
        let currentStreak = progress.dailyStreak;
        if (lastCheckInUTC && todayUTC.getTime() - lastCheckInUTC.getTime() === 24 * 60 * 60 * 1000) {
            currentStreak += 1;
        }
        else {
            currentStreak = 1;
        }
        if (currentStreak > 7)
            currentStreak = 1;
        const rewardAmount = reward_constant_1.REWARD_CONFIG.DAILY_CHECK_IN[currentStreak] || 20;
        yield grantBonusCoins(session, userId, rewardAmount, reward_interface_1.TransactionSource.DAILY_CHECK_IN, `Day ${currentStreak} Check-in`);
        progress.dailyStreak = currentStreak;
        progress.lastCheckInDate = todayUTC;
        yield progress.save({ session });
        yield session.commitTransaction();
        session.endSession();
        return { rewardAmount, currentStreak };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const claimWatchAdReward = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const progress = yield reward_model_1.UserRewardProgress.findOne({ user: userId }).session(session);
        if (!progress)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Reward progress not found');
        const today = new Date();
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        let lastAdDateUTC = null;
        if (progress.lastAdWatchDate) {
            const last = progress.lastAdWatchDate;
            lastAdDateUTC = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
        }
        if (!lastAdDateUTC || lastAdDateUTC.getTime() !== todayUTC.getTime()) {
            progress.adsWatchedToday = 0;
        }
        if (progress.adsWatchedToday >= reward_constant_1.REWARD_CONFIG.WATCH_AD.MAX_ADS_PER_DAY) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Maximum ad rewards reached for today');
        }
        const rewardAmount = reward_constant_1.REWARD_CONFIG.WATCH_AD.REWARD_PER_AD;
        yield grantBonusCoins(session, userId, rewardAmount, reward_interface_1.TransactionSource.WATCH_AD, `Watched Ad`);
        progress.adsWatchedToday += 1;
        progress.lastAdWatchDate = todayUTC;
        yield progress.save({ session });
        yield session.commitTransaction();
        session.endSession();
        return { rewardAmount, adsWatchedToday: progress.adsWatchedToday };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const claimNotificationReward = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const progress = yield reward_model_1.UserRewardProgress.findOne({ user: userId }).session(session);
        if (!progress)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Reward progress not found');
        if (progress.hasClaimedNotificationReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Notification reward already claimed');
        }
        const rewardAmount = reward_constant_1.REWARD_CONFIG.ENABLE_NOTIFICATION;
        yield grantBonusCoins(session, userId, rewardAmount, reward_interface_1.TransactionSource.ENABLE_NOTIFICATION, `Enabled Notifications`);
        progress.hasClaimedNotificationReward = true;
        yield progress.save({ session });
        yield session.commitTransaction();
        session.endSession();
        return { rewardAmount };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const claimSocialReward = (userId, platform) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const progress = yield reward_model_1.UserRewardProgress.findOne({ user: userId }).session(session);
        if (!progress)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Reward progress not found');
        if (platform === 'facebook' && progress.hasClaimedFacebookReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Facebook reward already claimed');
        }
        if (platform === 'instagram' && progress.hasClaimedInstagramReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Instagram reward already claimed');
        }
        const rewardAmount = platform === 'facebook' ? reward_constant_1.REWARD_CONFIG.FOLLOW_FACEBOOK : reward_constant_1.REWARD_CONFIG.FOLLOW_INSTAGRAM;
        const source = platform === 'facebook' ? reward_interface_1.TransactionSource.FOLLOW_FACEBOOK : reward_interface_1.TransactionSource.FOLLOW_INSTAGRAM;
        yield grantBonusCoins(session, userId, rewardAmount, source, `Followed on ${platform}`);
        if (platform === 'facebook')
            progress.hasClaimedFacebookReward = true;
        if (platform === 'instagram')
            progress.hasClaimedInstagramReward = true;
        yield progress.save({ session });
        yield session.commitTransaction();
        session.endSession();
        return { rewardAmount };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const claimBindEmailReward = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const progress = yield reward_model_1.UserRewardProgress.findOne({ user: userId }).session(session);
        if (!progress)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Reward progress not found');
        if (progress.hasClaimedBindEmailReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Bind Email reward already claimed');
        }
        const user = yield user_model_1.User.findById(userId);
        if (!user || !user.email || !user.isVerified) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Email is not verified or bound');
        }
        const rewardAmount = reward_constant_1.REWARD_CONFIG.BIND_EMAIL;
        yield grantBonusCoins(session, userId, rewardAmount, reward_interface_1.TransactionSource.BIND_EMAIL, `Bound Email`);
        progress.hasClaimedBindEmailReward = true;
        yield progress.save({ session });
        yield session.commitTransaction();
        session.endSession();
        return { rewardAmount };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const claimLoginReward = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const progress = yield reward_model_1.UserRewardProgress.findOne({ user: userId }).session(session);
        if (!progress)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Reward progress not found');
        if (progress.hasClaimedLoginReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Login reward already claimed');
        }
        const rewardAmount = reward_constant_1.REWARD_CONFIG.LOGIN_REWARD;
        yield grantBonusCoins(session, userId, rewardAmount, reward_interface_1.TransactionSource.LOGIN_REWARD, `Initial Login Reward`);
        progress.hasClaimedLoginReward = true;
        yield progress.save({ session });
        yield session.commitTransaction();
        session.endSession();
        return { rewardAmount };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const claimProfileCompletionReward = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const progress = yield reward_model_1.UserRewardProgress.findOne({ user: userId }).session(session);
        if (!progress)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Reward progress not found');
        if (progress.hasClaimedProfileReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Profile completion reward already claimed');
        }
        const user = yield user_model_1.User.findById(userId);
        if (!user)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
        const isProfileComplete = user.name && user.email && user.profileImage;
        if (!isProfileComplete)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Profile is not 100% complete');
        const rewardAmount = reward_constant_1.REWARD_CONFIG.PROFILE_COMPLETION;
        yield grantBonusCoins(session, userId, rewardAmount, reward_interface_1.TransactionSource.PROFILE_COMPLETION, `Profile Completed`);
        progress.hasClaimedProfileReward = true;
        yield progress.save({ session });
        yield session.commitTransaction();
        session.endSession();
        return { rewardAmount };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
exports.RewardService = {
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
