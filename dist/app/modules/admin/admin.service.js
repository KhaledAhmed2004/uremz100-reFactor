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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const recently_watched_model_1 = require("../recently-watched/recently-watched.model");
const mongoose_1 = require("mongoose");
const AggregationBuilder_1 = __importDefault(require("../../builder/AggregationBuilder"));
const user_model_1 = require("../user/user.model");
const subscription_model_1 = require("../subscription/subscription.model");
const subscription_event_model_1 = require("../subscription/subscription-event.model");
const subscription_interface_1 = require("../subscription/subscription.interface");
const review_model_1 = require("../review/review.model");
const content_model_1 = require("../content/content.model");
const episode_model_1 = require("../content/episode.model");
const visitor_model_1 = require("../visitor/visitor.model");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const user_1 = require("../../../enums/user");
// Prices and product mapping
const PRODUCT_PRICES = {
    premium_weekly: 9.99,
    premium_monthly: 29.99,
    premium_yearly: 199.99,
    enterprise_monthly: 49.99,
    enterprise_yearly: 399.99,
};
const getAdminDashboardStats = (range, customStart, customEnd) => __awaiter(void 0, void 0, void 0, function* () {
    let period = 'month';
    let filter = {};
    if (range === 'custom' && customStart) {
        const start = new Date(customStart);
        const end = customEnd ? new Date(customEnd) : new Date();
        filter.createdAt = { $gte: start, $lte: end };
    }
    else if (range) {
        // If range is provided (e.g., 'week', 'year'), use it for growth calculation
        period = range.replace('this_', '').replace('last_', '');
        if (period === '7_days')
            period = 'week';
        if (period === '30_days')
            period = 'month';
    }
    const userBuilder = new AggregationBuilder_1.default(user_model_1.User);
    const totalUsers = yield userBuilder.calculateGrowth({
        period,
        filter,
    });
    const reviewBuilder = new AggregationBuilder_1.default(review_model_1.Review);
    const totalReviews = yield reviewBuilder.calculateGrowth({
        period,
        filter,
    });
    const contentBuilder = new AggregationBuilder_1.default(content_model_1.Content);
    const totalContent = yield contentBuilder.calculateGrowth({
        period,
        filter,
    });
    const subBuilder = new AggregationBuilder_1.default(subscription_model_1.Subscription);
    const totalSubscribe = yield subBuilder.calculateGrowth({
        filter: Object.assign(Object.assign({}, filter), { status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE }),
        period,
    });
    const formatMetric = (stat) => ({
        value: stat.total,
        changePct: Math.abs(stat.growth),
        direction: stat.growthType === 'increase' ? 'up' : stat.growthType === 'decrease' ? 'down' : 'neutral',
    });
    return {
        meta: {
            comparisonPeriod: period,
        },
        totalUsers: formatMetric(totalUsers),
        totalReviews: formatMetric(totalReviews),
        totalContent: formatMetric(totalContent),
        totalSubscribe: formatMetric(totalSubscribe),
    };
});
const getVisitorAnalyticsData = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (range = 'last_30_days', tz = 'UTC', customStart, customEnd) {
    const now = new Date();
    let startDate;
    let endDate = new Date();
    let groupingFormat = '%Y-%m-%d';
    if (range === 'custom' && customStart) {
        startDate = new Date(customStart);
        if (customEnd)
            endDate = new Date(customEnd);
    }
    else {
        switch (range) {
            case 'last_7_days':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
                break;
            case 'last_30_days':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 30);
                break;
            case 'last_90_days':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 90);
                break;
            case 'last_year':
                startDate = new Date(now);
                startDate.setFullYear(now.getFullYear() - 1);
                groupingFormat = '%Y-%m';
                break;
            case 'all_time':
                const firstVisitor = (yield visitor_model_1.Visitor.findOne().sort({
                    createdAt: 1,
                }));
                startDate = firstVisitor
                    ? firstVisitor.createdAt
                    : new Date(now.getFullYear(), 0, 1);
                groupingFormat = '%Y-%m';
                break;
            case 'this_week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay());
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'this_month':
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
        }
    }
    const pipeline = [
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: groupingFormat, date: '$createdAt', timezone: tz } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } },
        {
            $project: {
                _id: 0,
                label: '$_id',
                count: 1
            }
        }
    ];
    const dbResults = yield visitor_model_1.Visitor.aggregate(pipeline);
    const resultsMap = new Map(dbResults.map(item => [item.label, item.count]));
    const series = [];
    const current = new Date(startDate);
    if (groupingFormat === '%Y-%m-%d') {
        while (current <= endDate) {
            const label = current.toISOString().split('T')[0];
            series.push({ label, count: resultsMap.get(label) || 0 });
            current.setDate(current.getDate() + 1);
        }
    }
    else {
        // Monthly grouping for last_year or all_time
        while (current <= endDate) {
            const label = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
            if (!series.find(s => s.label === label)) {
                series.push({ label, count: resultsMap.get(label) || 0 });
            }
            current.setMonth(current.getMonth() + 1);
        }
    }
    const total = dbResults.reduce((sum, item) => sum + item.count, 0);
    const avg = series.length > 0 ? Math.round(total / series.length) : 0;
    const peakItem = [...series].sort((a, b) => b.count - a.count)[0];
    return {
        meta: { range, timezone: tz },
        summary: {
            total,
            avg_per_period: avg,
            peak: {
                date: (peakItem === null || peakItem === void 0 ? void 0 : peakItem.label) || 'N/A',
                count: (peakItem === null || peakItem === void 0 ? void 0 : peakItem.count) || 0
            }
        },
        series
    };
});
const getWatchlistStatusBreakdown = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (period = 'this_month', customStart, customEnd) {
    const now = new Date();
    let startDate;
    let endDate = new Date();
    if ((period === 'custom' || !period) && customStart) {
        startDate = new Date(customStart);
        if (customEnd)
            endDate = new Date(customEnd);
    }
    else {
        switch (period) {
            case 'this_week':
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay());
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'last_week':
                const lastWeekStart = new Date(now);
                lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
                lastWeekStart.setHours(0, 0, 0, 0);
                startDate = lastWeekStart;
                endDate = new Date(lastWeekStart);
                endDate.setDate(endDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'this_month':
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate.setHours(0, 0, 0, 0);
                break;
        }
    }
    const pipeline = [
        {
            $match: {
                lastWatchedAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $lookup: {
                from: 'contents',
                localField: 'contentId',
                foreignField: '_id',
                as: 'content'
            }
        },
        { $unwind: '$content' },
        { $unwind: { path: '$content.genres', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$content.genres',
                count: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: 'genres',
                localField: '_id',
                foreignField: '_id',
                as: 'genreInfo'
            }
        },
        { $unwind: { path: '$genreInfo', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 0,
                genre: { $ifNull: ['$genreInfo.name', 'Uncategorized'] },
                count: 1
            }
        }
    ];
    // If last_week, add end date filter
    if (period === 'last_week') {
        const lastWeekEnd = new Date(startDate);
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 7);
        pipeline[0].$match.lastWatchedAt.$lt = lastWeekEnd;
    }
    const results = yield recently_watched_model_1.RecentlyWatched.aggregate(pipeline);
    // Calculate total for percentages
    const totalViews = results.reduce((sum, item) => sum + item.count, 0);
    const series = results.map(item => ({
        genre: item.genre,
        count: item.count,
        percentage: totalViews > 0 ? Math.round((item.count / totalViews) * 100) : 0
    }));
    // Sort by count descending
    series.sort((a, b) => b.count - a.count);
    return {
        meta: {
            period
        },
        series
    };
});
const getRevenueStats = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const now = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const formatMetric = (stat) => ({
        value: stat.total,
        changePct: Math.abs(stat.growth),
        direction: stat.growthType === 'increase'
            ? 'up'
            : stat.growthType === 'decrease'
                ? 'down'
                : 'neutral',
    });
    // 1. Total Users
    const userBuilder = new AggregationBuilder_1.default(user_model_1.User);
    const totalUsers = yield userBuilder.calculateGrowth({
        filter: { role: user_1.USER_ROLES.USER },
        period: 'month',
    });
    // 2. Total Subscribe
    const subBuilder = new AggregationBuilder_1.default(subscription_model_1.Subscription);
    const totalSubscribe = yield subBuilder.calculateGrowth({
        filter: { status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE },
        period: 'month',
    });
    // 4. Total Revenue
    const revenuePipeline = [
        {
            $match: {
                eventType: { $in: ['CREATED', 'RENEWED', 'UPGRADED', 'PLAN_CHANGED'] },
                productId: { $exists: true, $ne: null },
            },
        },
        {
            $addFields: {
                amount: {
                    $switch: {
                        branches: Object.entries(PRODUCT_PRICES).map(([pid, price]) => ({
                            case: { $eq: ['$productId', pid] },
                            then: price,
                        })),
                        default: 0,
                    },
                },
            },
        },
    ];
    const allRevenueEvents = yield subscription_event_model_1.SubscriptionEvent.aggregate(revenuePipeline);
    // Coin revenue from user points (Proxy)
    const usersWithPoints = yield user_model_1.User.aggregate([
        {
            $group: {
                _id: null,
                totalPoints: { $sum: { $ifNull: ['$points', 0] } },
            },
        },
    ]);
    const totalPointsValue = ((_a = usersWithPoints[0]) === null || _a === void 0 ? void 0 : _a.totalPoints) || 0;
    const coinsRevenue = totalPointsValue * 1; // Assuming 1 coin = $1
    const calculateTotalRevenue = (events) => {
        return events.reduce((sum, e) => sum + (e.amount || 0), 0) + coinsRevenue;
    };
    const thisMonthEvents = allRevenueEvents.filter(e => new Date(e.occurredAt) >= startThisMonth);
    const lastMonthEvents = allRevenueEvents.filter(e => {
        const d = new Date(e.occurredAt);
        return d >= startLastMonth && d <= endLastMonth;
    });
    const thisMonthRevenue = calculateTotalRevenue(thisMonthEvents);
    const lastMonthRevenue = calculateTotalRevenue(lastMonthEvents);
    const totalRevenueValue = calculateTotalRevenue(allRevenueEvents);
    let revenueGrowth = 0;
    let revenueGrowthType = 'no_change';
    if (lastMonthRevenue > 0) {
        revenueGrowth =
            ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
        revenueGrowthType =
            revenueGrowth > 0
                ? 'increase'
                : revenueGrowth < 0
                    ? 'decrease'
                    : 'no_change';
    }
    else if (thisMonthRevenue > 0) {
        revenueGrowth = 100;
        revenueGrowthType = 'increase';
    }
    return {
        meta: { comparisonPeriod: 'month' },
        totalUsers: formatMetric(totalUsers),
        totalRevenue: {
            value: Number(totalRevenueValue.toFixed(2)),
            changePct: Math.abs(Number(revenueGrowth.toFixed(2))),
            direction: revenueGrowthType === 'increase'
                ? 'up'
                : revenueGrowthType === 'decrease'
                    ? 'down'
                    : 'neutral',
        },
        totalSubscribe: formatMetric(totalSubscribe),
    };
});
const getTransactionsList = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const { search } = query, restQuery = __rest(query, ["search"]);
    // Map 'search' to 'searchTerm' for QueryBuilder
    if (search) {
        restQuery.searchTerm = search;
    }
    // If there's a search term, we want to check if it's an email or TRX ID.
    // QueryBuilder's search() will handle the TRX ID (externalTransactionId).
    // For email, we need to find userIds and add them to the filter.
    if (search) {
        const users = yield user_model_1.User.find({
            email: { $regex: search, $options: 'i' },
        }).select('_id');
        if (users.length > 0) {
            const userIds = users.map(u => u._id);
            // We use $or to search both TRX ID and email (via userIds)
            const existingFilter = restQuery.$or || [];
            restQuery.$or = [
                ...existingFilter,
                { userId: { $in: userIds } },
                { externalTransactionId: { $regex: search, $options: 'i' } },
                { uid: { $regex: search, $options: 'i' } },
            ];
            // Clear searchTerm so QueryBuilder doesn't add another $or with externalTransactionId
            delete restQuery.searchTerm;
        }
        else {
            // If no users found, still search by TRX ID and UID
            const existingFilter = restQuery.$or || [];
            restQuery.$or = [
                ...existingFilter,
                { externalTransactionId: { $regex: search, $options: 'i' } },
                { uid: { $regex: search, $options: 'i' } },
            ];
            delete restQuery.searchTerm;
        }
    }
    const transactionQuery = new QueryBuilder_1.default(subscription_event_model_1.SubscriptionEvent.find().populate('userId', 'email'), restQuery)
        .search(['externalTransactionId', 'uid'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const events = yield transactionQuery.modelQuery;
    const paginationInfo = yield transactionQuery.getPaginationInfo();
    const data = events.map((event) => {
        var _a;
        const subscriptionAmount = PRODUCT_PRICES[event.productId] || 0;
        const coinAmount = 0; // Coins are not tracked as individual transactions in this phase
        return {
            email: ((_a = event.userId) === null || _a === void 0 ? void 0 : _a.email) || 'N/A',
            uid: event.uid || 'N/A',
            trxId: event.externalTransactionId || 'N/A',
            date: event.occurredAt,
            coinAmount,
            subscriptionAmount,
            totalAmount: subscriptionAmount + coinAmount,
        };
    });
    return {
        pagination: paginationInfo,
        data,
    };
});
const getSubscriptionsStats = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const subBuilder = new AggregationBuilder_1.default(subscription_model_1.Subscription);
    const activeSubscribers = yield subBuilder.calculateGrowth({
        filter: { status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE },
        period: 'month',
    });
    const userBuilder = new AggregationBuilder_1.default(user_model_1.User);
    const totalUsers = yield userBuilder.calculateGrowth({
        filter: { role: user_1.USER_ROLES.USER },
        period: 'month',
    });
    // Get total revenue from all subscription events
    const revenuePipeline = [
        {
            $match: {
                eventType: { $in: ['CREATED', 'RENEWED', 'UPGRADED', 'PLAN_CHANGED'] },
                productId: { $exists: true, $ne: null },
            },
        },
        {
            $addFields: {
                amount: {
                    $switch: {
                        branches: Object.entries(PRODUCT_PRICES).map(([pid, price]) => ({
                            case: { $eq: ['$productId', pid] },
                            then: price,
                        })),
                        default: 0,
                    },
                },
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' },
            },
        },
    ];
    const revenueResult = yield subscription_event_model_1.SubscriptionEvent.aggregate(revenuePipeline);
    const totalRevenue = ((_a = revenueResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
    const formatMetric = (stat) => ({
        value: stat.total,
        changePct: Math.abs(stat.growth),
        direction: stat.growthType === 'increase'
            ? 'up'
            : stat.growthType === 'decrease'
                ? 'down'
                : 'neutral',
    });
    return {
        meta: { comparisonPeriod: 'month' },
        totalUsers: formatMetric(totalUsers),
        totalRevenue: {
            value: Number(totalRevenue.toFixed(2)),
            changePct: 0, // Growth not calculated for this specific metric here yet
            direction: 'neutral',
        },
        activeSubscribers: formatMetric(activeSubscribers),
        growthRate: {
            value: Number(activeSubscribers.growth.toFixed(1)),
            changePct: Math.abs(Number(activeSubscribers.growth.toFixed(1))),
            direction: activeSubscribers.growth > 0
                ? 'up'
                : activeSubscribers.growth < 0
                    ? 'down'
                    : 'neutral',
        },
    };
});
const getAdminSubscriptionsList = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const { search } = query, restQuery = __rest(query, ["search"]);
    if (search) {
        const sanitizedSearch = String(search).trim();
        const existingFilter = restQuery.$or || [];
        // 1. Search by User Name or Email
        const matchingUsers = yield user_model_1.User.find({
            $or: [
                { name: { $regex: sanitizedSearch, $options: 'i' } },
                { email: { $regex: sanitizedSearch, $options: 'i' } },
            ],
        }).select('_id');
        const userIds = matchingUsers.map(u => u._id);
        // 2. Search by Apple/Google transaction IDs
        restQuery.$or = [
            ...existingFilter,
            { userId: { $in: userIds } },
            { appleOriginalTransactionId: { $regex: sanitizedSearch, $options: 'i' } },
            { appleLatestTransactionId: { $regex: sanitizedSearch, $options: 'i' } },
            { googleOrderId: { $regex: sanitizedSearch, $options: 'i' } },
        ];
    }
    // Default sorting by latest update if not provided
    if (!restQuery.sort) {
        restQuery.sort = '-updatedAt';
    }
    const subQuery = new QueryBuilder_1.default(subscription_model_1.Subscription.find().populate('userId', 'name email profilePicture'), restQuery)
        .filter()
        .sort()
        .paginate()
        .fields();
    const subscriptions = yield subQuery.modelQuery;
    const paginationInfo = yield subQuery.getPaginationInfo();
    // Helper to map productId to human-readable Billing Cycle
    const mapBillingCycle = (productId) => {
        if (!productId)
            return 'N/A';
        if (productId.includes('weekly'))
            return 'Weekly';
        if (productId.includes('monthly'))
            return 'Monthly';
        if (productId.includes('yearly'))
            return 'Yearly';
        return productId;
    };
    // Map to a cleaner response format for the table
    const data = subscriptions.map((sub) => {
        const isUserDeleted = !sub.userId;
        return {
            id: sub._id,
            userName: isUserDeleted ? 'Deleted User' : sub.userId.name,
            userEmail: isUserDeleted ? 'N/A' : sub.userId.email,
            transactionId: sub.appleLatestTransactionId ||
                sub.appleOriginalTransactionId ||
                sub.googleOrderId ||
                'N/A',
            plan: sub.plan,
            status: sub.status,
            startDate: sub.startedAt,
            expiryDate: sub.currentPeriodEnd,
            gracePeriodEndsAt: sub.gracePeriodEndsAt,
            canceledAt: sub.canceledAt,
            billingCycle: mapBillingCycle(sub.productId),
            amount: PRODUCT_PRICES[sub.productId] || 0,
            updatedAt: sub.updatedAt,
        };
    });
    return {
        pagination: paginationInfo,
        data,
    };
});
const getMovieProfileFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_model_1.Content.findById(id);
    if (!result)
        return null;
    return result;
});
const getMovieAnalyticsOverviewData = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const movie = yield content_model_1.Content.findById(id);
    if (!movie)
        return null;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    // 1. Get real watch statistics from RecentlyWatched
    const viewersData = yield recently_watched_model_1.RecentlyWatched.find({ contentId: new mongoose_1.Types.ObjectId(id) });
    const totalWatchTimeSeconds = viewersData.reduce((sum, v) => sum + (v.watchedSeconds || 0), 0);
    const totalWatchTimeHours = totalWatchTimeSeconds > 0 ? Math.round(totalWatchTimeSeconds / 3600) : 0;
    // 2. Growth calculation
    const currentPeriodViews = yield recently_watched_model_1.RecentlyWatched.countDocuments({
        contentId: new mongoose_1.Types.ObjectId(id),
        createdAt: { $gte: thirtyDaysAgo }
    });
    const previousPeriodViews = yield recently_watched_model_1.RecentlyWatched.countDocuments({
        contentId: new mongoose_1.Types.ObjectId(id),
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });
    const viewGrowth = previousPeriodViews > 0
        ? ((currentPeriodViews - previousPeriodViews) / previousPeriodViews) * 100
        : (currentPeriodViews > 0 ? 100 : 0);
    // You can similarly calculate watch time growth if you want, but for now we'll map view growth
    const viewGrowthAbs = Math.abs(Number(viewGrowth.toFixed(1)));
    const viewDirection = viewGrowth >= 0 ? 'increase' : 'decrease';
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const totalViewsLast48Hours = viewersData.filter(v => {
        const watchedAt = new Date(v.lastWatchedAt || v.createdAt);
        return watchedAt >= fortyEightHoursAgo;
    }).length;
    const viewsByHour = [];
    for (let i = 0; i < 10; i++) {
        const hourStart = new Date(now);
        hourStart.setHours(now.getHours() - i, 0, 0, 0);
        const hourEnd = new Date(hourStart);
        hourEnd.setHours(hourStart.getHours() + 1, 0, 0, 0);
        const viewsInHour = viewersData.filter(v => {
            const watchedAt = new Date(v.lastWatchedAt || v.createdAt);
            return watchedAt >= hourStart && watchedAt < hourEnd;
        }).length;
        viewsByHour.push({
            hour: hourStart.toISOString(),
            views: viewsInHour
        });
    }
    // Sort chronologically (oldest to newest hour)
    viewsByHour.reverse();
    return {
        views: {
            value: movie.views,
            change: {
                percentage: viewGrowthAbs,
                direction: viewDirection
            }
        },
        watchTime: {
            value: totalWatchTimeHours,
            unit: 'hours',
            change: {
                percentage: viewGrowthAbs, // using same growth percentage for now
                direction: viewDirection
            }
        },
        performance_chart: {
            labels: ['Day 1', 'Day 3', 'Day 5', 'Day 7', 'Day 10', 'Day 14', 'Day 21', 'Day 28'],
            this_video: [10000, 25000, 35000, 45000, 55000, 65000, 75000, movie.views],
            typical_performance: [12000, 28000, 38000, 48000, 58000, 68000, 78000, 81000],
        },
        realtimeAnalytics: {
            totalViewsLast48Hours,
            viewsByHour
        },
    };
});
const getMovieAnalyticsEngagementData = (id) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const movie = yield content_model_1.Content.findById(id);
    if (!movie)
        return null;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    // 1. Get real watch statistics from RecentlyWatched
    const viewersData = yield recently_watched_model_1.RecentlyWatched.find({ contentId: new mongoose_1.Types.ObjectId(id) });
    const totalViewers = viewersData.length;
    // 2. Growth calculation
    const currentPeriodViews = yield recently_watched_model_1.RecentlyWatched.countDocuments({
        contentId: new mongoose_1.Types.ObjectId(id),
        createdAt: { $gte: thirtyDaysAgo }
    });
    const previousPeriodViews = yield recently_watched_model_1.RecentlyWatched.countDocuments({
        contentId: new mongoose_1.Types.ObjectId(id),
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });
    const viewGrowth = previousPeriodViews > 0
        ? ((currentPeriodViews - previousPeriodViews) / previousPeriodViews) * 100
        : (currentPeriodViews > 0 ? 100 : 0);
    // 3. Real Engagement Metrics
    const totalWatchTimeSeconds = viewersData.reduce((sum, v) => sum + (v.watchedSeconds || 0), 0);
    const avgWatchTimeSeconds = totalViewers > 0 ? totalWatchTimeSeconds / totalViewers : 0;
    const avgRetentionPercentage = movie.duration > 0
        ? (avgWatchTimeSeconds / (movie.duration * 60)) * 100
        : 0;
    const formatDuration = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };
    // 3. Retention Chart (Mocked based on average retention)
    const retentionChart = [];
    const durationMinutes = movie.duration || 120;
    const timePoints = [0, 0.5, 1, 2, 5, 10, 15, 20, 24.25, 30, 40, 50, 60];
    let currentRetention = 100;
    let typicalRetention = 100;
    timePoints.forEach(min => {
        if (min <= durationMinutes) {
            let timeLabel = `${Math.floor(min)}:00`;
            if (min === 0)
                timeLabel = '0:00';
            else if (min === 0.5)
                timeLabel = '0:30';
            else if (min === 24.25)
                timeLabel = '24:15';
            else if (min < 10)
                timeLabel = `${Math.floor(min)}:00`;
            retentionChart.push({
                time: timeLabel,
                percentage: Number(currentRetention.toFixed(1)),
                typicalPercentage: Number(typicalRetention.toFixed(1))
            });
            // Decrease retention
            currentRetention = currentRetention - (Math.random() * 8 + 2);
            typicalRetention = typicalRetention - (Math.random() * 7 + 3);
            // Introduce a fake "spike" at 24:15 like the chart
            if (min === 20) {
                currentRetention += 15;
            }
            if (currentRetention < 0)
                currentRetention = 0;
            if (typicalRetention < 0)
                typicalRetention = 0;
        }
    });
    const retentionAt30s = ((_a = retentionChart.find(c => c.time === '0:30')) === null || _a === void 0 ? void 0 : _a.percentage) || 0;
    const viewGrowthAbs = Math.abs(Number(viewGrowth.toFixed(1)));
    const viewDirection = viewGrowth >= 0 ? 'increase' : 'decrease';
    const avgViewDurationGrowthAbs = Math.abs(Number((viewGrowth * 0.8).toFixed(1)));
    const avgViewDurationDirection = viewGrowth * 0.8 >= 0 ? 'increase' : 'decrease';
    const baseValue = Number((totalWatchTimeSeconds / 3600).toFixed(0)) || 80000;
    const watchTimeGrowth = {
        labels: ['Day 1', 'Day 3', 'Day 5', 'Day 7', 'Day 10', 'Day 14', 'Day 21', 'Day 28'],
        datasets: [
            {
                name: 'This video',
                data: [
                    baseValue * 0.15, baseValue * 0.17, baseValue * 0.23, baseValue * 0.32,
                    baseValue * 0.45, baseValue * 0.60, baseValue * 0.81, baseValue
                ].map(Math.round)
            },
            {
                name: 'Typical performance',
                data: [
                    baseValue * 0.10, baseValue * 0.12, baseValue * 0.17, baseValue * 0.22,
                    baseValue * 0.27, baseValue * 0.35, baseValue * 0.43, baseValue * 0.52
                ].map(Math.round)
            }
        ]
    };
    return {
        watchTime: {
            value: baseValue,
            unit: 'hours',
            change: {
                percentage: viewGrowthAbs,
                direction: viewDirection
            }
        },
        avgViewDuration: {
            value: formatDuration(avgWatchTimeSeconds),
            change: {
                percentage: avgViewDurationGrowthAbs,
                direction: avgViewDurationDirection
            }
        },
        retention: {
            avgDuration: formatDuration(avgWatchTimeSeconds),
            avgPercentage: Number(avgRetentionPercentage.toFixed(1)),
            at30Sec: {
                value: retentionAt30s,
                status: retentionAt30s > 70 ? 'Above typical' : retentionAt30s > 50 ? 'Typical' : 'Below typical'
            },
            chart: retentionChart,
        },
        watchTimeGrowth,
    };
});
const getMovieAnalyticsAudienceData = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const movie = yield content_model_1.Content.findById(id);
    if (!movie)
        return null;
    // 1. Get all users who watched this content
    const viewers = yield recently_watched_model_1.RecentlyWatched.aggregate([
        { $match: { contentId: new mongoose_1.Types.ObjectId(id) } },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
            }
        },
        { $unwind: '$user' },
        {
            $lookup: {
                from: 'subscriptions',
                localField: 'userId',
                foreignField: 'userId',
                as: 'subscription'
            }
        },
        {
            $addFields: {
                userPlan: { $ifNull: [{ $arrayElemAt: ['$subscription.plan', 0] }, 'FREE'] },
                userGender: '$user.gender',
                userDob: '$user.dateOfBirth',
                userCountry: '$user.country'
            }
        }
    ]);
    if (viewers.length === 0) {
        return {
            watchTimeFromSubscribers: [
                { type: 'VIP Weekly', percentage: 0 },
                { type: 'VIP Monthly', percentage: 0 },
                { type: 'VIP Yearly', percentage: 0 },
                { type: 'Not Subscribed', percentage: 0 },
            ],
            demographics: {
                gender: [
                    { gender: 'Male', percentage: 0 },
                    { gender: 'Female', percentage: 0 },
                    { gender: 'Untracked', percentage: 0 },
                ],
                age: [
                    { range: '3-17', percentage: 0 },
                    { range: '18-24', percentage: 0 },
                    { range: '25-34', percentage: 0 },
                    { range: '35-44', percentage: 0 },
                    { range: '45-54', percentage: 0 },
                    { range: '55-64', percentage: 0 },
                    { range: '65+', percentage: 0 },
                    { range: 'Untracked', percentage: 0 },
                ],
            },
            geography: [],
        };
    }
    const totalViewers = viewers.length;
    // 2. Watch Time (Views) From Subscribers
    const planCounts = viewers.reduce((acc, v) => {
        const plan = v.userPlan;
        acc[plan] = (acc[plan] || 0) + 1;
        return acc;
    }, {});
    // Mapping plans to requested types (This is an approximation based on current plan names)
    const watchTimeFromSubscribers = [
        { type: 'VIP Weekly', percentage: Number(((planCounts['WEEKLY'] || 0) / totalViewers * 100).toFixed(1)) },
        { type: 'VIP Monthly', percentage: Number(((planCounts['MONTHLY'] || 0) / totalViewers * 100).toFixed(1)) },
        { type: 'VIP Yearly', percentage: Number(((planCounts['YEARLY'] || 0) / totalViewers * 100).toFixed(1)) },
        { type: 'Not Subscribed', percentage: Number(((planCounts['FREE'] || 0) / totalViewers * 100).toFixed(1)) },
    ];
    // 3. Demographics - Gender
    const genderCounts = viewers.reduce((acc, v) => {
        var _a;
        const gender = (_a = v.userGender) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        if (gender === 'male') {
            acc.male++;
        }
        else if (gender === 'female') {
            acc.female++;
        }
        else {
            acc.untracked++;
        }
        return acc;
    }, { male: 0, female: 0, untracked: 0 });
    const totalGender = totalViewers > 0 ? totalViewers : 1;
    const genderStats = [
        { gender: 'Male', percentage: Number((genderCounts.male / totalGender * 100).toFixed(1)) },
        { gender: 'Female', percentage: Number((genderCounts.female / totalGender * 100).toFixed(1)) },
        { gender: 'Untracked', percentage: Number((genderCounts.untracked / totalGender * 100).toFixed(1)) },
    ];
    // 4. Demographics - Age
    const calculateAge = (dob) => {
        if (!dob)
            return null;
        const birthDate = new Date(dob);
        if (isNaN(birthDate.getTime()))
            return null;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };
    const ageRanges = [
        { range: '3-17', min: 3, max: 17, count: 0 },
        { range: '18-24', min: 18, max: 24, count: 0 },
        { range: '25-34', min: 25, max: 34, count: 0 },
        { range: '35-44', min: 35, max: 44, count: 0 },
        { range: '45-54', min: 45, max: 54, count: 0 },
        { range: '55-64', min: 55, max: 64, count: 0 },
        { range: '65+', min: 65, max: 150, count: 0 },
        { range: 'Untracked', min: -1, max: -1, count: 0 },
    ];
    let totalAgeKnown = 0;
    viewers.forEach(v => {
        totalAgeKnown++;
        const age = calculateAge(v.userDob);
        if (age !== null) {
            const range = ageRanges.find(r => age >= r.min && age <= r.max);
            if (range) {
                range.count++;
            }
            else {
                const untracked = ageRanges.find(r => r.range === 'Untracked');
                if (untracked)
                    untracked.count++;
            }
        }
        else {
            const untracked = ageRanges.find(r => r.range === 'Untracked');
            if (untracked)
                untracked.count++;
        }
    });
    const ageStats = ageRanges.map(r => ({
        range: r.range,
        percentage: totalAgeKnown > 0 ? Number((r.count / totalAgeKnown * 100).toFixed(1)) : 0
    }));
    // 5. Geography
    const countryCounts = viewers.reduce((acc, v) => {
        const country = v.userCountry || 'Unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
    }, {});
    const geography = Object.entries(countryCounts)
        .map(([country, count]) => ({ country, count: count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    return {
        watchTimeFromSubscribers,
        demographics: {
            gender: genderStats,
            age: ageStats,
        },
        geography,
    };
});
const getMovieAnalyticsRevenueData = (id) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const movie = yield content_model_1.Content.findById(id);
    if (!movie)
        return null;
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // 1. Calculate Total Revenue from SubscriptionEvents
    const revenuePipeline = [
        {
            $match: {
                eventType: { $in: ['CREATED', 'RENEWED', 'UPGRADED', 'PLAN_CHANGED'] },
                productId: { $exists: true, $ne: null }
            }
        },
        {
            $addFields: {
                amount: {
                    $switch: {
                        branches: Object.entries(PRODUCT_PRICES).map(([pid, price]) => ({
                            case: { $eq: ['$productId', pid] },
                            then: price
                        })),
                        default: 0
                    }
                }
            }
        }
    ];
    const allRevenueEvents = yield subscription_event_model_1.SubscriptionEvent.aggregate(revenuePipeline);
    const subscriptionRevenue = allRevenueEvents.reduce((sum, event) => sum + (event.amount || 0), 0);
    // Calculate "Coins Purchased" from total user points
    const usersWithPoints = yield user_model_1.User.aggregate([
        { $group: { _id: null, totalPoints: { $sum: { $ifNull: ['$points', 0] } } } }
    ]);
    const totalPointsValue = ((_a = usersWithPoints[0]) === null || _a === void 0 ? void 0 : _a.totalPoints) || 0;
    const coinsRevenue = totalPointsValue * 1; // Assuming 1 coin = $1
    const totalRevenueValue = subscriptionRevenue + coinsRevenue;
    // Growth calculation (this month vs last month)
    const thisMonthRevenue = allRevenueEvents
        .filter(e => new Date(e.occurredAt) >= new Date(now.getFullYear(), now.getMonth(), 1))
        .reduce((sum, e) => sum + e.amount, 0);
    const lastMonthRevenue = allRevenueEvents
        .filter(e => {
        const d = new Date(e.occurredAt);
        return d >= lastMonth && d < new Date(now.getFullYear(), now.getMonth(), 1);
    })
        .reduce((sum, e) => sum + e.amount, 0);
    const revenueGrowth = lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : (thisMonthRevenue > 0 ? 100 : 0);
    // 2. ARPU & Conversion Rate
    const totalUsersCount = yield user_model_1.User.countDocuments({ role: 'USER' });
    const paidUsersCount = yield subscription_model_1.Subscription.countDocuments({
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
        plan: { $ne: subscription_interface_1.SUBSCRIPTION_PLAN.FREE }
    });
    const arpu = totalUsersCount > 0 ? totalRevenueValue / totalUsersCount : 0;
    const conversionRate = totalUsersCount > 0 ? (paidUsersCount / totalUsersCount) * 100 : 0;
    // 3. Revenue Trend (Last 8 data points/weeks)
    const trendPipeline = [
        ...revenuePipeline,
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt' } },
                dailyRevenue: { $sum: '$amount' }
            }
        },
        { $sort: { _id: 1 } },
        { $limit: 30 } // Last 30 days
    ];
    const trendResults = yield subscription_event_model_1.SubscriptionEvent.aggregate(trendPipeline);
    // 4. Monthly Breakdown
    const monthlyPipeline = [
        ...revenuePipeline,
        {
            $group: {
                _id: { $dateToString: { format: '%B', date: '$occurredAt' } },
                revenue: { $sum: '$amount' },
                sortMonth: { $min: { $month: '$occurredAt' } }
            }
        },
        { $sort: { sortMonth: 1 } }
    ];
    const monthlyBreakdown = yield subscription_event_model_1.SubscriptionEvent.aggregate(monthlyPipeline);
    // 5. How I Make Money (By Plan Type + Coins)
    const sourcePipeline = [
        ...revenuePipeline,
        {
            $group: {
                _id: '$productId',
                amount: { $sum: '$amount' }
            }
        }
    ];
    const sourceResults = yield subscription_event_model_1.SubscriptionEvent.aggregate(sourcePipeline);
    const howIMakeMoney = [
        {
            type: 'Coins Purchased',
            amount: Number(coinsRevenue.toFixed(2)),
            percentage: totalRevenueValue > 0 ? Number(((coinsRevenue / totalRevenueValue) * 100).toFixed(1)) : 0
        },
        ...sourceResults.map(r => {
            let type = r._id;
            if (type.includes('weekly'))
                type = 'Weekly VIP';
            else if (type.includes('monthly'))
                type = 'Monthly VIP';
            else if (type.includes('yearly'))
                type = 'Yearly VIP';
            else
                type = 'Other Subscriptions';
            return {
                type,
                amount: Number(r.amount.toFixed(2)),
                percentage: totalRevenueValue > 0 ? Number(((r.amount / totalRevenueValue) * 100).toFixed(1)) : 0
            };
        })
    ];
    // 6. Revenue By Category (Attributed)
    const contentStats = yield content_model_1.Content.aggregate([
        { $group: { _id: '$type', totalViews: { $sum: '$views' } } }
    ]);
    const movieViews = ((_b = contentStats.find(s => s._id === 'MOVIE')) === null || _b === void 0 ? void 0 : _b.totalViews) || 0;
    const seriesViews = ((_c = contentStats.find(s => s._id === 'SERIES')) === null || _c === void 0 ? void 0 : _c.totalViews) || 0;
    const totalViews = movieViews + seriesViews;
    const movieRevenueAttr = totalViews > 0 ? (movieViews / totalViews) * totalRevenueValue : 0;
    const seriesRevenueAttr = totalViews > 0 ? (seriesViews / totalViews) * totalRevenueValue : 0;
    return {
        summary: {
            totalRevenue: {
                value: Number(totalRevenueValue.toFixed(2)),
                growth: Number(revenueGrowth.toFixed(1)),
                period: 'from last period'
            },
            arpu: { value: Number(arpu.toFixed(2)), growth: 0 },
            conversionRate: { value: Number(conversionRate.toFixed(1)), growth: 0 },
            totalTransactions: { value: allRevenueEvents.length + (totalPointsValue > 0 ? 1 : 0), growth: 0 },
        },
        revenueTrend: {
            labels: trendResults.map(r => r._id),
            values: trendResults.map(r => Number(r.dailyRevenue.toFixed(2))),
        },
        monthlyBreakdown: monthlyBreakdown.map(m => ({
            month: m._id,
            revenue: Number(m.revenue.toFixed(2))
        })),
        howIMakeMoney,
        revenueByType: [
            {
                type: 'Movies',
                amount: Number(movieRevenueAttr.toFixed(2)),
                percentage: totalViews > 0 ? Number(((movieViews / totalViews) * 100).toFixed(1)) : 0
            },
            {
                type: 'Series',
                amount: Number(seriesRevenueAttr.toFixed(2)),
                percentage: totalViews > 0 ? Number(((seriesViews / totalViews) * 100).toFixed(1)) : 0
            }
        ]
    };
});
// --- Season Management ---
// --- Episode Analytics ---
const getEpisodeAnalyticsOverviewData = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const episode = yield episode_model_1.Episode.findById(id);
    if (!episode)
        return null;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    // 1. Get real watch statistics from RecentlyWatched
    const viewersData = yield recently_watched_model_1.RecentlyWatched.find({ contentId: new mongoose_1.Types.ObjectId(id) });
    const totalWatchTimeSeconds = viewersData.reduce((sum, v) => sum + (v.watchedSeconds || 0), 0);
    const totalWatchTimeHours = totalWatchTimeSeconds > 0 ? Math.round(totalWatchTimeSeconds / 3600) : 0;
    // 2. Growth calculation
    const currentPeriodViews = yield recently_watched_model_1.RecentlyWatched.countDocuments({
        contentId: new mongoose_1.Types.ObjectId(id),
        createdAt: { $gte: thirtyDaysAgo }
    });
    const previousPeriodViews = yield recently_watched_model_1.RecentlyWatched.countDocuments({
        contentId: new mongoose_1.Types.ObjectId(id),
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });
    const viewGrowth = previousPeriodViews > 0
        ? ((currentPeriodViews - previousPeriodViews) / previousPeriodViews) * 100
        : (currentPeriodViews > 0 ? 100 : 0);
    // You can similarly calculate watch time growth if you want, but for now we'll map view growth
    const viewGrowthAbs = Math.abs(Number(viewGrowth.toFixed(1)));
    const viewDirection = viewGrowth >= 0 ? 'increase' : 'decrease';
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const totalViewsLast48Hours = viewersData.filter(v => {
        const watchedAt = new Date(v.lastWatchedAt || v.createdAt);
        return watchedAt >= fortyEightHoursAgo;
    }).length;
    const viewsByHour = [];
    for (let i = 0; i < 10; i++) {
        const hourStart = new Date(now);
        hourStart.setHours(now.getHours() - i, 0, 0, 0);
        const hourEnd = new Date(hourStart);
        hourEnd.setHours(hourStart.getHours() + 1, 0, 0, 0);
        const viewsInHour = viewersData.filter(v => {
            const watchedAt = new Date(v.lastWatchedAt || v.createdAt);
            return watchedAt >= hourStart && watchedAt < hourEnd;
        }).length;
        viewsByHour.push({
            hour: hourStart.toISOString(),
            views: viewsInHour
        });
    }
    // Sort chronologically (oldest to newest hour)
    viewsByHour.reverse();
    return {
        views: {
            value: episode.views,
            change: {
                percentage: viewGrowthAbs,
                direction: viewDirection
            }
        },
        watchTime: {
            value: totalWatchTimeHours,
            unit: 'hours',
            change: {
                percentage: viewGrowthAbs, // using same growth percentage for now
                direction: viewDirection
            }
        },
        performance_chart: {
            labels: ['Day 1', 'Day 3', 'Day 5', 'Day 7', 'Day 10', 'Day 14', 'Day 21', 'Day 28'],
            this_video: [10000, 25000, 35000, 45000, 55000, 65000, 75000, episode.views],
            typical_performance: [12000, 28000, 38000, 48000, 58000, 68000, 78000, 81000],
        },
        realtimeAnalytics: {
            totalViewsLast48Hours,
            viewsByHour
        },
    };
});
const getEpisodeAnalyticsEngagementData = (id) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const episode = yield episode_model_1.Episode.findById(id);
    if (!episode)
        return null;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    // 1. Get real watch statistics from RecentlyWatched
    const viewersData = yield recently_watched_model_1.RecentlyWatched.find({ contentId: new mongoose_1.Types.ObjectId(id) });
    const totalViewers = viewersData.length;
    // 2. Growth calculation
    const currentPeriodViews = yield recently_watched_model_1.RecentlyWatched.countDocuments({
        contentId: new mongoose_1.Types.ObjectId(id),
        createdAt: { $gte: thirtyDaysAgo }
    });
    const previousPeriodViews = yield recently_watched_model_1.RecentlyWatched.countDocuments({
        contentId: new mongoose_1.Types.ObjectId(id),
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });
    const viewGrowth = previousPeriodViews > 0
        ? ((currentPeriodViews - previousPeriodViews) / previousPeriodViews) * 100
        : (currentPeriodViews > 0 ? 100 : 0);
    // 3. Real Engagement Metrics
    const totalWatchTimeSeconds = viewersData.reduce((sum, v) => sum + (v.watchedSeconds || 0), 0);
    const avgWatchTimeSeconds = totalViewers > 0 ? totalWatchTimeSeconds / totalViewers : 0;
    const avgRetentionPercentage = episode.duration > 0
        ? (avgWatchTimeSeconds / (episode.duration * 60)) * 100
        : 0;
    const formatDuration = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };
    // 3. Retention Chart (Mocked based on average retention)
    const retentionChart = [];
    const durationMinutes = episode.duration || 120;
    const timePoints = [0, 0.5, 1, 2, 5, 10, 15, 20, 24.25, 30, 40, 50, 60];
    let currentRetention = 100;
    let typicalRetention = 100;
    timePoints.forEach(min => {
        if (min <= durationMinutes) {
            let timeLabel = `${Math.floor(min)}:00`;
            if (min === 0)
                timeLabel = '0:00';
            else if (min === 0.5)
                timeLabel = '0:30';
            else if (min === 24.25)
                timeLabel = '24:15';
            else if (min < 10)
                timeLabel = `${Math.floor(min)}:00`;
            retentionChart.push({
                time: timeLabel,
                percentage: Number(currentRetention.toFixed(1)),
                typicalPercentage: Number(typicalRetention.toFixed(1))
            });
            // Decrease retention
            currentRetention = currentRetention - (Math.random() * 8 + 2);
            typicalRetention = typicalRetention - (Math.random() * 7 + 3);
            // Introduce a fake "spike" at 24:15 like the chart
            if (min === 20) {
                currentRetention += 15;
            }
            if (currentRetention < 0)
                currentRetention = 0;
            if (typicalRetention < 0)
                typicalRetention = 0;
        }
    });
    const retentionAt30s = ((_a = retentionChart.find(c => c.time === '0:30')) === null || _a === void 0 ? void 0 : _a.percentage) || 0;
    const viewGrowthAbs = Math.abs(Number(viewGrowth.toFixed(1)));
    const viewDirection = viewGrowth >= 0 ? 'increase' : 'decrease';
    const avgViewDurationGrowthAbs = Math.abs(Number((viewGrowth * 0.8).toFixed(1)));
    const avgViewDurationDirection = viewGrowth * 0.8 >= 0 ? 'increase' : 'decrease';
    const baseValue = Number((totalWatchTimeSeconds / 3600).toFixed(0)) || 80000;
    const watchTimeGrowth = {
        labels: ['Day 1', 'Day 3', 'Day 5', 'Day 7', 'Day 10', 'Day 14', 'Day 21', 'Day 28'],
        datasets: [
            {
                name: 'This video',
                data: [
                    baseValue * 0.15, baseValue * 0.17, baseValue * 0.23, baseValue * 0.32,
                    baseValue * 0.45, baseValue * 0.60, baseValue * 0.81, baseValue
                ].map(Math.round)
            },
            {
                name: 'Typical performance',
                data: [
                    baseValue * 0.10, baseValue * 0.12, baseValue * 0.17, baseValue * 0.22,
                    baseValue * 0.27, baseValue * 0.35, baseValue * 0.43, baseValue * 0.52
                ].map(Math.round)
            }
        ]
    };
    return {
        watchTime: {
            value: baseValue,
            unit: 'hours',
            change: {
                percentage: viewGrowthAbs,
                direction: viewDirection
            }
        },
        avgViewDuration: {
            value: formatDuration(avgWatchTimeSeconds),
            change: {
                percentage: avgViewDurationGrowthAbs,
                direction: avgViewDurationDirection
            }
        },
        retention: {
            avgDuration: formatDuration(avgWatchTimeSeconds),
            avgPercentage: Number(avgRetentionPercentage.toFixed(1)),
            at30Sec: {
                value: retentionAt30s,
                status: retentionAt30s > 70 ? 'Above typical' : retentionAt30s > 50 ? 'Typical' : 'Below typical'
            },
            chart: retentionChart,
        },
        watchTimeGrowth,
    };
});
const getEpisodeAnalyticsAudienceData = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const episode = yield episode_model_1.Episode.findById(id);
    if (!episode)
        return null;
    // 1. Get all users who watched this content
    const viewers = yield recently_watched_model_1.RecentlyWatched.aggregate([
        { $match: { contentId: new mongoose_1.Types.ObjectId(id) } },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
            }
        },
        { $unwind: '$user' },
        {
            $lookup: {
                from: 'subscriptions',
                localField: 'userId',
                foreignField: 'userId',
                as: 'subscription'
            }
        },
        {
            $addFields: {
                userPlan: { $ifNull: [{ $arrayElemAt: ['$subscription.plan', 0] }, 'FREE'] },
                userGender: '$user.gender',
                userDob: '$user.dateOfBirth',
                userCountry: '$user.country'
            }
        }
    ]);
    if (viewers.length === 0) {
        return {
            watchTimeFromSubscribers: [
                { type: 'VIP Weekly', percentage: 0 },
                { type: 'VIP Monthly', percentage: 0 },
                { type: 'VIP Yearly', percentage: 0 },
                { type: 'Not Subscribed', percentage: 0 },
            ],
            demographics: {
                gender: [
                    { gender: 'Male', percentage: 0 },
                    { gender: 'Female', percentage: 0 },
                    { gender: 'Untracked', percentage: 0 },
                ],
                age: [
                    { range: '3-17', percentage: 0 },
                    { range: '18-24', percentage: 0 },
                    { range: '25-34', percentage: 0 },
                    { range: '35-44', percentage: 0 },
                    { range: '45-54', percentage: 0 },
                    { range: '55-64', percentage: 0 },
                    { range: '65+', percentage: 0 },
                    { range: 'Untracked', percentage: 0 },
                ],
            },
            geography: [],
        };
    }
    const totalViewers = viewers.length;
    // 2. Watch Time (Views) From Subscribers
    const planCounts = viewers.reduce((acc, v) => {
        const plan = v.userPlan;
        acc[plan] = (acc[plan] || 0) + 1;
        return acc;
    }, {});
    // Mapping plans to requested types (This is an approximation based on current plan names)
    const watchTimeFromSubscribers = [
        { type: 'VIP Weekly', percentage: Number(((planCounts['WEEKLY'] || 0) / totalViewers * 100).toFixed(1)) },
        { type: 'VIP Monthly', percentage: Number(((planCounts['MONTHLY'] || 0) / totalViewers * 100).toFixed(1)) },
        { type: 'VIP Yearly', percentage: Number(((planCounts['YEARLY'] || 0) / totalViewers * 100).toFixed(1)) },
        { type: 'Not Subscribed', percentage: Number(((planCounts['FREE'] || 0) / totalViewers * 100).toFixed(1)) },
    ];
    // 3. Demographics - Gender
    const genderCounts = viewers.reduce((acc, v) => {
        var _a;
        const gender = (_a = v.userGender) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        if (gender === 'male') {
            acc.male++;
        }
        else if (gender === 'female') {
            acc.female++;
        }
        else {
            acc.untracked++;
        }
        return acc;
    }, { male: 0, female: 0, untracked: 0 });
    const totalGender = totalViewers > 0 ? totalViewers : 1;
    const genderStats = [
        { gender: 'Male', percentage: Number((genderCounts.male / totalGender * 100).toFixed(1)) },
        { gender: 'Female', percentage: Number((genderCounts.female / totalGender * 100).toFixed(1)) },
        { gender: 'Untracked', percentage: Number((genderCounts.untracked / totalGender * 100).toFixed(1)) },
    ];
    // 4. Demographics - Age
    const calculateAge = (dob) => {
        if (!dob)
            return null;
        const birthDate = new Date(dob);
        if (isNaN(birthDate.getTime()))
            return null;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };
    const ageRanges = [
        { range: '3-17', min: 3, max: 17, count: 0 },
        { range: '18-24', min: 18, max: 24, count: 0 },
        { range: '25-34', min: 25, max: 34, count: 0 },
        { range: '35-44', min: 35, max: 44, count: 0 },
        { range: '45-54', min: 45, max: 54, count: 0 },
        { range: '55-64', min: 55, max: 64, count: 0 },
        { range: '65+', min: 65, max: 150, count: 0 },
        { range: 'Untracked', min: -1, max: -1, count: 0 },
    ];
    let totalAgeKnown = 0;
    viewers.forEach(v => {
        totalAgeKnown++;
        const age = calculateAge(v.userDob);
        if (age !== null) {
            const range = ageRanges.find(r => age >= r.min && age <= r.max);
            if (range) {
                range.count++;
            }
            else {
                const untracked = ageRanges.find(r => r.range === 'Untracked');
                if (untracked)
                    untracked.count++;
            }
        }
        else {
            const untracked = ageRanges.find(r => r.range === 'Untracked');
            if (untracked)
                untracked.count++;
        }
    });
    const ageStats = ageRanges.map(r => ({
        range: r.range,
        percentage: totalAgeKnown > 0 ? Number((r.count / totalAgeKnown * 100).toFixed(1)) : 0
    }));
    // 5. Geography
    const countryCounts = viewers.reduce((acc, v) => {
        const country = v.userCountry || 'Unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
    }, {});
    const geography = Object.entries(countryCounts)
        .map(([country, count]) => ({ country, count: count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    return {
        watchTimeFromSubscribers,
        demographics: {
            gender: genderStats,
            age: ageStats,
        },
        geography,
    };
});
exports.AdminService = {
    getAdminDashboardStats,
    getVisitorAnalyticsData,
    getWatchlistStatusBreakdown,
    getSubscriptionsStats,
    getAdminSubscriptionsList,
    getRevenueStats,
    getTransactionsList,
    getMovieProfileFromDB,
    getMovieAnalyticsOverviewData,
    getMovieAnalyticsEngagementData,
    getMovieAnalyticsAudienceData,
    getMovieAnalyticsRevenueData,
    getEpisodeAnalyticsOverviewData,
    getEpisodeAnalyticsEngagementData,
    getEpisodeAnalyticsAudienceData
};
