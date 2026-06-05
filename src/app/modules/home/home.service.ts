import { RecentlyWatched } from '../recently-watched/recently-watched.model';
import { Content } from '../content/content.model';

const getHomeContentFromDB = async (userId?: string) => {
  const sections = [];
  const cardFields = 'title thumbnail poster type rating isPremium isRecent';

  // 1. Continue Watching (if userId provided)
  if (userId) {
    const recentlyWatched = await RecentlyWatched.find({ userId })
      .sort({ lastWatchedAt: -1 })
      .limit(10)
      .populate('contentId', cardFields);

    if (recentlyWatched.length > 0) {
      sections.push({
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
      });
    }
  }

  // 2. Trending (Popular)
  const trending = await Content.find({ views: { $gt: 100 } })
    .sort({ views: -1 })
    .select(cardFields)
    .limit(10);
  sections.push({
    id: 'row_trending_now',
    type: 'TRENDING',
    title: 'Trending Now',
    items: trending,
  });

  // 3. You Might Like
  const youMightLike = await Content.find()
    .sort({ rating: -1 })
    .select(cardFields)
    .limit(10);
  sections.push({
    id: 'row_you_might_like',
    type: 'YOU_MIGHT_LIKE',
    title: 'You Might Like',
    items: youMightLike,
  });

  // 4. Ranking (Daily/Weekly/Monthly simulation)
  const rankings = await Content.find()
    .sort({ views: -1 })
    .select(cardFields)
    .limit(5);
  if (rankings.length > 0) {
    sections.push({
      id: 'row_rankings',
      type: 'RANKING',
      title: 'Top Rankings',
      items: rankings,
    });
  }

  // 5. Most Popular Series
  const mostPopularSeries = await Content.find({
    type: 'SERIES',
    isPopularSeries: true,
  })
    .select(cardFields)
    .limit(10);
  if (mostPopularSeries.length > 0) {
    sections.push({
      id: 'row_popular_series',
      type: 'SERIES',
      title: 'Most Popular Series',
      items: mostPopularSeries,
    });
  }

  // 5.5 Most Popular Movies
  const mostPopularMovies = await Content.find({ type: 'MOVIE' })
    .sort({ views: -1 })
    .select(cardFields)
    .limit(10);
  if (mostPopularMovies.length > 0) {
    sections.push({
      id: 'row_popular_movies',
      type: 'MOVIE',
      title: 'Most Popular Movies',
      items: mostPopularMovies,
    });
  }

  // 6. Top Picks (Editorial Curation + AI)
  const topPicks = await Content.find({ rating: { $gte: 4.5 } })
    .select(cardFields)
    .limit(10);
  sections.push({
    id: 'row_top_picks',
    type: 'TOP_PICKS',
    title: 'Top Picks for You',
    items: topPicks,
  });

  // 7. VIP Picks
  const vipPicks = await Content.find({ isPremium: true })
    .select(cardFields)
    .limit(10);
  if (vipPicks.length > 0) {
    sections.push({
      id: 'row_vip_picks',
      type: 'VIP',
      title: 'VIP Picks',
      items: vipPicks,
    });
  }

  // 8. Newly Released
  const newlyReleased = await Content.find({ isRecent: true, status: 'PUBLISHED' })
    .sort({ createdAt: -1 })
    .select(cardFields)
    .limit(10);
  sections.push({
    id: 'row_new_releases',
    type: 'NEW_RELEASE',
    title: 'New Releases',
    items: newlyReleased,
  });

  // 8.5 Coming Soon
  const comingSoon = await Content.find({ status: 'DRAFT' })
    .sort({ createdAt: -1 })
    .select(cardFields)
    .limit(10);
  if (comingSoon.length > 0) {
    sections.push({
      id: 'row_coming_soon',
      type: 'COMING_SOON',
      title: 'Coming Soon',
      items: comingSoon,
    });
  }

  // 9. YouTube Upcoming
  const ytUpcoming = await Content.find({
    youtubeId: { $exists: true, $ne: null },
  })
    .sort({ publishedAt: -1 })
    .select(cardFields + ' youtubeId channelName publishedAt')
    .limit(10);

  if (ytUpcoming.length > 0) {
    sections.push({
      id: 'row_yt_upcoming',
      type: 'YOUTUBE_SHELF',
      title: 'Upcoming Trailers on YouTube',
      items: ytUpcoming,
    });
  }

  return {
    sections,
  };
};

export const HomeService = {
  getHomeContentFromDB,
};
