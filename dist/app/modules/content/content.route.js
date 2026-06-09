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
const router = express_1.default.Router();
const upload = (0, fileUploadHandler_1.default)();
// Search and Common
router.get('/search', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60000,
    max: 60,
    routeName: 'content-search',
}), content_controller_1.ContentController.searchContent);
router.get('/best-movies', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), content_controller_1.ContentController.getBestMovies);
router.get('/coming-soon', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), content_controller_1.ContentController.getComingSoonContent);
// Movies Management
router.post('/movies', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'trailerFile', maxCount: 1 },
    { name: 'posterFile', maxCount: 1 },
]), content_controller_1.ContentController.createMovie);
router.get('/movies', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), content_controller_1.ContentController.getAdminMovies);
router.patch('/movies/:movieId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), upload.fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'trailerFile', maxCount: 1 },
    { name: 'posterFile', maxCount: 1 },
]), content_controller_1.ContentController.updateMovie);
router.delete('/movies/:movieId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.deleteMovie);
router.patch('/movies/:movieId/status', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.updateMovieStatus);
// Series Management
router.get('/series', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getAdminSeries);
router.post('/series', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), upload.fields([
    { name: 'trailerFile', maxCount: 1 },
    { name: 'posterFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
]), content_controller_1.ContentController.createSeries);
router.patch('/series/:seriesId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), upload.fields([
    { name: 'trailerFile', maxCount: 1 },
    { name: 'posterFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
]), content_controller_1.ContentController.updateSeries);
router.delete('/series/:seriesId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.deleteSeries);
router.patch('/series/:seriesId/status', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.updateSeriesStatus);
router.get('/series/:seriesId/details', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getSeriesDetails);
// Season Management
router.post('/series/:seriesId/seasons', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), upload.fields([{ name: 'posterFile', maxCount: 1 }]), content_controller_1.ContentController.createSeason);
router.get('/series/:seriesId/seasons', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getSeasons);
router.patch('/series/seasons/:seasonId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), upload.fields([{ name: 'posterFile', maxCount: 1 }]), content_controller_1.ContentController.updateSeason);
router.delete('/series/seasons/:seasonId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.deleteSeason);
// Episode Management
router.get('/series/:seriesId/episodes', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), content_controller_1.ContentController.getEpisodes);
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
