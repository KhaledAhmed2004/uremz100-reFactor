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
exports.GenreService = void 0;
const genre_model_1 = require("./genre.model");
const content_model_1 = require("../content/content.model");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const getGenresFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const genreQuery = new QueryBuilder_1.default(genre_model_1.Genre.find(), query)
        .search(['name', 'description'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const genres = yield genreQuery.modelQuery;
    const paginationInfo = yield genreQuery.getPaginationInfo();
    // Aggregate content count for each genre (checking if genre ID is in the genres array)
    const genresWithCount = yield Promise.all(genres.map((genre) => __awaiter(void 0, void 0, void 0, function* () {
        const contentCount = yield content_model_1.Content.countDocuments({
            genres: genre._id
        });
        return Object.assign(Object.assign({}, genre.toObject()), { contentCount });
    })));
    return {
        pagination: paginationInfo,
        data: genresWithCount,
    };
});
const createGenreToDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield genre_model_1.Genre.create(payload);
    return result;
});
const updateGenreInDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield genre_model_1.Genre.findByIdAndUpdate(id, payload, { new: true });
    return result;
});
const bulkDeleteGenresFromDB = (ids) => __awaiter(void 0, void 0, void 0, function* () {
    // Find which IDs actually exist
    const existing = yield genre_model_1.Genre.find({ _id: { $in: ids } }).select('_id');
    const existingIds = existing.map((g) => g._id.toString());
    const notFoundIds = ids.filter((id) => !existingIds.includes(id));
    // Delete all found genres at once
    if (existingIds.length > 0) {
        yield genre_model_1.Genre.deleteMany({ _id: { $in: existingIds } });
    }
    return {
        deletedCount: existingIds.length,
        failedCount: notFoundIds.length,
        deletedIds: existingIds,
        failed: notFoundIds.map((id) => ({ id, reason: 'NOT_FOUND' })),
    };
});
exports.GenreService = {
    getGenresFromDB,
    createGenreToDB,
    updateGenreInDB,
    bulkDeleteGenresFromDB,
};
