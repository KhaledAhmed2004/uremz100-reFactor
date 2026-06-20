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
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const reward_service_1 = require("./reward.service");
const getOwnerQuery = (req) => {
    var _a;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)
        return { user: req.user.id };
    if (req.guestId)
        return { guestId: req.guestId };
    throw new ApiError_1.default(http_status_codes_1.StatusCodes.UNAUTHORIZED, 'Unauthorized access');
};
const getWalletDetails = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const ownerQuery = getOwnerQuery(req);
    const result = yield reward_service_1.RewardService.getWalletDetails(ownerQuery);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Wallet details retrieved successfully',
        data: result,
    });
}));
const claimWatchTimeReward = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const ownerQuery = getOwnerQuery(req);
    const { videoDuration } = req.body;
    const result = yield reward_service_1.RewardService.claimWatchTimeReward(ownerQuery, videoDuration);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `Watch time reward claimed successfully for ${videoDuration} minutes`,
        data: result,
    });
}));
const claimFreshWatchTimeReward = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const ownerQuery = getOwnerQuery(req);
    const { minutes } = req.body;
    const result = yield reward_service_1.RewardService.claimFreshWatchTimeReward(ownerQuery, minutes);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `Fresh drama watch time reward claimed successfully for ${minutes} minutes`,
        data: result,
    });
}));
const claimDailyCheckIn = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const ownerQuery = getOwnerQuery(req);
    const result = yield reward_service_1.RewardService.claimDailyCheckIn(ownerQuery);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: 'Daily check-in reward claimed successfully',
        data: result,
    });
}));
const claimTaskReward = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const ownerQuery = getOwnerQuery(req);
    const { taskType } = req.body;
    let result;
    switch (taskType) {
        case 'LOGIN':
            result = yield reward_service_1.RewardService.claimLoginReward(ownerQuery);
            break;
        case 'NOTIFICATION':
            result = yield reward_service_1.RewardService.claimNotificationReward(ownerQuery);
            break;
        case 'FACEBOOK':
        case 'INSTAGRAM':
        case 'YOUTUBE':
            result = yield reward_service_1.RewardService.claimSocialReward(ownerQuery, taskType.toLowerCase());
            break;
        case 'BIND_EMAIL':
            result = yield reward_service_1.RewardService.claimBindEmailReward(ownerQuery);
            break;
        case 'PROFILE_COMPLETION':
            result = yield reward_service_1.RewardService.claimProfileCompletionReward(ownerQuery);
            break;
        case 'WATCH_AD':
            result = yield reward_service_1.RewardService.claimWatchAdReward(ownerQuery);
            break;
        default:
            throw new ApiError_1.default(http_status_codes_1.StatusCodes.BAD_REQUEST, 'Invalid task type');
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_codes_1.StatusCodes.OK,
        success: true,
        message: `${taskType} reward claimed successfully`,
        data: result,
    });
}));
exports.RewardController = {
    getWalletDetails,
    claimWatchTimeReward,
    claimFreshWatchTimeReward,
    claimDailyCheckIn,
    claimTaskReward,
};
