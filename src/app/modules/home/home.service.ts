import { RecentlyWatched } from '../recently-watched/recently-watched.model';
import { Content } from '../content/content.model';
import { redisClient } from '../../../shared/redisClient';
import { logger } from '../../../shared/logger';

const cardFields = 'title thumbnail poster type rating isPremium isRecent';

// Helper to fetch data with Redis Cache
const fetchWithCache = async (key: string, fetcher: () => Promise<any>, ttlSeconds: number = 3600) => {
  try {
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);
  } catch (error) {
    logger.error('Redis GET Error:', error);
  }

  const data = await fetcher();

  try {
    if (data && data.length > 0) {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(data));
    }
  } catch (error) {
    logger.error('Redis SET Error:', error);
  }

  return data;
};

const getHomeContentFromDB = async (userId?: string) => {
  const sections: any[] = [];

  // 1. Continue Watching (Personalized - NO CACHE)
  const continueWatchingPromise = async () => {
    if (!userId) return null;
    const recentlyWatched = await RecentlyWatched.find({ userId })
      .sort({ lastWatchedAt: -1 })
      .limit(10)
      .populate('contentId', cardFields);

    if (recentlyWatched.length > 0) {
      return {
        id: 'row_continue_watching',
        type: 'CONTINUE_WATCHING',
        title: 'Continue Watching',
        items: recentlyWatched.map((rw: any) => {
          const content = rw.contentId ? rw.contentId.toObject() : {};
          return {
            ...content,
            progress: {
              seconds: rw.watchedSeconds,
              percentage: rw.completionPercentage,
              last_watched: rw.lastWatchedAt,
            },
          };
        }),
      };
    }
    return null;
  };

  // 2-10: Global Queries
  const queries = [
    // Continue Watching (Executes without cache)
    continueWatchingPromise(),
    
    // Trending
    fetchWithCache('home:trending', async () => {
      const data = await Content.find({ views: { $gt: 100 } })
        .sort({ views: -1 })
        .select(cardFields)
        .limit(10);
      return { id: 'row_trending_now', type: 'TRENDING', title: 'Trending Now', items: data };
    }),

    // You Might Like
    fetchWithCache('home:you_might_like', async () => {
      const data = await Content.find()
        .sort({ rating: -1 })
        .select(cardFields)
        .limit(10);
      return { id: 'row_you_might_like', type: 'YOU_MIGHT_LIKE', title: 'You Might Like', items: data };
    }),

    // Rankings
    fetchWithCache('home:rankings', async () => {
      const data = await Content.find()
        .sort({ views: -1 })
        .select(cardFields)
        .limit(5);
      return data.length > 0 ? { id: 'row_rankings', type: 'RANKING', title: 'Top Rankings', items: data } : null;
    }),

    // Most Popular Series
    fetchWithCache('home:popular_series', async () => {
      const data = await Content.find({ type: 'SERIES', isPopularSeries: true })
        .select(cardFields)
        .limit(10);
      return data.length > 0 ? { id: 'row_popular_series', type: 'SERIES', title: 'Most Popular Series', items: data } : null;
    }),

    // Most Popular Movies
    fetchWithCache('home:popular_movies', async () => {
      const data = await Content.find({ type: 'MOVIE' })
        .sort({ views: -1 })
        .select(cardFields)
        .limit(10);
      return data.length > 0 ? { id: 'row_popular_movies', type: 'MOVIE', title: 'Most Popular Movies', items: data } : null;
    }),

    // Top Picks
    fetchWithCache('home:top_picks', async () => {
      const data = await Content.find({ rating: { $gte: 4.5 } })
        .select(cardFields)
        .limit(10);
      return { id: 'row_top_picks', type: 'TOP_PICKS', title: 'Top Picks for You', items: data };
    }),

    // VIP Picks
    fetchWithCache('home:vip_picks', async () => {
      const data = await Content.find({ isPremium: true })
        .select(cardFields)
        .limit(10);
      return data.length > 0 ? { id: 'row_vip_picks', type: 'VIP', title: 'VIP Picks', items: data } : null;
    }),

    // Newly Released
    fetchWithCache('home:new_releases', async () => {
      const data = await Content.find({ isRecent: true, status: 'PUBLISHED' })
        .sort({ createdAt: -1 })
        .select(cardFields)
        .limit(10);
      return { id: 'row_new_releases', type: 'NEW_RELEASE', title: 'New Releases', items: data };
    }),

    // Coming Soon
    fetchWithCache('home:coming_soon', async () => {
      const data = await Content.find({ status: 'DRAFT' })
        .sort({ createdAt: -1 })
        .select(cardFields)
        .limit(10);
      return data.length > 0 ? { id: 'row_coming_soon', type: 'COMING_SOON', title: 'Coming Soon', items: data } : null;
    }),

    // YouTube Upcoming
    fetchWithCache('home:yt_upcoming', async () => {
      const data = await Content.find({ youtubeId: { $exists: true, $ne: null } })
        .sort({ publishedAt: -1 })
        .select(cardFields + ' youtubeId channelName publishedAt')
        .limit(10);
      return data.length > 0 ? { id: 'row_yt_upcoming', type: 'YOUTUBE_SHELF', title: 'Upcoming Trailers on YouTube', items: data } : null;
    })
  ];

  // Execute all queries in parallel
  const results = await Promise.allSettled(queries);

  // Filter fulfilled promises and push non-null sections
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      sections.push(result.value);
    } else if (result.status === 'rejected') {
      logger.error('Home Section Query Failed:', result.reason);
    }
  });

  return {
    sections,
  };
};

export const HomeService = {
  getHomeContentFromDB,
};
