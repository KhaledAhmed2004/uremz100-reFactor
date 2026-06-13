import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLES } from '../../../enums/user';
import { RewardController } from './reward.controller';
import { RewardValidation } from './reward.validation';

const router = express.Router();

router.get(
  '/wallet',
  auth(USER_ROLES.USER, USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  RewardController.getWalletDetails,
);

router.post(
  '/claim/watch-time',
  auth(USER_ROLES.USER),
  validateRequest(RewardValidation.claimWatchTimeRewardZodSchema),
  RewardController.claimWatchTimeReward,
);

router.post(
  '/claim/fresh-watch-time',
  auth(USER_ROLES.USER),
  validateRequest(RewardValidation.claimWatchTimeRewardZodSchema),
  RewardController.claimFreshWatchTimeReward,
);

router.post(
  '/claim/check-in',
  auth(USER_ROLES.USER),
  RewardController.claimDailyCheckIn,
);

router.post(
  '/claim/ad',
  auth(USER_ROLES.USER),
  RewardController.claimWatchAdReward,
);

router.post(
  '/claim/notification',
  auth(USER_ROLES.USER),
  RewardController.claimNotificationReward,
);

router.post(
  '/claim/social',
  auth(USER_ROLES.USER),
  validateRequest(RewardValidation.claimSocialRewardZodSchema),
  RewardController.claimSocialReward,
);

router.post(
  '/claim/bind-email',
  auth(USER_ROLES.USER),
  RewardController.claimBindEmailReward,
);

router.post(
  '/claim/login-reward',
  auth(USER_ROLES.USER),
  RewardController.claimLoginReward,
);

router.post(
  '/claim/profile',
  auth(USER_ROLES.USER),
  RewardController.claimProfileCompletionReward,
);

export const RewardRoutes = router;
