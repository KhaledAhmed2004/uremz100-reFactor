import { Types } from 'mongoose';
import { RecentlyWatched } from '../app/modules/recently-watched/recently-watched.model';
import { Watchlist } from '../app/modules/watchlist/watchlist.model';
import { FavoriteContent } from '../app/modules/favorite-content/favorite-content.model';
import { MyCollection } from '../app/modules/my-collection/my-collection.model';

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
  } catch (error) {
    console.error(`Failed to migrate guest data for guestId: ${guestId}`, error);
  }
};
