import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { RevenueService } from './revenue.service';

const getRevenuesData = catchAsync(async (req: Request, res: Response) => {
  const result = await RevenueService.getRevenuesData(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Revenues data retrieved successfully',
    data: result,
  });
});

export const RevenueController = {
  getRevenuesData,
};
