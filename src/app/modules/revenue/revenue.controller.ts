import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { RevenueService } from './revenue.service';

const getRevenueStats = catchAsync(async (req: Request, res: Response) => {
  const result = await RevenueService.getRevenueStats();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Revenue stats retrieved successfully',
    data: result,
  });
});

const getRevenueTransactions = catchAsync(async (req: Request, res: Response) => {
  const result = await RevenueService.getRevenueTransactions(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Revenue transactions retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

export const RevenueController = {
  getRevenueStats,
  getRevenueTransactions,
};
