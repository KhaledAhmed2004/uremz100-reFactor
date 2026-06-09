"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Genre = void 0;
const mongoose_1 = require("mongoose");
const genreSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret.__v;
            return ret;
        },
    },
    toObject: {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret.__v;
            return ret;
        },
    },
});
exports.Genre = (0, mongoose_1.model)('Genre', genreSchema);
