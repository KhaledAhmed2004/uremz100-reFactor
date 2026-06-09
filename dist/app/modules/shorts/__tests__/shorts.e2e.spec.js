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
const jwtHelper_1 = require("../../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../../config"));
const user_1 = require("../../../../enums/user");
const testLogger_1 = require("../../../../helpers/__tests__/testLogger");
const http_status_codes_1 = require("http-status-codes");
let replSet;
function createAuthUser() {
    return __awaiter(this, arguments, void 0, function* (role = user_1.USER_ROLES.BROTHER) {
        const user = yield user_model_1.User.create({
            name: `Test ${role}`,
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
        });
        const token = jwtHelper_1.jwtHelper.createToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 }, config_1.default.jwt.jwt_secret, '1h');
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
(0, vitest_1.describe)('Shorts Module E2E Tests', () => {
    (0, vitest_1.describe)('Get Shorts Feed (GET /api/v1/shorts)', () => {
        (0, vitest_1.it)('successfully retrieves a mix of free contents and movie trailers with cursor pagination', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser();
            // 1. Premium Movie WITHOUT trailer (Should NOT be in shorts)
            yield content_model_1.Content.create({
                title: 'Premium Movie No Trailer',
                description: 'desc',
                type: 'MOVIE',
                status: 'PUBLISHED',
                planStatus: ['MONTHLY'],
                videoUrl: 'http://video.com',
                duration: 120,
                releaseYear: 2024,
            });
            // 2. Premium Movie WITH trailer (Should be in shorts as TRAILER)
            const premiumMovieWithTrailer = yield content_model_1.Content.create({
                title: 'Premium Movie With Trailer',
                description: 'desc',
                type: 'MOVIE',
                status: 'PUBLISHED',
                planStatus: ['MONTHLY'],
                videoUrl: 'http://video.com',
                trailerUrl: 'http://trailer.com/vid1.mp4',
                duration: 120,
                releaseYear: 2024,
            });
            // 3. Free Movie (Should be in shorts as FREE_CONTENT)
            const freeMovie = yield content_model_1.Content.create({
                title: 'Free Movie',
                description: 'desc',
                type: 'MOVIE',
                status: 'PUBLISHED',
                planStatus: ['FREE'],
                videoUrl: 'http://free.com/vid2.mp4',
                duration: 120,
                releaseYear: 2024,
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/shorts?limit=1')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/shorts?limit=1', { headers: { Authorization: `Bearer ${token}` } }, response.body, 'GET-SHORTS-PAGE1', 'User fetches first page of shorts feed');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(1);
            const firstItem = response.body.data[0];
            // Since it sorts by _id descending, the most recently created (freeMovie) should be first
            (0, vitest_1.expect)(firstItem.type).toBe('FREE_CONTENT');
            (0, vitest_1.expect)(firstItem.videoUrl).toBe('http://free.com/vid2.mp4');
            (0, vitest_1.expect)(response.body.meta.hasNextPage).toBe(true);
            (0, vitest_1.expect)(response.body.meta.nextCursor).toBeDefined();
            // Fetch page 2
            const cursor = response.body.meta.nextCursor;
            const responsePage2 = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/shorts?limit=1&cursor=${cursor}`)
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/shorts?limit=1&cursor=${cursor}`, { headers: { Authorization: `Bearer ${token}` } }, responsePage2.body, 'GET-SHORTS-PAGE2', 'User fetches second page of shorts feed using cursor');
            (0, vitest_1.expect)(responsePage2.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(responsePage2.body.data.length).toBe(1);
            const secondItem = responsePage2.body.data[0];
            // Second item should be the trailer
            (0, vitest_1.expect)(secondItem.type).toBe('TRAILER');
            (0, vitest_1.expect)(secondItem.videoUrl).toBe('http://trailer.com/vid1.mp4');
            // ID should have '_trailer' suffix
            (0, vitest_1.expect)(secondItem.id).toBe(`${premiumMovieWithTrailer._id.toString()}_trailer`);
            (0, vitest_1.expect)(responsePage2.body.meta.hasNextPage).toBe(false);
            (0, vitest_1.expect)(responsePage2.body.meta.nextCursor).toBeNull();
        }));
    });
});
