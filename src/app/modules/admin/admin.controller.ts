import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import ApiError from '../../../errors/ApiError';
import { AdminService } from './admin.service';
import { Content } from '../content/content.model';

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const { range, startDate, endDate } = req.query;
  const result = await AdminService.getAdminDashboardStats(
    range as string,
    startDate as string,
    endDate as string,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Admin dashboard metrics',
    data: result,
  });
});

const getVisitorAnalytics = catchAsync(async (req: Request, res: Response) => {
  const { range, tz, startDate, endDate } = req.query;
  const result = await AdminService.getVisitorAnalyticsData(
    range as string,
    tz as string,
    startDate as string,
    endDate as string,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Visitor analytics retrieved successfully.',
    data: result,
  });
});

const getWatchlistStatus = catchAsync(async (req: Request, res: Response) => {
  const { period, range, startDate, endDate } = req.query;
  const result = await AdminService.getWatchlistStatusBreakdown(
    (period || range) as string,
    startDate as string,
    endDate as string,
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Watchlist status breakdown retrieved successfully',
    data: result,
  });
});

const getSubscriptionsStats = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AdminService.getSubscriptionsStats();
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Subscription stats retrieved successfully',
      data: result,
    });
  },
);

const getAdminSubscriptions = catchAsync(
  async (req: Request, res: Response) => {
    const result = await AdminService.getAdminSubscriptionsList(req.query);
    sendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Subscriptions list fetched',
      meta: result.pagination,
      data: result.data,
    });
  },
);

const getRevenueStats = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getRevenueStats();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Revenue stats retrieved successfully',
    data: result,
  });
});

const getTransactions = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getTransactionsList(req.query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Transactions list fetched',
    meta: result.pagination,
    data: result.data,
  });
});

const getMovieProfile = catchAsync(async (req: Request, res: Response) => {
  const { movieId } = req.params;
  const result = await AdminService.getMovieProfileFromDB(movieId);

  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Movie profile not found');
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Movie profile retrieved',
    data: result,
  });
});

const patchContentBoost = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isPopularSeries } = req.body;

  const content = await Content.findByIdAndUpdate(
    id,
    { isPopularSeries },
    { new: true },
  );

  if (!content) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Content not found');
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: `Content ${isPopularSeries ? 'boosted' : 'unboosted'} successfully`,
    data: content,
  });
});

export const AdminController = {
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
