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
const app_1 = __importDefault(require("../../app"));
const content_model_1 = require("../modules/content/content.model");
const http_status_codes_1 = require("http-status-codes");
const testLogger_1 = require("../../helpers/__tests__/testLogger");
// Increase timeout for E2E tests
vitest_1.vi.setConfig({ testTimeout: 30000 });
let replSet;
let guestId;
let theMovieId;
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({ replSet: { count: 1 } });
    yield mongoose_1.default.connect(replSet.getUri());
    // 1. Generate a unique Guest ID for the test session
    guestId = `guest-${(0, crypto_1.randomUUID)()}`;
    // 2. Create some Content for the Guest to interact with
    const movie1 = yield content_model_1.Content.create({
        title: 'Guest Movie Experience',
        description: 'A great movie for guests',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['FREE'],
        videoUrl: 'http://video.com/guest-movie.mp4',
        posterUrl: 'http://image.com/guest.jpg',
        duration: 120,
        releaseYear: 2024,
        views: 50,
        publishedAt: new Date(),
    });
    theMovieId = movie1._id.toString();
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield replSet.stop();
}));
(0, vitest_1.describe)('Guest User E2E Flow', () => {
    (0, vitest_1.describe)('1. Home Page & Progress Flow', () => {
        (0, vitest_1.it)('should track progress using x-guest-id', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
A guest user starts watching a movie. We track their progress using the 'x-guest-id' header 
since they are not logged in and have no JWT token.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/recently-watched/track-progress')
                .set('x-guest-id', guestId)
                .send({
                contentId: theMovieId,
                watchedSeconds: 45,
            });
            (0, testLogger_1.logApi)('POST', '/api/v1/recently-watched/track-progress', { headers: { 'x-guest-id': guestId }, body: { contentId: theMovieId, watchedSeconds: 45 } }, res.body, 'POST-GUEST-TRACK', 'Guest user tracks watch progress');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should show the "Continue Watching" section in popular tab for guest', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
When the guest visits the home page, the 'Continue Watching' section is personalized 
based on their 'x-guest-id'. The server fetches the progress they made earlier.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=popular')
                .set('x-guest-id', guestId);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=popular', { headers: { 'x-guest-id': guestId } }, res.body, 'GET-GUEST-HOME', 'Guest user fetches home tab with continue watching');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const continueWatchingSection = res.body.data.sections.find((s) => s.id === 'row_continue_watching');
            (0, vitest_1.expect)(continueWatchingSection).toBeDefined();
            (0, vitest_1.expect)(continueWatchingSection.items.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(continueWatchingSection.items[0]._id || continueWatchingSection.items[0].id).toBe(theMovieId);
        }));
    });
    (0, vitest_1.describe)('2. Guest My Collection Flow', () => {
        (0, vitest_1.it)('should add a movie to My Collection for guest', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
Even without an account, guests can add movies to 'My Collection' (Watchlist) 
using their 'x-guest-id'.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/my-collection')
                .set('x-guest-id', guestId)
                .send({
                itemId: theMovieId,
            });
            (0, testLogger_1.logApi)('POST', '/api/v1/my-collection', { headers: { 'x-guest-id': guestId }, body: { itemId: theMovieId } }, res.body, 'POST-GUEST-COLLECTION', 'Guest user adds item to collection');
            (0, vitest_1.expect)([200, 201]).toContain(res.status);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should retrieve My Collection using x-guest-id', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            console.info(`
📖 DOC: 
When the guest visits the 'My Collection' page, their saved items are fetched using their 'x-guest-id'.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/my-collection')
                .set('x-guest-id', guestId);
            (0, testLogger_1.logApi)('GET', '/api/v1/my-collection', { headers: { 'x-guest-id': guestId } }, res.body, 'GET-GUEST-COLLECTION', 'Guest user views collection');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const items = res.body.data || ((_a = res.body.data) === null || _a === void 0 ? void 0 : _a.data);
            (0, vitest_1.expect)(Array.isArray(items)).toBe(true);
            (0, vitest_1.expect)(items.length).toBeGreaterThan(0);
        }));
    });
});
