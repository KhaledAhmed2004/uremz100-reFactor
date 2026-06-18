import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import ApiError from '../../../errors/ApiError';
import { RewardService } from './reward.service';

const getOwnerQuery = (req: Request) => {
  if (req.user?.id) return { user: req.user.id };
  if (req.guestId) return { guestId: req.guestId };
  throw new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized access');
};

const getWalletDetails = catchAsync(async (req: Request, res: Response) => {
  const ownerQuery = getOwnerQuery(req);
  const result = await RewardService.getWalletDetails(ownerQuery);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Wallet details retrieved successfully',
    data: result,
  });
});

const claimWatchTimeReward = catchAsync(async (req: Request, res: Response) => {
  const ownerQuery = getOwnerQuery(req);
  const { videoDuration } = req.body;
  const result = await RewardService.claimWatchTimeReward(ownerQuery, videoDuration);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Watch time reward claimed successfully for ${videoDuration} minutes`,
    data: result,
  });
});

const claimFreshWatchTimeReward = catchAsync(async (req: Request, res: Response) => {
  const ownerQuery = getOwnerQuery(req);
  const { minutes } = req.body;
  const result = await RewardService.claimFreshWatchTimeReward(ownerQuery, minutes);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Fresh drama watch time reward claimed successfully for ${minutes} minutes`,
    data: result,
  });
});

const claimDailyCheckIn = catchAsync(async (req: Request, res: Response) => {
  const ownerQuery = getOwnerQuery(req);
  const result = await RewardService.claimDailyCheckIn(ownerQuery);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Daily check-in reward claimed successfully',
    data: result,
  });
});

const claimTaskReward = catchAsync(async (req: Request, res: Response) => {
  const ownerQuery = getOwnerQuery(req);
  const { taskType } = req.body;

  let result;
  switch (taskType) {
    case 'LOGIN':
      result = await RewardService.claimLoginReward(ownerQuery);
      break;
    case 'NOTIFICATION':
      result = await RewardService.claimNotificationReward(ownerQuery);
      break;
    case 'FACEBOOK':
    case 'INSTAGRAM':
    case 'YOUTUBE':
      result = await RewardService.claimSocialReward(ownerQuery, taskType.toLowerCase());
      break;
    case 'BIND_EMAIL':
      result = await RewardService.claimBindEmailReward(ownerQuery);
      break;
    case 'PROFILE_COMPLETION':
      result = await RewardService.claimProfileCompletionReward(ownerQuery);
      break;
    case 'WATCH_AD':
      result = await RewardService.claimWatchAdReward(ownerQuery);
      break;
    default:
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid task type');
  }

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `${taskType} reward claimed successfully`,
    data: result,
  });
});

export const RewardController = {
  getWalletDetails,
  claimWatchTimeReward,
  claimFreshWatchTimeReward,
  claimDailyCheckIn,
  claimTaskReward,
};
