"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Watchlist = void 0;
const mongoose_1 = require("mongoose");
const watchlistSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    guestId: { type: String, required: false, index: true },
    contentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Content', required: true },
    status: { type: String, enum: ['added', 'removed'], default: 'added' },
}, {
    timestamps: true,
});
watchlistSchema.index({ userId: 1, contentId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });
watchlistSchema.index({ guestId: 1, contentId: 1 }, { unique: true, partialFilterExpression: { guestId: { $type: 'string' } } });
exports.Watchlist = (0, mongoose_1.model)('Watchlist', watchlistSchema);
