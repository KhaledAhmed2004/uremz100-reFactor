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
exports.GenreController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const genre_service_1 = require("./genre.service");
const getAll = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield genre_service_1.GenreService.getGenresFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Genres fetched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const createGenre = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield genre_service_1.GenreService.createGenreToDB(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Genre created successfully',
        data: result,
    });
}));
const updateById = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { genreId } = req.params;
    const result = yield genre_service_1.GenreService.updateGenreInDB(genreId, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Genre updated successfully',
        data: result,
    });
}));
const bulkDelete = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { ids } = req.body;
    const result = yield genre_service_1.GenreService.bulkDeleteGenresFromDB(ids);
    const isPartial = result.failedCount > 0 && result.deletedCount > 0;
    const allFailed = result.deletedCount === 0;
    const statusCode = allFailed
        ? http_status_1.default.NOT_FOUND
        : isPartial
            ? 207
            : http_status_1.default.OK;
    const message = allFailed
        ? 'No genres were found to delete'
        : isPartial
            ? 'Bulk delete partially completed'
            : 'Genres deleted successfully';
    (0, sendResponse_1.default)(res, {
        statusCode,
        success: !allFailed,
        message,
        data: result,
    });
}));
exports.GenreController = {
    getAll,
    createGenre,
    updateById,
    bulkDelete,
};
