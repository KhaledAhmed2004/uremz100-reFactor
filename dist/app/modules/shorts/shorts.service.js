"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortsService = void 0;
const content_model_1 = require("../content/content.model");
const mongoose_1 = __importDefault(require("mongoose"));
const getShortsFeed = (cursor_1, ...args_1) => __awaiter(void 0, [cursor_1, ...args_1], void 0, function* (cursor, limit = 10) {
    const query = {
        status: 'PUBLISHED',
        $or: [
            { planStatus: { $in: ['FREE'] } },
            { type: 'MOVIE', trailerUrl: { $exists: true, $nin: [null, ''] } }
        ]
    };
    if (cursor) {
        query._id = { $lt: new mongoose_1.default.Types.ObjectId(cursor) };
    }
    const limitNumber = Number(limit);
    // Fetch limit + 1 to check if there is a next page
    const contents = yield content_model_1.Content.find(query)
        .sort({ _id: -1 })
        .limit(limitNumber + 1)
        .lean();
    const hasNextPage = contents.length > limitNumber;
    if (hasNextPage) {
        contents.pop(); // Remove the extra item
    }
    const data = contents.map((doc) => {
        var _a;
        // If it's a premium movie with a trailer, treat it as a trailer
        const isTrailer = doc.type === 'MOVIE' && !((_a = doc.planStatus) === null || _a === void 0 ? void 0 : _a.includes('FREE')) && doc.trailerUrl;
        return {
            id: isTrailer ? `${doc._id}_trailer` : doc._id.toString(),
            contentId: doc._id.toString(),
            title: doc.title,
            description: doc.description,
            videoUrl: isTrailer ? doc.trailerUrl : doc.videoUrl,
            poster: doc.poster,
            type: isTrailer ? 'TRAILER' : 'FREE_CONTENT',
        };
    });
    const nextCursor = data.length > 0 ? contents[contents.length - 1]._id.toString() : null;
    return {
        meta: {
            limit: limitNumber,
            nextCursor: hasNextPage ? nextCursor : null,
            hasNextPage,
        },
        data,
    };
});
const incrementShortViewInDB = (contentId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_model_1.Content.findByIdAndUpdate(contentId, { $inc: { views: 1 } }, { new: true, select: 'title views' });
    return result;
});
exports.ShortsService = {
    getShortsFeed,
    incrementShortViewInDB,
};
