"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Season = void 0;
const mongoose_1 = require("mongoose");
const seasonSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    posterUrl: { type: String, required: true },
    seriesId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Content', required: true },
    seasonNumber: { type: Number, required: true },
}, {
    timestamps: true,
});
exports.Season = (0, mongoose_1.model)('Season', seasonSchema);
