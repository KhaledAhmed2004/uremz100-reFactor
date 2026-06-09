import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLES } from '../../../enums/user';
import { RewardController } from './reward.controller';
import { RewardValidation } from './reward.validation';

const router = express.Router();

router.get(
  '/wallet',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH, USER_ROLES.SUPER_ADMIN),
  RewardController.getWalletDetails,
);

router.post(
  '/claim/watch-time',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  validateRequest(RewardValidation.claimWatchTimeRewardZodSchema),
  RewardController.claimWatchTimeReward,
);

router.post(
  '/claim/fresh-watch-time',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  validateRequest(RewardValidation.claimWatchTimeRewardZodSchema),
  RewardController.claimFreshWatchTimeReward,
);

router.post(
  '/claim/check-in',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  RewardController.claimDailyCheckIn,
);

router.post(
  '/claim/ad',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  RewardController.claimWatchAdReward,
);

router.post(
  '/claim/notification',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  RewardController.claimNotificationReward,
);

router.post(
  '/claim/social',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  validateRequest(RewardValidation.claimSocialRewardZodSchema),
  RewardController.claimSocialReward,
);

router.post(
  '/claim/bind-email',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  RewardController.claimBindEmailReward,
);

router.post(
  '/claim/login-reward',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  RewardController.claimLoginReward,
);

router.post(
  '/claim/profile',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  RewardController.claimProfileCompletionReward,
);

export const RewardRoutes = router;
