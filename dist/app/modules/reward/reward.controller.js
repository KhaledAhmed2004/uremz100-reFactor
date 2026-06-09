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
exports.RewardController = void 0;
const http_status_codes_1 = require("http-status-codes");
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const reward_service_1 = require("./reward.service");
const getWalletDetails = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield reward_service_1.RewardService.getWalletDetails(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Wallet details retrieved successfully',
        data: result,
    });
}));
const claimWatchTimeReward = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const { minutes } = req.body;
    const result = yield reward_service_1.RewardService.claimWatchTimeReward(userId, minutes);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `Watch time reward claimed successfully for ${minutes} minutes`,
        data: result,
    });
}));
const claimFreshWatchTimeReward = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const { minutes } = req.body;
    const result = yield reward_service_1.RewardService.claimFreshWatchTimeReward(userId, minutes);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `Fresh drama watch time reward claimed successfully for ${minutes} minutes`,
        data: result,
    });
}));
const claimDailyCheckIn = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield reward_service_1.RewardService.claimDailyCheckIn(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Daily check-in reward claimed successfully',
        data: result,
    });
}));
const claimWatchAdReward = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield reward_service_1.RewardService.claimWatchAdReward(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Ad reward claimed successfully',
        data: result,
    });
}));
const claimNotificationReward = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield reward_service_1.RewardService.claimNotificationReward(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Notification reward claimed successfully',
        data: result,
    });
}));
const claimSocialReward = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const { platform } = req.body; // 'facebook' or 'instagram'
    const result = yield reward_service_1.RewardService.claimSocialReward(userId, platform);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `Social reward claimed successfully for ${platform}`,
        data: result,
    });
}));
const claimBindEmailReward = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield reward_service_1.RewardService.claimBindEmailReward(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Bind email reward claimed successfully',
        data: result,
    });
}));
const claimLoginReward = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield reward_service_1.RewardService.claimLoginReward(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Login reward claimed successfully',
        data: result,
    });
}));
const claimProfileCompletionReward = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.user.id;
    const result = yield reward_service_1.RewardService.claimProfileCompletionReward(userId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Profile completion reward claimed successfully',
        data: result,
    });
}));
exports.RewardController = {
    getWalletDetails,
    claimWatchTimeReward,
    claimFreshWatchTimeReward,
    claimDailyCheckIn,
    claimWatchAdReward,
    claimNotificationReward,
    claimSocialReward,
    claimBindEmailReward,
    claimLoginReward,
    claimProfileCompletionReward,
};
