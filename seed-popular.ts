import mongoose from 'mongoose';
import config from './src/config';
import { Content } from './src/app/modules/content/content.model';

const seedDatabase = async () => {
  try {
    console.log('Connecting to database:', config.database_url);
    await mongoose.connect(config.database_url as string);
    console.log('Connected successfully.');

    console.log('Clearing old content...');
    await Content.deleteMany({});

    console.log('Seeding new popular content (with new algorithms)...');
    
    const dummyContent = [
      // Popular Series
      {
        title: 'Stranger Things',
        description: 'Sci-fi horror series',
        type: 'SERIES',
        status: 'PUBLISHED',
        planStatus: ['FREE'],
        videoUrl: 'http://video.com/stranger.mp4',
        posterUrl: 'https://image.tmdb.org/t/p/w500/49WJfeN0mOXnHAHXKQDECLDvJR.jpg',
        duration: 45,
        releaseYear: 2016,
        publishedAt: new Date(),
        isPopularSeries: true,
        views: 5000,
        dailyViews: 100,
        weeklyViews: 800,
        totalWatchTime: 200000,
        engagementScore: 50,
        trendingScore: 80,
        rating: 4.8,
      },
      {
        title: 'Breaking Bad',
        description: 'Crime drama',
        type: 'SERIES',
        status: 'PUBLISHED',
        planStatus: ['MONTHLY'],
        videoUrl: 'http://video.com/bb.mp4',
        posterUrl: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
        duration: 50,
        releaseYear: 2008,
        publishedAt: new Date(),
        isPopularSeries: true,
        views: 12000,
        dailyViews: 200,
        weeklyViews: 1500,
        totalWatchTime: 500000,
        engagementScore: 120,
        trendingScore: 100,
        rating: 4.9,
      },
      // Trending Movies
      {
        title: 'The Dark Knight',
        description: 'Batman action movie',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['FREE'],
        videoUrl: 'http://video.com/tdk.mp4',
        posterUrl: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
        duration: 152,
        releaseYear: 2008,
        publishedAt: new Date(),
        views: 8000,
        dailyViews: 150,
        weeklyViews: 1200,
        totalWatchTime: 400000,
        engagementScore: 80,
        trendingScore: 90,
        rating: 4.9,
      },
      {
        title: 'Inception',
        description: 'Sci-fi thriller',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['MONTHLY'],
        videoUrl: 'http://video.com/inception.mp4',
        posterUrl: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
        duration: 148,
        releaseYear: 2010,
        publishedAt: new Date(),
        views: 6000,
        dailyViews: 120,
        weeklyViews: 900,
        totalWatchTime: 300000,
        engagementScore: 60,
        trendingScore: 70,
        rating: 4.7,
      },
      {
        title: 'Interstellar',
        description: 'Space exploration',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['FREE'],
        videoUrl: 'http://video.com/interstellar.mp4',
        posterUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
        duration: 169,
        releaseYear: 2014,
        publishedAt: new Date(),
        views: 4500,
        dailyViews: 90,
        weeklyViews: 600,
        totalWatchTime: 250000,
        engagementScore: 45,
        trendingScore: 50,
        rating: 4.8,
      },
      // New Releases
      {
        title: 'Dune: Part Two',
        description: 'Sci-fi epic',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['MONTHLY'],
        videoUrl: 'http://video.com/dune2.mp4',
        posterUrl: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2JGjjc9k.jpg',
        duration: 166,
        releaseYear: 2024,
        publishedAt: new Date(),
        views: 3000,
        dailyViews: 300,
        weeklyViews: 2500,
        totalWatchTime: 180000,
        engagementScore: 35,
        trendingScore: 250, // very high trending because it's new
        rating: 4.6,
      },
      // Coming Soon Movie
      {
        title: 'Avatar: Fire and Ash',
        description: 'Upcoming epic sci-fi film',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['MONTHLY'],
        videoUrl: 'http://video.com/avatar3.mp4',
        posterUrl: 'https://image.tmdb.org/t/p/w500/jRXYjXNqO6EMrxZeOObOtwXp9k.jpg',
        duration: 192,
        releaseYear: 2025,
        releaseDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days in the future
        views: 0,
        dailyViews: 0,
        weeklyViews: 0,
        totalWatchTime: 0,
        engagementScore: 0,
        trendingScore: 0,
        rating: 0,
      },
      // VIP Content (High Rating for Daily Filter)
      {
        title: 'Oppenheimer',
        description: 'Biographical thriller',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['MONTHLY', 'YEARLY'],
        isPremium: true,
        videoUrl: 'http://video.com/oppenheimer.mp4',
        posterUrl: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
        duration: 180,
        releaseYear: 2023,
        publishedAt: new Date(),
        views: 5000,
        dailyViews: 500,
        weeklyViews: 3000,
        totalWatchTime: 100000,
        engagementScore: 95,
        trendingScore: 80,
        rating: 4.9,
      },
      // VIP Content (High Views for Weekly Filter)
      {
        title: 'Game of Thrones',
        description: 'Epic fantasy series',
        type: 'SERIES',
        status: 'PUBLISHED',
        planStatus: ['YEARLY'],
        isPremium: true,
        videoUrl: 'http://video.com/got.mp4',
        posterUrl: 'https://image.tmdb.org/t/p/w500/1XS1oqLOMWPNenlNpqzGWgOX2Xb.jpg',
        duration: 60,
        releaseYear: 2011,
        publishedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Not recent
        views: 25000,
        dailyViews: 1000,
        weeklyViews: 8000,
        totalWatchTime: 800000,
        engagementScore: 150,
        trendingScore: 120,
        rating: 4.7,
      }
    ];

    await Content.insertMany(dummyContent);
    console.log('Seeded successfully with correct Engagement & Trending scores!');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
