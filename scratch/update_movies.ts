import mongoose from 'mongoose';
import { Content } from '../src/app/modules/content/content.model';

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect('mongodb://localhost:27017/uremz100');
  
  const defaultTrailerUrl = 'https://res.cloudinary.com/demo/video/upload/sea_turtle.mp4';
  const defaultVideoUrl = 'https://res.cloudinary.com/demo/video/upload/elephants.mp4';

  console.log('Updating all movies to have a trailerUrl and a working demo videoUrl...');
  
  const result = await Content.updateMany(
    { type: 'MOVIE' },
    { 
      $set: { 
        trailerUrl: defaultTrailerUrl,
        videoUrl: defaultVideoUrl
      } 
    }
  );
  
  console.log(`Successfully updated ${result.modifiedCount} movies.`);
  
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

main().catch(console.error);
