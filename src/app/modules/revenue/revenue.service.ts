import { RevenueTransaction } from './revenue.model';
import { User } from '../user/user.model';
import { Content } from '../content/content.model';
import { Subscription } from '../subscription/subscription.model';
import { SUBSCRIPTION_STATUS } from '../subscription/subscription.interface';
import QueryBuilder from '../../builder/QueryBuilder';

export const getRevenuesData = async (query: Record<string, unknown>) => {
  const now = new Date();
  
  // Start of current month
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Start of previous month
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  // End of previous month (which is start of current month)
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // 1. Total Users
  const totalUsersCurrent = await User.countDocuments();
  const totalUsersPrevious = await User.countDocuments({ createdAt: { $lte: endOfPreviousMonth } });
  
  // 2. Total Content
  const totalContentCurrent = await Content.countDocuments();
  const totalContentPrevious = await Content.countDocuments({ createdAt: { $lte: endOfPreviousMonth } });
  
  // 3. Total Subscribe
  const totalSubscribeCurrent = await Subscription.countDocuments({ status: SUBSCRIPTION_STATUS.ACTIVE });
  const totalSubscribePrevious = await Subscription.countDocuments({ 
    status: SUBSCRIPTION_STATUS.ACTIVE,
    createdAt: { $lte: endOfPreviousMonth } // Approximation, normally track historical statuses
  });

  // 4. Total Revenue
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

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
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

  // 5. Transactions Table with QueryBuilder
  const revenueQuery = new QueryBuilder(
    RevenueTransaction.find().populate('userId', 'email name'),
    query
  )
    .search(['trxId']) // If searching by email, we might need a custom lookup since it's a ref. For now, search by trxId. We can enhance email search if needed.
    .filter()
    .sort()
    .paginate()
    .fields();

  const transactions = await revenueQuery.modelQuery;
  const meta = await revenueQuery.getPaginationInfo();

  // Custom search by email handling (QueryBuilder doesn't easily search populated fields natively without aggregation)
  // If we need email search, we can check if searchTerm exists and find users first.
  let finalTransactions = transactions;
  let finalMeta = meta;

  if (query.searchTerm && typeof query.searchTerm === 'string') {
    const term = query.searchTerm;
    // Check if it's not just matching trxId, maybe we need to match user emails
    const matchingUsers = await User.find({ email: { $regex: term, $options: 'i' } }).select('_id');
    const userIds = matchingUsers.map(u => u._id);
    
    if (userIds.length > 0) {
      // Re-run the query including those user IDs
      const customQuery = new QueryBuilder(
        RevenueTransaction.find({
          $or: [
            { trxId: { $regex: term, $options: 'i' } },
            { userId: { $in: userIds } }
          ]
        }).populate('userId', 'email name'),
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

  return {
    metrics,
    transactions: {
      meta: finalMeta,
      data: finalTransactions
    }
  };
};

export const RevenueService = {
  getRevenuesData
};
