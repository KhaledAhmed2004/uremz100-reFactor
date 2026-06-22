import mongoose from 'mongoose';
import config from '../config';
import { Content } from '../app/modules/content/content.model';
import { Season } from '../app/modules/content/season.model';
import { Episode } from '../app/modules/content/episode.model';
import { Genre } from '../app/modules/genre/genre.model';
import { logger } from '../shared/logger';

const seriesVideos = [
  'https://res.cloudinary.com/demo/video/upload/dog.mp4',
  'https://res.cloudinary.com/demo/video/upload/elephants.mp4',
  'https://res.cloudinary.com/demo/video/upload/sea_turtle.mp4',
  'http://vjs.zencdn.net/v/oceans.mp4',
];

export const seedSeries = async () => {
  try {
    // Connect to the database
    await mongoose.connect(config.database_url as string);
    logger.info('Connected to MongoDB for seeding Series...');

    // 1. Setup Genres
    const genreNames = ['Drama', 'Action', 'Mystery'];
    const genreIds: mongoose.Types.ObjectId[] = [];
    
    for (const name of genreNames) {
      const genre = await Genre.findOneAndUpdate(
        { name },
        { name, description: `${name} series` },
        { upsert: true, new: true }
      );
      if (genre) {
        genreIds.push(genre._id as mongoose.Types.ObjectId);
      }
    }

    // 2. Prepare Series Data
    for (let i = 0; i < 5; i++) {
      const isPremium = i % 2 === 0;
      
      const series = await Content.create({
        title: `Epic Series ${i + 1}`,
        description: `This is an amazing series seeded for testing. It has 2 seasons.`,
        type: 'SERIES',
        status: 'PUBLISHED',
        planStatus: isPremium ? ['MONTHLY', 'YEARLY'] : ['FREE'],
        genres: genreIds,
        posterUrl: `https://picsum.photos/seed/series${i}/1920/1080`,
        duration: 0,
        releaseYear: 2023,
        views: Math.floor(Math.random() * 100000),
        dailyViews: Math.floor(Math.random() * 1000),
        weeklyViews: Math.floor(Math.random() * 5000),
        totalWatchTime: Math.floor(Math.random() * 5000000),
        seasonsCount: 2,
        totalEpisodes: 6,
        isPopularSeries: i === 0,
        cast: ['Actor A', 'Actor B']
      });

      for (let s = 1; s <= 2; s++) {
        const season = await Season.create({
          title: `Season ${s}`,
          posterUrl: `https://picsum.photos/seed/season${i}_${s}/800/1200`,
          seriesId: series._id,
          seasonNumber: s
        });

        for (let e = 1; e <= 3; e++) {
          const requiresCoin = e === 3 ? 50 : 0; // Third episode requires coins
          await Episode.create({
            title: `Episode ${e}`,
            description: `This is episode ${e} of season ${s}.`,
            videoUrl: seriesVideos[e % seriesVideos.length],
            thumbnailUrl: `https://picsum.photos/seed/episode${i}_${s}_${e}/400/225`,
            duration: 45,
            releaseDate: new Date(),
            status: 'PUBLISHED',
            planStatus: series.planStatus,
            seasonId: season._id,
            seriesId: series._id,
            seasonNumber: s,
            episodeNumber: e,
            requiredCoin: requiresCoin
          });
        }
      }
    }

    logger.info('✨ Successfully seeded Series, Seasons, and Episodes!');

  } catch (error) {
    logger.error('Error seeding Series:', error);
  } finally {
    // Cleanly close connection
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB.');
  }
};

// Execute
seedSeries().then(() => process.exit(0));
