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
exports.RevenueService = exports.getRevenueTransactions = exports.getRevenueStats = void 0;
const revenue_model_1 = require("./revenue.model");
const user_model_1 = require("../user/user.model");
const content_model_1 = require("../content/content.model");
const subscription_model_1 = require("../subscription/subscription.model");
const subscription_interface_1 = require("../subscription/subscription.interface");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const getRevenueStats = () => __awaiter(void 0, void 0, void 0, function* () {
    const now = new Date();
    // Start of current month
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    // Start of previous month
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // End of previous month (which is start of current month)
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    // 1. Total Users
    const totalUsersCurrent = yield user_model_1.User.countDocuments();
    const totalUsersPrevious = yield user_model_1.User.countDocuments({ createdAt: { $lte: endOfPreviousMonth } });
    // 2. Total Content
    const totalContentCurrent = yield content_model_1.Content.countDocuments();
    const totalContentPrevious = yield content_model_1.Content.countDocuments({ createdAt: { $lte: endOfPreviousMonth } });
    // 3. Total Subscribe
    const totalSubscribeCurrent = yield subscription_model_1.Subscription.countDocuments({ status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE });
    const totalSubscribePrevious = yield subscription_model_1.Subscription.countDocuments({
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
        createdAt: { $lte: endOfPreviousMonth } // Approximation, normally track historical statuses
    });
    // 4. Total Revenue
    const revenueCurrentAgg = yield revenue_model_1.RevenueTransaction.aggregate([
        { $match: { status: 'SUCCESS' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenueCurrent = revenueCurrentAgg.length > 0 ? revenueCurrentAgg[0].total : 0;
    const revenuePreviousAgg = yield revenue_model_1.RevenueTransaction.aggregate([
        { $match: { status: 'SUCCESS', createdAt: { $lte: endOfPreviousMonth } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenuePrevious = revenuePreviousAgg.length > 0 ? revenuePreviousAgg[0].total : 0;
    const calculateTrend = (current, previous) => {
        if (previous === 0)
            return current > 0 ? 100 : 0;
        return Number((((current - previous) / previous) * 100).toFixed(1));
    };
    const metrics = {
        totalUsers: {
            value: totalUsersCurrent,
            trend: calculateTrend(totalUsersCurrent, totalUsersPrevious)
        },
        totalRevenue: {
            value: totalRevenueCurrent,
            trend: calculateTrend(totalRevenueCurrent, totalRevenuePrevious)
        },
        totalContent: {
            value: totalContentCurrent,
            trend: calculateTrend(totalContentCurrent, totalContentPrevious)
        },
        totalSubscribe: {
            value: totalSubscribeCurrent,
            trend: calculateTrend(totalSubscribeCurrent, totalSubscribePrevious)
        }
    };
    return metrics;
});
exports.getRevenueStats = getRevenueStats;
const getRevenueTransactions = (query) => __awaiter(void 0, void 0, void 0, function* () {
    // 5. Transactions Table with QueryBuilder
    const revenueQuery = new QueryBuilder_1.default(revenue_model_1.RevenueTransaction.find().populate('userId', 'email name'), query)
        .search(['trxId']) // If searching by email, we might need a custom lookup since it's a ref. For now, search by trxId. We can enhance email search if needed.
        .filter()
        .sort()
        .paginate()
        .fields();
    const transactions = yield revenueQuery.modelQuery;
    const meta = yield revenueQuery.getPaginationInfo();
    // Custom search by email handling (QueryBuilder doesn't easily search populated fields natively without aggregation)
    // If we need email search, we can check if searchTerm exists and find users first.
    let finalTransactions = transactions;
    let finalMeta = meta;
    if (query.searchTerm && typeof query.searchTerm === 'string') {
        const term = query.searchTerm;
        // Check if it's not just matching trxId, maybe we need to match user emails
        const matchingUsers = yield user_model_1.User.find({ email: { $regex: term, $options: 'i' } }).select('_id');
        const userIds = matchingUsers.map(u => u._id);
        if (userIds.length > 0) {
            // Re-run the query including those user IDs
            const customQuery = new QueryBuilder_1.default(revenue_model_1.RevenueTransaction.find({
                $or: [
                    { trxId: { $regex: term, $options: 'i' } },
                    { userId: { $in: userIds } }
                ]
            }).populate('userId', 'email name'), query)
                .filter()
                .sort()
                .paginate()
                .fields();
            finalTransactions = yield customQuery.modelQuery;
            finalMeta = yield customQuery.getPaginationInfo();
        }
    }
    return {
        meta: finalMeta,
        data: finalTransactions
    };
});
exports.getRevenueTransactions = getRevenueTransactions;
exports.RevenueService = {
    getRevenueStats: exports.getRevenueStats,
    getRevenueTransactions: exports.getRevenueTransactions
};
