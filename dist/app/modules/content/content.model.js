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
    poster: { type: String },
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
    cast: { type: [String], default: [] },
    type: { type: String, enum: ['SERIES', 'MOVIE'], required: true },
    isPremium: { type: Boolean },
    isRecent: { type: Boolean },
    isPopularSeries: { type: Boolean, default: false },
    youtubeId: { type: String },
    channelName: { type: String },
    publishedAt: { type: Date },
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
}, {
    timestamps: true,
});
exports.Content = (0, mongoose_1.model)('Content', contentSchema);
