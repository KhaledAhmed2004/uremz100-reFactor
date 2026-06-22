"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeService = void 0;
const recently_watched_model_1 = require("../recently-watched/recently-watched.model");
const content_model_1 = require("../content/content.model");
const redisClient_1 = require("../../../shared/redisClient");
const logger_1 = require("../../../shared/logger");
const season_model_1 = require("../content/season.model");
const cardFields = 'title thumbnailUrl posterUrl type rating isPremium releaseDate publishedAt createdAt';
const attachSeasonPosters = (contents) => __awaiter(void 0, void 0, void 0, function* () {
    return Promise.all(contents.map((content) => __awaiter(void 0, void 0, void 0, function* () {
        const obj = content.toObject ? content.toObject() : content;
        if (obj.type === 'SERIES' && !obj.posterUrl) {
            const latestSeason = yield season_model_1.Season.findOne({ seriesId: obj._id }).sort('-seasonNumber').lean();
            if (latestSeason && latestSeason.posterUrl) {
                obj.posterUrl = latestSeason.posterUrl;
            }
        }
        return obj;
    })));
});
// Helper to fetch data with Redis Cache
const fetchWithCache = (key_1, fetcher_1, ...args_1) => __awaiter(void 0, [key_1, fetcher_1, ...args_1], void 0, function* (key, fetcher, ttlSeconds = 3600) {
    try {
        const cached = yield redisClient_1.redisClient.get(key);
        if (cached)
            return JSON.parse(cached);
    }
    catch (error) {
        logger_1.logger.error('Redis GET Error:', error);
    }
    const data = yield fetcher();
    try {
        // data can be an object or an array. Just check if it's truthy and not an empty array.
        if (data && (!Array.isArray(data) || data.length > 0)) {
            yield redisClient_1.redisClient.setex(key, ttlSeconds, JSON.stringify(data));
        }
    }
    catch (error) {
        logger_1.logger.error('Redis SET Error:', error);
    }
    return data;
});
const getHomeContentFromDB = (userId_1, guestId_1, ...args_1) => __awaiter(void 0, [userId_1, guestId_1, ...args_1], void 0, function* (userId, guestId, tab = 'popular', filter = 'daily') {
    const sections = [];
    // 1. Continue Watching (Personalized - NO CACHE)
    const getContinueWatching = () => __awaiter(void 0, void 0, void 0, function* () {
        if (!userId && !guestId)
            return null;
        const query = userId ? { userId } : { guestId };
        const recentlyWatched = yield recently_watched_model_1.RecentlyWatched.find(query)
            .sort({ lastWatchedAt: -1 })
            .limit(10)
            .populate('contentId', cardFields);
        return {
            id: 'row_continue_watching',
            type: 'CONTINUE_WATCHING',
            title: 'Continue Watching',
            items: recentlyWatched.length > 0 ? recentlyWatched.map((rw) => {
                const content = rw.contentId ? rw.contentId.toObject() : {};
                return Object.assign(Object.assign({}, content), { progress: {
                        seconds: rw.watchedSeconds,
                        percentage: rw.completionPercentage,
                        last_watched: rw.lastWatchedAt,
                    } });
            }) : [],
        };
    });
    const getTrending = () => fetchWithCache('home:trending', () => __awaiter(void 0, void 0, void 0, function* () {
        const data = yield content_model_1.Content.find({ trendingScore: { $gt: 0 } }).sort({ trendingScore: -1 }).select(cardFields).limit(10);
        const withPosters = yield attachSeasonPosters(data);
        return { id: 'row_trending_now', type: 'TRENDING', title: 'Trending Now', items: withPosters };
    }));
    const getYouMightLike = () => fetchWithCache('home:you_might_like', () => __awaiter(void 0, void 0, void 0, function* () {
        const data = yield content_model_1.Content.find().sort({ rating: -1 }).select(cardFields).limit(10);
        const withPosters = yield attachSeasonPosters(data);
        return { id: 'row_you_might_like', type: 'YOU_MIGHT_LIKE', title: 'You Might Like', items: withPosters };
    }));
    const getPopularSeries = () => fetchWithCache('home:popular_series', () => __awaiter(void 0, void 0, void 0, function* () {
        const data = yield content_model_1.Content.find({
            type: 'SERIES',
            $or: [{ isPopularSeries: true }, { engagementScore: { $gte: 10 } }]
        }).sort({ engagementScore: -1 }).select(cardFields).limit(10);
        const withPosters = yield attachSeasonPosters(data);
        return { id: 'row_popular_series', type: 'SERIES', title: 'Most Popular Series', items: withPosters };
    }));
    const getPopularMovies = () => fetchWithCache('home:popular_movies', () => __awaiter(void 0, void 0, void 0, function* () {
        const data = yield content_model_1.Content.find({
            type: 'MOVIE',
            $or: [{ isPopularSeries: true }, { engagementScore: { $gte: 10 } }]
        }).sort({ engagementScore: -1 }).select(cardFields).limit(10);
        const withPosters = yield attachSeasonPosters(data);
        return { id: 'row_popular_movies', type: 'MOVIE', title: 'Most Popular Movies', items: withPosters };
    }));
    const getTopPicks = () => fetchWithCache('home:top_picks', () => __awaiter(void 0, void 0, void 0, function* () {
        const data = yield content_model_1.Content.find({ rating: { $gte: 4.5 } }).select(cardFields).limit(10);
        const withPosters = yield attachSeasonPosters(data);
        return { id: 'row_top_picks', type: 'TOP_PICKS', title: 'Top Picks for You', items: withPosters };
    }));
    const getNewReleases = () => fetchWithCache('home:new_releases', () => __awaiter(void 0, void 0, void 0, function* () {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const data = yield content_model_1.Content.find({
            publishedAt: { $gte: thirtyDaysAgo },
            status: 'PUBLISHED'
        }).sort({ publishedAt: -1 }).select(cardFields).limit(10);
        const withPosters = yield attachSeasonPosters(data);
        return { id: 'row_new_releases', type: 'NEW_RELEASE', title: 'New Releases', items: withPosters };
    }));
    const getComingSoon = () => fetchWithCache('home:coming_soon', () => __awaiter(void 0, void 0, void 0, function* () {
        const now = new Date();
        const data = yield content_model_1.Content.find({
            $and: [
                { releaseDate: { $exists: true, $ne: null } },
                { releaseDate: { $gte: now } },
                { status: 'PUBLISHED' }
            ]
        }).sort({ releaseDate: 1 }).select(cardFields).limit(10);
        const withPosters = yield attachSeasonPosters(data);
        return { id: 'row_coming_soon', type: 'COMING_SOON', title: 'Coming Soon', items: withPosters };
    }));
    let queries = [];
    if (tab === 'new') {
        queries = [
            getComingSoon(),
            getNewReleases()
        ];
    }
    else if (tab === 'vip') {
        if (filter === 'weekly') {
            queries = [
                fetchWithCache('home:vip_weekly_v2', () => __awaiter(void 0, void 0, void 0, function* () {
                    const data = yield content_model_1.Content.find({ isPremium: true }).sort({ views: -1 }).select(cardFields).limit(10);
                    const withPosters = yield attachSeasonPosters(data);
                    return { id: 'row_vip_weekly', type: 'VIP', title: "Weekly VIP Picks", items: withPosters };
                })),
                getComingSoon()
            ];
        }
        else {
            // Default to daily
            queries = [
                fetchWithCache('home:vip_daily_v2', () => __awaiter(void 0, void 0, void 0, function* () {
                    const data = yield content_model_1.Content.find({ isPremium: true }).sort({ rating: -1 }).select(cardFields).limit(10);
                    const withPosters = yield attachSeasonPosters(data);
                    return { id: 'row_vip_daily', type: 'VIP', title: "Today's VIP Picks", items: withPosters };
                })),
                getComingSoon()
            ];
        }
    }
    else if (tab === 'ranking') {
        // Dynamic ranking based on filter (daily, weekly, monthly, popular)
        queries = [
            fetchWithCache(`home:ranking:${filter}`, () => __awaiter(void 0, void 0, void 0, function* () {
                let sortConfig = { views: -1 };
                if (filter === 'daily') {
                    sortConfig = { dailyViews: -1, views: -1 };
                }
                else if (filter === 'weekly') {
                    sortConfig = { weeklyViews: -1, views: -1 };
                }
                else if (filter === 'monthly') {
                    // We can use total views for monthly or add a monthlyViews field later
                    sortConfig = { views: -1 };
                }
                const data = yield content_model_1.Content.find().sort(sortConfig).select(cardFields).limit(10);
                const withPosters = yield attachSeasonPosters(data);
                const title = filter === 'popular' ? 'Popular Rankings' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Rankings`;
                return { id: `row_ranking_${filter}`, type: 'RANKING', title, items: withPosters };
            }))
        ];
    }
    else {
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
    const results = yield Promise.allSettled(queries);
    // Filter fulfilled promises and push non-null sections
    results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
            sections.push(result.value);
        }
        else if (result.status === 'rejected') {
            logger_1.logger.error('Home Section Query Failed:', result.reason);
        }
    });
    return { sections };
});
exports.HomeService = {
    getHomeContentFromDB,
};
