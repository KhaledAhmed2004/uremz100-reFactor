import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { ShortsService } from './shorts.service';

const getShortsFeed = catchAsync(async (req: Request, res: Response) => {
  const cursor = req.query.cursor as string;
  const limit = req.query.limit ? Number(req.query.limit) : 10;

  const result = await ShortsService.getShortsFeed(cursor, limit);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Shorts retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const incrementShortView = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await ShortsService.incrementShortViewInDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'View count incremented successfully',
    data: result,
  });
});

export const ShortsController = {
  getShortsFeed,
  incrementShortView,
};
