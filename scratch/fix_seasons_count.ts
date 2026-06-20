import mongoose from 'mongoose';
import { Content } from '../src/app/modules/content/content.model';
import { Season } from '../src/app/modules/content/season.model';
import config from '../src/config';

async function fixSeasonsCount() {
  try {
    await mongoose.connect(config.database_url as string);
    const series = await Content.find({ type: 'SERIES' });
    
    for (const s of series) {
      const count = await Season.countDocuments({ seriesId: s._id });
      s.seasonsCount = count;
      await s.save();
      console.log(`Updated ${s.title} seasonsCount to ${count}`);
    }
    
    console.log('Fixed!');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

fixSeasonsCount();
