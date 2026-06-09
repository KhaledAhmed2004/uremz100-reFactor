"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Episode = void 0;
const mongoose_1 = require("mongoose");
const episodeSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    thumbnail: { type: String, required: true },
    videoUrl: { type: String, required: true },
    duration: { type: Number, required: true },
    releaseDate: { type: Date, required: true },
    planStatus: {
        type: String,
        enum: ['FREE', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ALL'],
        default: 'FREE',
    },
    status: {
        type: String,
        enum: ['PUBLISHED', 'DRAFT'],
        default: 'PUBLISHED',
    },
    seriesId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Content', required: true },
    seasonId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Season', required: true },
    seasonNumber: { type: Number, required: true },
    episodeNumber: { type: Number, required: true },
}, {
    timestamps: true,
});
exports.Episode = (0, mongoose_1.model)('Episode', episodeSchema);
