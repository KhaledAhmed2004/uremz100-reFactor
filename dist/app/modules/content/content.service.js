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
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const content_model_1 = require("./content.model");
const favorite_content_model_1 = require("../favorite-content/favorite-content.model");
const episode_model_1 = require("./episode.model");
const season_model_1 = require("./season.model");
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
    const cardFields = 'title poster type rating releaseYear isPremium';
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
    const result = yield content_model_1.Content.find({ isRecent: true }).sort({ createdAt: -1 }).limit(10);
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
        poster: item.poster,
        duration: `${Math.floor(item.duration / 60)}h ${item.duration % 60}m`,
        status: item.status,
        planStatus: item.planStatus,
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
    const data = series.map((item) => ({
        _id: item._id,
        title: item.title,
        poster: item.poster,
        seasonsCount: item.seasonsCount || 0,
        status: item.status,
        subscriptionType: item.planStatus,
    }));
    return {
        pagination: paginationInfo,
        data,
    };
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
    const episodeData = Object.assign(Object.assign({}, payload), { seriesId: new mongoose_1.Types.ObjectId(seriesId), seasonId: payload.seasonId ? new mongoose_1.Types.ObjectId(payload.seasonId) : undefined, duration: payload.duration ? Number(payload.duration) : 0, seasonNumber: payload.seasonNumber ? Number(payload.seasonNumber) : 1, episodeNumber: payload.episodeNumber ? Number(payload.episodeNumber) : 1, releaseDate: payload.releaseDate ? new Date(payload.releaseDate) : new Date(), planStatus: payload.availability || 'FREE', status: payload.isDraft === 'true' || payload.isDraft === true ? 'DRAFT' : 'PUBLISHED' });
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
    const { isDraft, availability, genres, cast, duration, releaseYear, rating, views, isPremium, isRecent, isPopularSeries, thumbnail } = payload, rest = __rest(payload, ["isDraft", "availability", "genres", "cast", "duration", "releaseYear", "rating", "views", "isPremium", "isRecent", "isPopularSeries", "thumbnail"]);
    const movieData = Object.assign(Object.assign({}, rest), { genres: Array.isArray(genres) ? genres : (genres ? [genres] : []), cast: Array.isArray(cast) ? cast : (cast ? [cast] : []), duration: duration ? Number(duration) : 0, releaseYear: releaseYear ? Number(releaseYear) : new Date().getFullYear(), rating: rating ? Number(rating) : 0, views: views ? Number(views) : 0, isPopularSeries: isPopularSeries === 'true' || isPopularSeries === true, planStatus: Array.isArray(availability) ? availability : (availability ? [availability] : ['FREE']), status: isDraft === 'true' || isDraft === true ? 'DRAFT' : 'PUBLISHED', type: 'MOVIE' });
    if (isPremium !== undefined)
        movieData.isPremium = isPremium === 'true' || isPremium === true;
    if (isRecent !== undefined)
        movieData.isRecent = isRecent === 'true' || isRecent === true;
    const result = yield content_model_1.Content.create(movieData);
    return result;
});
const createSeriesToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { isDraft, availability, genres, releaseYear, rating, views, isPremium, isRecent, isPopularSeries, cast, thumbnail } = payload, rest = __rest(payload, ["isDraft", "availability", "genres", "releaseYear", "rating", "views", "isPremium", "isRecent", "isPopularSeries", "cast", "thumbnail"]);
    const seriesData = Object.assign(Object.assign({}, rest), { genres: Array.isArray(genres) ? genres : (genres ? [genres] : []), cast: Array.isArray(cast) ? cast : (cast ? [cast] : []), duration: 0, releaseYear: releaseYear ? Number(releaseYear) : new Date().getFullYear(), rating: rating ? Number(rating) : 0, views: views ? Number(views) : 0, isPopularSeries: isPopularSeries === 'true' || isPopularSeries === true, planStatus: Array.isArray(availability) ? availability : (availability ? [availability] : ['FREE']), status: isDraft === 'true' || isDraft === true ? 'DRAFT' : 'PUBLISHED', type: 'SERIES' });
    if (isPremium !== undefined)
        seriesData.isPremium = isPremium === 'true' || isPremium === true;
    if (isRecent !== undefined)
        seriesData.isRecent = isRecent === 'true' || isRecent === true;
    const result = yield content_model_1.Content.create(seriesData);
    return result;
});
const updateSeriesInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { isDraft, availability, genres, releaseYear, rating, views, isPremium, isRecent, isPopularSeries, cast, thumbnail } = payload, rest = __rest(payload, ["isDraft", "availability", "genres", "releaseYear", "rating", "views", "isPremium", "isRecent", "isPopularSeries", "cast", "thumbnail"]);
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
    if (isRecent !== undefined)
        updateData.isRecent = isRecent === 'true' || isRecent === true;
    if (isPopularSeries !== undefined)
        updateData.isPopularSeries = isPopularSeries === 'true' || isPopularSeries === true;
    if (availability)
        updateData.planStatus = Array.isArray(availability) ? availability : [availability];
    if (isDraft !== undefined) {
        updateData.status = isDraft === 'true' || isDraft === true ? 'DRAFT' : 'PUBLISHED';
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
    const { isDraft, availability, genres, cast, duration, releaseYear, rating, views, isPremium, isRecent, isPopularSeries } = payload, rest = __rest(payload, ["isDraft", "availability", "genres", "cast", "duration", "releaseYear", "rating", "views", "isPremium", "isRecent", "isPopularSeries"]);
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
    if (isRecent !== undefined)
        updateData.isRecent = isRecent === 'true' || isRecent === true;
    if (isPopularSeries !== undefined)
        updateData.isPopularSeries = isPopularSeries === 'true' || isPopularSeries === true;
    if (availability)
        updateData.planStatus = Array.isArray(availability) ? availability : [availability];
    if (isDraft !== undefined) {
        updateData.status = isDraft === 'true' || isDraft === true ? 'DRAFT' : 'PUBLISHED';
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
exports.ContentService = {
    searchContentFromDB,
    favoriteContentInDB,
    unfavoriteContentFromDB,
    getBestMoviesFromDB,
    getComingSoonContentFromDB,
    getAdminMoviesList: getAdminMoviesList,
    getAdminSeriesList: getAdminSeriesList,
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
    deleteSeasonFromDB: deleteSeasonFromDB
};
