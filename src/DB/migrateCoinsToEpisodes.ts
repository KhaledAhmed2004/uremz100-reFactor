import mongoose from 'mongoose';
import config from '../config';

export const migrateCoinsToEpisodes = async () => {
  try {
    console.log('Connecting to MongoDB for Migration...');
    await mongoose.connect(config.database_url as string);
    const db = mongoose.connection.db!;

    // 1. Migrate Season Coins to Episodes
    console.log('--- 1. Migrating requiredCoin from Seasons to Episodes ---');
    const seasonsCursor = db.collection('seasons').find({ requiredCoin: { $gt: 0 } });
    const seasons = await seasonsCursor.toArray();
    
    console.log(`Found ${seasons.length} seasons that require coins.`);

    for (const season of seasons) {
      // Apply the season's coin requirement to all its episodes
      const result = await db.collection('episodes').updateMany(
        { seasonId: season._id },
        { $set: { requiredCoin: season.requiredCoin } }
      );
      
      console.log(`Updated ${result.modifiedCount} episodes for Season ${season._id}`);
      
      // Clean up the old field from the season
      await db.collection('seasons').updateOne(
        { _id: season._id },
        { $unset: { requiredCoin: "" } }
      );
    }

    // 2. Migrate UnlockedSeason to UnlockedEpisode
    console.log('--- 2. Migrating Unlocked Seasons to Unlocked Episodes ---');
    const unlockedSeasonsCursor = db.collection('unlockedseasons').find({});
    const unlockedSeasons = await unlockedSeasonsCursor.toArray();
    
    console.log(`Found ${unlockedSeasons.length} unlocked season records to migrate.`);

    for (const us of unlockedSeasons) {
      // Find all episodes associated with this unlocked season
      const episodes = await db.collection('episodes').find({ seasonId: us.seasonId }).toArray();
      
      const unlockedEpisodesToInsert = episodes.map(ep => ({
        userId: us.userId,
        episodeId: ep._id,
        unlockedAt: us.createdAt || new Date(),
        createdAt: us.createdAt || new Date(),
        updatedAt: us.updatedAt || new Date()
      }));

      if (unlockedEpisodesToInsert.length > 0) {
        try {
          // ordered: false ensures that if some episodes are already unlocked, it doesn't fail the whole batch
          await db.collection('unlockedepisodes').insertMany(unlockedEpisodesToInsert, { ordered: false });
        } catch (error: any) {
          // Ignore duplicate key errors (code 11000)
          if (error.code !== 11000) {
            console.error(`Error inserting unlocked episodes for user ${us.userId}:`, error);
          }
        }
      }
    }

    console.log('✨ Migration completed successfully!');

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

migrateCoinsToEpisodes().then(() => process.exit(0));
