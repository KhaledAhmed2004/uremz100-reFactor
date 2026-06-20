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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecentlyWatchedService = void 0;
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const content_model_1 = require("../content/content.model");
const recently_watched_model_1 = require("./recently-watched.model");
const trackProgressInDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, guestId, contentId, watchedSeconds } = payload;
    if (!userId && !guestId) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'User ID or Guest ID is required');
    }
    const content = yield content_model_1.Content.findById(contentId);
    if (!content) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Content not found');
    }
    // Calculate completion percentage automatically
    // content.duration is in minutes, convert to seconds
    const totalSeconds = content.duration * 60;
    const completionPercentage = totalSeconds > 0
        ? Math.min(Math.round((watchedSeconds / totalSeconds) * 100), 100)
        : 0;
    // Build the query object for user or guest
    const query = userId
        ? { userId: new mongoose_1.Types.ObjectId(userId), contentId: new mongoose_1.Types.ObjectId(contentId) }
        : { guestId, contentId: new mongoose_1.Types.ObjectId(contentId) };
    const updateData = {
        contentId: new mongoose_1.Types.ObjectId(contentId),
        watchedSeconds,
        completionPercentage,
        lastWatchedAt: new Date(),
    };
    if (userId) {
        updateData.userId = new mongoose_1.Types.ObjectId(userId);
    }
    else if (guestId) {
        updateData.guestId = guestId;
    }
    // Check if a record already exists before upserting
    const existingRecord = yield recently_watched_model_1.RecentlyWatched.findOne(query);
    // Upsert recently watched record
    const result = yield recently_watched_model_1.RecentlyWatched.findOneAndUpdate(query, updateData, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
    }).select('-userId -guestId');
    // Calculate incremental watch time in seconds
    let watchDurationDelta = watchedSeconds;
    if (existingRecord && existingRecord.watchedSeconds < watchedSeconds) {
        watchDurationDelta = watchedSeconds - existingRecord.watchedSeconds;
    }
    // If this is the first time watching (no existing record), increment view count
    const incQuery = { totalWatchTime: watchDurationDelta };
    if (!existingRecord && watchedSeconds > 0) {
        incQuery.views = 1;
        incQuery.dailyViews = 1;
        incQuery.weeklyViews = 1;
    }
    if (watchDurationDelta > 0 || !existingRecord) {
        yield content_model_1.Content.findByIdAndUpdate(contentId, { $inc: incQuery });
    }
    return result;
});
const getRecentlyWatchedFromDB = (userId, guestId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId && !guestId)
        return [];
    const query = userId ? { userId: new mongoose_1.Types.ObjectId(userId) } : { guestId };
    const cardFields = 'title posterUrl type isPremium releaseDate rating publishedAt createdAt';
    const result = yield recently_watched_model_1.RecentlyWatched.find(query)
        .populate('contentId', cardFields)
        .sort({ lastWatchedAt: -1 })
        .limit(20);
    return result;
});
const getProgressByContentIdFromDB = (contentId, userId, guestId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId && !guestId)
        return null;
    const query = { contentId: new mongoose_1.Types.ObjectId(contentId) };
    if (userId) {
        query.userId = new mongoose_1.Types.ObjectId(userId);
    }
    else {
        query.guestId = guestId;
    }
    const result = yield recently_watched_model_1.RecentlyWatched.findOne(query);
    return result;
});
exports.RecentlyWatchedService = {
    trackProgressInDB,
    getRecentlyWatchedFromDB,
    getProgressByContentIdFromDB,
};
