import mongoose from 'mongoose';
import { Content } from '../src/app/modules/content/content.model';
import { Season } from '../src/app/modules/content/season.model';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/uremz100';

async function migrate() {
  try {
    console.log(`Connecting to MongoDB: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    const seriesList = await Content.find({ type: 'SERIES' });
    console.log(`Found ${seriesList.length} series to process...`);

    for (const series of seriesList) {
      const { posterUrl, trailerUrl, _id, title } = series as any;
      
      // If either of these exist at the root level, we migrate them
      if (posterUrl || trailerUrl) {
        console.log(`Migrating series: "${title}" (ID: ${_id})`);

        // Get the first season to migrate these to
        const firstSeason = await Season.findOne({ seriesId: _id }).sort('seasonNumber');
        
        if (firstSeason) {
          let updated = false;
          if (posterUrl && !firstSeason.posterUrl) {
            firstSeason.posterUrl = posterUrl;
            updated = true;
          }
          if (trailerUrl && !firstSeason.trailerUrl) {
            firstSeason.trailerUrl = trailerUrl;
            updated = true;
          }
          if (updated) {
            await firstSeason.save();
            console.log(` -> Added poster/trailer to Season 1 of ${title}`);
          }
        } else {
          console.log(` -> Warning: No season found for ${title}. Cannot migrate poster/trailer.`);
        }

        // Unset from the main Content document
        await Content.updateOne(
          { _id },
          { $unset: { posterUrl: "", trailerUrl: "" } }
        );
        console.log(` -> Removed poster/trailer from main series document`);
      } else {
        console.log(`Skipping "${title}", already migrated.`);
      }
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB');
  }
}

migrate();
