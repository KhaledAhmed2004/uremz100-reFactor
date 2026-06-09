"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavoriteContent = void 0;
const mongoose_1 = require("mongoose");
const favoriteContentSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    guestId: { type: String, required: false, index: true },
    contentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Content', required: true },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// One favorite per (user/guest, content) pair.
favoriteContentSchema.index({ userId: 1, contentId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });
favoriteContentSchema.index({ guestId: 1, contentId: 1 }, { unique: true, partialFilterExpression: { guestId: { $type: 'string' } } });
exports.FavoriteContent = (0, mongoose_1.model)('FavoriteContent', favoriteContentSchema);
