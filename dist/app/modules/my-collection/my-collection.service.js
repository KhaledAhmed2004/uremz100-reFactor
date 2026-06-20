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
exports.MyCollectionService = void 0;
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const content_model_1 = require("../content/content.model");
const season_model_1 = require("../content/season.model");
const episode_model_1 = require("../content/episode.model");
const my_collection_model_1 = require("./my-collection.model");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const addToCollectionInDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, guestId, itemId } = payload;
    if (!userId && !guestId) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'User ID or Guest ID is required');
    }
    let itemType;
    let itemModel;
    // 1. Check in Content model (Movies & Series)
    const contentItem = yield content_model_1.Content.findById(itemId);
    if (contentItem) {
        itemType = contentItem.type; // Will be 'MOVIE' or 'SERIES'
        itemModel = 'Content';
    }
    else {
        // 2. Check in Season model
        const seasonItem = yield season_model_1.Season.findById(itemId);
        if (seasonItem) {
            itemType = 'SEASON';
            itemModel = 'Season';
        }
        else {
            // 3. Check in Episode model
            const episodeItem = yield episode_model_1.Episode.findById(itemId);
            if (episodeItem) {
                itemType = 'EPISODE';
                itemModel = 'Episode';
            }
        }
    }
    if (!itemType || !itemModel) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Content not found in any category');
    }
    const query = userId
        ? { userId: new mongoose_1.Types.ObjectId(userId), itemId: new mongoose_1.Types.ObjectId(itemId) }
        : { guestId, itemId: new mongoose_1.Types.ObjectId(itemId) };
    const updateData = {
        itemType,
        itemId: new mongoose_1.Types.ObjectId(itemId),
        itemModel,
    };
    if (userId) {
        updateData.userId = new mongoose_1.Types.ObjectId(userId);
    }
    else if (guestId) {
        updateData.guestId = guestId;
    }
    const result = yield my_collection_model_1.MyCollection.findOneAndUpdate(query, updateData, { upsert: true, new: true });
    return result;
});
const removeFromCollectionFromDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, guestId, collectionId } = payload;
    const query = userId
        ? { _id: collectionId, userId: new mongoose_1.Types.ObjectId(userId) }
        : { _id: collectionId, guestId };
    const result = yield my_collection_model_1.MyCollection.findOneAndDelete(query);
    if (!result) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'Item not found in your collection');
    }
    return result;
});
const removeFromCollectionBulkFromDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, guestId, itemIds } = payload;
    if (!userId && !guestId) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'User ID or Guest ID is required');
    }
    const query = userId
        ? {
            userId: new mongoose_1.Types.ObjectId(userId),
            $or: [{ _id: { $in: itemIds } }, { itemId: { $in: itemIds } }]
        }
        : {
            guestId,
            $or: [{ _id: { $in: itemIds } }, { itemId: { $in: itemIds } }]
        };
    const result = yield my_collection_model_1.MyCollection.deleteMany(query);
    return result.deletedCount;
});
const getMyCollectionFromDB = (userId, guestId, query) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId && !guestId)
        return { pagination: null, data: [] };
    const dbQuery = userId ? { userId: new mongoose_1.Types.ObjectId(userId) } : { guestId };
    const cardFields = 'title posterUrl thumbnailUrl type isPremium releaseDate rating seasonNumber episodeNumber publishedAt createdAt';
    const myCollectionQuery = my_collection_model_1.MyCollection.find(dbQuery)
        .populate('itemId', cardFields);
    const collectionQuery = new QueryBuilder_1.default(myCollectionQuery, query)
        .filter()
        .sort()
        .paginate()
        .fields();
    const result = yield collectionQuery.modelQuery;
    const pagination = yield collectionQuery.getPaginationInfo();
    return {
        pagination,
        data: result,
    };
});
exports.MyCollectionService = {
    addToCollectionInDB,
    removeFromCollectionFromDB,
    removeFromCollectionBulkFromDB,
    getMyCollectionFromDB,
};
