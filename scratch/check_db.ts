import mongoose from 'mongoose';
import { Season } from '../src/app/modules/content/season.model';
import { Episode } from '../src/app/modules/content/episode.model';
import config from '../src/config';

async function check() {
  await mongoose.connect(config.database_url as string);
  const sCount = await Season.countDocuments();
  const eCount = await Episode.countDocuments();
  console.log('Seasons:', sCount, 'Episodes:', eCount);
  const firstEpisode = await Episode.findOne();
  console.log(firstEpisode);
  process.exit(0);
}
check();
