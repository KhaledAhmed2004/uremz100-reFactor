"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const revenue_controller_1 = require("./revenue.controller");
const router = express_1.default.Router();
router.get('/stats', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), revenue_controller_1.RevenueController.getRevenueStats);
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), revenue_controller_1.RevenueController.getRevenueTransactions);
exports.RevenueRoutes = router;
