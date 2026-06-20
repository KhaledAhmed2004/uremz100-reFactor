"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentController = void 0;
const http_status_1 = __importDefault(require("http-status"));
const catchAsync_1 = __importDefault(require("../../../shared/catchAsync"));
const sendResponse_1 = __importDefault(require("../../../shared/sendResponse"));
const content_service_1 = require("./content.service");
const http_status_codes_1 = require("http-status-codes");
const admin_service_1 = require("../admin/admin.service");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const searchContent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_service_1.ContentService.searchContentFromDB(req.query);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Content searched successfully',
        meta: result.pagination,
        data: result.data,
    });
}));
const favoriteContent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { contentId } = req.params;
    const result = yield content_service_1.ContentService.favoriteContentInDB(user.id, contentId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Content favorited successfully',
        data: result,
    });
}));
const unfavoriteContent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const { contentId } = req.params;
    const result = yield content_service_1.ContentService.unfavoriteContentFromDB(user.id, contentId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Content unfavorited successfully',
        data: result,
    });
}));
const getBestMovies = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_service_1.ContentService.getBestMoviesFromDB();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Best movies retrieved successfully',
        data: result,
    });
}));
const getComingSoonContent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_service_1.ContentService.getComingSoonContentFromDB();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Coming soon content retrieved successfully',
        data: result,
    });
}));
const getMoviesStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_service_1.ContentService.getMoviesStats();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Movies stats retrieved successfully',
        data: result,
    });
}));
const getSeriesStats = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_service_1.ContentService.getSeriesStats();
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Series stats retrieved successfully',
        data: result,
    });
}));
const getAdminMovies = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_service_1.ContentService.getAdminMoviesList(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Movies list fetched',
        meta: result.pagination,
        data: result.data,
    });
}));
const getAdminSeries = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_service_1.ContentService.getAdminSeriesList(req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Series list fetched',
        meta: result.pagination,
        data: result.data,
    });
}));
const getMovieDetails = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_service_1.ContentService.getMovieDetailsFromDB(req.params.movieId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Movie details retrieved successfully',
        data: result,
    });
}));
const getMovieAnalyticsEngagement = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { movieId } = req.params;
    const [engagement] = yield Promise.all([
        admin_service_1.AdminService.getMovieAnalyticsEngagementData(movieId),
        // AdminService.getMovieAnalyticsAudienceData(movieId),
        // AdminService.getMovieAnalyticsRevenueData(movieId),
    ]);
    if (!engagement) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Movie analytics not found');
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Movie analytics engagement retrieved successfully',
        data: {
            engagement,
            // audience,
            // revenue,
        },
    });
}));
const getMovieAnalyticsAudience = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { movieId } = req.params;
    const result = yield admin_service_1.AdminService.getMovieAnalyticsAudienceData(movieId);
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Movie analytics not found');
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Movie analytics audience retrieved successfully',
        data: result,
    });
}));
const getMovieAnalyticsOverview = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { movieId } = req.params;
    const result = yield admin_service_1.AdminService.getMovieAnalyticsOverviewData(movieId);
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Movie analytics not found');
    }
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Movie analytics overview retrieved successfully',
        data: result,
    });
}));
const getSeriesDetails = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_service_1.ContentService.getSeriesDetailsFromDB(req.params.seriesId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Series details retrieved successfully',
        data: result,
    });
}));
const getContentDetailsPublic = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_service_1.ContentService.getContentDetailsPublicFromDB(req.params.contentId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Content details retrieved successfully',
        data: result,
    });
}));
const getPlaybackUrl = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const guestId = req.guestId;
    const result = yield content_service_1.ContentService.generatePlaybackUrl(req.params.contentId, user === null || user === void 0 ? void 0 : user.id, guestId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Playback URL generated successfully',
        data: result,
    });
}));
const getEpisodePlaybackUrl = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    const guestId = req.guestId;
    const result = yield content_service_1.ContentService.generateEpisodePlaybackUrl(req.params.episodeId, user === null || user === void 0 ? void 0 : user.id, guestId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Episode playback URL generated successfully',
        data: result,
    });
}));
const createSeason = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { seriesId } = req.params;
    const payload = Object.assign({}, req.body);
    if (req.files) {
        const files = req.files;
        if (files['posterFile']) {
            payload.posterUrl = files['posterFile'][0].location || files['posterFile'][0].path;
        }
    }
    const result = yield content_service_1.ContentService.createSeasonToDB(seriesId, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Season created successfully',
        data: result,
    });
}));
const getSeasons = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { seriesId } = req.params;
    const result = yield content_service_1.ContentService.getSeasonsBySeriesFromDB(seriesId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Seasons retrieved successfully',
        data: result,
    });
}));
const updateSeason = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { seasonId } = req.params;
    const payload = Object.assign({}, req.body);
    if (req.files) {
        const files = req.files;
        if (files['posterFile']) {
            payload.posterUrl = files['posterFile'][0].location || files['posterFile'][0].path;
        }
    }
    const result = yield content_service_1.ContentService.updateSeasonInDB(seasonId, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Season updated successfully',
        data: result,
    });
}));
const deleteSeason = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { seasonId } = req.params;
    yield content_service_1.ContentService.deleteSeasonFromDB(seasonId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Season deleted successfully',
        data: null,
    });
}));
const getEpisodes = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_service_1.ContentService.getEpisodesFromDB(req.params.seriesId, req.query);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Episodes list fetched',
        meta: result.pagination,
        data: result.data,
    });
}));
const createEpisode = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = Object.assign({}, req.body);
    if (req.files) {
        const files = req.files;
        if (files['videoFile'])
            payload.videoUrl =
                files['videoFile'][0].location || files['videoFile'][0].path;
        if (files['thumbnailFile'])
            payload.thumbnailUrl =
                files['thumbnailFile'][0].location ||
                    files['thumbnailFile'][0].path;
    }
    const result = yield content_service_1.ContentService.createEpisodeToDB(req.params.seriesId, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Episode created successfully',
        data: result,
    });
}));
const updateEpisode = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = Object.assign({}, req.body);
    if (req.files) {
        const files = req.files;
        if (files['videoFile'])
            payload.videoUrl =
                files['videoFile'][0].location || files['videoFile'][0].path;
        if (files['thumbnailFile'])
            payload.thumbnailUrl =
                files['thumbnailFile'][0].location ||
                    files['thumbnailFile'][0].path;
    }
    const result = yield content_service_1.ContentService.updateEpisodeInDB(req.params.episodeId, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Episode updated successfully',
        data: result,
    });
}));
const deleteEpisode = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield content_service_1.ContentService.deleteEpisodeFromDB(req.params.episodeId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Episode deleted successfully',
        data: null,
    });
}));
const createMovie = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = Object.assign({}, req.body);
    // Handle files from fileUploadHandler
    if (req.files) {
        const files = req.files;
        if (files['videoFile'])
            payload.videoUrl = files['videoFile'][0].location || files['videoFile'][0].path;
        if (files['trailerFile'])
            payload.trailerUrl = files['trailerFile'][0].location || files['trailerFile'][0].path;
        if (files['posterFile'])
            payload.posterUrl = files['posterFile'][0].location || files['posterFile'][0].path;
        if (files['thumbnailFile'])
            payload.thumbnailUrl = files['thumbnailFile'][0].location || files['thumbnailFile'][0].path;
    }
    const result = yield content_service_1.ContentService.createMovieToDB(payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Movie created successfully',
        data: result,
    });
}));
const createSeries = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = Object.assign({}, req.body);
    // Handle files from fileUploadHandler
    if (req.files) {
        const files = req.files;
        if (files['trailerFile'])
            payload.trailerUrl =
                files['trailerFile'][0].location || files['trailerFile'][0].path;
        if (files['posterFile'])
            payload.posterUrl =
                files['posterFile'][0].location || files['posterFile'][0].path;
        if (files['thumbnailFile'])
            payload.thumbnailUrl =
                files['thumbnailFile'][0].location ||
                    files['thumbnailFile'][0].path;
    }
    const result = yield content_service_1.ContentService.createSeriesToDB(payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.CREATED,
        message: 'Series created successfully',
        data: result,
    });
}));
const updateSeries = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = Object.assign({}, req.body);
    // Handle files from fileUploadHandler
    if (req.files) {
        const files = req.files;
        if (files['trailerFile'])
            payload.trailerUrl =
                files['trailerFile'][0].location || files['trailerFile'][0].path;
        if (files['posterFile'])
            payload.posterUrl =
                files['posterFile'][0].location || files['posterFile'][0].path;
        if (files['thumbnailFile'])
            payload.thumbnailUrl =
                files['thumbnailFile'][0].location ||
                    files['thumbnailFile'][0].path;
    }
    const result = yield content_service_1.ContentService.updateSeriesInDB(req.params.seriesId, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Series updated successfully',
        data: result,
    });
}));
const deleteSeries = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield content_service_1.ContentService.deleteSeriesFromDB(req.params.seriesId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Series deleted successfully',
        data: null,
    });
}));
const updateSeriesStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield content_service_1.ContentService.updateSeriesStatusInDB(req.params.seriesId, req.body.status);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Series status updated successfully',
        data: result,
    });
}));
const updateMovie = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { movieId } = req.params;
    const payload = Object.assign({}, req.body);
    // Handle files if updated
    if (req.files) {
        const files = req.files;
        if (files['videoFile'])
            payload.videoUrl = files['videoFile'][0].location || files['videoFile'][0].path;
        if (files['trailerFile'])
            payload.trailerUrl = files['trailerFile'][0].location || files['trailerFile'][0].path;
        if (files['posterFile'])
            payload.posterUrl = files['posterFile'][0].location || files['posterFile'][0].path;
        if (files['thumbnailFile'])
            payload.thumbnailUrl = files['thumbnailFile'][0].location || files['thumbnailFile'][0].path;
    }
    const result = yield content_service_1.ContentService.updateMovieInDB(movieId, payload);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Movie updated successfully',
        data: result,
    });
}));
const deleteMovie = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { movieId } = req.params;
    yield content_service_1.ContentService.deleteMovieFromDB(movieId);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Movie deleted',
    });
}));
const updateMovieStatus = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { movieId } = req.params;
    const { status } = req.body;
    const result = yield content_service_1.ContentService.updateMovieStatusInDB(movieId, status);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Movie status updated successfully',
        data: result,
    });
}));
const initiateUpload = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { fileName, contentType } = req.body;
    const result = yield content_service_1.ContentService.initiateMultipartUpload(fileName, contentType);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Upload initiated successfully',
        data: result,
    });
}));
const getPresignedUrls = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { uploadId, key, partNumbers } = req.body;
    const result = yield content_service_1.ContentService.generateMultipartPresignedUrls(uploadId, key, partNumbers);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Presigned URLs generated successfully',
        data: result,
    });
}));
const completeUpload = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { uploadId, key, parts } = req.body;
    const result = yield content_service_1.ContentService.completeMultipartUpload(uploadId, key, parts);
    (0, sendResponse_1.default)(res, {
        success: true,
        statusCode: http_status_codes_1.StatusCodes.OK,
        message: 'Upload completed successfully',
        data: result,
    });
}));
exports.ContentController = {
    searchContent,
    favoriteContent,
    unfavoriteContent,
    getBestMovies,
    getComingSoonContent,
    getMoviesStats,
    getSeriesStats,
    getAdminMovies: getAdminMovies,
    getAdminSeries: getAdminSeries,
    getMovieDetails: getMovieDetails,
    getMovieAnalyticsEngagement,
    getMovieAnalyticsOverview,
    getMovieAnalyticsAudience,
    getSeriesDetails: getSeriesDetails,
    createSeason: createSeason,
    getSeasons: getSeasons,
    updateSeason: updateSeason,
    deleteSeason: deleteSeason,
    getEpisodes: getEpisodes,
    createEpisode: createEpisode,
    updateEpisode: updateEpisode,
    deleteEpisode: deleteEpisode,
    createMovie: createMovie,
    createSeries: createSeries,
    updateSeries: updateSeries,
    deleteSeries: deleteSeries,
    updateSeriesStatus: updateSeriesStatus,
    updateMovie: updateMovie,
    deleteMovie: deleteMovie,
    updateMovieStatus: updateMovieStatus,
    initiateUpload: initiateUpload,
    getPresignedUrls: getPresignedUrls,
    completeUpload: completeUpload,
    getContentDetailsPublic: getContentDetailsPublic,
    getPlaybackUrl: getPlaybackUrl,
    getEpisodePlaybackUrl: getEpisodePlaybackUrl
};
