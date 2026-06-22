"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Content = void 0;
const mongoose_1 = require("mongoose");
const contentSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    genres: {
        type: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Genre' }],
        required: true,
        default: [],
    },
    posterUrl: { type: String },
    videoUrl: {
        type: String,
        required: function () {
            return this.type === 'MOVIE';
        },
    },
    trailerUrl: { type: String },
    duration: { type: Number, required: true },
    releaseYear: { type: Number, required: true },
    rating: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    dailyViews: { type: Number, default: 0 },
    weeklyViews: { type: Number, default: 0 },
    totalWatchTime: { type: Number, default: 0 },
    engagementScore: { type: Number, default: 0 },
    trendingScore: { type: Number, default: 0 },
    cast: { type: [String], default: [] },
    type: { type: String, enum: ['SERIES', 'MOVIE'], required: true },
    isPremium: { type: Boolean },
    releaseDate: { type: Date },
    isPopularSeries: { type: Boolean, default: false },
    youtubeId: { type: String },
    channelName: { type: String },
    publishedAt: { type: Date, default: () => new Date(), index: true },
    planStatus: {
        type: [String],
        enum: ['FREE', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ALL'],
        default: ['FREE'],
    },
    status: {
        type: String,
        enum: ['PUBLISHED', 'DRAFT'],
        default: 'PUBLISHED',
    },
    seasonsCount: { type: Number, default: 0 },
    totalEpisodes: { type: Number, default: 0 },
    requiredCoin: { type: Number, default: 0 },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
contentSchema.virtual('isRecent').get(function () {
    // If publishedAt exists, use it; otherwise use createdAt
    const date = this.publishedAt || this.createdAt;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return date && date >= thirtyDaysAgo;
});
exports.Content = (0, mongoose_1.model)('Content', contentSchema);
