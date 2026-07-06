"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_1 = require("../../../enums/user");
const rateLimit_1 = require("../../middlewares/rateLimit");
const content_controller_1 = require("./content.controller");
const fileUploadHandler_1 = __importDefault(require("../../middlewares/fileUploadHandler"));
const guestOrAuth_1 = __importDefault(require("../../middlewares/guestOrAuth"));
const router = express_1.default.Router();
const upload = (0, fileUploadHandler_1.default)();
// Search and Common
router.get('/search', guestOrAuth_1.default, (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60000,
    max: 60,
    routeName: 'content-search',
}), content_controller_1.ContentController.searchContent);
router.get('/best-movies', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), content_controller_1.ContentController.getBestMovies);
router.get('/coming-soon', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN, user_1.USER_ROLES.USER), content_controller_1.ContentController.getComingSoonContent);
// import guestOrAuth from '../../middlewares/guestOrAuth';
router.get('/:contentId/details', guestOrAuth_1.default, content_controller_1.ContentController.getContentDetailsPublic);
router.get('/:contentId/similar', guestOrAuth_1.default, content_controller_1.ContentController.getSimilarContentPublic);
router.get('/seasons/:seasonId/episodes', guestOrAuth_1.default, content_controller_1.ContentController.getEpisodesBySeasonPublic);
router.get('/:contentId/playback-url', guestOrAuth_1.default, content_controller_1.ContentController.getPlaybackUrl);
router.get('/episodes/:episodeId/playback-url', guestOrAuth_1.default, content_controller_1.ContentController.getEpisodePlaybackUrl);
router.post('/:contentId/unlock', (0, auth_1.default)(user_1.USER_ROLES.USER), content_controller_1.ContentController.unlockContent);
router.post('/episodes/:episodeId/unlock', (0, auth_1.default)(user_1.USER_ROLES.USER), content_controller_1.ContentController.unlockEpisode);
// Movies Management
router.get('/movies/stats', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getMoviesStats);
router.post('/movies', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'trailerFile', maxCount: 1 },
    { name: 'posterFile', maxCount: 1 },
]), content_controller_1.ContentController.createMovie);
router.get('/movies', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.ADMIN), content_controller_1.ContentController.getAdminMovies);
router.get('/movies/:movieId', guestOrAuth_1.default, content_controller_1.ContentController.getMovieDetails);
router.get('/movies/:movieId/analytics/overview', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getMovieAnalyticsOverview);
router.get('/movies/:movieId/analytics/audience', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getMovieAnalyticsAudience);
router.get('/movies/:movieId/analytics/engagement', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getMovieAnalyticsEngagement);
router.patch('/movies/:movieId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'trailerFile', maxCount: 1 },
    { name: 'posterFile', maxCount: 1 },
]), content_controller_1.ContentController.updateMovie);
router.delete('/movies/:movieId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.deleteMovie);
router.patch('/movies/:movieId/status', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.updateMovieStatus);
// Series Management
router.get('/series/stats', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getSeriesStats);
router.get('/series', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getAdminSeries);
router.post('/series', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.createSeries);
router.patch('/series/:seriesId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.updateSeries);
router.delete('/series/:seriesId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.deleteSeries);
router.patch('/series/:seriesId/status', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.updateSeriesStatus);
router.get('/series/:seriesId/details', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getSeriesDetails);
// Season Management
router.post('/series/:seriesId/seasons', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), upload.fields([
    { name: 'posterFile', maxCount: 1 },
    { name: 'trailerFile', maxCount: 1 },
]), content_controller_1.ContentController.createSeason);
router.get('/series/:seriesId/seasons', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getSeasons);
router.patch('/series/seasons/:seasonId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), upload.fields([
    { name: 'posterFile', maxCount: 1 },
    { name: 'trailerFile', maxCount: 1 },
]), content_controller_1.ContentController.updateSeason);
router.delete('/series/seasons/:seasonId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.deleteSeason);
// Episode Management
router.get('/series/:seriesId/episodes', content_controller_1.ContentController.getEpisodes);
router.get('/series/episodes/:episodeId', content_controller_1.ContentController.getEpisodeDetails);
router.get('/series/episodes/:episodeId/analytics/overview', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getEpisodeAnalyticsOverview);
router.get('/series/episodes/:episodeId/analytics/audience', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getEpisodeAnalyticsAudience);
router.get('/series/episodes/:episodeId/analytics/engagement', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getEpisodeAnalyticsEngagement);
router.post('/series/:seriesId/episodes', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
]), content_controller_1.ContentController.createEpisode);
router.patch('/series/episodes/:episodeId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
]), content_controller_1.ContentController.updateEpisode);
router.delete('/series/episodes/:episodeId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.deleteEpisode);
// AWS S3 Multipart Upload routes
router.post('/upload/initiate', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.initiateUpload);
router.post('/upload/presigned-urls', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getPresignedUrls);
router.post('/upload/complete', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.completeUpload);
exports.ContentRoutes = router;
