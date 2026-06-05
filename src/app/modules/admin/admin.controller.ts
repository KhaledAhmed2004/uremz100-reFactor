import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import ApiError from '../../../errors/ApiError';
import { AdminService } from './admin.service';

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const { range, startDate, endDate } = req.query;
  const result = await AdminService.getAdminDashboardStats(
    range as string,
    startDate as string,
    endDate as string
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
    endDate as string
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
    endDate as string
  );
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Watchlist status breakdown retrieved successfully',
    data: result,
  });
});

const getMoviesStats = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getMoviesStats();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Movies stats retrieved successfully',
    data: result,
  });
});

const getSeriesStats = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getSeriesStats();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Series stats retrieved successfully',
    data: result,
  });
});

const getSubscriptionsStats = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getSubscriptionsStats();
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Subscription stats retrieved successfully',
    data: result,
  });
});
// --- Season Management ---
const getAdminSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const result = await AdminService.getAdminSubscriptionsList(req.query);
  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Subscriptions list fetched',
    pagination: result.pagination,
    data: result.data,
  });
});

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
    pagination: result.pagination,
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

const getMovieAnalyticsOverview = catchAsync(async (req: Request, res: Response) => {
  const { movieId } = req.params;
  const result = await AdminService.getMovieAnalyticsOverviewData(movieId);
  
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Movie analytics not found');
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Movie analytics overview retrieved',
    data: result,
  });
});

const getMovieAnalyticsEngagement = catchAsync(async (req: Request, res: Response) => {
  const { movieId } = req.params;
  const result = await AdminService.getMovieAnalyticsEngagementData(movieId);
  
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Movie analytics not found');
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Movie analytics engagement retrieved',
    data: result,
  });
});

const getMovieAnalyticsAudience = catchAsync(async (req: Request, res: Response) => {
  const { movieId } = req.params;
  const result = await AdminService.getMovieAnalyticsAudienceData(movieId);
  
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Movie analytics not found');
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Movie analytics audience retrieved',
    data: result,
  });
});

const getMovieAnalyticsRevenue = catchAsync(async (req: Request, res: Response) => {
  const { movieId } = req.params;
  const result = await AdminService.getMovieAnalyticsRevenueData(movieId);
  
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Movie analytics not found');
  }

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Movie analytics revenue retrieved',
    data: result,
  });
});




export const AdminController = {
  getDashboardStats,
  getVisitorAnalytics,
  getWatchlistStatus,
  getMoviesStats,
  getSeriesStats,
  getSubscriptionsStats,
  getAdminSubscriptions,
  getRevenueStats,
  getTransactions,
  getMovieProfile,
  getMovieAnalyticsOverview,
  getMovieAnalyticsEngagement,
  getMovieAnalyticsAudience,
  getMovieAnalyticsRevenue,
};
