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
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateGuestDataToUser = void 0;
const mongoose_1 = require("mongoose");
const recently_watched_model_1 = require("../app/modules/recently-watched/recently-watched.model");
const watchlist_model_1 = require("../app/modules/watchlist/watchlist.model");
const favorite_content_model_1 = require("../app/modules/favorite-content/favorite-content.model");
const my_collection_model_1 = require("../app/modules/my-collection/my-collection.model");
const reward_model_1 = require("../app/modules/reward/reward.model");
const subscription_model_1 = require("../app/modules/subscription/subscription.model");
const subscription_event_model_1 = require("../app/modules/subscription/subscription-event.model");
const migrateGuestDataToUser = (guestId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!guestId || !userId)
        return;
    const objectId = typeof userId === 'string' ? new mongoose_1.Types.ObjectId(userId) : userId;
    try {
        // Migrate Recently Watched
        yield recently_watched_model_1.RecentlyWatched.updateMany({ guestId }, { $set: { userId: objectId }, $unset: { guestId: "" } });
        // Migrate Watchlist
        yield watchlist_model_1.Watchlist.updateMany({ guestId }, { $set: { userId: objectId }, $unset: { guestId: "" } });
        // Migrate Favorite Content
        yield favorite_content_model_1.FavoriteContent.updateMany({ guestId }, { $set: { userId: objectId }, $unset: { guestId: "" } });
        // Migrate My Collection
        yield my_collection_model_1.MyCollection.updateMany({ guestId }, { $set: { userId: objectId }, $unset: { guestId: "" } });
        // Migrate Wallet and Transactions
        const guestWallet = yield reward_model_1.Wallet.findOne({ guestId });
        if (guestWallet) {
            const userWallet = yield reward_model_1.Wallet.findOne({ user: objectId });
            if (userWallet) {
                userWallet.goldBalance += guestWallet.goldBalance;
                userWallet.bonusLedger.push(...guestWallet.bonusLedger);
                yield userWallet.save();
                // Update transactions to point to the user's wallet
                yield reward_model_1.Transaction.updateMany({ wallet: guestWallet._id }, { $set: { wallet: userWallet._id } });
            }
            yield reward_model_1.Wallet.deleteOne({ guestId });
        }
        // Migrate Reward Progress
        const guestProgress = yield reward_model_1.UserRewardProgress.findOne({ guestId });
        if (guestProgress) {
            const userProgress = yield reward_model_1.UserRewardProgress.findOne({ user: objectId });
            if (userProgress) {
                userProgress.checkInStreak = guestProgress.checkInStreak;
                userProgress.checkInRewards = guestProgress.checkInRewards;
                userProgress.adsWatchedToday = guestProgress.adsWatchedToday;
                userProgress.lastAdWatchDate = guestProgress.lastAdWatchDate;
                userProgress.dailyWatchReward = guestProgress.dailyWatchReward;
                userProgress.freshDramaWatchTimeClaimed = guestProgress.freshDramaWatchTimeClaimed;
                userProgress.hasClaimedNotificationReward = userProgress.hasClaimedNotificationReward || guestProgress.hasClaimedNotificationReward;
                userProgress.hasClaimedFacebookReward = userProgress.hasClaimedFacebookReward || guestProgress.hasClaimedFacebookReward;
                userProgress.hasClaimedInstagramReward = userProgress.hasClaimedInstagramReward || guestProgress.hasClaimedInstagramReward;
                userProgress.hasClaimedYoutubeReward = userProgress.hasClaimedYoutubeReward || guestProgress.hasClaimedYoutubeReward;
                yield userProgress.save();
            }
            yield reward_model_1.UserRewardProgress.deleteOne({ guestId });
        }
        // Migrate Subscription
        yield subscription_model_1.Subscription.updateMany({ guestId }, { $set: { userId: objectId }, $unset: { guestId: "" } });
        // Migrate Subscription Events
        yield subscription_event_model_1.SubscriptionEvent.updateMany({ guestId }, { $set: { userId: objectId }, $unset: { guestId: "" } });
    }
    catch (error) {
        console.error(`Failed to migrate guest data for guestId: ${guestId}`, error);
    }
});
exports.migrateGuestDataToUser = migrateGuestDataToUser;
