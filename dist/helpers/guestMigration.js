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
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateGuestDataToUser = void 0;
const mongoose_1 = require("mongoose");
const recently_watched_model_1 = require("../app/modules/recently-watched/recently-watched.model");
const watchlist_model_1 = require("../app/modules/watchlist/watchlist.model");
const favorite_content_model_1 = require("../app/modules/favorite-content/favorite-content.model");
const my_collection_model_1 = require("../app/modules/my-collection/my-collection.model");
const migrateGuestDataToUser = (guestId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!guestId || !userId)
        return;
    const objectId = typeof userId === 'string' ? new mongoose_1.Types.ObjectId(userId) : userId;
    try {
        // Migrate Recently Watched
        yield recently_watched_model_1.RecentlyWatched.updateMany({ guestId }, { $set: { userId: objectId }, $unset: { guestId: "" } });
        // Migrate Watchlist
        yield watchlist_model_1.Watchlist.updateMany({ guestId }, { $set: { userId: objectId }, $unset: { guestId: "" } });
        // Migrate Favorite Content
        yield favorite_content_model_1.FavoriteContent.updateMany({ guestId }, { $set: { userId: objectId }, $unset: { guestId: "" } });
        // Migrate My Collection
        yield my_collection_model_1.MyCollection.updateMany({ guestId }, { $set: { userId: objectId }, $unset: { guestId: "" } });
    }
    catch (error) {
        console.error(`Failed to migrate guest data for guestId: ${guestId}`, error);
    }
});
exports.migrateGuestDataToUser = migrateGuestDataToUser;
