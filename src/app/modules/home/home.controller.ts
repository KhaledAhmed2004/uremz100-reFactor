import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { HomeService } from './home.service';

const getHomeContent = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const guestId = req.guestId;
  const tab = (req.query.tab as string) || 'popular';
  const filter = (req.query.filter as string) || 'daily';

  const result = await HomeService.getHomeContentFromDB(user?.id, guestId, tab, filter);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `${tab} content retrieved successfully`,
    data: result,
  });
});

export const HomeController = {
  getHomeContent,
};
