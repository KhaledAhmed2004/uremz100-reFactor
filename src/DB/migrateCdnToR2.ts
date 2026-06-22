import mongoose from 'mongoose';
import config from '../config';

const OLD_DOMAIN = 'https://uremz-video-stream.b-cdn.net';
const NEW_DOMAIN = 'https://pub-085e3de5d2824de0bd78d99ef319730e.r2.dev';

export const migrateCdnToR2 = async () => {
  try {
    console.log(`Connecting to MongoDB to migrate CDN links...`);
    await mongoose.connect(config.database_url as string);
    const db = mongoose.connection.db!;

    const replaceDomain = (url: any) => {
      if (typeof url === 'string' && url.includes(OLD_DOMAIN)) {
        return url.replace(OLD_DOMAIN, NEW_DOMAIN);
      }
      return url;
    };

    console.log(`Replacing ${OLD_DOMAIN} with ${NEW_DOMAIN} in all collections...`);

    // 1. Contents Collection
    const contents = await db.collection('contents').find({}).toArray();
    let contentUpdates = 0;
    for (const c of contents) {
      const updates: any = {};
      if (c.posterUrl) updates.posterUrl = replaceDomain(c.posterUrl);
      if (c.trailerUrl) updates.trailerUrl = replaceDomain(c.trailerUrl);
      
      // Update if any of them actually changed
      if (updates.posterUrl !== c.posterUrl || updates.trailerUrl !== c.trailerUrl) {
        await db.collection('contents').updateOne({ _id: c._id }, { $set: updates });
        contentUpdates++;
      }
    }
    console.log(`Updated ${contentUpdates} records in Contents.`);

    // 2. Seasons Collection
    const seasons = await db.collection('seasons').find({}).toArray();
    let seasonUpdates = 0;
    for (const s of seasons) {
      const updates: any = {};
      if (s.posterUrl) updates.posterUrl = replaceDomain(s.posterUrl);
      if (s.trailerUrl) updates.trailerUrl = replaceDomain(s.trailerUrl);
      
      if (updates.posterUrl !== s.posterUrl || updates.trailerUrl !== s.trailerUrl) {
        await db.collection('seasons').updateOne({ _id: s._id }, { $set: updates });
        seasonUpdates++;
      }
    }
    console.log(`Updated ${seasonUpdates} records in Seasons.`);

    // 3. Episodes Collection
    const episodes = await db.collection('episodes').find({}).toArray();
    let episodeUpdates = 0;
    for (const ep of episodes) {
      const updates: any = {};
      if (ep.videoUrl) updates.videoUrl = replaceDomain(ep.videoUrl);
      if (ep.thumbnailUrl) updates.thumbnailUrl = replaceDomain(ep.thumbnailUrl);
      
      if (updates.videoUrl !== ep.videoUrl || updates.thumbnailUrl !== ep.thumbnailUrl) {
        await db.collection('episodes').updateOne({ _id: ep._id }, { $set: updates });
        episodeUpdates++;
      }
    }
    console.log(`Updated ${episodeUpdates} records in Episodes.`);

    // 4. Users Collection
    const users = await db.collection('users').find({}).toArray();
    let userUpdates = 0;
    for (const u of users) {
      const updates: any = {};
      if (u.profileImage) updates.profileImage = replaceDomain(u.profileImage);
      if (u.verificationImage) updates.verificationImage = replaceDomain(u.verificationImage);
      
      if (updates.profileImage !== u.profileImage || updates.verificationImage !== u.verificationImage) {
        await db.collection('users').updateOne({ _id: u._id }, { $set: updates });
        userUpdates++;
      }
    }
    console.log(`Updated ${userUpdates} records in Users.`);

    console.log('✨ All CDN links have been successfully migrated to R2 directly!');

  } catch (error) {
    console.error('Error during CDN migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

migrateCdnToR2().then(() => process.exit(0));
