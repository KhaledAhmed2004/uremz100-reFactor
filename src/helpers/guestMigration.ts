import { Types } from 'mongoose';
import { RecentlyWatched } from '../app/modules/recently-watched/recently-watched.model';
import { Watchlist } from '../app/modules/watchlist/watchlist.model';
import { FavoriteContent } from '../app/modules/favorite-content/favorite-content.model';
import { MyCollection } from '../app/modules/my-collection/my-collection.model';
import { Wallet, UserRewardProgress, Transaction } from '../app/modules/reward/reward.model';
import { Subscription } from '../app/modules/subscription/subscription.model';
import { SubscriptionEvent } from '../app/modules/subscription/subscription-event.model';

export const migrateGuestDataToUser = async (guestId: string, userId: string | Types.ObjectId) => {
  if (!guestId || !userId) return;

  const objectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  try {
    // Migrate Recently Watched
    await RecentlyWatched.updateMany(
      { guestId },
      { $set: { userId: objectId }, $unset: { guestId: "" } }
    );

    // Migrate Watchlist
    await Watchlist.updateMany(
      { guestId },
      { $set: { userId: objectId }, $unset: { guestId: "" } }
    );

    // Migrate Favorite Content
    await FavoriteContent.updateMany(
      { guestId },
      { $set: { userId: objectId }, $unset: { guestId: "" } }
    );

    // Migrate My Collection
    await MyCollection.updateMany(
      { guestId },
      { $set: { userId: objectId }, $unset: { guestId: "" } }
    );

    // Migrate Wallet and Transactions
    const guestWallet = await Wallet.findOne({ guestId });
    if (guestWallet) {
      const userWallet = await Wallet.findOne({ user: objectId });
      if (userWallet) {
        userWallet.goldBalance += guestWallet.goldBalance;
        userWallet.bonusLedger.push(...guestWallet.bonusLedger);
        await userWallet.save();

        // Update transactions to point to the user's wallet
        await Transaction.updateMany(
          { wallet: guestWallet._id },
          { $set: { wallet: userWallet._id } }
        );
      }
      await Wallet.deleteOne({ guestId });
    }

    // Migrate Reward Progress
    const guestProgress = await UserRewardProgress.findOne({ guestId });
    if (guestProgress) {
      const userProgress = await UserRewardProgress.findOne({ user: objectId });
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
        
        await userProgress.save();
      }
      await UserRewardProgress.deleteOne({ guestId });
    }

    // Migrate Subscription
    await Subscription.updateMany(
      { guestId },
      { $set: { userId: objectId }, $unset: { guestId: "" } }
    );

    // Migrate Subscription Events
    await SubscriptionEvent.updateMany(
      { guestId },
      { $set: { userId: objectId }, $unset: { guestId: "" } }
    );

  } catch (error) {
    console.error(`Failed to migrate guest data for guestId: ${guestId}`, error);
  }
};
