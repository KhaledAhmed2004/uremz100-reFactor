"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnlockedContent = void 0;
const mongoose_1 = require("mongoose");
const unlockedContentSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    contentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Content', required: true },
    unlockedAt: { type: Date, default: () => new Date() },
}, {
    timestamps: true,
});
unlockedContentSchema.index({ userId: 1, contentId: 1 }, { unique: true });
exports.UnlockedContent = (0, mongoose_1.model)('UnlockedContent', unlockedContentSchema);
