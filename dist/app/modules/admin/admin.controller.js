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
exports.AdminController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const admin_service_1 = require("./admin.service");
const content_model_1 = require("../content/content.model");
const getDashboardStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { range, startDate, endDate } = req.query;
    const result = yield admin_service_1.AdminService.getAdminDashboardStats(range, startDate, endDate);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Admin dashboard metrics',
        data: result,
    });
}));
const getVisitorAnalytics = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { range, tz, startDate, endDate } = req.query;
    const result = yield admin_service_1.AdminService.getVisitorAnalyticsData(range, tz, startDate, endDate);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Visitor analytics retrieved successfully.',
        data: result,
    });
}));
const getWatchlistStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { period, range, startDate, endDate } = req.query;
    const result = yield admin_service_1.AdminService.getWatchlistStatusBreakdown((period || range), startDate, endDate);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Watchlist status breakdown retrieved successfully',
        data: result,
    });
}));
const getSubscriptionsStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getSubscriptionsStats();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Subscription stats retrieved successfully',
        data: result,
    });
}));
const getAdminSubscriptions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getAdminSubscriptionsList(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Subscriptions list fetched',
        meta: result.pagination,
        data: result.data,
    });
}));
const getRevenueStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getRevenueStats();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Revenue stats retrieved successfully',
        data: result,
    });
}));
const getTransactions = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_service_1.AdminService.getTransactionsList(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Transactions list fetched',
        meta: result.pagination,
        data: result.data,
    });
}));
const getMovieProfile = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { movieId } = req.params;
    const result = yield admin_service_1.AdminService.getMovieProfileFromDB(movieId);
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Movie profile not found');
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Movie profile retrieved',
        data: result,
    });
}));
const patchContentBoost = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { isPopularSeries } = req.body;
    const content = yield content_model_1.Content.findByIdAndUpdate(id, { isPopularSeries }, { new: true });
    if (!content) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Content not found');
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: `Content ${isPopularSeries ? 'boosted' : 'unboosted'} successfully`,
        data: content,
    });
}));
exports.AdminController = {
    getDashboardStats,
    getVisitorAnalytics,
    getWatchlistStatus,
    getSubscriptionsStats,
    getAdminSubscriptions,
    getRevenueStats,
    getTransactions,
    getMovieProfile,
    patchContentBoost,
};
