"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RewardRoutes = void 0;
const express_1 = __importDefault(require("express"));
const guestOrAuth_1 = __importDefault(require("../../middlewares/guestOrAuth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const reward_controller_1 = require("./reward.controller");
const reward_validation_1 = require("./reward.validation");
const router = express_1.default.Router();
router.get('/wallet', guestOrAuth_1.default, reward_controller_1.RewardController.getWalletDetails);
router.post('/claim/watch-time', guestOrAuth_1.default, (0, validateRequest_1.default)(reward_validation_1.RewardValidation.claimWatchTimeRewardZodSchema), reward_controller_1.RewardController.claimWatchTimeReward);
router.post('/claim/fresh-watch-time', guestOrAuth_1.default, (0, validateRequest_1.default)(reward_validation_1.RewardValidation.claimWatchTimeRewardZodSchema), reward_controller_1.RewardController.claimFreshWatchTimeReward);
router.post('/claim/check-in', guestOrAuth_1.default, reward_controller_1.RewardController.claimDailyCheckIn);
router.post('/claim/task', guestOrAuth_1.default, (0, validateRequest_1.default)(reward_validation_1.RewardValidation.claimTaskZodSchema), reward_controller_1.RewardController.claimTaskReward);
exports.RewardRoutes = router;
