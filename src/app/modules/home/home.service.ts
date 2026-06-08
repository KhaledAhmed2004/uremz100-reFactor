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
    // data can be an object or an array. Just check if it's truthy and not an empty array.
    if (data && (!Array.isArray(data) || data.length > 0)) {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(data));
    }
  } catch (error) {
    logger.error('Redis SET Error:', error);
  }

  return data;
};

const getHomeContentFromDB = async (userId?: string, guestId?: string, tab: string = 'popular', filter: string = 'daily') => {
  const sections: any[] = [];

  // 1. Continue Watching (Personalized - NO CACHE)
  const getContinueWatching = async () => {
    if (!userId && !guestId) return null;
    const query = userId ? { userId } : { guestId };
    const recentlyWatched = await RecentlyWatched.find(query)
      .sort({ lastWatchedAt: -1 })
      .limit(10)
      .populate('contentId', cardFields);

    return {
      id: 'row_continue_watching',
      type: 'CONTINUE_WATCHING',
      title: 'Continue Watching',
      items: recentlyWatched.length > 0 ? recentlyWatched.map((rw: any) => {
        const content = rw.contentId ? rw.contentId.toObject() : {};
        return {
          ...content,
          progress: {
            seconds: rw.watchedSeconds,
            percentage: rw.completionPercentage,
            last_watched: rw.lastWatchedAt,
          },
        };
      }) : [],
    };
  };

  const getTrending = () => fetchWithCache('home:trending', async () => {
    const data = await Content.find({ views: { $gt: 100 } }).sort({ views: -1 }).select(cardFields).limit(10);
    return { id: 'row_trending_now', type: 'TRENDING', title: 'Trending Now', items: data };
  });

  const getYouMightLike = () => fetchWithCache('home:you_might_like', async () => {
    const data = await Content.find().sort({ rating: -1 }).select(cardFields).limit(10);
    return { id: 'row_you_might_like', type: 'YOU_MIGHT_LIKE', title: 'You Might Like', items: data };
  });

  const getPopularSeries = () => fetchWithCache('home:popular_series', async () => {
    const data = await Content.find({ type: 'SERIES', isPopularSeries: true }).select(cardFields).limit(10);
    return { id: 'row_popular_series', type: 'SERIES', title: 'Most Popular Series', items: data };
  });

  const getPopularMovies = () => fetchWithCache('home:popular_movies', async () => {
    const data = await Content.find({ type: 'MOVIE' }).sort({ views: -1 }).select(cardFields).limit(10);
    return { id: 'row_popular_movies', type: 'MOVIE', title: 'Most Popular Movies', items: data };
  });

  const getTopPicks = () => fetchWithCache('home:top_picks', async () => {
    const data = await Content.find({ rating: { $gte: 4.5 } }).select(cardFields).limit(10);
    return { id: 'row_top_picks', type: 'TOP_PICKS', title: 'Top Picks for You', items: data };
  });

  const getNewReleases = () => fetchWithCache('home:new_releases', async () => {
    const data = await Content.find({ isRecent: true, status: 'PUBLISHED' }).sort({ createdAt: -1 }).select(cardFields).limit(10);
    return { id: 'row_new_releases', type: 'NEW_RELEASE', title: 'New Releases', items: data };
  });

  const getComingSoon = () => fetchWithCache('home:coming_soon', async () => {
    const data = await Content.find({ status: 'DRAFT' }).sort({ createdAt: -1 }).select(cardFields).limit(10);
    return { id: 'row_coming_soon', type: 'COMING_SOON', title: 'Coming Soon', items: data };
  });

  let queries: Promise<any>[] = [];

  if (tab === 'new') {
    queries = [
      getComingSoon(),
      getNewReleases()
    ];
  } else if (tab === 'vip') {
    queries = [
      fetchWithCache('home:vip_daily', async () => {
        const data = await Content.find({ isPremium: true }).sort({ rating: -1 }).select(cardFields).limit(10);
        return { id: 'row_vip_daily', type: 'VIP', title: "Today's VIP Picks", items: data };
      }),
      fetchWithCache('home:vip_weekly', async () => {
        const data = await Content.find({ isPremium: true }).sort({ views: -1 }).select(cardFields).limit(10);
        return { id: 'row_vip_weekly', type: 'VIP', title: "Weekly VIP Picks", items: data };
      }),
      getTrending() // Represents "Hot Now"
    ];
  } else if (tab === 'ranking') {
    // Dynamic ranking based on filter (daily, weekly, monthly, popular)
    queries = [
      fetchWithCache(`home:ranking:${filter}`, async () => {
        let sortConfig: any = { views: -1 };
        if (filter === 'daily') sortConfig = { createdAt: -1, views: -1 };
        // Ideally filter applies to a specific time range in DB
        const data = await Content.find().sort(sortConfig).select(cardFields).limit(10);
        const title = filter === 'popular' ? 'Popular Rankings' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Rankings`;
        return { id: `row_ranking_${filter}`, type: 'RANKING', title, items: data };
      })
    ];
  } else {
    // tab === 'popular'
    queries = [
      getContinueWatching(),
      getTrending(),
      getPopularSeries(),
      getPopularMovies(),
      getYouMightLike(),
      getTopPicks()
    ];
  }

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

  return { sections };
};

export const HomeService = {
  getHomeContentFromDB,
};
