import mongoose from 'mongoose';
import { Content } from '../src/app/modules/content/content.model';

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect('mongodb://localhost:27017/uremz100');
  
  console.log('Fetching all movies...');
  const movies = await Content.find({ type: 'MOVIE' }).sort({ createdAt: -1 });
  
  console.log(`Found ${movies.length} movies currently in the database.`);
  
  if (movies.length > 15) {
    const toDelete = movies.slice(15);
    const deleteIds = toDelete.map((m: any) => m._id);
    
    console.log(`Deleting ${deleteIds.length} older movies...`);
    const result = await Content.deleteMany({ _id: { $in: deleteIds } });
    
    console.log(`Successfully deleted ${result.deletedCount} movies! Exactly 15 are left.`);
  } else {
    console.log('There are 15 or fewer movies, so no deletion is needed.');
  }
  
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

main().catch(console.error);
