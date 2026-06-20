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
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = require("crypto");
const mongodb_memory_server_1 = require("mongodb-memory-server");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../../../app"));
const user_model_1 = require("../../user/user.model");
const content_model_1 = require("../content.model");
const genre_model_1 = require("../../genre/genre.model");
const season_model_1 = require("../season.model");
const episode_model_1 = require("../episode.model");
const jwtHelper_1 = require("../../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../../config"));
const user_1 = require("../../../../enums/user");
const testLogger_1 = require("../../../../helpers/__tests__/testLogger");
const http_status_codes_1 = require("http-status-codes");
const content_service_1 = require("../content.service");
// ── Test helpers ─────────────────────────────────────────────────────────────
let replSet;
/** Create an auth user and return its document and a valid JWT. */
function createAuthUser() {
    return __awaiter(this, arguments, void 0, function* (role = user_1.USER_ROLES.SUPER_ADMIN, nameSuffix = 'admin') {
        const user = yield user_model_1.User.create({
            name: `Test ${role} ${nameSuffix}`,
            role,
            email: `${(0, crypto_1.randomUUID)()}@test.com`,
            password: 'password123',
            isVerified: true,
            status: user_1.USER_STATUS.ACTIVE,
            revertDate: new Date(),
            dateOfBirth: new Date('1990-01-01'),
            profileImage: '/default-avatar.svg',
            verificationImage: 'https://example.com/img.jpg',
            verificationVideo: 'https://example.com/vid.mp4',
            tokenVersion: 0,
        });
        const token = jwtHelper_1.jwtHelper.createToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion }, config_1.default.jwt.jwt_secret, '1h');
        return { user, token };
    });
}
// ── Lifecycle ────────────────────────────────────────────────────────────────
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({ replSet: { count: 1 } });
    yield mongoose_1.default.connect(replSet.getUri());
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield replSet.stop();
}));
(0, vitest_1.beforeEach)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield content_model_1.Content.deleteMany({});
    yield user_model_1.User.deleteMany({});
    yield genre_model_1.Genre.deleteMany({});
    yield season_model_1.Season.deleteMany({});
    yield episode_model_1.Episode.deleteMany({});
    vitest_1.vi.clearAllMocks();
}));
// ── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Content E2E Tests', () => {
    (0, vitest_1.describe)('Search Content (GET /api/v1/contents/search)', () => {
        (0, vitest_1.it)('successfully retrieves content based on search query', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            yield content_model_1.Content.create({
                title: 'Inception',
                description: 'A mind-bending thriller',
                type: 'MOVIE',
                status: 'PUBLISHED',
                releaseYear: 2010,
                duration: 148,
                videoUrl: 'http://video.com',
                posterUrl: 'http://poster.jpg'
            });
            yield content_model_1.Content.create({
                title: 'Interstellar',
                description: 'Space exploration',
                type: 'MOVIE',
                status: 'PUBLISHED',
                releaseYear: 2014,
                duration: 169,
                videoUrl: 'http://video2.com'
            });
            const queryParams = { searchTerm: 'Inception' };
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/search')
                .query(queryParams)
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/search', { query: queryParams }, response.body, 'GET-CONTENT-SEARCH', 'Search content by title');
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(1);
            (0, vitest_1.expect)(response.body.data[0].title).toBe('Inception');
        }));
    });
    (0, vitest_1.describe)('Get Best Movies (GET /api/v1/contents/best-movies)', () => {
        (0, vitest_1.it)('successfully retrieves top rated movies', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            yield content_model_1.Content.create({ title: 'Bad Movie', description: 'desc', releaseYear: 2020, duration: 120, videoUrl: 'url', type: 'MOVIE', rating: 2, status: 'PUBLISHED' });
            yield content_model_1.Content.create({ title: 'Good Movie', description: 'desc', releaseYear: 2020, duration: 120, videoUrl: 'url', type: 'MOVIE', rating: 8, status: 'PUBLISHED' });
            yield content_model_1.Content.create({ title: 'Best Movie', description: 'desc', releaseYear: 2020, duration: 120, videoUrl: 'url', type: 'MOVIE', rating: 10, status: 'PUBLISHED' });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/best-movies')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/best-movies', {}, response.body, 'GET-BEST-MOVIES', 'Fetch top rated movies');
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(3);
            // Ensure the highest rating is first
            (0, vitest_1.expect)(response.body.data[0].title).toBe('Best Movie');
        }));
    });
    (0, vitest_1.describe)('Get Coming Soon Content (GET /api/v1/contents/coming-soon)', () => {
        (0, vitest_1.it)('successfully retrieves upcoming content based on future release date', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const now = new Date();
            const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            const lastYear = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            yield content_model_1.Content.create({ title: 'Old Movie', description: 'desc', releaseYear: 2020, duration: 120, videoUrl: 'url', type: 'MOVIE', releaseDate: lastYear, status: 'PUBLISHED' });
            yield content_model_1.Content.create({ title: 'Upcoming Movie', description: 'desc', releaseYear: 2020, duration: 120, videoUrl: 'url', type: 'MOVIE', releaseDate: nextYear, status: 'PUBLISHED' });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/coming-soon')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/coming-soon', {}, response.body, 'GET-COMING-SOON', 'Fetch upcoming movies');
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(1);
            (0, vitest_1.expect)(response.body.data[0].title).toBe('Upcoming Movie');
        }));
    });
    (0, vitest_1.describe)('Admin Movie Management', () => {
        (0, vitest_1.it)('successfully creates a movie (POST /api/v1/contents/movies)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const genre = yield genre_model_1.Genre.create({ name: 'Action' });
            const payload = {
                title: 'New Movie',
                description: 'Action packed',
                genres: [genre._id.toString()],
                duration: 120,
                releaseYear: 2024,
                videoUrl: 'http://video.com',
                availability: ['FREE'],
                isDraft: false
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/contents/movies')
                .set('Authorization', `Bearer ${token}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/contents/movies', { body: payload }, response.body, 'CREATE-MOVIE', 'Admin creates a movie');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.CREATED);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.title).toBe('New Movie');
            (0, vitest_1.expect)(response.body.data.type).toBe('MOVIE');
        }));
        (0, vitest_1.it)('successfully fetches admin movies list (GET /api/v1/contents/movies)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            yield content_model_1.Content.create({ title: 'Movie 1', description: 'desc', duration: 120, releaseYear: 2024, type: 'MOVIE', videoUrl: 'url' });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/movies')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/movies', {}, response.body, 'GET-ADMIN-MOVIES', 'Admin fetches movies list');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(1);
        }));
        (0, vitest_1.it)('successfully updates a movie (PATCH /api/v1/contents/movies/:movieId)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const movie = yield content_model_1.Content.create({ title: 'Old Title', description: 'desc', duration: 120, releaseYear: 2024, type: 'MOVIE', videoUrl: 'url' });
            const payload = { title: 'Updated Title' };
            const response = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/contents/movies/${movie._id}`)
                .set('Authorization', `Bearer ${token}`)
                .send(payload);
            (0, testLogger_1.logApi)('PATCH', '/api/v1/contents/movies/:movieId', { body: payload }, response.body, 'UPDATE-MOVIE', 'Admin updates a movie');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.title).toBe('Updated Title');
        }));
        (0, vitest_1.it)('successfully deletes a movie (DELETE /api/v1/contents/movies/:movieId)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const movie = yield content_model_1.Content.create({ title: 'To Delete', description: 'desc', duration: 120, releaseYear: 2024, type: 'MOVIE', videoUrl: 'url' });
            const response = yield (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/contents/movies/${movie._id}`)
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('DELETE', '/api/v1/contents/movies/:movieId', {}, response.body, 'DELETE-MOVIE', 'Admin deletes a movie');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            const dbCheck = yield content_model_1.Content.findById(movie._id);
            (0, vitest_1.expect)(dbCheck).toBeNull();
        }));
        (0, vitest_1.it)('successfully updates movie status (PATCH /api/v1/contents/movies/:movieId/status)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const movie = yield content_model_1.Content.create({ title: 'Status Movie', description: 'desc', duration: 120, releaseYear: 2024, type: 'MOVIE', videoUrl: 'url', status: 'DRAFT' });
            const response = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/contents/movies/${movie._id}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'PUBLISHED' });
            (0, testLogger_1.logApi)('PATCH', '/api/v1/contents/movies/:movieId/status', { body: { status: 'PUBLISHED' } }, response.body, 'UPDATE-MOVIE-STATUS', 'Admin updates movie status');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.status).toBe('PUBLISHED');
        }));
    });
    (0, vitest_1.describe)('Admin Series Management', () => {
        (0, vitest_1.it)('successfully creates a series (POST /api/v1/contents/series)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const genre = yield genre_model_1.Genre.create({ name: 'Sci-Fi' });
            const payload = {
                title: 'New Series',
                description: 'Epic journey',
                genres: [genre._id.toString()],
                releaseYear: 2024,
                availability: ['MONTHLY'],
                isDraft: false
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/contents/series')
                .set('Authorization', `Bearer ${token}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/contents/series', { body: payload }, response.body, 'CREATE-SERIES', 'Admin creates a series');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.CREATED);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.title).toBe('New Series');
            (0, vitest_1.expect)(response.body.data.type).toBe('SERIES');
        }));
        (0, vitest_1.it)('successfully fetches admin series list (GET /api/v1/contents/series)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            yield content_model_1.Content.create({ title: 'Series 1', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES' });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/series')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/series', {}, response.body, 'GET-ADMIN-SERIES', 'Admin fetches series list');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(1);
        }));
        (0, vitest_1.it)('successfully fetches series details (GET /api/v1/contents/series/:seriesId/details)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const series = yield content_model_1.Content.create({ title: 'Detailed Series', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES' });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/series/${series._id}/details`)
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/series/:seriesId/details', {}, response.body, 'GET-SERIES-DETAILS', 'Admin fetches series details');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.title).toBe('Detailed Series');
            (0, vitest_1.expect)(response.body.data.seasons).toBeInstanceOf(Array);
        }));
        (0, vitest_1.it)('successfully updates series status (PATCH /api/v1/contents/series/:seriesId/status)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const series = yield content_model_1.Content.create({ title: 'Status Series', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES', status: 'DRAFT' });
            const response = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/contents/series/${series._id}/status`)
                .set('Authorization', `Bearer ${token}`)
                .send({ status: 'PUBLISHED' });
            (0, testLogger_1.logApi)('PATCH', '/api/v1/contents/series/:seriesId/status', { body: { status: 'PUBLISHED' } }, response.body, 'UPDATE-SERIES-STATUS', 'Admin updates series status');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.status).toBe('PUBLISHED');
        }));
    });
    (0, vitest_1.describe)('Season Management', () => {
        (0, vitest_1.it)('successfully creates a season (POST /api/v1/contents/series/:seriesId/seasons)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const series = yield content_model_1.Content.create({ title: 'Series', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES' });
            const payload = {
                title: 'Season 1',
                seasonNumber: 1,
                posterUrl: 'http://poster.jpg'
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/contents/series/${series._id}/seasons`)
                .set('Authorization', `Bearer ${token}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/contents/series/:seriesId/seasons', { body: payload }, response.body, 'CREATE-SEASON', 'Admin creates a season');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.CREATED);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.title).toBe('Season 1');
        }));
        (0, vitest_1.it)('successfully fetches seasons (GET /api/v1/contents/series/:seriesId/seasons)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const series = yield content_model_1.Content.create({ title: 'Series', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES' });
            yield season_model_1.Season.create({ title: 'Season 1', seasonNumber: 1, seriesId: series._id, posterUrl: 'url' });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/series/${series._id}/seasons`)
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/series/:seriesId/seasons', {}, response.body, 'GET-SEASONS', 'Admin fetches seasons');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(1);
        }));
    });
    (0, vitest_1.describe)('Episode Management', () => {
        (0, vitest_1.it)('successfully creates an episode (POST /api/v1/contents/series/:seriesId/episodes)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const series = yield content_model_1.Content.create({ title: 'Series', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES' });
            const season = yield season_model_1.Season.create({ title: 'Season 1', seasonNumber: 1, seriesId: series._id, posterUrl: 'url' });
            const payload = {
                title: 'Episode 1',
                description: 'First episode',
                videoUrl: 'http://video.com',
                thumbnailUrl: 'http://thumb.jpg',
                duration: 45,
                releaseDate: new Date(),
                seasonId: season._id.toString(),
                seasonNumber: 1,
                episodeNumber: 1,
                availability: 'FREE'
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/contents/series/${series._id}/episodes`)
                .set('Authorization', `Bearer ${token}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/contents/series/:seriesId/episodes', { body: payload }, response.body, 'CREATE-EPISODE', 'Admin creates an episode');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.CREATED);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.title).toBe('Episode 1');
        }));
        (0, vitest_1.it)('successfully fetches episodes (GET /api/v1/contents/series/:seriesId/episodes)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const series = yield content_model_1.Content.create({ title: 'Series', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES' });
            const season = yield season_model_1.Season.create({ title: 'Season 1', seasonNumber: 1, seriesId: series._id, posterUrl: 'url' });
            yield episode_model_1.Episode.create({
                title: 'Episode 1',
                description: 'desc',
                videoUrl: 'url',
                thumbnailUrl: 'url',
                duration: 45,
                releaseDate: new Date(),
                seriesId: series._id,
                seasonId: season._id,
                seasonNumber: 1,
                episodeNumber: 1
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/series/${series._id}/episodes`)
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/series/:seriesId/episodes', {}, response.body, 'GET-EPISODES', 'Admin fetches episodes');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(1);
        }));
    });
    (0, vitest_1.describe)('Multipart Upload Management', () => {
        (0, vitest_1.it)('successfully initiates a multipart upload (POST /api/v1/contents/upload/initiate)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const payload = { fileName: 'test.mp4', contentType: 'video/mp4' };
            vitest_1.vi.spyOn(content_service_1.ContentService, 'initiateMultipartUpload').mockResolvedValueOnce({
                uploadId: 'test-upload-id',
                key: 'movies/test.mp4'
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/contents/upload/initiate')
                .set('Authorization', `Bearer ${token}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/contents/upload/initiate', { body: payload }, response.body, 'UPLOAD-INITIATE', 'Admin initiates multipart upload');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.uploadId).toBe('test-upload-id');
            (0, vitest_1.expect)(response.body.data.key).toBe('movies/test.mp4');
        }));
        (0, vitest_1.it)('successfully generates presigned URLs (POST /api/v1/contents/upload/presigned-urls)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const payload = { uploadId: 'test-upload-id', key: 'movies/test.mp4', partNumbers: [1, 2] };
            vitest_1.vi.spyOn(content_service_1.ContentService, 'generateMultipartPresignedUrls').mockResolvedValueOnce([
                { partNumber: 1, url: 'http://presigned.url/part1' },
                { partNumber: 2, url: 'http://presigned.url/part2' }
            ]);
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/contents/upload/presigned-urls')
                .set('Authorization', `Bearer ${token}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/contents/upload/presigned-urls', { body: payload }, response.body, 'UPLOAD-PRESIGNED', 'Admin gets presigned URLs');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(2);
            (0, vitest_1.expect)(response.body.data[0].url).toBe('http://presigned.url/part1');
        }));
        (0, vitest_1.it)('successfully completes a multipart upload (POST /api/v1/contents/upload/complete)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const payload = {
                uploadId: 'test-upload-id',
                key: 'movies/test.mp4',
                parts: [{ ETag: 'etag1', PartNumber: 1 }]
            };
            vitest_1.vi.spyOn(content_service_1.ContentService, 'completeMultipartUpload').mockResolvedValueOnce({
                location: 'http://bunnycdn.url/movies/test.mp4',
                key: 'movies/test.mp4'
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/contents/upload/complete')
                .set('Authorization', `Bearer ${token}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/contents/upload/complete', { body: payload }, response.body, 'UPLOAD-COMPLETE', 'Admin completes multipart upload');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.location).toBe('http://bunnycdn.url/movies/test.mp4');
        }));
    });
});
