import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { RecentlyWatchedService } from './recently-watched.service';

const trackProgress = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await RecentlyWatchedService.trackProgressInDB(user.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Progress tracked successfully',
    data: result,
  });
});

const getRecentlyWatched = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await RecentlyWatchedService.getRecentlyWatchedFromDB(user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Recently watched content retrieved successfully',
    data: result,
  });
});

export const RecentlyWatchedController = {
  trackProgress,
  getRecentlyWatched,
};
