import express from 'express';
import guestOrAuth from '../../middlewares/guestOrAuth';
import { USER_ROLES } from '../../../enums/user';
import { RecentlyWatchedController } from './recently-watched.controller';

const router = express.Router();

// Tracks user's video watching progress (seconds & percentage) for "Continue Watching" feature.
router.post(
  '/track-progress',
  guestOrAuth,
  RecentlyWatchedController.trackProgress,
);

// Retrieves the list of contents recently watched by the authenticated user.
router.get(
  '/',
  guestOrAuth,
  RecentlyWatchedController.getRecentlyWatched,
);

// Retrieves the progress of a specific content by its ID
router.get(
  '/content/:contentId',
  guestOrAuth,
  RecentlyWatchedController.getProgressByContentId,
);

export const RecentlyWatchedRoutes = router;
