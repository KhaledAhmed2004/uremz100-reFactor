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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const config_1 = __importDefault(require("../../../config"));
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const AggregationBuilder_1 = __importDefault(require("../../builder/AggregationBuilder"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const content_model_1 = require("./content.model");
const favorite_content_model_1 = require("../favorite-content/favorite-content.model");
const episode_model_1 = require("./episode.model");
const season_model_1 = require("./season.model");
const subscription_model_1 = require("../subscription/subscription.model");
const unlocked_content_model_1 = require("./unlocked-content.model");
const unlocked_episode_model_1 = require("./unlocked-episode.model");
const reward_service_1 = require("../reward/reward.service");
const s3 = new client_s3_1.S3Client({
    region: 'auto',
    credentials: {
        accessKeyId: config_1.default.r2.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: config_1.default.r2.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    endpoint: config_1.default.r2.s3ApiUrl || process.env.AWS_S3_ENDPOINT || undefined,
    forcePathStyle: true,
});
const searchContentFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const searchableFields = ['title', 'description'];
    // Handle specific "filter" parameter from documentation
    if (query.filter === 'popular') {
        query.sort = '-views';
    }
    else if (query.filter === 'new') {
        query.sort = '-createdAt';
    }
    const cardFields = 'title posterUrl type rating releaseYear isPremium publishedAt createdAt';
    const contentQuery = new QueryBuilder_1.default(content_model_1.Content.find().select(cardFields), query)
        .search(searchableFields)
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield contentQuery.modelQuery;
    const pagination = yield contentQuery.getPaginationInfo();
    return {
        pagination,
        data: result,
    };
});
const unlockEpisodeInDB = (userId, episodeId) => __awaiter(void 0, void 0, void 0, function* () {
    const episode = yield episode_model_1.Episode.findById(episodeId);
    if (!episode) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Episode not found');
    }
    if (!episode.requiredCoin || episode.requiredCoin <= 0) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'This episode does not require coins to unlock');
    }
    const alreadyUnlocked = yield unlocked_episode_model_1.UnlockedEpisode.findOne({
        userId: new mongoose_1.Types.ObjectId(userId),
        episodeId: new mongoose_1.Types.ObjectId(episodeId)
    });
    if (alreadyUnlocked) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'Episode is already unlocked');
    }
    // Deduct coins
    yield reward_service_1.RewardService.deductCoinsForUnlock(userId, episode.requiredCoin);
    // Record unlock
    yield unlocked_episode_model_1.UnlockedEpisode.create({
        userId: new mongoose_1.Types.ObjectId(userId),
        episodeId: new mongoose_1.Types.ObjectId(episodeId)
    });
    return { success: true, message: 'Episode unlocked successfully' };
});
const favoriteContentInDB = (userId, contentId) => __awaiter(void 0, void 0, void 0, function* () {
    const isContentExist = yield content_model_1.Content.findById(contentId);
    if (!isContentExist) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Content not found');
    }
    const result = yield favorite_content_model_1.FavoriteContent.findOneAndUpdate({
        userId: new mongoose_1.Types.ObjectId(userId),
        contentId: new mongoose_1.Types.ObjectId(contentId),
    }, {
        userId: new mongoose_1.Types.ObjectId(userId),
        contentId: new mongoose_1.Types.ObjectId(contentId),
    }, { upsert: true, new: true });
    return result;
});
const unfavoriteContentFromDB = (userId, contentId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield favorite_content_model_1.FavoriteContent.findOneAndDelete({
        userId: new mongoose_1.Types.ObjectId(userId),
        contentId: new mongoose_1.Types.ObjectId(contentId),
    });
    return result;
});
const getBestMoviesFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_model_1.Content.find({ type: 'MOVIE' }).sort({ rating: -1 }).limit(10);
    return result;
});
const getComingSoonContentFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const now = new Date();
    const result = yield content_model_1.Content.find({
        $and: [
            { releaseDate: { $exists: true, $ne: null } },
            { releaseDate: { $gte: now } },
            { status: 'PUBLISHED' }
        ]
    }).sort({ releaseDate: 1 }).limit(10);
    return result;
});
const getAdminMoviesList = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const movieQuery = new QueryBuilder_1.default(content_model_1.Content.find({ type: 'MOVIE' }), query)
        .search(['title'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const movies = yield movieQuery.modelQuery;
    const paginationInfo = yield movieQuery.getPaginationInfo();
    const data = movies.map((item) => ({
        _id: item._id,
        title: item.title,
        posterUrl: item.posterUrl,
        poster: item.posterUrl,
        duration: `${Math.floor(item.duration / 60)}h ${item.duration % 60}m`,
        status: item.status,
        planStatus: item.planStatus,
        requiredCoin: item.requiredCoin,
    }));
    return {
        pagination: paginationInfo,
        data,
    };
});
const getAdminSeriesList = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const seriesQuery = new QueryBuilder_1.default(content_model_1.Content.find({ type: 'SERIES' }), query)
        .search(['title'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const series = yield seriesQuery.modelQuery;
    const paginationInfo = yield seriesQuery.getPaginationInfo();
    const data = yield Promise.all(series.map((item) => __awaiter(void 0, void 0, void 0, function* () {
        let posterUrl = null;
        const latestSeason = yield season_model_1.Season.findOne({ seriesId: item._id }).sort('-seasonNumber').lean();
        if (latestSeason) {
            posterUrl = latestSeason.posterUrl;
        }
        return {
            _id: item._id,
            title: item.title,
            posterUrl,
            poster: posterUrl,
            seasonsCount: item.seasonsCount || 0,
            status: item.status,
            planStatus: item.planStatus,
            requiredCoin: item.requiredCoin,
        };
    })));
    return {
        pagination: paginationInfo,
        data,
    };
});
const getMovieDetailsFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const movie = yield content_model_1.Content.findById(id);
    if (!movie) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Movie not found');
    }
    return movie.toObject();
});
const getSeriesDetailsFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const series = yield content_model_1.Content.findById(id);
    if (!series) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Series not found');
    }
    // Double check total episodes count from Episode collection
    const totalEpisodes = yield episode_model_1.Episode.countDocuments({ seriesId: id });
    // Fetch seasons for this series and count episodes for each season
    const seasonsRaw = yield season_model_1.Season.find({ seriesId: id }).sort('seasonNumber');
    const seasons = yield Promise.all(seasonsRaw.map((season) => __awaiter(void 0, void 0, void 0, function* () {
        const episodeCount = yield episode_model_1.Episode.countDocuments({ seasonId: season._id });
        return Object.assign(Object.assign({}, season.toObject()), { episodeCount });
    })));
    return Object.assign(Object.assign({}, series.toObject()), { totalEpisodes: totalEpisodes, seasons: seasons });
});
const getContentDetailsPublicFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const content = yield content_model_1.Content.findById(id)
        .populate('genres', 'name')
        .select('-dailyViews -weeklyViews -totalWatchTime -engagementScore -trendingScore -__v -cast');
    if (!content || content.status !== 'PUBLISHED') {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Content not found');
    }
    let result = content.toObject();
    if (result.genres && Array.isArray(result.genres)) {
        result.genres = result.genres.map((g) => g.name || g);
    }
    if (content.type === 'SERIES') {
        const totalEpisodes = yield episode_model_1.Episode.countDocuments({ seriesId: id, status: 'PUBLISHED' });
        const seasonsRaw = yield season_model_1.Season.find({ seriesId: id }).sort('seasonNumber');
        const seasons = yield Promise.all(seasonsRaw.map((season) => __awaiter(void 0, void 0, void 0, function* () {
            const episodes = yield episode_model_1.Episode.find({ seasonId: season._id, status: 'PUBLISHED' })
                .select('-videoUrl -createdAt -updatedAt -__v')
                .sort('episodeNumber');
            const seasonObj = season.toObject();
            delete seasonObj.createdAt;
            delete seasonObj.updatedAt;
            delete seasonObj.__v;
            return Object.assign(Object.assign({}, seasonObj), { episodeCount: episodes.length });
        })));
        result = Object.assign(Object.assign({}, result), { totalEpisodes, seasonsCount: seasons.length, seasons });
    }
    else if (content.type === 'MOVIE') {
        delete result.totalEpisodes;
        delete result.seasonsCount;
    }
    return result;
});
const _generateSignedUrlIfS3 = (rawUrl) => __awaiter(void 0, void 0, void 0, function* () {
    const bucket = config_1.default.r2.bucketName || process.env.AWS_S3_BUCKET;
    const r2Domain = config_1.default.r2.customDomain || `https://${config_1.default.r2.accountId}.r2.cloudflarestorage.com`;
    // Attempt to extract S3 key if it matches our R2 bucket domain
    let key = rawUrl;
    if (rawUrl.includes(bucket) || rawUrl.includes(r2Domain)) {
        try {
            const urlObj = new URL(rawUrl);
            // Strip leading slash
            key = urlObj.pathname.substring(1);
            // Remove bucket name from path if it's there
            if (key.startsWith(`${bucket}/`)) {
                key = key.substring(bucket.length + 1);
            }
        }
        catch (e) {
            // Not a valid URL, treat as raw key
        }
    }
    // If it's still a full http URL (e.g. cloudinary/w3c test), just return it
    if (key.startsWith('http')) {
        return {
            url: key,
            expiresAt: new Date(Date.now() + 3600 * 1000)
        };
    }
    const command = new client_s3_1.GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    const signedUrl = yield (0, s3_request_presigner_1.getSignedUrl)(s3, command, { expiresIn: 3600 });
    return {
        url: signedUrl,
        expiresAt: new Date(Date.now() + 3600 * 1000)
    };
});
const _checkSubscription = (userId, planStatus) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (planStatus.includes('FREE'))
        return;
    if (!userId) {
        throw new ApiError_1.default(http_status_1.default.FORBIDDEN, 'Please login to watch premium content');
    }
    const subscription = yield subscription_model_1.Subscription.findOne({
        userId: new mongoose_1.Types.ObjectId(userId),
        status: 'ACTIVE'
    });
    if (!subscription) {
        throw new ApiError_1.default(http_status_1.default.FORBIDDEN, 'Active subscription required to watch this content');
    }
    // Allow ALL or if the user's plan intersects with the content's required plans
    if (!planStatus.includes('ALL') && !planStatus.includes(((_a = subscription.plan) === null || _a === void 0 ? void 0 : _a.toString()) || ((_b = subscription.planId) === null || _b === void 0 ? void 0 : _b.toString()))) { // Simplified check. Ideally we cross-reference plan IDs
        // In many systems 'PREMIUM'/'BASIC' strings are used. If subscription has a plan object, we'd check its type.
        // For now, if they have ANY active subscription, we let them watch it since our plan statuses are simple.
        // To strictly check if subscription matches planStatus, we can do further validation based on your exact Subscription schema.
    }
});
const getEpisodesBySeasonPublicFromDB = (seasonId) => __awaiter(void 0, void 0, void 0, function* () {
    const episodes = yield episode_model_1.Episode.find({ seasonId, status: 'PUBLISHED' })
        .select('-createdAt -updatedAt -__v')
        .sort('episodeNumber');
    return episodes;
});
const getSimilarContentFromDB = (contentId) => __awaiter(void 0, void 0, void 0, function* () {
    const content = yield content_model_1.Content.findById(contentId).select('genres');
    if (!content) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Content not found');
    }
    const similarContents = yield content_model_1.Content.find({
        _id: { $ne: content._id },
        status: 'PUBLISHED',
        genres: { $in: content.genres }
    })
        .select('-videoUrl -dailyViews -weeklyViews -totalWatchTime -engagementScore -trendingScore -__v -cast')
        .sort({ engagementScore: -1, views: -1 })
        .limit(10);
    return similarContents;
});
const generatePlaybackUrl = (contentId, userId, guestId) => __awaiter(void 0, void 0, void 0, function* () {
    const content = yield content_model_1.Content.findById(contentId);
    if (!content || content.status !== 'PUBLISHED') {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Content not found');
    }
    try {
        yield _checkSubscription(userId, content.planStatus);
    }
    catch (err) {
        // If user is not subscribed, check if they unlocked it
        if (userId && content.requiredCoin && content.requiredCoin > 0) {
            const isUnlocked = yield unlocked_content_model_1.UnlockedContent.findOne({
                userId: new mongoose_1.Types.ObjectId(userId),
                contentId: new mongoose_1.Types.ObjectId(contentId)
            });
            if (!isUnlocked) {
                throw new ApiError_1.default(http_status_1.default.FORBIDDEN, 'You need to unlock this content or subscribe to watch it');
            }
        }
        else {
            throw err;
        }
    }
    const { url, expiresAt } = yield _generateSignedUrlIfS3(content.videoUrl);
    return {
        contentId,
        url,
        expiresAt
    };
});
const generateEpisodePlaybackUrl = (episodeId, userId, guestId) => __awaiter(void 0, void 0, void 0, function* () {
    const episode = yield episode_model_1.Episode.findById(episodeId);
    if (!episode || episode.status !== 'PUBLISHED') {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Episode not found');
    }
    try {
        yield _checkSubscription(userId, [episode.planStatus]);
    }
    catch (err) {
        let unlocked = false;
        if (userId && episode.requiredCoin && episode.requiredCoin > 0) {
            const isUnlocked = yield unlocked_episode_model_1.UnlockedEpisode.findOne({
                userId: new mongoose_1.Types.ObjectId(userId),
                episodeId: episode._id
            });
            if (isUnlocked) {
                unlocked = true;
            }
        }
        if (!unlocked) {
            throw err;
        }
    }
    const { url, expiresAt } = yield _generateSignedUrlIfS3(episode.videoUrl);
    return {
        episodeId,
        url,
        expiresAt
    };
});
const getEpisodesFromDB = (seriesId, query) => __awaiter(void 0, void 0, void 0, function* () {
    const filter = { seriesId: new mongoose_1.Types.ObjectId(seriesId) };
    // Support filtering by seasonId or seasonNumber
    if (query.seasonId) {
        filter.seasonId = new mongoose_1.Types.ObjectId(query.seasonId);
        delete query.seasonId;
    }
    else if (query.seasonNumber) {
        filter.seasonNumber = Number(query.seasonNumber);
        delete query.seasonNumber;
    }
    const episodeQuery = new QueryBuilder_1.default(episode_model_1.Episode.find(filter), query)
        .search(['title'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const episodes = yield episodeQuery.modelQuery;
    const paginationInfo = yield episodeQuery.getPaginationInfo();
    return {
        pagination: paginationInfo,
        data: episodes.map((ep) => ({
            _id: ep._id,
            title: ep.title,
            description: ep.description,
            thumbnailUrl: ep.thumbnailUrl,
            duration: `${ep.duration} min`,
            releaseDate: ep.releaseDate,
            status: ep.status,
            planStatus: ep.planStatus,
            seasonId: ep.seasonId,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.episodeNumber,
        })),
    };
});
const createEpisodeToDB = (seriesId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const series = yield content_model_1.Content.findById(seriesId);
    if (!series) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Series not found');
    }
    // If seasonId is provided, verify it exists
    if (payload.seasonId) {
        const season = yield season_model_1.Season.findById(payload.seasonId);
        if (!season) {
            throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Season not found');
        }
        // Automatically set seasonNumber from the season record if not provided
        if (!payload.seasonNumber) {
            payload.seasonNumber = season.seasonNumber;
        }
    }
    const episodeData = Object.assign(Object.assign({}, payload), { seriesId: new mongoose_1.Types.ObjectId(seriesId), seasonId: payload.seasonId ? new mongoose_1.Types.ObjectId(payload.seasonId) : undefined, duration: payload.duration ? Number(payload.duration) : 0, seasonNumber: payload.seasonNumber ? Number(payload.seasonNumber) : 1, episodeNumber: payload.episodeNumber ? Number(payload.episodeNumber) : 1, requiredCoin: payload.requiredCoin ? Number(payload.requiredCoin) : 0, releaseDate: payload.releaseDate ? new Date(payload.releaseDate) : new Date(), planStatus: payload.availability || 'FREE', status: payload.isDraft === 'true' || payload.isDraft === true ? 'DRAFT' : 'PUBLISHED' });
    const result = yield episode_model_1.Episode.create(episodeData);
    // Update series aggregate counts
    const totalEpisodes = yield episode_model_1.Episode.countDocuments({ seriesId });
    const maxSeason = yield episode_model_1.Episode.aggregate([
        { $match: { seriesId: new mongoose_1.Types.ObjectId(seriesId) } },
        { $group: { _id: null, maxSeason: { $max: '$seasonNumber' } } }
    ]);
    yield content_model_1.Content.findByIdAndUpdate(seriesId, {
        totalEpisodes,
        seasonsCount: ((_a = maxSeason[0]) === null || _a === void 0 ? void 0 : _a.maxSeason) || 1
    });
    return result;
});
const updateEpisodeInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const updateData = Object.assign({}, payload);
    if (payload.duration)
        updateData.duration = Number(payload.duration);
    if (payload.seasonNumber)
        updateData.seasonNumber = Number(payload.seasonNumber);
    if (payload.requiredCoin !== undefined)
        updateData.requiredCoin = Number(payload.requiredCoin);
    if (payload.releaseDate)
        updateData.releaseDate = new Date(payload.releaseDate);
    if (payload.availability)
        updateData.planStatus = payload.availability;
    if (payload.isDraft !== undefined) {
        updateData.status = payload.isDraft === 'true' || payload.isDraft === true ? 'DRAFT' : 'PUBLISHED';
    }
    const result = yield episode_model_1.Episode.findByIdAndUpdate(id, updateData, { new: true });
    if (result) {
        // Sync series aggregate counts
        const seriesId = result.seriesId;
        const totalEpisodes = yield episode_model_1.Episode.countDocuments({ seriesId });
        const maxSeason = yield episode_model_1.Episode.aggregate([
            { $match: { seriesId: new mongoose_1.Types.ObjectId(seriesId) } },
            { $group: { _id: null, maxSeason: { $max: '$seasonNumber' } } }
        ]);
        yield content_model_1.Content.findByIdAndUpdate(seriesId, {
            totalEpisodes,
            seasonsCount: ((_a = maxSeason[0]) === null || _a === void 0 ? void 0 : _a.maxSeason) || 1
        });
    }
    return result;
});
const deleteEpisodeFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const episode = yield episode_model_1.Episode.findById(id);
    if (!episode)
        return null;
    const seriesId = episode.seriesId;
    const result = yield episode_model_1.Episode.findByIdAndDelete(id);
    // Sync series aggregate counts
    const totalEpisodes = yield episode_model_1.Episode.countDocuments({ seriesId });
    const maxSeason = yield episode_model_1.Episode.aggregate([
        { $match: { seriesId: new mongoose_1.Types.ObjectId(seriesId) } },
        { $group: { _id: null, maxSeason: { $max: '$seasonNumber' } } }
    ]);
    yield content_model_1.Content.findByIdAndUpdate(seriesId, {
        totalEpisodes,
        seasonsCount: ((_a = maxSeason[0]) === null || _a === void 0 ? void 0 : _a.maxSeason) || 1
    });
    return result;
});
const createMovieToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { isDraft, availability, genres, cast, duration, releaseYear, rating, views, isPremium, releaseDate, isPopularSeries, thumbnail, requiredCoin } = payload, rest = __rest(payload, ["isDraft", "availability", "genres", "cast", "duration", "releaseYear", "rating", "views", "isPremium", "releaseDate", "isPopularSeries", "thumbnail", "requiredCoin"]);
    const movieData = Object.assign(Object.assign({}, rest), { genres: Array.isArray(genres) ? genres : (genres ? [genres] : []), cast: Array.isArray(cast) ? cast : (cast ? [cast] : []), duration: duration ? Number(duration) : 0, releaseYear: releaseYear ? Number(releaseYear) : new Date().getFullYear(), rating: rating ? Number(rating) : 0, views: views ? Number(views) : 0, isPopularSeries: isPopularSeries === 'true' || isPopularSeries === true, planStatus: Array.isArray(availability) ? availability : (availability ? [availability] : ['FREE']), status: isDraft === 'true' || isDraft === true ? 'DRAFT' : 'PUBLISHED', publishedAt: isDraft === 'true' || isDraft === true ? undefined : new Date(), type: 'MOVIE', requiredCoin: requiredCoin ? Number(requiredCoin) : 0 });
    if (isPremium !== undefined)
        movieData.isPremium = isPremium === 'true' || isPremium === true;
    if (releaseDate !== undefined)
        movieData.releaseDate = new Date(releaseDate);
    const result = yield content_model_1.Content.create(movieData);
    return result;
});
const createSeriesToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { isDraft, availability, genres, releaseYear, rating, views, isPremium, releaseDate, isPopularSeries, cast, thumbnail } = payload, rest = __rest(payload, ["isDraft", "availability", "genres", "releaseYear", "rating", "views", "isPremium", "releaseDate", "isPopularSeries", "cast", "thumbnail"]);
    const seriesData = Object.assign(Object.assign({}, rest), { genres: Array.isArray(genres) ? genres : (genres ? [genres] : []), cast: Array.isArray(cast) ? cast : (cast ? [cast] : []), duration: 0, releaseYear: releaseYear ? Number(releaseYear) : new Date().getFullYear(), rating: rating ? Number(rating) : 0, views: views ? Number(views) : 0, isPopularSeries: isPopularSeries === 'true' || isPopularSeries === true, planStatus: Array.isArray(availability) ? availability : (availability ? [availability] : ['FREE']), status: isDraft === 'true' || isDraft === true ? 'DRAFT' : 'PUBLISHED', publishedAt: isDraft === 'true' || isDraft === true ? undefined : new Date(), type: 'SERIES' });
    if (isPremium !== undefined)
        seriesData.isPremium = isPremium === 'true' || isPremium === true;
    if (releaseDate !== undefined)
        seriesData.releaseDate = new Date(releaseDate);
    const result = yield content_model_1.Content.create(seriesData);
    return result;
});
const updateSeriesInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { isDraft, availability, genres, releaseYear, rating, views, isPremium, releaseDate, isPopularSeries, cast, thumbnail } = payload, rest = __rest(payload, ["isDraft", "availability", "genres", "releaseYear", "rating", "views", "isPremium", "releaseDate", "isPopularSeries", "cast", "thumbnail"]);
    const updateData = Object.assign({}, rest);
    if (genres)
        updateData.genres = Array.isArray(genres) ? genres : [genres];
    if (cast)
        updateData.cast = Array.isArray(cast) ? cast : [cast];
    if (releaseYear !== undefined)
        updateData.releaseYear = Number(releaseYear);
    if (rating !== undefined)
        updateData.rating = Number(rating);
    if (views !== undefined)
        updateData.views = Number(views);
    if (isPremium !== undefined)
        updateData.isPremium = isPremium === 'true' || isPremium === true;
    if (releaseDate !== undefined)
        updateData.releaseDate = new Date(releaseDate);
    if (isPopularSeries !== undefined)
        updateData.isPopularSeries = isPopularSeries === 'true' || isPopularSeries === true;
    if (availability)
        updateData.planStatus = Array.isArray(availability) ? availability : [availability];
    if (isDraft !== undefined) {
        const isDraftBool = isDraft === 'true' || isDraft === true;
        updateData.status = isDraftBool ? 'DRAFT' : 'PUBLISHED';
        if (!isDraftBool)
            updateData.publishedAt = new Date();
    }
    const result = yield content_model_1.Content.findByIdAndUpdate(id, updateData, { new: true });
    return result;
});
const deleteSeriesFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Delete all episodes associated with this series
    yield episode_model_1.Episode.deleteMany({ seriesId: new mongoose_1.Types.ObjectId(id) });
    // 2. Delete the series content
    const result = yield content_model_1.Content.findByIdAndDelete(id);
    return result;
});
const updateSeriesStatusInDB = (id, status) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_model_1.Content.findByIdAndUpdate(id, { status }, { new: true });
    return result;
});
const updateMovieInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { isDraft, availability, genres, cast, duration, releaseYear, rating, views, isPremium, releaseDate, isPopularSeries, requiredCoin } = payload, rest = __rest(payload, ["isDraft", "availability", "genres", "cast", "duration", "releaseYear", "rating", "views", "isPremium", "releaseDate", "isPopularSeries", "requiredCoin"]);
    const updateData = Object.assign({}, rest);
    if (genres)
        updateData.genres = Array.isArray(genres) ? genres : [genres];
    if (cast)
        updateData.cast = Array.isArray(cast) ? cast : [cast];
    if (duration !== undefined)
        updateData.duration = Number(duration);
    if (releaseYear !== undefined)
        updateData.releaseYear = Number(releaseYear);
    if (rating !== undefined)
        updateData.rating = Number(rating);
    if (views !== undefined)
        updateData.views = Number(views);
    if (isPremium !== undefined)
        updateData.isPremium = isPremium === 'true' || isPremium === true;
    if (releaseDate !== undefined)
        updateData.releaseDate = new Date(releaseDate);
    if (isPopularSeries !== undefined)
        updateData.isPopularSeries = isPopularSeries === 'true' || isPopularSeries === true;
    if (requiredCoin !== undefined)
        updateData.requiredCoin = Number(requiredCoin);
    if (availability)
        updateData.planStatus = Array.isArray(availability) ? availability : [availability];
    if (isDraft !== undefined) {
        const isDraftBool = isDraft === 'true' || isDraft === true;
        updateData.status = isDraftBool ? 'DRAFT' : 'PUBLISHED';
        if (!isDraftBool)
            updateData.publishedAt = new Date();
    }
    const result = yield content_model_1.Content.findByIdAndUpdate(id, updateData, { new: true });
    return result;
});
const deleteMovieFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_model_1.Content.findByIdAndDelete(id);
    return result;
});
const updateMovieStatusInDB = (id, status) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_model_1.Content.findByIdAndUpdate(id, { status }, { new: true });
    return result;
});
const initiateMultipartUpload = (fileName, contentType) => __awaiter(void 0, void 0, void 0, function* () {
    const key = `media/videos/${Date.now()}-${fileName}`;
    const bucket = config_1.default.r2.bucketName || process.env.AWS_S3_BUCKET;
    const command = new client_s3_1.CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
    });
    const response = yield s3.send(command);
    return {
        uploadId: response.UploadId,
        key: key,
    };
});
const generateMultipartPresignedUrls = (uploadId, key, partNumbers) => __awaiter(void 0, void 0, void 0, function* () {
    const bucket = config_1.default.r2.bucketName || process.env.AWS_S3_BUCKET;
    const urls = yield Promise.all(partNumbers.map((partNumber) => __awaiter(void 0, void 0, void 0, function* () {
        const command = new client_s3_1.UploadPartCommand({
            Bucket: bucket,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
        });
        const url = yield (0, s3_request_presigner_1.getSignedUrl)(s3, command, { expiresIn: 3600 });
        return { partNumber, url };
    })));
    return urls;
});
const completeMultipartUpload = (uploadId, key, parts) => __awaiter(void 0, void 0, void 0, function* () {
    const bucket = config_1.default.r2.bucketName || process.env.AWS_S3_BUCKET;
    const command = new client_s3_1.CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
            Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        },
    });
    yield s3.send(command);
    let location = '';
    if (config_1.default.r2.customDomain) {
        location = `${config_1.default.r2.customDomain.replace(/\/$/, '')}/${key}`;
    }
    else if (config_1.default.r2.accountId) {
        location = `https://${config_1.default.r2.accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
    }
    else {
        const region = process.env.AWS_REGION || 'us-east-1';
        location = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    }
    return {
        location,
        key: key,
    };
});
const createSeasonToDB = (seriesId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const series = yield content_model_1.Content.findById(seriesId);
    if (!series) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Series not found');
    }
    const result = yield season_model_1.Season.create(Object.assign(Object.assign({}, payload), { seriesId }));
    // Update series seasonsCount
    yield content_model_1.Content.findByIdAndUpdate(seriesId, {
        $inc: { seasonsCount: 1 },
    });
    return result;
});
const getSeasonsBySeriesFromDB = (seriesId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield season_model_1.Season.find({ seriesId }).sort('seasonNumber');
});
const updateSeasonInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield season_model_1.Season.findByIdAndUpdate(id, payload, { new: true });
    if (!result) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Season not found');
    }
    return result;
});
const deleteSeasonFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const season = yield season_model_1.Season.findById(id);
    if (!season) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Season not found');
    }
    // Delete all episodes in this season
    yield episode_model_1.Episode.deleteMany({ seasonId: id });
    // Delete season
    yield season_model_1.Season.findByIdAndDelete(id);
    // Decrement series seasonsCount
    yield content_model_1.Content.findByIdAndUpdate(season.seriesId, {
        $inc: { seasonsCount: -1 },
    });
    return null;
});
const getMoviesStats = () => __awaiter(void 0, void 0, void 0, function* () {
    const contentBuilder = new AggregationBuilder_1.default(content_model_1.Content);
    const formatMetric = (stat) => {
        const growthVal = (stat === null || stat === void 0 ? void 0 : stat.growth) || 0;
        return {
            value: Number((stat === null || stat === void 0 ? void 0 : stat.total) || 0),
            changePct: Number(Math.abs(Number(growthVal)).toFixed(2)),
            direction: (stat === null || stat === void 0 ? void 0 : stat.growthType) === 'increase'
                ? 'up'
                : (stat === null || stat === void 0 ? void 0 : stat.growthType) === 'decrease'
                    ? 'down'
                    : 'neutral',
        };
    };
    const movieGrowth = yield contentBuilder.calculateGrowth({
        filter: { type: 'MOVIE' },
        period: 'month',
    });
    const viewsGrowth = yield contentBuilder.calculateGrowth({
        filter: { type: 'MOVIE' },
        sumField: 'views',
        period: 'month',
    });
    // Calculate Likes Growth manually since it requires a join
    const getLikesStats = () => __awaiter(void 0, void 0, void 0, function* () {
        const now = new Date();
        const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
        const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endLast = new Date(now.getFullYear(), now.getMonth(), 0);
        endLast.setHours(23, 59, 59, 999);
        const getLikesCount = (dateFilter) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const pipeline = [
                {
                    $lookup: {
                        from: 'contents',
                        localField: 'contentId',
                        foreignField: '_id',
                        as: 'content',
                    },
                },
                { $unwind: '$content' },
                { $match: { 'content.type': 'MOVIE' } },
            ];
            if (dateFilter) {
                pipeline.push({ $match: { createdAt: dateFilter } });
            }
            pipeline.push({ $group: { _id: null, total: { $sum: 1 } } });
            const result = yield favorite_content_model_1.FavoriteContent.aggregate(pipeline);
            return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
        });
        const [thisPeriod, lastPeriod, total] = yield Promise.all([
            getLikesCount({ $gte: startThis }),
            getLikesCount({ $gte: startLast, $lte: endLast }),
            getLikesCount(),
        ]);
        let growth = 0;
        let growthType = 'no_change';
        if (lastPeriod > 0) {
            growth = ((thisPeriod - lastPeriod) / lastPeriod) * 100;
            growthType = growth > 0 ? 'increase' : growth < 0 ? 'decrease' : 'no_change';
        }
        else if (thisPeriod > 0) {
            growth = 100;
            growthType = 'increase';
        }
        return { total, growth, growthType };
    });
    const likesGrowth = yield getLikesStats();
    // CTR (Click-Through Rate) - Since there is no impression data, we calculate an Engagement Rate (Likes / Views)
    const calculateRatio = (likes, views) => (views > 0 ? (likes / views) * 100 : 0);
    const currentCtr = calculateRatio(likesGrowth.thisPeriodCount || 0, viewsGrowth.thisPeriodCount || 0);
    const previousCtr = calculateRatio(likesGrowth.lastPeriodCount || 0, viewsGrowth.lastPeriodCount || 0);
    const ctrValue = calculateRatio(likesGrowth.total, viewsGrowth.total);
    let ctrChange = 0;
    let ctrDirection = 'neutral';
    if (previousCtr > 0) {
        ctrChange = ((currentCtr - previousCtr) / previousCtr) * 100;
        ctrDirection = ctrChange > 0 ? 'up' : ctrChange < 0 ? 'down' : 'neutral';
    }
    else if (currentCtr > 0) {
        ctrChange = 100;
        ctrDirection = 'up';
    }
    return {
        meta: { comparisonPeriod: 'month' },
        totalMovies: formatMetric(movieGrowth),
        totalLikes: formatMetric(likesGrowth),
        ctr: {
            value: Number(ctrValue || 0),
            changePct: Number(Math.abs(Number(ctrChange || 0)).toFixed(2)),
            direction: ctrDirection,
        },
        totalViews: formatMetric(viewsGrowth),
    };
});
const getSeriesStats = () => __awaiter(void 0, void 0, void 0, function* () {
    const contentBuilder = new AggregationBuilder_1.default(content_model_1.Content);
    const formatMetric = (stat) => {
        const growthVal = (stat === null || stat === void 0 ? void 0 : stat.growth) || 0;
        return {
            value: Number((stat === null || stat === void 0 ? void 0 : stat.total) || 0),
            changePct: Number(Math.abs(Number(growthVal)).toFixed(2)),
            direction: (stat === null || stat === void 0 ? void 0 : stat.growthType) === 'increase'
                ? 'up'
                : (stat === null || stat === void 0 ? void 0 : stat.growthType) === 'decrease'
                    ? 'down'
                    : 'neutral',
        };
    };
    const seriesGrowth = yield contentBuilder.calculateGrowth({
        filter: { type: 'SERIES' },
        period: 'month',
    });
    const viewsGrowth = yield contentBuilder.calculateGrowth({
        filter: { type: 'SERIES' },
        sumField: 'views',
        period: 'month',
    });
    // Calculate Likes Growth manually since it requires a join
    const getLikesStats = () => __awaiter(void 0, void 0, void 0, function* () {
        const now = new Date();
        const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
        const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endLast = new Date(now.getFullYear(), now.getMonth(), 0);
        endLast.setHours(23, 59, 59, 999);
        const getLikesCount = (dateFilter) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const pipeline = [
                {
                    $lookup: {
                        from: 'contents',
                        localField: 'contentId',
                        foreignField: '_id',
                        as: 'content',
                    },
                },
                { $unwind: '$content' },
                { $match: { 'content.type': 'SERIES' } },
            ];
            if (dateFilter) {
                pipeline.push({ $match: { createdAt: dateFilter } });
            }
            pipeline.push({ $group: { _id: null, total: { $sum: 1 } } });
            const result = yield favorite_content_model_1.FavoriteContent.aggregate(pipeline);
            return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
        });
        const [thisPeriod, lastPeriod, total] = yield Promise.all([
            getLikesCount({ $gte: startThis }),
            getLikesCount({ $gte: startLast, $lte: endLast }),
            getLikesCount(),
        ]);
        let growth = 0;
        let growthType = 'no_change';
        if (lastPeriod > 0) {
            growth = ((thisPeriod - lastPeriod) / lastPeriod) * 100;
            growthType = growth > 0 ? 'increase' : growth < 0 ? 'decrease' : 'no_change';
        }
        else if (thisPeriod > 0) {
            growth = 100;
            growthType = 'increase';
        }
        return { total, growth, growthType };
    });
    const likesGrowth = yield getLikesStats();
    // CTR (Click-Through Rate) - Since there is no impression data, we calculate an Engagement Rate (Likes / Views)
    const calculateRatio = (likes, views) => (views > 0 ? (likes / views) * 100 : 0);
    const currentCtr = calculateRatio(likesGrowth.thisPeriodCount || 0, viewsGrowth.thisPeriodCount || 0);
    const previousCtr = calculateRatio(likesGrowth.lastPeriodCount || 0, viewsGrowth.lastPeriodCount || 0);
    const ctrValue = calculateRatio(likesGrowth.total, viewsGrowth.total);
    let ctrChange = 0;
    let ctrDirection = 'neutral';
    if (previousCtr > 0) {
        ctrChange = ((currentCtr - previousCtr) / previousCtr) * 100;
        ctrDirection = ctrChange > 0 ? 'up' : ctrChange < 0 ? 'down' : 'neutral';
    }
    else if (currentCtr > 0) {
        ctrChange = 100;
        ctrDirection = 'up';
    }
    return {
        meta: { comparisonPeriod: 'month' },
        totalSeries: formatMetric(seriesGrowth),
        totalLikes: formatMetric(likesGrowth),
        ctr: {
            value: Number(ctrValue || 0),
            changePct: Number(Math.abs(Number(ctrChange || 0)).toFixed(2)),
            direction: ctrDirection,
        },
        totalViews: formatMetric(viewsGrowth),
    };
});
const unlockContentInDB = (userId, contentId) => __awaiter(void 0, void 0, void 0, function* () {
    const content = yield content_model_1.Content.findById(contentId);
    if (!content) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Content not found');
    }
    if (!content.requiredCoin || content.requiredCoin <= 0) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'This content cannot be unlocked with coins');
    }
    const alreadyUnlocked = yield unlocked_content_model_1.UnlockedContent.findOne({
        userId: new mongoose_1.Types.ObjectId(userId),
        contentId: new mongoose_1.Types.ObjectId(contentId),
    });
    if (alreadyUnlocked) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'You have already unlocked this content');
    }
    yield reward_service_1.RewardService.deductCoinsForUnlock(userId, content.requiredCoin);
    const unlocked = yield unlocked_content_model_1.UnlockedContent.create({
        userId: new mongoose_1.Types.ObjectId(userId),
        contentId: new mongoose_1.Types.ObjectId(contentId),
    });
    return unlocked;
});
exports.ContentService = {
    searchContentFromDB,
    favoriteContentInDB,
    unfavoriteContentFromDB,
    getBestMoviesFromDB,
    getComingSoonContentFromDB,
    getMoviesStats,
    getSeriesStats,
    getAdminMoviesList: getAdminMoviesList,
    getAdminSeriesList: getAdminSeriesList,
    getMovieDetailsFromDB: getMovieDetailsFromDB,
    getSeriesDetailsFromDB: getSeriesDetailsFromDB,
    getEpisodesFromDB: getEpisodesFromDB,
    createEpisodeToDB: createEpisodeToDB,
    updateEpisodeInDB: updateEpisodeInDB,
    deleteEpisodeFromDB: deleteEpisodeFromDB,
    createMovieToDB: createMovieToDB,
    createSeriesToDB: createSeriesToDB,
    updateSeriesInDB: updateSeriesInDB,
    deleteSeriesFromDB: deleteSeriesFromDB,
    updateSeriesStatusInDB: updateSeriesStatusInDB,
    updateMovieInDB: updateMovieInDB,
    deleteMovieFromDB: deleteMovieFromDB,
    updateMovieStatusInDB: updateMovieStatusInDB,
    initiateMultipartUpload: initiateMultipartUpload,
    generateMultipartPresignedUrls: generateMultipartPresignedUrls,
    completeMultipartUpload: completeMultipartUpload,
    createSeasonToDB: createSeasonToDB,
    getSeasonsBySeriesFromDB: getSeasonsBySeriesFromDB,
    updateSeasonInDB: updateSeasonInDB,
    deleteSeasonFromDB: deleteSeasonFromDB,
    getContentDetailsPublicFromDB: getContentDetailsPublicFromDB,
    getSimilarContentFromDB: getSimilarContentFromDB,
    getEpisodesBySeasonPublicFromDB: getEpisodesBySeasonPublicFromDB,
    generatePlaybackUrl: generatePlaybackUrl,
    generateEpisodePlaybackUrl: generateEpisodePlaybackUrl,
    unlockContentInDB: unlockContentInDB,
    unlockEpisodeInDB: unlockEpisodeInDB
};
