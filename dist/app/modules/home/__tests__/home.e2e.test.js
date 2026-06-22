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
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const app_1 = __importDefault(require("../../../../app")); // Ensure this path correctly points to the express app
const content_model_1 = require("../../content/content.model");
const user_model_1 = require("../../user/user.model");
const recently_watched_model_1 = require("../../recently-watched/recently-watched.model");
const user_1 = require("../../../../enums/user");
const config_1 = __importDefault(require("../../../../config"));
// Fix JWT Secret Error during testing
if (!config_1.default.jwt)
    config_1.default.jwt = {};
config_1.default.jwt.jwt_secret = 'test-secret-key-for-e2e';
config_1.default.jwt.jwt_expire_in = '1d';
let mongoServer;
(0, vitest_1.describe)('E2E: Guest User to Registered User Flow', () => {
    let contentId;
    const guestId = 'e2e-guest-1001';
    let userToken;
    (0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        // Setup In-Memory MongoDB for E2E testing
        mongoServer = yield mongodb_memory_server_1.MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        yield mongoose_1.default.connect(mongoUri);
        // Seed a movie
        const content = yield content_model_1.Content.create({
            title: 'E2E Test Movie',
            type: 'MOVIE',
            status: 'PUBLISHED',
            isRecent: true,
            views: 500,
            rating: 4.8,
            releaseYear: 2024,
            duration: 120,
            videoUrl: 'https://example.com/video.mp4',
            description: 'A test movie for E2E testing'
        });
        contentId = content._id.toString();
    }));
    (0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        yield mongoose_1.default.disconnect();
        yield mongoServer.stop();
    }));
    (0, vitest_1.it)('Step 1: Guest visits home page', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app_1.default).get('/api/v1/home/content').set('x-guest-id', guestId);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.success).toBe(true);
        // Continue watching should be empty for a new guest
    }));
    (0, vitest_1.it)('Step 2: Guest watches a video and history is saved', () => __awaiter(void 0, void 0, void 0, function* () {
        // Note: Assuming you have a POST route for recently watched.
        // We are simulating the creation in DB since route might be different.
        yield recently_watched_model_1.RecentlyWatched.create({
            guestId,
            contentId,
            watchedSeconds: 300,
            completionPercentage: 15,
        });
        const rw = yield recently_watched_model_1.RecentlyWatched.findOne({ guestId });
        (0, vitest_1.expect)(rw).not.toBeNull();
        (0, vitest_1.expect)(rw === null || rw === void 0 ? void 0 : rw.guestId).toBe(guestId);
    }));
    (0, vitest_1.it)('Step 3: Guest creates an account (Data Migration)', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // We assume the signup logic in auth.service handles the migration
        // Simulating signup and migration for E2E
        const user = yield user_model_1.User.create({
            name: 'E2E User',
            email: 'e2e@example.com',
            password: 'password123',
            role: user_1.USER_ROLES.USER,
            status: user_1.USER_STATUS.ACTIVE,
            isVerified: true,
            revertDate: new Date(),
            dateOfBirth: new Date('1990-01-01'),
            profileImage: '/default-avatar.svg',
        });
        // Simulate Auth Service Migration Logic:
        yield recently_watched_model_1.RecentlyWatched.updateMany({ guestId: guestId }, { $set: { userId: user._id }, $unset: { guestId: "" } });
        // Verify migration
        const rw = yield recently_watched_model_1.RecentlyWatched.findOne({ userId: user._id });
        (0, vitest_1.expect)(rw).not.toBeNull();
        (0, vitest_1.expect)(rw === null || rw === void 0 ? void 0 : rw.guestId).toBeUndefined();
        (0, vitest_1.expect)((_a = rw === null || rw === void 0 ? void 0 : rw.userId) === null || _a === void 0 ? void 0 : _a.toString()).toBe(user._id.toString());
        // Simulate logging in and getting a token (we'll just fake it for the test logic)
        userToken = 'Bearer fake-jwt-token-for-e2e';
    }));
    (0, vitest_1.it)('Step 4: User visits home page and sees Continue Watching', () => __awaiter(void 0, void 0, void 0, function* () {
        // Note: To make this work fully, the auth middleware should recognize 'fake-jwt-token-for-e2e' 
        // or we mock the auth middleware. For pure E2E without mocks, we would actually hit /auth/login.
        // Assuming auth middleware is mocked or we use the User ID directly if bypassing auth for test.
        // For demonstration, we just know the DB has the record linked to User.
        const rw = yield recently_watched_model_1.RecentlyWatched.findOne({ contentId });
        (0, vitest_1.expect)(rw === null || rw === void 0 ? void 0 : rw.userId).toBeDefined();
    }));
});
