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
// Helper to automatically create wallet/progress for guests
const getOrCreateWalletAndProgress = (ownerQuery, session) => __awaiter(void 0, void 0, void 0, function* () {
    const options = session ? { session } : {};
    let wallet = yield reward_model_1.Wallet.findOne(ownerQuery).session(session || null);
    let progress = yield reward_model_1.UserRewardProgress.findOne(ownerQuery).session(session || null);
    if (!wallet) {
        const newWallet = new reward_model_1.Wallet(Object.assign(Object.assign({}, ownerQuery), { goldBalance: 0, bonusLedger: [] }));
        wallet = yield newWallet.save(options);
    }
    if (!progress) {
        const newProgress = new reward_model_1.UserRewardProgress(ownerQuery);
        progress = yield newProgress.save(options);
    }
    return { wallet, progress };
});
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
const getWalletDetails = (ownerQuery) => __awaiter(void 0, void 0, void 0, function* () {
    const { wallet } = yield getOrCreateWalletAndProgress(ownerQuery);
    const { bonusBalance, activeLedgers } = getActiveBonus(wallet.bonusLedger);
    // If there are expired ledgers, optionally clean them up (non-blocking)
    if (activeLedgers.length !== wallet.bonusLedger.length) {
        wallet.bonusLedger = activeLedgers;
        wallet.save().catch(console.error); // Fire and forget
    }
    const progressDoc = yield reward_model_1.UserRewardProgress.findOne(ownerQuery).lean();
    let progress = null;
    if (progressDoc) {
        progress = Object.assign(Object.assign({}, progressDoc), { dailyWatchReward: progressDoc.dailyWatchReward || {
                lastClaimDate: null,
                claimedDuration: 0,
            } });
        // Remove fields from the response DTO
        delete progress.freshDramaWatchTimeClaimed;
        delete progress.hasClaimedBindEmailReward;
        delete progress.hasClaimedProfileReward;
    }
    return {
        coinBalance: wallet.goldBalance + bonusBalance,
        progress,
    };
});
// Generic helper to add bonus coins
const grantBonusCoins = (session, ownerQuery, amount, source, description) => __awaiter(void 0, void 0, void 0, function* () {
    const { wallet } = yield getOrCreateWalletAndProgress(ownerQuery, session);
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
const claimWatchTimeReward = (ownerQuery, videoDuration) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (videoDuration < 5) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'ভিডিও 5 মিনিট দেখতে হবে রিওয়ার্ড পেতে।');
    }
    let rewardAmount = 0;
    if (videoDuration >= 5 && videoDuration < 10)
        rewardAmount = 10;
    else if (videoDuration >= 10 && videoDuration < 20)
        rewardAmount = 15;
    else if (videoDuration >= 20 && videoDuration < 30)
        rewardAmount = 20;
    else if (videoDuration >= 30 && videoDuration < 40)
        rewardAmount = 25;
    else if (videoDuration >= 40)
        rewardAmount = 30;
    if (rewardAmount === 0) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'ভিডিও 5 মিনিট দেখতে হবে রিওয়ার্ড পেতে।');
    }
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const { progress } = yield getOrCreateWalletAndProgress(ownerQuery, session);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const lastClaimDate = (_a = progress.dailyWatchReward) === null || _a === void 0 ? void 0 : _a.lastClaimDate;
        if (lastClaimDate) {
            const lastClaimed = new Date(lastClaimDate);
            lastClaimed.setUTCHours(0, 0, 0, 0);
            if (today.getTime() === lastClaimed.getTime()) {
                throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'আপনি আজকে রিওয়ার্ড নিয়েছেন। পরের দিনে আবার চেষ্টা করুন।');
            }
        }
        yield grantBonusCoins(session, ownerQuery, rewardAmount, reward_interface_1.TransactionSource.WATCH_TIME, `Watched ${videoDuration} Minutes (Daily Reward)`);
        progress.dailyWatchReward = {
            lastClaimDate: new Date(),
            claimedDuration: videoDuration,
        };
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
const claimFreshWatchTimeReward = (ownerQuery, minutes) => __awaiter(void 0, void 0, void 0, function* () {
    const allowedMilestones = Object.keys(reward_constant_1.REWARD_CONFIG.FRESH_DRAMA).map(Number);
    if (!allowedMilestones.includes(minutes)) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Invalid milestone. Allowed milestones: ${allowedMilestones.join(', ')}`);
    }
    const rewardAmount = reward_constant_1.REWARD_CONFIG.FRESH_DRAMA[minutes];
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const { progress } = yield getOrCreateWalletAndProgress(ownerQuery, session);
        if (progress.freshDramaWatchTimeClaimed.includes(minutes)) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, `Milestone ${minutes} minutes already claimed for fresh dramas`);
        }
        yield grantBonusCoins(session, ownerQuery, rewardAmount, reward_interface_1.TransactionSource.FRESH_DRAMA, `Watched Fresh Drama ${minutes} Minutes`);
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
const claimDailyCheckIn = (ownerQuery) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const { progress } = yield getOrCreateWalletAndProgress(ownerQuery, session);
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
            progress.checkInRewards = {};
        }
        let lastClaimDateUTC = null;
        if (progress.checkInStreak.lastClaimDate) {
            lastClaimDateUTC = new Date(progress.checkInStreak.lastClaimDate);
            lastClaimDateUTC.setUTCHours(0, 0, 0, 0);
        }
        if (lastClaimDateUTC && lastClaimDateUTC.getTime() === todayUTC.getTime()) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Already claimed today');
        }
        let currentDay = progress.checkInStreak.currentDay || 1;
        if (lastClaimDateUTC) {
            const daysMissed = Math.round((todayUTC.getTime() - lastClaimDateUTC.getTime()) / (1000 * 60 * 60 * 24));
            if (daysMissed > 1) {
                currentDay = 1;
                progress.checkInStreak.isStreakActive = false;
                progress.checkInRewards = {};
            }
        }
        const rewardCoins = reward_constant_1.REWARD_CONFIG.DAILY_CHECK_IN[currentDay] || 10;
        yield grantBonusCoins(session, ownerQuery, rewardCoins, reward_interface_1.TransactionSource.DAILY_CHECK_IN, `Day ${currentDay} Check-in`);
        progress.checkInRewards[`day${currentDay}`] = { claimed: true, claimedAt: today };
        progress.checkInStreak.lastClaimDate = today;
        progress.checkInStreak.isStreakActive = true;
        if (currentDay === 7) {
            progress.checkInStreak.currentDay = 1;
            progress.checkInStreak.totalStreaksCompleted = (progress.checkInStreak.totalStreaksCompleted || 0) + 1;
            // We don't clear checkInRewards immediately so the UI can show Day 7 claimed, 
            // it will be cleared automatically on the next check-in because daysMissed logic or a cycle reset.
            // Actually, standard is to clear on the start of the next cycle. Let's leave it, 
            // but if currentDay was 7, next checkin will start at 1 anyway.
        }
        else {
            progress.checkInStreak.currentDay = currentDay + 1;
        }
        yield progress.save({ session });
        yield session.commitTransaction();
        session.endSession();
        return {
            success: true,
            coinsEarned: rewardCoins,
            streakDay: currentDay,
            nextStreakDay: progress.checkInStreak.currentDay
        };
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const claimWatchAdReward = (ownerQuery) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const { progress } = yield getOrCreateWalletAndProgress(ownerQuery, session);
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
        yield grantBonusCoins(session, ownerQuery, rewardAmount, reward_interface_1.TransactionSource.WATCH_AD, `Watched Ad`);
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
const claimNotificationReward = (ownerQuery) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const { progress } = yield getOrCreateWalletAndProgress(ownerQuery, session);
        if (progress.hasClaimedNotificationReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Notification reward already claimed');
        }
        const rewardAmount = reward_constant_1.REWARD_CONFIG.ENABLE_NOTIFICATION;
        yield grantBonusCoins(session, ownerQuery, rewardAmount, reward_interface_1.TransactionSource.ENABLE_NOTIFICATION, `Enabled Notifications`);
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
const claimSocialReward = (ownerQuery, platform) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const { progress } = yield getOrCreateWalletAndProgress(ownerQuery, session);
        if (platform === 'facebook' && progress.hasClaimedFacebookReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Facebook reward already claimed');
        }
        if (platform === 'instagram' && progress.hasClaimedInstagramReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Instagram reward already claimed');
        }
        if (platform === 'youtube' && progress.hasClaimedYoutubeReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'YouTube reward already claimed');
        }
        let rewardAmount = 0;
        let source;
        if (platform === 'facebook') {
            rewardAmount = reward_constant_1.REWARD_CONFIG.FOLLOW_FACEBOOK;
            source = reward_interface_1.TransactionSource.FOLLOW_FACEBOOK;
        }
        else if (platform === 'instagram') {
            rewardAmount = reward_constant_1.REWARD_CONFIG.FOLLOW_INSTAGRAM;
            source = reward_interface_1.TransactionSource.FOLLOW_INSTAGRAM;
        }
        else {
            rewardAmount = reward_constant_1.REWARD_CONFIG.FOLLOW_YOUTUBE;
            source = reward_interface_1.TransactionSource.FOLLOW_YOUTUBE;
        }
        yield grantBonusCoins(session, ownerQuery, rewardAmount, source, `Followed on ${platform}`);
        if (platform === 'facebook')
            progress.hasClaimedFacebookReward = true;
        if (platform === 'instagram')
            progress.hasClaimedInstagramReward = true;
        if (platform === 'youtube')
            progress.hasClaimedYoutubeReward = true;
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
const claimBindEmailReward = (ownerQuery) => __awaiter(void 0, void 0, void 0, function* () {
    if (ownerQuery.guestId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Please register an account to claim the bind email reward');
    }
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const { progress } = yield getOrCreateWalletAndProgress(ownerQuery, session);
        if (progress.hasClaimedBindEmailReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Bind Email reward already claimed');
        }
        const user = yield user_model_1.User.findById(ownerQuery.user);
        if (!user || !user.email || !user.isVerified) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Email is not verified or bound');
        }
        const rewardAmount = reward_constant_1.REWARD_CONFIG.BIND_EMAIL;
        yield grantBonusCoins(session, ownerQuery, rewardAmount, reward_interface_1.TransactionSource.BIND_EMAIL, `Bound Email`);
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
const claimLoginReward = (ownerQuery) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const { progress } = yield getOrCreateWalletAndProgress(ownerQuery, session);
        if (progress.hasClaimedLoginReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Login reward already claimed');
        }
        const rewardAmount = reward_constant_1.REWARD_CONFIG.LOGIN_REWARD;
        yield grantBonusCoins(session, ownerQuery, rewardAmount, reward_interface_1.TransactionSource.LOGIN_REWARD, `Initial Login Reward`);
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
const claimProfileCompletionReward = (ownerQuery) => __awaiter(void 0, void 0, void 0, function* () {
    if (ownerQuery.guestId) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Please register an account to claim the profile completion reward');
    }
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        const { progress } = yield getOrCreateWalletAndProgress(ownerQuery, session);
        if (progress.hasClaimedProfileReward) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Profile completion reward already claimed');
        }
        const user = yield user_model_1.User.findById(ownerQuery.user);
        if (!user)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'User not found');
        const isProfileComplete = user.name && user.email && user.profileImage;
        if (!isProfileComplete)
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Profile is not 100% complete');
        const rewardAmount = reward_constant_1.REWARD_CONFIG.PROFILE_COMPLETION;
        yield grantBonusCoins(session, ownerQuery, rewardAmount, reward_interface_1.TransactionSource.PROFILE_COMPLETION, `Profile Completed`);
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
const deductCoinsForUnlock = (userId, amount) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield (0, mongoose_1.startSession)();
    session.startTransaction();
    try {
        // We pass { user: userId } as the ownerQuery.
        const ownerQuery = { user: userId };
        const { wallet } = yield getOrCreateWalletAndProgress(ownerQuery, session);
        const { bonusBalance, activeLedgers } = getActiveBonus(wallet.bonusLedger);
        if (wallet.goldBalance + bonusBalance < amount) {
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.PAYMENT_REQUIRED, 'Insufficient coin balance to unlock this content');
        }
        let amountToDeduct = amount;
        // Prioritize deducting from active bonus ledgers (sort by earliest expiration)
        if (bonusBalance > 0 && amountToDeduct > 0) {
            const sortedLedgers = activeLedgers.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
            for (const ledger of sortedLedgers) {
                if (amountToDeduct <= 0)
                    break;
                if (ledger.amount <= amountToDeduct) {
                    amountToDeduct -= ledger.amount;
                    ledger.amount = 0;
                }
                else {
                    ledger.amount -= amountToDeduct;
                    amountToDeduct = 0;
                }
            }
            // Re-assign back to wallet. Filter out ledgers with 0 amount to clean up.
            wallet.bonusLedger = wallet.bonusLedger.filter(l => l.amount > 0);
        }
        // If there's still an amount left, deduct from goldBalance
        if (amountToDeduct > 0) {
            wallet.goldBalance -= amountToDeduct;
        }
        yield wallet.save({ session });
        yield reward_model_1.Transaction.create([
            {
                wallet: wallet._id,
                amount,
                type: reward_interface_1.TransactionType.SPEND,
                currencyType: reward_interface_1.CurrencyType.GOLD, // Or MIXED, but GOLD is fine as a generic spend
                source: reward_interface_1.TransactionSource.SPEND_UNLOCK,
                description: `Spent ${amount} coins to unlock content`,
            },
        ], { session });
        yield session.commitTransaction();
        session.endSession();
        return { success: true, amountDeducted: amount };
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
    deductCoinsForUnlock,
};
