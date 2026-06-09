"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const app_1 = __importDefault(require("../../app"));
const user_model_1 = require("../modules/user/user.model");
const content_model_1 = require("../modules/content/content.model");
const jwtHelper_1 = require("../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../config"));
const user_1 = require("../../enums/user");
const http_status_codes_1 = require("http-status-codes");
const testLogger_1 = require("../../helpers/__tests__/testLogger");
// Increase timeout for E2E tests
vitest_1.vi.setConfig({ testTimeout: 30000 });
let replSet;
let userToken;
let testUserId;
let theMovieId;
let shortsCursor;
let myCollectionId;
let selectedShortId;
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({ replSet: { count: 1 } });
    yield mongoose_1.default.connect(replSet.getUri());
    // 1. Create a User
    const user = yield user_model_1.User.create({
        name: 'E2E Flow User',
        role: user_1.USER_ROLES.BROTHER,
        email: `${(0, crypto_1.randomUUID)()}@test.com`,
        password: 'password123',
        isVerified: true,
        status: user_1.USER_STATUS.ACTIVE,
        revertDate: new Date(),
        dateOfBirth: new Date('1990-01-01'),
        profileImage: '/default.jpg',
        verificationImage: '/img.jpg',
        verificationVideo: '/vid.mp4',
    });
    testUserId = user._id.toString();
    // Initialize Reward Wallet and Progress for the E2E user
    const { Wallet, UserRewardProgress } = yield Promise.resolve().then(() => __importStar(require('../modules/reward/reward.model')));
    yield Wallet.create({ user: user._id, goldBalance: 0, bonusLedger: [] });
    yield UserRewardProgress.create({ user: user._id });
    userToken = jwtHelper_1.jwtHelper.createToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 }, config_1.default.jwt.jwt_secret, '1d');
    // 2. Create some Content
    const movie1 = yield content_model_1.Content.create({
        title: 'Batman The Dark Knight',
        description: 'A great movie',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['FREE'],
        videoUrl: 'http://video.com/batman.mp4',
        poster: 'http://image.com/batman.jpg',
        duration: 120,
        releaseYear: 2008,
        isRecent: true,
        views: 1000,
    });
    theMovieId = movie1._id.toString();
    yield content_model_1.Content.create({
        title: 'Superman Returns',
        description: 'Another great movie',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['MONTHLY'],
        trailerUrl: 'http://trailer.com/superman.mp4',
        videoUrl: 'http://video.com/superman.mp4',
        poster: 'http://image.com/superman.jpg',
        duration: 120,
        releaseYear: 2006,
        isRecent: true,
        views: 500,
    });
    // Create 10 more movies to trigger cursor pagination for limit=10
    for (let i = 0; i < 10; i++) {
        yield content_model_1.Content.create({
            title: `Extra Movie ${i}`,
            description: 'Just to fill the feed',
            type: 'MOVIE',
            status: 'PUBLISHED',
            planStatus: ['FREE'],
            videoUrl: 'http://video.com/extra.mp4',
            poster: 'http://image.com/extra.jpg',
            duration: 120,
            releaseYear: 2020,
            isRecent: true,
            views: 10,
        });
    }
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield replSet.stop();
}));
(0, vitest_1.describe)('Master System Flow E2E Tests', () => {
    (0, vitest_1.describe)('1. Home Page Flow', () => {
        (0, vitest_1.it)('should return search results from the home page search bar', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            console.info(`
📖 DOC: 
When a user searches for a movie from the search bar (e.g., 'Batman'), 
the system queries the content collection to find matches and returns them instantly.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/search?searchTerm=Batman')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/search?searchTerm=Batman', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SEARCH', 'User searches for a movie from home page');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            // The search endpoint might return paginated structure
            const results = ((_a = res.body.data) === null || _a === void 0 ? void 0 : _a.data) || res.body.data;
            (0, vitest_1.expect)(Array.isArray(results)).toBe(true);
            (0, vitest_1.expect)(results.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(results[0].title).toContain('Batman');
        }));
        (0, vitest_1.it)('should load the popular tab successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
The 'Popular' tab on the home screen loads categorized sections (e.g., Trending Now).
Each section contains a list of top-performing content.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=popular')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=popular', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-POPULAR', 'User fetches popular home tab');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.sections).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(res.body.data.sections)).toBe(true);
            // Ensure the trending section is returned
            const trendingSection = res.body.data.sections.find((s) => s.id === 'row_trending_now');
            (0, vitest_1.expect)(trendingSection).toBeDefined();
        }));
        (0, vitest_1.it)('should load the new tab successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
The 'New' tab displays freshly published movies and series, 
helping users easily discover the latest additions to the platform.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=new')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=new', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-NEW', 'User fetches new home tab');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should load the vip tab successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
The 'VIP' tab loads premium content exclusively available to paid subscribers.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=vip')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=vip', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-VIP', 'User fetches vip home tab');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should load the ranking tab successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
The 'Ranking' tab shows leaderboards (e.g., weekly or monthly top charts) 
based on total views and user engagement.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=ranking&filter=weekly')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=ranking&filter=weekly', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-RANKING', 'User fetches ranking home tab');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should fetch the specific watch progress for a selected movie (Option 3 Architecture)', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
When a user clicks on a movie from the search results or a category (not from "Continue Watching"),
the frontend makes a specific request to fetch the user's progress for that single movie.
This allows playback to resume from the exact paused location, independent of the home page feed.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/recently-watched/content/${theMovieId}`)
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/recently-watched/content/${theMovieId}`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SINGLE-PROGRESS', 'User fetches progress for a specific movie');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            // Data will be null if not watched yet, which is expected for theMovieId right now
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
        (0, vitest_1.it)('should track progress for the selected movie to appear in Recently Watched', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
While watching the movie, the app tracks progress. This ensures the movie appears in the "Continue Watching" list.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/recently-watched/track-progress')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                contentId: theMovieId,
                watchedSeconds: 60,
            });
            (0, testLogger_1.logApi)('POST', '/api/v1/recently-watched/track-progress', { headers: { Authorization: `Bearer ${userToken}` }, body: { contentId: theMovieId, watchedSeconds: 60 } }, res.body, 'POST-TRACK-PROGRESS', 'User tracks watch progress for movie');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should return the "Continue Watching" section in the popular tab after tracking progress', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
Because the user just tracked progress for a movie, reloading the Home page (Popular tab)
will now dynamically return the 'Continue Watching' row as the very first section!
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=popular')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=popular', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-CONTINUE-WATCHING', 'User fetches home tab to see continue watching');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const continueWatchingSection = res.body.data.sections.find((s) => s.id === 'row_continue_watching');
            (0, vitest_1.expect)(continueWatchingSection).toBeDefined();
            (0, vitest_1.expect)(continueWatchingSection.items.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(continueWatchingSection.items[0]._id || continueWatchingSection.items[0].id).toBe(theMovieId);
        }));
    });
    (0, vitest_1.describe)('2. Shorts Page & Player Flow', () => {
        (0, vitest_1.describe)('A. Infinite Scrolling (Feed)', () => {
            (0, vitest_1.it)('Step 1: User opens the shorts feed and the first 5 videos are loaded without a cursor', () => __awaiter(void 0, void 0, void 0, function* () {
                var _a;
                console.info(`
📖 DOC: 
When the user first opens the shorts page, a request is made without a cursor. 
The server returns the first batch of videos and a nextCursor to load the subsequent videos.

❓ WHY NO CURSOR?: Because this is the initial page load. 
Without a cursor, the server knows to start fetching from the very beginning (the latest or top videos in the feed). 
The returned nextCursor acts as a pointer for all subsequent scrolling requests.
`);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .get('/api/v1/shorts?limit=5')
                    .set('Authorization', `Bearer ${userToken}`);
                (0, testLogger_1.logApi)('GET', '/api/v1/shorts?limit=5', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SHORTS-P1', 'User fetches shorts page 1');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
                (0, vitest_1.expect)(res.body.data.length).toBeGreaterThan(0);
                // Save cursor for next test
                if ((_a = res.body.meta) === null || _a === void 0 ? void 0 : _a.nextCursor) {
                    shortsCursor = res.body.meta.nextCursor;
                }
                // A real user sees the shorts and its details from the feed response
                const firstShort = res.body.data[0];
                (0, vitest_1.expect)(firstShort.title).toBeDefined();
                (0, vitest_1.expect)(firstShort.videoUrl).toBeDefined();
                // Save the selected short for subsequent actions (play, add to collection)
                selectedShortId = firstShort.contentId || firstShort.id || firstShort._id;
            }));
            (0, vitest_1.it)('Step 2: User scrolls down, triggering a request with the nextCursor to load the next 5 videos', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 DOC: 
As the user scrolls to the bottom, the app uses the previously received nextCursor to fetch the next set of videos. 
This creates an infinite scrolling experience.
`);
                // If no cursor was returned (because total items < 5), we will just pass a dummy or omit it.
                // But to test the endpoint handles it, we will append it if it exists.
                const cursorParam = shortsCursor ? `&cursor=${shortsCursor}` : '';
                const res = yield (0, supertest_1.default)(app_1.default)
                    .get(`/api/v1/shorts?limit=5${cursorParam}`)
                    .set('Authorization', `Bearer ${userToken}`);
                (0, testLogger_1.logApi)('GET', `/api/v1/shorts?limit=5${cursorParam}`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SHORTS-P2', 'User fetches shorts page 2');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
            }));
        });
        (0, vitest_1.describe)('B. Video Playback & Engagement', () => {
            (0, vitest_1.it)('Step 3: User watches a video for 3 seconds and a view is tracked', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 DOC: 
For Shorts, we do not track 'watchedSeconds' or allow resuming because videos are too short.
Instead, we only track the number of views (e.g., when a user watches more than 3 seconds).
`);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post(`/api/v1/shorts/${selectedShortId}/view`)
                    .set('Authorization', `Bearer ${userToken}`);
                (0, testLogger_1.logApi)('POST', `/api/v1/shorts/${selectedShortId}/view`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-TRACK-VIEW', 'User watches short and triggers view count');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
            }));
            (0, vitest_1.it)('Step 4: User likes the video and adds it to their personal My Collection list', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 DOC: 
If the user enjoys the video, they can add it to their personal collection. 
The server saves this relationship so it can be retrieved later in the My List page.
`);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/my-collection')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({
                    itemId: selectedShortId,
                });
                (0, testLogger_1.logApi)('POST', '/api/v1/my-collection', { headers: { Authorization: `Bearer ${userToken}` }, body: { itemId: selectedShortId } }, res.body, 'POST-MY-COLLECTION', 'User adds short to collection');
                if (![200, 201].includes(res.status))
                    console.log('MY COLLECTION POST ERROR:', res.status, res.body);
                (0, vitest_1.expect)([200, 201]).toContain(res.status);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                myCollectionId = res.body.data._id || res.body.data.id;
            }));
        });
    });
    (0, vitest_1.describe)('3. My List Page Flow', () => {
        (0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
            // Seed data to ensure these tests can be run in isolation (e.g. from Vitest UI)
            yield (0, supertest_1.default)(app_1.default).post('/api/v1/recently-watched/track-progress').set('Authorization', `Bearer ${userToken}`).send({
                contentId: theMovieId, watchedSeconds: 60,
            });
            yield (0, supertest_1.default)(app_1.default).post('/api/v1/my-collection').set('Authorization', `Bearer ${userToken}`).send({
                itemId: theMovieId,
            });
        }));
        (0, vitest_1.it)('should show the movie in Recently Watched', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
Step 1: The user navigates to the 'My List' section and opens 'Recently Watched'.
The server retrieves all the content the user has started watching, 
allowing them to easily resume playback right from where they left off.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/recently-watched')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/recently-watched', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-RECENTLY-WATCHED', 'User views recently watched list');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const items = res.body.data.data || res.body.data;
            (0, vitest_1.expect)(Array.isArray(items)).toBe(true);
            (0, vitest_1.expect)(items.length).toBeGreaterThan(0);
            // Ensure the movie we tracked is in the list
            const watchedItem = items.find((item) => { var _a, _b, _c; return ((_a = item.contentId) === null || _a === void 0 ? void 0 : _a.id) === theMovieId || ((_c = (_b = item.contentId) === null || _b === void 0 ? void 0 : _b._id) === null || _c === void 0 ? void 0 : _c.toString()) === theMovieId || item.contentId === theMovieId; });
            if (!watchedItem)
                console.log('RECENTLY WATCHED ITEMS:', JSON.stringify(items, null, 2));
            (0, vitest_1.expect)(watchedItem).toBeDefined();
        }));
        (0, vitest_1.it)('should show the movie in My Collection', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            console.info(`
📖 DOC: 
Step 2: The user switches to the 'My Collection' (or Watchlist) tab.
The server retrieves all the movies, series, and shorts the user has explicitly saved or liked.
This acts as a personal library of favorite content.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/my-collection')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/my-collection', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-MY-COLLECTION', 'User views their collection');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const items = res.body.data || ((_a = res.body.data) === null || _a === void 0 ? void 0 : _a.data);
            (0, vitest_1.expect)(Array.isArray(items)).toBe(true);
            if (items.length === 0)
                console.log('MY COLLECTION GET ITEMS:', JSON.stringify(res.body, null, 2));
            (0, vitest_1.expect)(items.length).toBeGreaterThan(0);
        }));
    });
    (0, vitest_1.describe)('4. Rewards Page Flow', () => {
        (0, vitest_1.it)('should show the initial wallet balance as 0', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
Step 1: The user navigates to the 'Rewards' page.
The server retrieves the user's wallet details, which defaults to 0 upon registration.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/rewards/wallet')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/rewards/wallet', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-WALLET', 'User views their coin wallet');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.goldBalance).toBe(0);
            (0, vitest_1.expect)(res.body.data.bonusBalance).toBe(0);
            (0, vitest_1.expect)(res.body.data.transactions).toEqual([]);
        }));
        (0, vitest_1.it)('should allow the user to claim a daily check-in reward', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
Step 2: The user clicks "Claim" on the Daily Check-In reward.
The server verifies the streak and adds 20 coins to the user's wallet.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/rewards/claim/check-in')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('POST', '/api/v1/rewards/claim/check-in', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-CLAIM-CHECKIN', 'User claims daily check-in reward');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(20);
            (0, vitest_1.expect)(res.body.data.currentStreak).toBe(1);
        }));
        (0, vitest_1.it)('should show the updated wallet balance after claiming a reward', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
Step 3: The Rewards page reloads or the wallet updates instantly.
The server retrieves the updated wallet showing 20 coins and 1 recent transaction.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/rewards/wallet')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/rewards/wallet', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-WALLET-UPDATED', 'User views updated coin wallet');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.goldBalance).toBe(0);
            (0, vitest_1.expect)(res.body.data.bonusBalance).toBe(20);
            (0, vitest_1.expect)(res.body.data.transactions.length).toBe(1);
            (0, vitest_1.expect)(res.body.data.transactions[0].source).toBe('daily_check_in');
            (0, vitest_1.expect)(res.body.data.transactions[0].amount).toBe(20);
        }));
    });
});
