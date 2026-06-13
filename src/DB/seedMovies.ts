import mongoose from 'mongoose';
import config from '../config';
import { Content } from '../app/modules/content/content.model';
import { Genre } from '../app/modules/genre/genre.model';
import { logger } from '../shared/logger';

// List of reliable horizontal (16:9) real free videos for Movies
const movieVideos = [
  'https://res.cloudinary.com/demo/video/upload/dog.mp4',
  'https://res.cloudinary.com/demo/video/upload/elephants.mp4',
  'https://res.cloudinary.com/demo/video/upload/sea_turtle.mp4',
  'http://vjs.zencdn.net/v/oceans.mp4',
  'https://media.w3.org/2010/05/sintel/trailer.mp4'
];

export const seedMovies = async () => {
  try {
    // Connect to the database
    await mongoose.connect(config.database_url as string);
    logger.info('Connected to MongoDB for seeding Movies...');

    // 1. Setup Genres
    const genreNames = ['Action', 'Comedy', 'Drama', 'Sci-Fi', 'Thriller'];
    const genreIds: mongoose.Types.ObjectId[] = [];
    
    for (const name of genreNames) {
      const genre = await Genre.findOneAndUpdate(
        { name },
        { name, description: `${name} movies` },
        { upsert: true, new: true }
      );
      if (genre) {
        genreIds.push(genre._id as mongoose.Types.ObjectId);
      }
    }

    // 2. Prepare Movie Data
    const moviesData = [];

    // Let's create 15 realistic movies
    for (let i = 0; i < 15; i++) {
      const isPremium = i % 3 === 0; // Every 3rd movie is premium (e.g. MONTHLY plan)
      const videoId = i % movieVideos.length;
      
      // Select 1 to 3 random genres
      const randomGenres: mongoose.Types.ObjectId[] = [];
      const numGenres = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numGenres; j++) {
        if (genreIds.length > 0) {
          const randIndex = Math.floor(Math.random() * genreIds.length);
          if (!randomGenres.includes(genreIds[randIndex])) {
            randomGenres.push(genreIds[randIndex]);
          }
        }
      }

      // If premium, it might have a trailer. Let's use a short video as a trailer.
      const trailerUrl = isPremium 
        ? 'https://res.cloudinary.com/demo/video/upload/kitten-playing.mp4' 
        : undefined;

      moviesData.push({
        title: isPremium ? `Premium Blockbuster Movie ${i + 1}` : `Awesome Free Movie ${i + 1}`,
        description: `This is an amazing full-length movie seeded for testing. ${isPremium ? 'Subscribe to watch the full HD version.' : 'Enjoy this movie completely free!'}`,
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: isPremium ? ['MONTHLY', 'YEARLY'] : ['FREE'],
        genres: randomGenres,
        videoUrl: movieVideos[videoId],
        trailerUrl: trailerUrl,
        // Horizontal poster dimensions typical for movies
        posterUrl: `https://picsum.photos/seed/movie${i}/1920/1080`,
        duration: Math.floor(Math.random() * 60) + 90, // Duration between 90 and 150 minutes
        releaseYear: 2020 + Math.floor(Math.random() * 5), // 2020 to 2024
        publishedAt: new Date(Date.now() - i * 86400000), // Staggered over the last 15 days
        views: Math.floor(Math.random() * 100000) + 5000,
        dailyViews: Math.floor(Math.random() * 1000) + 100,
        weeklyViews: Math.floor(Math.random() * 5000) + 500,
        totalWatchTime: Math.floor(Math.random() * 5000000) + 100000,
        engagementScore: Math.floor(Math.random() * 100) + 50,
        trendingScore: Math.floor(Math.random() * 100) + 50,
        cast: ['Actor A', 'Actor B', 'Actress C'],
        isPopularSeries: false
      });
    }

    // Insert into DB
    await Content.insertMany(moviesData);
    logger.info(`✨ Successfully seeded ${moviesData.length} Movies into the development database!`);

  } catch (error) {
    logger.error('Error seeding Movies:', error);
  } finally {
    // Cleanly close connection
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB.');
  }
};

// Execute
seedMovies().then(() => process.exit(0));
