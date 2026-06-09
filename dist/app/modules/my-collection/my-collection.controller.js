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
exports.MyCollectionController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const my_collection_service_1 = require("./my-collection.service");
const addToCollection = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const guestId = req.guestId;
    const result = yield my_collection_service_1.MyCollectionService.addToCollectionInDB(Object.assign({ userId: user === null || user === void 0 ? void 0 : user.id, guestId }, req.body));
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.CREATED,
        success: true,
        message: 'Added to collection successfully',
        data: result,
    });
}));
const removeFromCollection = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const guestId = req.guestId;
    const { collectionId } = req.params;
    yield my_collection_service_1.MyCollectionService.removeFromCollectionFromDB({
        userId: user === null || user === void 0 ? void 0 : user.id,
        guestId,
        collectionId,
    });
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Removed from collection successfully',
        data: null,
    });
}));
const getMyCollection = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const guestId = req.guestId;
    const result = yield my_collection_service_1.MyCollectionService.getMyCollectionFromDB(user === null || user === void 0 ? void 0 : user.id, guestId, req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'My collection retrieved successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
exports.MyCollectionController = {
    addToCollection,
    removeFromCollection,
    getMyCollection,
};
