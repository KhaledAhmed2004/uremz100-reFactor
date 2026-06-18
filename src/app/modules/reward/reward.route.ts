import express from 'express';
import auth from '../../middlewares/auth';
import guestOrAuth from '../../middlewares/guestOrAuth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLES } from '../../../enums/user';
import { RewardController } from './reward.controller';
import { RewardValidation } from './reward.validation';

const router = express.Router();

router.get(
  '/wallet',
  guestOrAuth,
  RewardController.getWalletDetails,
);

router.post(
  '/claim/watch-time',
  guestOrAuth,
  validateRequest(RewardValidation.claimWatchTimeRewardZodSchema),
  RewardController.claimWatchTimeReward,
);

router.post(
  '/claim/fresh-watch-time',
  guestOrAuth,
  validateRequest(RewardValidation.claimWatchTimeRewardZodSchema),
  RewardController.claimFreshWatchTimeReward,
);

router.post(
  '/claim/check-in',
  guestOrAuth,
  RewardController.claimDailyCheckIn,
);

router.post(
  '/claim/task',
  guestOrAuth,
  validateRequest(RewardValidation.claimTaskZodSchema),
  RewardController.claimTaskReward,
);

export const RewardRoutes = router;
