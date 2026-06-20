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
const recently_watched_model_1 = require("../recently-watched.model");
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
    yield recently_watched_model_1.RecentlyWatched.deleteMany({});
    yield content_model_1.Content.deleteMany({});
    yield user_model_1.User.deleteMany({});
    vitest_1.vi.clearAllMocks();
}));
(0, vitest_1.describe)('Recently Watched E2E Tests', () => {
    (0, vitest_1.describe)('Track Progress (POST /api/v1/recently-watched/track-progress)', () => {
        (0, vitest_1.it)('successfully tracks content progress for a user', () => __awaiter(void 0, void 0, void 0, function* () {
            const { user, token } = yield createAuthUser(user_1.USER_ROLES.USER);
            const content = yield content_model_1.Content.create({
                title: 'Test Movie',
                description: 'desc',
                type: 'MOVIE',
                videoUrl: 'http://video.com',
                duration: 120,
                releaseYear: 2024
            });
            const payload = {
                contentId: content._id.toString(),
                watchedSeconds: 60, // 1 minute watched of a 120 minute movie
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/recently-watched/track-progress')
                .set('Authorization', `Bearer ${token}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/recently-watched/track-progress', { body: payload }, response.body, 'TRACK-PROGRESS', 'User tracks watching progress');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.watchedSeconds).toBe(60);
            // (60s / (120m * 60s)) * 100 = (60 / 7200) * 100 = 0.833... -> rounded to 1
            (0, vitest_1.expect)(response.body.data.completionPercentage).toBe(1);
            (0, vitest_1.expect)(response.body.data.contentId).toBe(content._id.toString());
            // Verify DB
            const dbCheck = yield recently_watched_model_1.RecentlyWatched.findOne({ userId: user._id, contentId: content._id });
            (0, vitest_1.expect)(dbCheck).not.toBeNull();
            (0, vitest_1.expect)(dbCheck === null || dbCheck === void 0 ? void 0 : dbCheck.watchedSeconds).toBe(60);
            // Verify content views incremented
            const contentCheck = yield content_model_1.Content.findById(content._id);
            (0, vitest_1.expect)(contentCheck === null || contentCheck === void 0 ? void 0 : contentCheck.views).toBeGreaterThan(0);
        }));
    });
    (0, vitest_1.describe)('Get Recently Watched (GET /api/v1/recently-watched)', () => {
        (0, vitest_1.it)('successfully retrieves user watch history', () => __awaiter(void 0, void 0, void 0, function* () {
            const { user, token } = yield createAuthUser(user_1.USER_ROLES.USER);
            const content = yield content_model_1.Content.create({
                title: 'Test Movie',
                description: 'desc',
                type: 'MOVIE',
                videoUrl: 'http://video.com',
                duration: 120,
                releaseYear: 2024
            });
            yield recently_watched_model_1.RecentlyWatched.create({
                userId: user._id,
                contentId: content._id,
                watchedSeconds: 500,
                completionPercentage: 20,
                lastWatchedAt: new Date()
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/recently-watched')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/recently-watched', {}, response.body, 'GET-RECENTLY-WATCHED', 'User fetches watch history');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(1);
            (0, vitest_1.expect)(response.body.data[0].contentId.title).toBe('Test Movie');
        }));
    });
});
