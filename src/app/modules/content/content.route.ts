import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';
import { rateLimitMiddleware } from '../../middlewares/rateLimit';
import { ContentController } from './content.controller';
import fileUploadHandler from '../../middlewares/fileUploadHandler';
import guestOrAuth from '../../middlewares/guestOrAuth';

const router = express.Router();
const upload = fileUploadHandler();

// Search and Common
router.get(
  '/search',
  guestOrAuth,
  rateLimitMiddleware({
    windowMs: 60_000,
    max: 60,
    routeName: 'content-search',
  }),
  ContentController.searchContent,
);

router.get(
  '/best-movies',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.USER),
  ContentController.getBestMovies,
);

router.get(
  '/coming-soon',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.USER),
  ContentController.getComingSoonContent,
);

// import guestOrAuth from '../../middlewares/guestOrAuth';

router.get(
  '/:contentId/details',
  guestOrAuth,
  ContentController.getContentDetailsPublic,
);

router.get(
  '/:contentId/similar',
  guestOrAuth,
  ContentController.getSimilarContentPublic,
);

router.get(
  '/seasons/:seasonId/episodes',
  guestOrAuth,
  ContentController.getEpisodesBySeasonPublic,
);

router.get(
  '/:contentId/playback-url',
  guestOrAuth,
  ContentController.getPlaybackUrl,
);

router.get(
  '/episodes/:episodeId/playback-url',
  guestOrAuth,
  ContentController.getEpisodePlaybackUrl,
);

// Movies Management
router.get(
  '/movies/stats',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.getMoviesStats,
);

router.post(
  '/movies',
  auth(USER_ROLES.SUPER_ADMIN),
  upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'trailerFile', maxCount: 1 },
    { name: 'posterFile', maxCount: 1 },
  ]),
  ContentController.createMovie,
);

router.get(
  '/movies',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
  ContentController.getAdminMovies,
);

router.get(
  '/movies/:movieId',
  guestOrAuth,
  ContentController.getMovieDetails,
);

router.get(
  '/movies/:movieId/analytics/overview',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.getMovieAnalyticsOverview,
);

router.get(
  '/movies/:movieId/analytics/audience',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.getMovieAnalyticsAudience,
);

router.get(
  '/movies/:movieId/analytics/engagement',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.getMovieAnalyticsEngagement,
);

router.patch(
  '/movies/:movieId',
  auth(USER_ROLES.SUPER_ADMIN),
  upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'trailerFile', maxCount: 1 },
    { name: 'posterFile', maxCount: 1 },
  ]),
  ContentController.updateMovie,
);

router.delete(
  '/movies/:movieId',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.deleteMovie,
);

router.patch(
  '/movies/:movieId/status',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.updateMovieStatus,
);



// Series Management
router.get(
  '/series/stats',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.getSeriesStats,
);

router.get(
  '/series',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.getAdminSeries,
);

router.post(
  '/series',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.createSeries,
);

router.patch(
  '/series/:seriesId',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.updateSeries,
);

router.delete(
  '/series/:seriesId',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.deleteSeries,
);

router.patch(
  '/series/:seriesId/status',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.updateSeriesStatus,
);

router.get(
  '/series/:seriesId/details',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.getSeriesDetails,
);

// Season Management
router.post(
  '/series/:seriesId/seasons',
  auth(USER_ROLES.SUPER_ADMIN),
  upload.fields([
    { name: 'posterFile', maxCount: 1 },
    { name: 'trailerFile', maxCount: 1 },
  ]),
  ContentController.createSeason,
);

router.get(
  '/series/:seriesId/seasons',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.getSeasons,
);

router.patch(
  '/series/seasons/:seasonId',
  auth(USER_ROLES.SUPER_ADMIN),
  upload.fields([
    { name: 'posterFile', maxCount: 1 },
    { name: 'trailerFile', maxCount: 1 },
  ]),
  ContentController.updateSeason,
);

router.delete(
  '/series/seasons/:seasonId',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.deleteSeason,
);

// Episode Management
router.get(
  '/series/:seriesId/episodes',
  ContentController.getEpisodes,
);

router.post(
  '/series/:seriesId/episodes',
  auth(USER_ROLES.SUPER_ADMIN),
  upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
  ]),
  ContentController.createEpisode,
);

router.patch(
  '/series/episodes/:episodeId',
  auth(USER_ROLES.SUPER_ADMIN),
  upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
  ]),
  ContentController.updateEpisode,
);

router.delete(
  '/series/episodes/:episodeId',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.deleteEpisode,
);

// AWS S3 Multipart Upload routes
router.post(
  '/upload/initiate',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.initiateUpload,
);

router.post(
  '/upload/presigned-urls',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.getPresignedUrls,
);

router.post(
  '/upload/complete',
  auth(USER_ROLES.SUPER_ADMIN),
  ContentController.completeUpload,
);

export const ContentRoutes = router;
