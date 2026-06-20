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
const my_collection_model_1 = require("../my-collection.model");
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
    yield my_collection_model_1.MyCollection.deleteMany({});
    yield content_model_1.Content.deleteMany({});
    yield user_model_1.User.deleteMany({});
    vitest_1.vi.clearAllMocks();
}));
(0, vitest_1.describe)('My Collection E2E Tests', () => {
    (0, vitest_1.describe)('Add to Collection (POST /api/v1/my-collection)', () => {
        (0, vitest_1.it)('successfully adds a movie to user collection', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.USER);
            const content = yield content_model_1.Content.create({
                title: 'Collection Movie',
                description: 'desc',
                type: 'MOVIE',
                videoUrl: 'http://video.com',
                duration: 120,
                releaseYear: 2024
            });
            const payload = {
                itemId: content._id.toString()
            };
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/my-collection')
                .set('Authorization', `Bearer ${token}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/my-collection', { body: payload }, response.body, 'ADD-TO-COLLECTION', 'User adds a movie to collection');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.CREATED);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.itemType).toBe('MOVIE');
            (0, vitest_1.expect)(response.body.data.itemId).toBe(content._id.toString());
        }));
    });
    (0, vitest_1.describe)('Get My Collection (GET /api/v1/my-collection)', () => {
        (0, vitest_1.it)('successfully retrieves user collection with populated items', () => __awaiter(void 0, void 0, void 0, function* () {
            const { user, token } = yield createAuthUser(user_1.USER_ROLES.USER);
            const content = yield content_model_1.Content.create({
                title: 'Saved Movie',
                description: 'desc',
                type: 'MOVIE',
                videoUrl: 'http://video.com',
                duration: 120,
                releaseYear: 2024
            });
            yield my_collection_model_1.MyCollection.create({
                userId: user._id,
                itemType: 'MOVIE',
                itemId: content._id,
                itemModel: 'Content'
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/my-collection')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/my-collection', {}, response.body, 'GET-MY-COLLECTION', 'User fetches their collection');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(1);
            (0, vitest_1.expect)(response.body.data[0].itemId.title).toBe('Saved Movie');
        }));
    });
    (0, vitest_1.describe)('Remove from Collection (DELETE /api/v1/my-collection/:collectionId)', () => {
        (0, vitest_1.it)('successfully removes an item from collection', () => __awaiter(void 0, void 0, void 0, function* () {
            const { user, token } = yield createAuthUser(user_1.USER_ROLES.USER);
            const collectionItem = yield my_collection_model_1.MyCollection.create({
                userId: user._id,
                itemType: 'MOVIE',
                itemId: new mongoose_1.default.Types.ObjectId(),
                itemModel: 'Content'
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/my-collection/${collectionItem._id}`)
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('DELETE', '/api/v1/my-collection/:collectionId', {}, response.body, 'REMOVE-FROM-COLLECTION', 'User removes item from collection');
            (0, vitest_1.expect)(response.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            const dbCheck = yield my_collection_model_1.MyCollection.findById(collectionItem._id);
            (0, vitest_1.expect)(dbCheck).toBeNull();
        }));
    });
});
