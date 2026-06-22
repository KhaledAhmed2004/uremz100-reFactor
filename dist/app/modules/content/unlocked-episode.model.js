"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnlockedEpisode = void 0;
const mongoose_1 = require("mongoose");
const unlockedEpisodeSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    episodeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Episode', required: true },
    unlockedAt: { type: Date, default: () => new Date() },
}, {
    timestamps: true,
});
unlockedEpisodeSchema.index({ userId: 1, episodeId: 1 }, { unique: true });
exports.UnlockedEpisode = (0, mongoose_1.model)('UnlockedEpisode', unlockedEpisodeSchema);
