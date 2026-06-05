import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';
import { RecentlyWatchedController } from './recently-watched.controller';

const router = express.Router();

// Tracks user's video watching progress (seconds & percentage) for "Continue Watching" feature.
router.post(
  '/track-progress',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  RecentlyWatchedController.trackProgress,
);

// Retrieves the list of contents recently watched by the authenticated user.
router.get(
  '/',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  RecentlyWatchedController.getRecentlyWatched,
);

export const RecentlyWatchedRoutes = router;
