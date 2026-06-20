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
exports.processGoogleWebhook = exports.verifyGooglePurchase = exports.processAppleWebhook = exports.verifyApplePurchase = exports.setFreePlan = exports.getMySubscription = exports.adminResetPlan = exports.adminGrantPlan = exports.getSubscriptionEvents = exports.getSubscriptionById = exports.getPendingWebhooks = exports.getSubscriptionAnalytics = exports.getAllSubscriptions = void 0;
const mongoose_1 = require("mongoose");
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const subscription_model_1 = require("./subscription.model");
const subscription_interface_1 = require("./subscription.interface");
const apple_verify_1 = require("./providers/apple/apple.verify");
const apple_webhook_1 = require("./providers/apple/apple.webhook");
const google_verify_1 = require("./providers/google/google.verify");
const google_webhook_1 = require("./providers/google/google.webhook");
const plan_mapper_1 = require("./helpers/plan.mapper");
const pending_webhook_model_1 = require("./pending-webhook.model");
const subscription_event_model_1 = require("./subscription-event.model");
const user_model_1 = require("../user/user.model");
const revenue_model_1 = require("../revenue/revenue.model");
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
// --- Admin Service Methods ---
const getAllSubscriptions = (query) => __awaiter(void 0, void 0, void 0, function* () {
    // Handle custom 'pkg' filter (weekly, monthly, yearly)
    const dbQuery = Object.assign({}, query);
    if (dbQuery.pkg && typeof dbQuery.pkg === 'string') {
        dbQuery.productId = { $regex: dbQuery.pkg, $options: 'i' };
        delete dbQuery.pkg; // Remove pkg so QueryBuilder doesn't try to match it directly
    }
    const subscriptionQuery = new QueryBuilder_1.default(subscription_model_1.Subscription.find().populate('userId', 'name email'), dbQuery)
        .search(['googleOrderId', 'appleOriginalTransactionId'])
        .filter()
        .sort()
        .paginate()
        .fields();
    const transactions = yield subscriptionQuery.modelQuery;
    const meta = yield subscriptionQuery.getPaginationInfo();
    // Custom search logic for populated fields or default ID
    let finalTransactions = transactions;
    let finalMeta = meta;
    if (query.searchTerm && typeof query.searchTerm === 'string') {
        const term = query.searchTerm;
        const matchingUsers = yield user_model_1.User.find({ email: { $regex: term, $options: 'i' } }).select('_id');
        const userIds = matchingUsers.map((u) => u._id);
        if (userIds.length > 0) {
            const customQuery = new QueryBuilder_1.default(subscription_model_1.Subscription.find({
                $or: [
                    { googleOrderId: { $regex: term, $options: 'i' } },
                    { appleOriginalTransactionId: { $regex: term, $options: 'i' } },
                    { userId: { $in: userIds } },
                ],
            }).populate('userId', 'name email'), query)
                .filter()
                .sort()
                .paginate()
                .fields();
            finalTransactions = yield customQuery.modelQuery;
            finalMeta = yield customQuery.getPaginationInfo();
        }
    }
    // Format the data to match the UI mock expectations
    const formattedData = yield Promise.all(finalTransactions.map((sub) => __awaiter(void 0, void 0, void 0, function* () {
        // Attempt to find the amount from RevenueTransactions
        const latestRevenue = sub.userId ? yield revenue_model_1.RevenueTransaction.findOne({ userId: sub.userId._id })
            .sort({ createdAt: -1 })
            .select('totalAmount currency') : null;
        return {
            _id: sub._id,
            transactionId: sub.googleOrderId || sub.appleOriginalTransactionId || `TRX-${sub._id.toString().slice(-8).toUpperCase()}`,
            plan: sub.plan,
            startDate: sub.startedAt || sub.createdAt,
            amount: latestRevenue ? latestRevenue.totalAmount : 0,
            user: sub.userId ? sub.userId : null,
            guestId: sub.guestId || null
        };
    })));
    return { meta: finalMeta, data: formattedData };
});
exports.getAllSubscriptions = getAllSubscriptions;
const getSubscriptionAnalytics = () => __awaiter(void 0, void 0, void 0, function* () {
    const now = new Date();
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    // 1. Total Users
    const totalUsersCurrent = yield user_model_1.User.countDocuments();
    const totalUsersPrevious = yield user_model_1.User.countDocuments({ createdAt: { $lte: endOfPreviousMonth } });
    // 2. Total Revenue
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
    // 3. Active Subscribers
    const activeSubscribersCurrent = yield subscription_model_1.Subscription.countDocuments({ status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE });
    const activeSubscribersPrevious = yield subscription_model_1.Subscription.countDocuments({
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
        createdAt: { $lte: endOfPreviousMonth }
    });
    const calculateTrend = (current, previous) => {
        if (previous === 0)
            return current > 0 ? 100 : 0;
        return Number((((current - previous) / previous) * 100).toFixed(1));
    };
    const formatMetric = (current, previous) => {
        const changePct = calculateTrend(current, previous);
        let direction = 'neutral';
        if (changePct > 0)
            direction = 'up';
        else if (changePct < 0)
            direction = 'down';
        return {
            value: current,
            changePct: Math.abs(changePct),
            direction
        };
    };
    const growthRateCurrent = calculateTrend(activeSubscribersCurrent, activeSubscribersPrevious);
    const growthRatePrevious = calculateTrend(activeSubscribersPrevious, activeSubscribersPrevious * 0.9); // Dummy comparison
    const growthRateDiff = Number((growthRateCurrent - growthRatePrevious).toFixed(1));
    let grDirection = 'neutral';
    if (growthRateDiff > 0)
        grDirection = 'up';
    else if (growthRateDiff < 0)
        grDirection = 'down';
    return {
        meta: {
            comparisonPeriod: "month"
        },
        totalUsers: formatMetric(totalUsersCurrent, totalUsersPrevious),
        totalRevenue: formatMetric(totalRevenueCurrent, totalRevenuePrevious),
        activeSubscribers: formatMetric(activeSubscribersCurrent, activeSubscribersPrevious),
        growthRate: {
            value: growthRateCurrent,
            changePct: Math.abs(growthRateDiff),
            direction: grDirection
        }
    };
});
exports.getSubscriptionAnalytics = getSubscriptionAnalytics;
const getPendingWebhooks = () => __awaiter(void 0, void 0, void 0, function* () {
    return pending_webhook_model_1.PendingWebhook.find().sort({ receivedAt: -1 }).limit(100);
});
exports.getPendingWebhooks = getPendingWebhooks;
const getSubscriptionById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    return subscription_model_1.Subscription.findById(id).populate('userId', 'name email');
});
exports.getSubscriptionById = getSubscriptionById;
const getSubscriptionEvents = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    return subscription_event_model_1.SubscriptionEvent.find({ userId: new mongoose_1.Types.ObjectId(userId) }).sort({
        occurredAt: -1,
    });
});
exports.getSubscriptionEvents = getSubscriptionEvents;
const adminGrantPlan = (userId, plan) => __awaiter(void 0, void 0, void 0, function* () {
    const uId = new mongoose_1.Types.ObjectId(userId);
    return subscription_model_1.Subscription.upsertForUserOrGuest(uId, undefined, {
        plan,
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
        platform: subscription_interface_1.SUBSCRIPTION_PLATFORM.ADMIN,
        productId: `admin_granted_${plan.toLowerCase()}`,
        currentPeriodEnd: null, // Admin grants are usually perpetual unless managed manually
    });
});
exports.adminGrantPlan = adminGrantPlan;
const adminResetPlan = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const uId = new mongoose_1.Types.ObjectId(userId);
    return subscription_model_1.Subscription.upsertForUserOrGuest(uId, undefined, {
        plan: subscription_interface_1.SUBSCRIPTION_PLAN.FREE,
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
        platform: subscription_interface_1.SUBSCRIPTION_PLATFORM.ADMIN,
        productId: undefined,
        currentPeriodEnd: null,
        canceledAt: new Date(),
    });
});
exports.adminResetPlan = adminResetPlan;
// --- End Admin Service Methods ---
const ensureSubscriptionDoc = (userId, guestId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId && !guestId)
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'User ID or Guest ID is required');
    const uId = userId ? new mongoose_1.Types.ObjectId(userId) : undefined;
    const doc = yield subscription_model_1.Subscription.findByUserOrGuest(uId, guestId);
    if (doc)
        return doc;
    const query = userId ? { userId: uId } : { guestId };
    // We use findOneAndUpdate directly here instead of upsertForUserOrGuest to avoid
    // writing a 'CREATED' event to the audit log for every first-time profile view.
    // The zero-state FREE record is not a meaningful subscription event.
    return (yield subscription_model_1.Subscription.findOneAndUpdate(query, {
        $set: Object.assign(Object.assign({}, query), { plan: subscription_interface_1.SUBSCRIPTION_PLAN.FREE, status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE }),
    }, { new: true, upsert: true }));
});
const getMySubscription = (userId, guestId) => __awaiter(void 0, void 0, void 0, function* () {
    return ensureSubscriptionDoc(userId, guestId);
});
exports.getMySubscription = getMySubscription;
const setFreePlan = (userId, guestId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!userId && !guestId)
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'User ID or Guest ID is required');
    const uId = userId ? new mongoose_1.Types.ObjectId(userId) : undefined;
    const existing = yield subscription_model_1.Subscription.findByUserOrGuest(uId, guestId);
    // C2 Fix: Guard against active store subscriptions.
    // If a user has an active Apple/Google subscription, we cannot unilaterally
    // downgrade them to FREE, as the store remains the source of truth.
    if (existing &&
        existing.platform !== subscription_interface_1.SUBSCRIPTION_PLATFORM.ADMIN &&
        (existing.status === subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE ||
            existing.status === subscription_interface_1.SUBSCRIPTION_STATUS.TRIALING ||
            existing.status === subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE) &&
        existing.currentPeriodEnd &&
        existing.currentPeriodEnd > new Date()) {
        throw new ApiError_1.default(http_status_1.default.CONFLICT, 'You have an active store subscription. Please cancel it through the App Store or Play Store first.');
    }
    return subscription_model_1.Subscription.upsertForUserOrGuest(uId, guestId, {
        plan: subscription_interface_1.SUBSCRIPTION_PLAN.FREE,
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
        platform: subscription_interface_1.SUBSCRIPTION_PLATFORM.ADMIN, // Mark as admin-reset
    });
});
exports.setFreePlan = setFreePlan;
const verifyApplePurchase = (userId, guestId, signedTransactionInfo) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!userId && !guestId)
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'User ID or Guest ID is required');
    // 1. Cryptographically verify the JWS with Apple's library.
    const decoded = yield (0, apple_verify_1.verifyAppleTransaction)(signedTransactionInfo);
    // C3 Fix: Reject if this transaction has been superseded by an upgrade.
    if (decoded.isUpgraded) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'This transaction has been superseded by an upgrade. Please verify the latest transaction.');
    }
    // 2. Fraud guard: reject if this transaction is already bound to a
    //    different user account.
    const existingByTx = yield subscription_model_1.Subscription.findOne({
        appleOriginalTransactionId: decoded.originalTransactionId,
    });
    if (existingByTx) {
        if (userId && ((_a = existingByTx.userId) === null || _a === void 0 ? void 0 : _a.toString()) !== userId) {
            throw new ApiError_1.default(http_status_1.default.CONFLICT, 'This Apple transaction is already linked to another account');
        }
        if (guestId && existingByTx.guestId !== guestId) {
            throw new ApiError_1.default(http_status_1.default.CONFLICT, 'This Apple transaction is already linked to another guest account');
        }
    }
    // 3. Map the store-side productId to a local plan.
    const plan = (0, plan_mapper_1.mapAppleProductToPlan)(decoded.productId);
    if (plan === subscription_interface_1.SUBSCRIPTION_PLAN.FREE) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Unknown or unsupported productId: ${decoded.productId}`);
    }
    // 4. Persist the subscription for this user.
    const updated = yield subscription_model_1.Subscription.upsertForUserOrGuest(userId ? new mongoose_1.Types.ObjectId(userId) : undefined, guestId, {
        plan,
        status: subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE,
        platform: subscription_interface_1.SUBSCRIPTION_PLATFORM.APPLE,
        environment: decoded.environment,
        productId: decoded.productId,
        appleOriginalTransactionId: decoded.originalTransactionId,
        appleLatestTransactionId: decoded.transactionId,
        startedAt: new Date(decoded.purchaseDate),
        currentPeriodEnd: decoded.expiresDate
            ? new Date(decoded.expiresDate)
            : null,
        canceledAt: null,
        gracePeriodEndsAt: null,
        metadata: {
            appAccountToken: decoded.appAccountToken,
            bundleId: decoded.bundleId,
        },
    });
    // 5. Re-process any orphan webhooks that arrived before this verify call.
    // We don't await this so the user gets their response immediately.
    reprocessPendingWebhooks(decoded.originalTransactionId, 'apple').catch(err => {
        console.error('Failed to re-process pending Apple webhooks:', err);
    });
    return updated;
});
exports.verifyApplePurchase = verifyApplePurchase;
const processAppleWebhook = (signedPayload) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, apple_webhook_1.handleAppleNotification)(signedPayload);
});
exports.processAppleWebhook = processAppleWebhook;
const verifyGooglePurchase = (userId, guestId, purchaseToken, productId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!userId && !guestId)
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, 'User ID or Guest ID is required');
    // 1. Pull the authoritative subscription state from Google.
    const decoded = yield (0, google_verify_1.verifyGoogleSubscription)(purchaseToken, productId);
    // 2. Fraud guard: a purchase token must not be linked to a different user.
    // C1 Fix: Handle linkedPurchaseToken (upgrades/downgrades).
    // If the user upgraded, the new token is in purchaseToken, and the old token
    // is in linkedPurchaseToken. We should check both to find the existing row.
    const existingByToken = yield subscription_model_1.Subscription.findOne({
        $or: [
            { googlePurchaseToken: decoded.purchaseToken },
            ...(decoded.linkedPurchaseToken
                ? [{ googlePurchaseToken: decoded.linkedPurchaseToken }]
                : []),
        ],
    });
    if (existingByToken) {
        if (userId && ((_a = existingByToken.userId) === null || _a === void 0 ? void 0 : _a.toString()) !== userId) {
            throw new ApiError_1.default(http_status_1.default.CONFLICT, 'This Google purchase is already linked to another account');
        }
        if (guestId && existingByToken.guestId !== guestId) {
            throw new ApiError_1.default(http_status_1.default.CONFLICT, 'This Google purchase is already linked to another guest account');
        }
    }
    // 3. Map productId → local plan.
    const plan = (0, plan_mapper_1.mapGoogleProductToPlan)(decoded.productId);
    if (plan === subscription_interface_1.SUBSCRIPTION_PLAN.FREE) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Unknown or unsupported productId: ${decoded.productId}`);
    }
    // 4. Translate Google's subscriptionState into our local status.
    const isActiveState = decoded.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' ||
        decoded.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
    if (!isActiveState) {
        throw new ApiError_1.default(http_status_1.default.BAD_REQUEST, `Google subscription is not active (state: ${decoded.subscriptionState})`);
    }
    const localStatus = decoded.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
        ? subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE
        : subscription_interface_1.SUBSCRIPTION_STATUS.ACTIVE;
    // 5. Persist for this user.
    const updated = yield subscription_model_1.Subscription.upsertForUserOrGuest(userId ? new mongoose_1.Types.ObjectId(userId) : undefined, guestId, {
        plan,
        status: localStatus,
        platform: subscription_interface_1.SUBSCRIPTION_PLATFORM.GOOGLE,
        environment: decoded.environment,
        productId: decoded.productId,
        autoRenewing: decoded.autoRenewing,
        googlePurchaseToken: decoded.purchaseToken,
        googleOrderId: decoded.orderId,
        startedAt: decoded.startTime ? new Date(decoded.startTime) : null,
        currentPeriodEnd: decoded.expiryTime
            ? new Date(decoded.expiryTime)
            : null,
        canceledAt: null,
        gracePeriodEndsAt: localStatus === subscription_interface_1.SUBSCRIPTION_STATUS.PAST_DUE && decoded.expiryTime
            ? new Date(decoded.expiryTime)
            : null,
        metadata: {
            acknowledgementState: decoded.acknowledgementState,
            linkedPurchaseToken: decoded.linkedPurchaseToken,
            testPurchase: decoded.testPurchase,
        },
    });
    // 6. Re-process any orphan webhooks.
    reprocessPendingWebhooks(decoded.purchaseToken, 'google').catch(err => {
        console.error('Failed to re-process pending Google webhooks:', err);
    });
    return updated;
});
exports.verifyGooglePurchase = verifyGooglePurchase;
const processGoogleWebhook = (rawBody, authorizationHeader) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, google_webhook_1.handleGoogleNotification)(rawBody, authorizationHeader);
});
exports.processGoogleWebhook = processGoogleWebhook;
const reprocessPendingWebhooks = (externalPurchaseId, provider) => __awaiter(void 0, void 0, void 0, function* () {
    const pending = yield pending_webhook_model_1.PendingWebhook.find({
        externalPurchaseId,
        provider,
    }).sort({ receivedAt: 1 });
    if (pending.length === 0)
        return;
    for (const item of pending) {
        try {
            if (provider === 'apple') {
                yield (0, apple_webhook_1.handleAppleNotification)(item.payload);
            }
            else {
                yield (0, google_webhook_1.handleGoogleNotification)(item.payload, undefined, true);
            }
            // Delete after successful processing
            yield pending_webhook_model_1.PendingWebhook.findByIdAndDelete(item._id);
        }
        catch (err) {
            console.error(`Failed to re-process pending ${provider} webhook ${item._id}:`, err);
        }
    }
});
const SubscriptionService = {
    getMySubscription: exports.getMySubscription,
    setFreePlan: exports.setFreePlan,
    verifyApplePurchase: exports.verifyApplePurchase,
    processAppleWebhook: exports.processAppleWebhook,
    verifyGooglePurchase: exports.verifyGooglePurchase,
    processGoogleWebhook: exports.processGoogleWebhook,
    getAllSubscriptions: exports.getAllSubscriptions,
    getSubscriptionAnalytics: exports.getSubscriptionAnalytics,
    getPendingWebhooks: exports.getPendingWebhooks,
    getSubscriptionById: exports.getSubscriptionById,
    getSubscriptionEvents: exports.getSubscriptionEvents,
    adminGrantPlan: exports.adminGrantPlan,
    adminResetPlan: exports.adminResetPlan,
};
exports.default = SubscriptionService;
