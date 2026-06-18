import { Types } from 'mongoose';
import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiError';
import { Subscription as SubscriptionModel } from './subscription.model';
import {
  ISubscription,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_PLATFORM,
  SUBSCRIPTION_STATUS,
} from './subscription.interface';
import { verifyAppleTransaction } from './providers/apple/apple.verify';
import { handleAppleNotification } from './providers/apple/apple.webhook';
import { AppleWebhookResult } from './providers/apple/apple.types';
import { verifyGoogleSubscription } from './providers/google/google.verify';
import { handleGoogleNotification } from './providers/google/google.webhook';
import { GoogleWebhookResult } from './providers/google/google.types';
import {
  mapAppleProductToPlan,
  mapGoogleProductToPlan,
} from './helpers/plan.mapper';
import { PendingWebhook } from './pending-webhook.model';
import { SubscriptionEvent } from './subscription-event.model';
import { ISubscriptionEvent } from './subscription-event.interface';
import { ProcessedWebhook } from './processed-webhook.model';
import { User } from '../user/user.model';
import { RevenueTransaction } from '../revenue/revenue.model';
import QueryBuilder from '../../builder/QueryBuilder';

// --- Admin Service Methods ---

export const getAllSubscriptions = async (
  query: Record<string, unknown>
) => {
  // Handle custom 'pkg' filter (weekly, monthly, yearly)
  const dbQuery = { ...query };
  if (dbQuery.pkg && typeof dbQuery.pkg === 'string') {
    dbQuery.productId = { $regex: dbQuery.pkg, $options: 'i' };
    delete dbQuery.pkg; // Remove pkg so QueryBuilder doesn't try to match it directly
  }

  const subscriptionQuery = new QueryBuilder(
    SubscriptionModel.find().populate('userId', 'name email'),
    dbQuery
  )
    .search(['googleOrderId', 'appleOriginalTransactionId'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const transactions = await subscriptionQuery.modelQuery;
  const meta = await subscriptionQuery.getPaginationInfo();

  // Custom search logic for populated fields or default ID
  let finalTransactions = transactions;
  let finalMeta = meta;

  if (query.searchTerm && typeof query.searchTerm === 'string') {
    const term = query.searchTerm;
    const matchingUsers = await User.find({ email: { $regex: term, $options: 'i' } }).select('_id');
    const userIds = matchingUsers.map((u) => u._id);

    if (userIds.length > 0) {
      const customQuery = new QueryBuilder(
        SubscriptionModel.find({
          $or: [
            { googleOrderId: { $regex: term, $options: 'i' } },
            { appleOriginalTransactionId: { $regex: term, $options: 'i' } },
            { userId: { $in: userIds } },
          ],
        }).populate('userId', 'name email'),
        query
      )
        .filter()
        .sort()
        .paginate()
        .fields();

      finalTransactions = await customQuery.modelQuery;
      finalMeta = await customQuery.getPaginationInfo();
    }
  }

  // Format the data to match the UI mock expectations
  const formattedData = await Promise.all(finalTransactions.map(async (sub) => {
    // Attempt to find the amount from RevenueTransactions
    const latestRevenue = sub.userId ? await RevenueTransaction.findOne({ userId: sub.userId._id })
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
  }));

  return { meta: finalMeta, data: formattedData };
};

export const getSubscriptionAnalytics = async () => {
  const now = new Date();
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // 1. Total Users
  const totalUsersCurrent = await User.countDocuments();
  const totalUsersPrevious = await User.countDocuments({ createdAt: { $lte: endOfPreviousMonth } });

  // 2. Total Revenue
  const revenueCurrentAgg = await RevenueTransaction.aggregate([
    { $match: { status: 'SUCCESS' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  const totalRevenueCurrent = revenueCurrentAgg.length > 0 ? revenueCurrentAgg[0].total : 0;

  const revenuePreviousAgg = await RevenueTransaction.aggregate([
    { $match: { status: 'SUCCESS', createdAt: { $lte: endOfPreviousMonth } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);
  const totalRevenuePrevious = revenuePreviousAgg.length > 0 ? revenuePreviousAgg[0].total : 0;

  // 3. Active Subscribers
  const activeSubscribersCurrent = await SubscriptionModel.countDocuments({ status: SUBSCRIPTION_STATUS.ACTIVE });
  const activeSubscribersPrevious = await SubscriptionModel.countDocuments({
    status: SUBSCRIPTION_STATUS.ACTIVE,
    createdAt: { $lte: endOfPreviousMonth }
  });

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  };

  const formatMetric = (current: number, previous: number) => {
    const changePct = calculateTrend(current, previous);
    let direction = 'neutral';
    if (changePct > 0) direction = 'up';
    else if (changePct < 0) direction = 'down';

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
  if (growthRateDiff > 0) grDirection = 'up';
  else if (growthRateDiff < 0) grDirection = 'down';

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
};

export const getPendingWebhooks = async () => {
  return PendingWebhook.find().sort({ receivedAt: -1 }).limit(100);
};

export const getSubscriptionById = async (
  id: string
): Promise<ISubscription | null> => {
  return SubscriptionModel.findById(id).populate('userId', 'name email');
};

export const getSubscriptionEvents = async (
  userId: string
): Promise<ISubscriptionEvent[]> => {
  return SubscriptionEvent.find({ userId: new Types.ObjectId(userId) }).sort({
    occurredAt: -1,
  });
};

export const adminGrantPlan = async (
  userId: string,
  plan: SUBSCRIPTION_PLAN
): Promise<ISubscription> => {
  const uId = new Types.ObjectId(userId);
  return SubscriptionModel.upsertForUserOrGuest(uId, undefined, {
    plan,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    platform: SUBSCRIPTION_PLATFORM.ADMIN,
    productId: `admin_granted_${plan.toLowerCase()}`,
    currentPeriodEnd: null, // Admin grants are usually perpetual unless managed manually
  });
};

export const adminResetPlan = async (userId: string): Promise<ISubscription> => {
  const uId = new Types.ObjectId(userId);
  return SubscriptionModel.upsertForUserOrGuest(uId, undefined, {
    plan: SUBSCRIPTION_PLAN.FREE,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    platform: SUBSCRIPTION_PLATFORM.ADMIN,
    productId: undefined,
    currentPeriodEnd: null,
    canceledAt: new Date(),
  });
};

// --- End Admin Service Methods ---


const ensureSubscriptionDoc = async (
  userId: string | undefined,
  guestId: string | undefined
): Promise<ISubscription> => {
  if (!userId && !guestId) throw new ApiError(httpStatus.BAD_REQUEST, 'User ID or Guest ID is required');

  const uId = userId ? new Types.ObjectId(userId) : undefined;
  const doc = await SubscriptionModel.findByUserOrGuest(uId, guestId);
  if (doc) return doc;

  const query = userId ? { userId: uId } : { guestId };

  // We use findOneAndUpdate directly here instead of upsertForUserOrGuest to avoid
  // writing a 'CREATED' event to the audit log for every first-time profile view.
  // The zero-state FREE record is not a meaningful subscription event.
  return (await SubscriptionModel.findOneAndUpdate(
    query,
    {
      $set: {
        ...query,
        plan: SUBSCRIPTION_PLAN.FREE,
        status: SUBSCRIPTION_STATUS.ACTIVE,
      },
    },
    { new: true, upsert: true }
  )) as ISubscription;
};

export const getMySubscription = async (
  userId: string | undefined,
  guestId: string | undefined
): Promise<ISubscription> => {
  return ensureSubscriptionDoc(userId, guestId);
};

export const setFreePlan = async (
  userId: string | undefined,
  guestId: string | undefined
): Promise<ISubscription> => {
  if (!userId && !guestId) throw new ApiError(httpStatus.BAD_REQUEST, 'User ID or Guest ID is required');
  const uId = userId ? new Types.ObjectId(userId) : undefined;
  const existing = await SubscriptionModel.findByUserOrGuest(uId, guestId);

  // C2 Fix: Guard against active store subscriptions.
  // If a user has an active Apple/Google subscription, we cannot unilaterally
  // downgrade them to FREE, as the store remains the source of truth.
  if (
    existing &&
    existing.platform !== SUBSCRIPTION_PLATFORM.ADMIN &&
    (existing.status === SUBSCRIPTION_STATUS.ACTIVE ||
      existing.status === SUBSCRIPTION_STATUS.TRIALING ||
      existing.status === SUBSCRIPTION_STATUS.PAST_DUE) &&
    existing.currentPeriodEnd &&
    existing.currentPeriodEnd > new Date()
  ) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'You have an active store subscription. Please cancel it through the App Store or Play Store first.'
    );
  }

  return SubscriptionModel.upsertForUserOrGuest(uId, guestId, {
    plan: SUBSCRIPTION_PLAN.FREE,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    platform: SUBSCRIPTION_PLATFORM.ADMIN, // Mark as admin-reset
  });
};

export const verifyApplePurchase = async (
  userId: string | undefined,
  guestId: string | undefined,
  signedTransactionInfo: string
): Promise<ISubscription> => {
  if (!userId && !guestId) throw new ApiError(httpStatus.BAD_REQUEST, 'User ID or Guest ID is required');

  // 1. Cryptographically verify the JWS with Apple's library.
  const decoded = await verifyAppleTransaction(signedTransactionInfo);

  // C3 Fix: Reject if this transaction has been superseded by an upgrade.
  if (decoded.isUpgraded) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'This transaction has been superseded by an upgrade. Please verify the latest transaction.'
    );
  }

  // 2. Fraud guard: reject if this transaction is already bound to a
  //    different user account.
  const existingByTx = await SubscriptionModel.findOne({
    appleOriginalTransactionId: decoded.originalTransactionId,
  });
  if (existingByTx) {
    if (userId && existingByTx.userId?.toString() !== userId) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'This Apple transaction is already linked to another account'
      );
    }
    if (guestId && existingByTx.guestId !== guestId) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'This Apple transaction is already linked to another guest account'
      );
    }
  }

  // 3. Map the store-side productId to a local plan.
  const plan = mapAppleProductToPlan(decoded.productId);
  if (plan === SUBSCRIPTION_PLAN.FREE) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Unknown or unsupported productId: ${decoded.productId}`
    );
  }

  // 4. Persist the subscription for this user.
  const updated = await SubscriptionModel.upsertForUserOrGuest(
    userId ? new Types.ObjectId(userId) : undefined,
    guestId,
    {
      plan,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      platform: SUBSCRIPTION_PLATFORM.APPLE,
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
    }
  );

  // 5. Re-process any orphan webhooks that arrived before this verify call.
  // We don't await this so the user gets their response immediately.
  reprocessPendingWebhooks(decoded.originalTransactionId, 'apple').catch(
    err => {
      console.error('Failed to re-process pending Apple webhooks:', err);
    }
  );

  return updated;
};

export const processAppleWebhook = async (
  signedPayload: string
): Promise<AppleWebhookResult> => {
  return handleAppleNotification(signedPayload);
};

export const verifyGooglePurchase = async (
  userId: string | undefined,
  guestId: string | undefined,
  purchaseToken: string,
  productId: string
): Promise<ISubscription> => {
  if (!userId && !guestId) throw new ApiError(httpStatus.BAD_REQUEST, 'User ID or Guest ID is required');

  // 1. Pull the authoritative subscription state from Google.
  const decoded = await verifyGoogleSubscription(purchaseToken, productId);

  // 2. Fraud guard: a purchase token must not be linked to a different user.
  // C1 Fix: Handle linkedPurchaseToken (upgrades/downgrades).
  // If the user upgraded, the new token is in purchaseToken, and the old token
  // is in linkedPurchaseToken. We should check both to find the existing row.
  const existingByToken = await SubscriptionModel.findOne({
    $or: [
      { googlePurchaseToken: decoded.purchaseToken },
      ...(decoded.linkedPurchaseToken
        ? [{ googlePurchaseToken: decoded.linkedPurchaseToken }]
        : []),
    ],
  });

  if (existingByToken) {
    if (userId && existingByToken.userId?.toString() !== userId) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'This Google purchase is already linked to another account'
      );
    }
    if (guestId && existingByToken.guestId !== guestId) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'This Google purchase is already linked to another guest account'
      );
    }
  }

  // 3. Map productId → local plan.
  const plan = mapGoogleProductToPlan(decoded.productId);
  if (plan === SUBSCRIPTION_PLAN.FREE) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Unknown or unsupported productId: ${decoded.productId}`
    );
  }

  // 4. Translate Google's subscriptionState into our local status.
  const isActiveState =
    decoded.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' ||
    decoded.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
  if (!isActiveState) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Google subscription is not active (state: ${decoded.subscriptionState})`
    );
  }
  const localStatus =
    decoded.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
      ? SUBSCRIPTION_STATUS.PAST_DUE
      : SUBSCRIPTION_STATUS.ACTIVE;

  // 5. Persist for this user.
  const updated = await SubscriptionModel.upsertForUserOrGuest(
    userId ? new Types.ObjectId(userId) : undefined,
    guestId,
    {
      plan,
      status: localStatus,
      platform: SUBSCRIPTION_PLATFORM.GOOGLE,
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
      gracePeriodEndsAt:
        localStatus === SUBSCRIPTION_STATUS.PAST_DUE && decoded.expiryTime
          ? new Date(decoded.expiryTime)
          : null,
      metadata: {
        acknowledgementState: decoded.acknowledgementState,
        linkedPurchaseToken: decoded.linkedPurchaseToken,
        testPurchase: decoded.testPurchase,
      },
    }
  );

  // 6. Re-process any orphan webhooks.
  reprocessPendingWebhooks(decoded.purchaseToken, 'google').catch(err => {
    console.error('Failed to re-process pending Google webhooks:', err);
  });

  return updated;
};

export const processGoogleWebhook = async (
  rawBody: Buffer | string,
  authorizationHeader: string | undefined
): Promise<GoogleWebhookResult> => {
  return handleGoogleNotification(rawBody, authorizationHeader);
};

const reprocessPendingWebhooks = async (
  externalPurchaseId: string,
  provider: 'apple' | 'google'
) => {
  const pending = await PendingWebhook.find({
    externalPurchaseId,
    provider,
  }).sort({ receivedAt: 1 });

  if (pending.length === 0) return;

  for (const item of pending) {
    try {
      if (provider === 'apple') {
        await handleAppleNotification(item.payload as string);
      } else {
        await handleGoogleNotification(item.payload as Buffer, undefined, true);
      }
      // Delete after successful processing
      await PendingWebhook.findByIdAndDelete(item._id);
    } catch (err) {
      console.error(
        `Failed to re-process pending ${provider} webhook ${item._id}:`,
        err
      );
    }
  }
};

const SubscriptionService = {
  getMySubscription,
  setFreePlan,
  verifyApplePurchase,
  processAppleWebhook,
  verifyGooglePurchase,
  processGoogleWebhook,
  getAllSubscriptions,
  getSubscriptionAnalytics,
  getPendingWebhooks,
  getSubscriptionById,
  getSubscriptionEvents,
  adminGrantPlan,
  adminResetPlan,
};

export default SubscriptionService;
