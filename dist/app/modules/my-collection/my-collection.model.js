"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyCollection = void 0;
const mongoose_1 = require("mongoose");
const myCollectionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    guestId: { type: String, required: false, index: true },
    itemType: {
        type: String,
        enum: ['MOVIE', 'SERIES', 'SEASON', 'EPISODE'],
        required: true
    },
    itemId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        refPath: 'itemModel'
    },
    itemModel: {
        type: String,
        required: true,
        enum: ['Content', 'Season', 'Episode']
    }
}, {
    timestamps: true,
});
// One unique entry per user/guest and specific item
myCollectionSchema.index({ userId: 1, itemId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });
myCollectionSchema.index({ guestId: 1, itemId: 1 }, { unique: true, partialFilterExpression: { guestId: { $type: 'string' } } });
exports.MyCollection = (0, mongoose_1.model)('MyCollection', myCollectionSchema);
