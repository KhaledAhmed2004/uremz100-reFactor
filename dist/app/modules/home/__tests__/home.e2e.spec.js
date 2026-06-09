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
const content_model_1 = require("../../content/content.model");
const recently_watched_model_1 = require("../../recently-watched/recently-watched.model");
const jwtHelper_1 = require("../../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../../config"));
const user_1 = require("../../../../enums/user");
const testLogger_1 = require("../../../../helpers/__tests__/testLogger");
const http_status_codes_1 = require("http-status-codes");
let replSet;
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
    vitest_1.vi.clearAllMocks();
}));
(0, vitest_1.describe)('Home Module E2E Tests', () => {
    (0, vitest_1.describe)('Get Home Content (GET /api/v1/home/content)', () => {
        (0, vitest_1.it)('successfully retrieves popular sections using ?tab=popular', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            // 1. Trending Movie (views > 100)
            yield content_model_1.Content.create({
                title: 'Trending Movie',
                description: 'desc',
                type: 'MOVIE',
                videoUrl: 'http://video.com',
                duration: 120,
                releaseYear: 2024,
                views: 150,
                rating: 4.0,
            });
            // 2. Popular Movie
            yield content_model_1.Content.create({
                title: 'Popular Movie',
                description: 'desc',
                type: 'MOVIE',
                videoUrl: 'http://video.com',
                duration: 110,
                releaseYear: 2024,
                views: 90,
                rating: 4.2,
            });
            // 3. Popular Series
            yield content_model_1.Content.create({
                title: 'Popular Series',
                description: 'desc',
                type: 'SERIES',
                videoUrl: 'http://video.com',
                duration: 0,
                releaseYear: 2024,
                isPopularSeries: true,
                views: 80,
                rating: 4.5,
            });
            // 4. Top Pick (rating >= 4.5)
            yield content_model_1.Content.create({
                title: 'Top Pick Content',
                description: 'desc',
                type: 'MOVIE',
                videoUrl: 'http://video.com',
                duration: 130,
                releaseYear: 2024,
                views: 50,
                rating: 4.8,
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=popular')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=popular', { headers: { Authorization: `Bearer ${token}` } }, response.body, 'GET-HOME-CONTENT', 'User fetches popular sections');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.sections).toBeInstanceOf(Array);
            const sections = response.body.data.sections;
            // Verify specific sections exist
            const popularMoviesSection = sections.find((s) => s.id === 'row_popular_movies');
            (0, vitest_1.expect)(popularMoviesSection).toBeDefined();
            (0, vitest_1.expect)(popularMoviesSection.title).toBe('Most Popular Movies');
            (0, vitest_1.expect)(popularMoviesSection.items.length).toBeGreaterThan(0);
            const popularSeriesSection = sections.find((s) => s.id === 'row_popular_series');
            (0, vitest_1.expect)(popularSeriesSection).toBeDefined();
            (0, vitest_1.expect)(popularSeriesSection.title).toBe('Most Popular Series');
            const youMightLikeSection = sections.find((s) => s.id === 'row_you_might_like');
            (0, vitest_1.expect)(youMightLikeSection).toBeDefined();
            const trendingSection = sections.find((s) => s.id === 'row_trending_now');
            (0, vitest_1.expect)(trendingSection).toBeDefined();
        }));
        (0, vitest_1.it)('successfully retrieves popular sections for a guest user using ?tab=popular', () => __awaiter(void 0, void 0, void 0, function* () {
            const guestId = 'e2e-guest-123';
            const content = yield content_model_1.Content.create({
                title: 'Guest Top Pick',
                description: 'desc',
                type: 'MOVIE',
                videoUrl: 'http://video.com',
                duration: 130,
                releaseYear: 2024,
                views: 50,
                rating: 4.8,
            });
            yield recently_watched_model_1.RecentlyWatched.create({
                guestId,
                contentId: content._id,
                watchedSeconds: 120,
                completionPercentage: 50,
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=popular')
                .set('x-guest-id', guestId);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=popular', { headers: { 'x-guest-id': guestId } }, response.body, 'GET-HOME-CONTENT-GUEST', 'Guest user fetches popular sections');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            const sections = response.body.data.sections;
            const continueWatchingSection = sections.find((s) => s.id === 'row_continue_watching');
            (0, vitest_1.expect)(continueWatchingSection).toBeDefined();
            (0, vitest_1.expect)(continueWatchingSection.items.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(continueWatchingSection.items[0].title).toBe('Guest Top Pick');
        }));
        (0, vitest_1.it)('successfully retrieves new sections using ?tab=new', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            yield content_model_1.Content.create({
                title: 'New Coming Soon',
                description: 'desc',
                type: 'MOVIE',
                status: 'DRAFT',
                videoUrl: 'http://video.com',
                duration: 120,
                releaseYear: 2025,
            });
            // New Release
            yield content_model_1.Content.create({
                title: 'New Release Movie',
                description: 'desc',
                type: 'MOVIE',
                status: 'PUBLISHED',
                isRecent: true,
                videoUrl: 'http://video.com',
                duration: 120,
                releaseYear: 2024,
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=new')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=new', { headers: { Authorization: `Bearer ${token}` } }, response.body, 'GET-HOME-CONTENT-NEW', 'User fetches new sections');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            const sections = response.body.data.sections;
            const comingSoonSection = sections.find((s) => s.id === 'row_coming_soon');
            (0, vitest_1.expect)(comingSoonSection).toBeDefined();
            (0, vitest_1.expect)(comingSoonSection.title).toBe('Coming Soon');
            const newReleaseSection = sections.find((s) => s.id === 'row_new_releases');
            (0, vitest_1.expect)(newReleaseSection).toBeDefined();
            (0, vitest_1.expect)(newReleaseSection.title).toBe('New Releases');
        }));
        (0, vitest_1.it)('successfully retrieves vip sections using ?tab=vip', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            yield content_model_1.Content.create({
                title: 'VIP Movie',
                description: 'Premium content',
                type: 'MOVIE',
                videoUrl: 'http://video.com',
                duration: 120,
                releaseYear: 2024,
                isPremium: true,
                rating: 4.9,
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=vip')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=vip', { headers: { Authorization: `Bearer ${token}` } }, response.body, 'GET-HOME-CONTENT-VIP', 'User fetches VIP sections');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            const sections = response.body.data.sections;
            const vipDailySection = sections.find((s) => s.id === 'row_vip_daily');
            (0, vitest_1.expect)(vipDailySection).toBeDefined();
            (0, vitest_1.expect)(vipDailySection.title).toBe("Today's VIP Picks");
            const vipWeeklySection = sections.find((s) => s.id === 'row_vip_weekly');
            (0, vitest_1.expect)(vipWeeklySection).toBeDefined();
            (0, vitest_1.expect)(vipWeeklySection.title).toBe("Weekly VIP Picks");
        }));
        (0, vitest_1.it)('successfully retrieves ranking sections using ?tab=ranking&filter=weekly', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            yield content_model_1.Content.create({
                title: 'Weekly Hit Movie',
                description: 'Hits of the week',
                type: 'MOVIE',
                videoUrl: 'http://video.com',
                duration: 120,
                releaseYear: 2024,
                views: 500,
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=ranking&filter=weekly')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=ranking&filter=weekly', { headers: { Authorization: `Bearer ${token}` } }, response.body, 'GET-HOME-CONTENT-RANKING', 'User fetches weekly ranking sections');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            const sections = response.body.data.sections;
            const rankingSection = sections.find((s) => s.id === 'row_ranking_weekly');
            (0, vitest_1.expect)(rankingSection).toBeDefined();
            (0, vitest_1.expect)(rankingSection.title).toBe('Weekly Rankings');
            (0, vitest_1.expect)(rankingSection.items.length).toBeGreaterThan(0);
        }));
        (0, vitest_1.it)('returns an empty sections array when there is no content matching the tab', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.BROTHER);
            // We do NOT create any Content here, so the DB is empty for this test
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=new')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=new', { headers: { Authorization: `Bearer ${token}` } }, response.body, 'GET-HOME-CONTENT-EMPTY', 'User fetches new sections when empty');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.sections).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.sections.length).toBe(2);
            const sections = response.body.data.sections;
            const comingSoonSection = sections.find((s) => s.id === 'row_coming_soon');
            (0, vitest_1.expect)(comingSoonSection).toBeDefined();
            (0, vitest_1.expect)(comingSoonSection.items).toBeInstanceOf(Array);
            (0, vitest_1.expect)(comingSoonSection.items.length).toBe(0);
            const newReleaseSection = sections.find((s) => s.id === 'row_new_releases');
            (0, vitest_1.expect)(newReleaseSection).toBeDefined();
            (0, vitest_1.expect)(newReleaseSection.items).toBeInstanceOf(Array);
            (0, vitest_1.expect)(newReleaseSection.items.length).toBe(0);
        }));
    });
});
