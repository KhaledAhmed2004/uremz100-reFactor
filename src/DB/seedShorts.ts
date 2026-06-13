import mongoose from 'mongoose';
import config from '../config';
import { Content } from '../app/modules/content/content.model';
import { Genre } from '../app/modules/genre/genre.model';
import { logger } from '../shared/logger';

// List of real vertical/short video URLs for a realistic feel (Real-life demo videos converted to 9:16 ratio)
const shortVideos = [
  'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/dog.mp4',
  'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/elephants.mp4',
  'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/sea_turtle.mp4',
  'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/skater.mp4',
  'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/snowboarding.mp4',
  'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/kitten-playing.mp4',
  'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/rooster.mp4',
  'https://res.cloudinary.com/demo/video/upload/w_720,h_1280,c_fill/boy-spiderman.mp4'
];

export const seedShorts = async () => {
  try {
    // Connect to the real local database
    await mongoose.connect(config.database_url as string);
    logger.info('Connected to MongoDB for seeding Shorts...');

    // 1. Ensure we have at least one Genre, as it's required by the Content model
    let genre = await Genre.findOne({ name: 'Entertainment' });
    if (!genre) {
      genre = await Genre.create({ name: 'Entertainment', description: 'General entertainment content' });
    }

    // 2. Prepare 10 Realistic Shorts (All Free Content as requested)
    const shortsData = [];

    // Optional: Clear existing content if you want a clean slate
    // await Content.deleteMany({ title: { $regex: 'Short' } });

    for (let i = 0; i < 10; i++) {
      const videoId = i % shortVideos.length;
      
      shortsData.push({
        title: `Viral Free Short ${i + 1}`,
        description: 'A quick viral moment caught on camera, completely free to watch!',
        type: 'MOVIE', // The codebase only accepts MOVIE or SERIES. Shorts logic depends on FREE plan.
        status: 'PUBLISHED',
        planStatus: ['FREE'], // Ensuring all of them are proper free videos
        genres: [genre._id],
        videoUrl: shortVideos[videoId],
        posterUrl: `https://picsum.photos/seed/viral${i}/400/600`, // Vertical poster dimension
        duration: 1, // in minutes (required)
        releaseYear: 2024,
        publishedAt: new Date(Date.now() - i * 100000), // Staggered to test infinite scroll sorting
        views: Math.floor(Math.random() * 50000) + 1000,
        engagementScore: Math.floor(Math.random() * 100) + 20,
        trendingScore: Math.floor(Math.random() * 100) + 20,
      });
    }

    // Insert them
    await Content.insertMany(shortsData);
    logger.info(`✨ Successfully seeded ${shortsData.length} Proper Free Shorts into the development database!`);

  } catch (error) {
    logger.error('Error seeding Shorts:', error);
  } finally {
    // Cleanly close connection so the script exits
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB.');
  }
};

// Execute
seedShorts().then(() => process.exit(0));
