import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { HomeService } from './home.service';

const getHomeContent = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const result = await HomeService.getHomeContentFromDB(user?.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Home content retrieved successfully',
    data: result,
  });
});

export const HomeController = {
  getHomeContent,
};
