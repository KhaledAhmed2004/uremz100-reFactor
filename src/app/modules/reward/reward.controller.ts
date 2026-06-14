import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { RewardService } from './reward.service';

const getWalletDetails = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await RewardService.getWalletDetails(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Wallet details retrieved successfully',
    data: result,
  });
});

const claimWatchTimeReward = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { videoDuration } = req.body;
  const result = await RewardService.claimWatchTimeReward(userId, videoDuration);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Watch time reward claimed successfully for ${videoDuration} minutes`,
    data: result,
  });
});

const claimFreshWatchTimeReward = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { minutes } = req.body;
  const result = await RewardService.claimFreshWatchTimeReward(userId, minutes);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Fresh drama watch time reward claimed successfully for ${minutes} minutes`,
    data: result,
  });
});

const claimDailyCheckIn = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await RewardService.claimDailyCheckIn(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Daily check-in reward claimed successfully',
    data: result,
  });
});

const claimWatchAdReward = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await RewardService.claimWatchAdReward(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Ad reward claimed successfully',
    data: result,
  });
});

const claimNotificationReward = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await RewardService.claimNotificationReward(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Notification reward claimed successfully',
    data: result,
  });
});

const claimSocialReward = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { platform } = req.body; // 'facebook' or 'instagram'
  const result = await RewardService.claimSocialReward(userId, platform);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Social reward claimed successfully for ${platform}`,
    data: result,
  });
});

const claimBindEmailReward = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await RewardService.claimBindEmailReward(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Bind email reward claimed successfully',
    data: result,
  });
});

const claimLoginReward = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await RewardService.claimLoginReward(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Login reward claimed successfully',
    data: result,
  });
});

const claimProfileCompletionReward = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await RewardService.claimProfileCompletionReward(userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Profile completion reward claimed successfully',
    data: result,
  });
});

export const RewardController = {
  getWalletDetails,
  claimWatchTimeReward,
  claimFreshWatchTimeReward,
  claimDailyCheckIn,
  claimWatchAdReward,
  claimNotificationReward,
  claimSocialReward,
  claimBindEmailReward,
  claimLoginReward,
  claimProfileCompletionReward,
};
