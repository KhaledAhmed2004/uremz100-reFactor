"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecentlyWatched = void 0;
const mongoose_1 = require("mongoose");
const recentlyWatchedSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    guestId: { type: String, required: false, index: true },
    contentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Content', required: true },
    lastWatchedAt: { type: Date, default: Date.now },
    watchedSeconds: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 },
}, {
    timestamps: true,
});
// One recently watched record per user/guest-content pair — update lastWatchedAt on revisit.
recentlyWatchedSchema.index({ userId: 1, contentId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });
recentlyWatchedSchema.index({ guestId: 1, contentId: 1 }, { unique: true, partialFilterExpression: { guestId: { $type: 'string' } } });
exports.RecentlyWatched = (0, mongoose_1.model)('RecentlyWatched', recentlyWatchedSchema);
