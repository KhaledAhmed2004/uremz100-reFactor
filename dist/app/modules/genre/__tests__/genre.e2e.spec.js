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
const genre_model_1 = require("../genre.model");
const jwtHelper_1 = require("../../../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../../../config"));
const user_1 = require("../../../../enums/user");
const testLogger_1 = require("../../../../helpers/__tests__/testLogger");
// ── Mocks ────────────────────────────────────────────────────────────────────
vitest_1.vi.mock('../../content/content.model', () => ({
    Content: {
        countDocuments: vitest_1.vi.fn().mockResolvedValue(0),
    },
}));
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
    yield genre_model_1.Genre.deleteMany({});
    yield user_model_1.User.deleteMany({});
    vitest_1.vi.clearAllMocks();
}));
// ── Tests ────────────────────────────────────────────────────────────────────
(0, vitest_1.describe)('Genre E2E Tests', () => {
    (0, vitest_1.describe)('Create Genre (POST /api/v1/genres)', () => {
        (0, vitest_1.it)('allows SUPER_ADMIN to create a genre', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const payload = { name: 'Action', description: 'Action movies' };
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/genres')
                .set('Authorization', `Bearer ${token}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/genres', { body: payload }, response.body, 'CREATE-GENRE', 'SUPER_ADMIN creates a new genre');
            (0, vitest_1.expect)(response.status).toBe(201);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.name).toBe(payload.name);
            (0, vitest_1.expect)(response.body.data.description).toBe(payload.description);
            (0, vitest_1.expect)(response.body.data.id).toBeDefined();
            const dbCheck = yield genre_model_1.Genre.findById(response.body.data.id);
            (0, vitest_1.expect)(dbCheck).not.toBeNull();
            (0, vitest_1.expect)(dbCheck === null || dbCheck === void 0 ? void 0 : dbCheck.name).toBe(payload.name);
        }));
    });
    (0, vitest_1.describe)('Get All Genres (GET /api/v1/genres)', () => {
        (0, vitest_1.it)('successfully retrieves all genres with pagination and count', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            yield genre_model_1.Genre.create({ name: 'Horror', description: 'Scary stuff' });
            yield genre_model_1.Genre.create({ name: 'Romance' });
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/genres')
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/genres', {}, response.body, 'GET-GENRES', 'Fetch all genres');
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(2);
            (0, vitest_1.expect)(response.body.data[0].contentCount).toBeDefined();
        }));
        (0, vitest_1.it)('successfully filters genres by searchTerm (name and description)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            yield genre_model_1.Genre.create({ name: 'Action', description: 'Explosions and car chases' });
            yield genre_model_1.Genre.create({ name: 'Comedy', description: 'Funny and hilarious' });
            yield genre_model_1.Genre.create({ name: 'Drama', description: 'Serious storytelling' });
            const queryParams = { searchTerm: 'Explosions' };
            const response = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/genres')
                .query(queryParams)
                .set('Authorization', `Bearer ${token}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/genres', { query: queryParams }, response.body, 'GET-GENRES-SEARCH', 'Search genres by description');
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data).toBeInstanceOf(Array);
            (0, vitest_1.expect)(response.body.data.length).toBe(1);
            (0, vitest_1.expect)(response.body.data[0].name).toBe('Action');
        }));
    });
    (0, vitest_1.describe)('Update Genre (PATCH /api/v1/genres/:genreId)', () => {
        (0, vitest_1.it)('allows SUPER_ADMIN to update a genre', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const genre = yield genre_model_1.Genre.create({ name: 'OldName' });
            const payload = { name: 'NewName' };
            const response = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/genres/${genre._id}`)
                .set('Authorization', `Bearer ${token}`)
                .send(payload);
            (0, testLogger_1.logApi)('PATCH', '/api/v1/genres/:genreId', { params: { genreId: genre._id }, body: payload }, response.body, 'UPDATE-GENRE', 'SUPER_ADMIN updates a genre');
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.data.name).toBe('NewName');
            const dbCheck = yield genre_model_1.Genre.findById(genre._id);
            (0, vitest_1.expect)(dbCheck === null || dbCheck === void 0 ? void 0 : dbCheck.name).toBe('NewName');
        }));
    });
    (0, vitest_1.describe)('Bulk Delete Genres (DELETE /api/v1/genres)', () => {
        (0, vitest_1.it)('returns 200 when all provided IDs are successfully deleted', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const genre1 = yield genre_model_1.Genre.create({ name: 'Horror' });
            const genre2 = yield genre_model_1.Genre.create({ name: 'Comedy' });
            const genre3 = yield genre_model_1.Genre.create({ name: 'Thriller' });
            const ids = [genre1._id.toString(), genre2._id.toString(), genre3._id.toString()];
            const response = yield (0, supertest_1.default)(app_1.default)
                .delete('/api/v1/genres')
                .set('Authorization', `Bearer ${token}`)
                .send({ ids });
            (0, testLogger_1.logApi)('DELETE', '/api/v1/genres', { body: { ids } }, response.body, 'BULK-DELETE-ALL-SUCCESS', 'SUPER_ADMIN bulk deletes all 3 genres');
            (0, vitest_1.expect)(response.status).toBe(200);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.message).toBe('Genres deleted successfully');
            (0, vitest_1.expect)(response.body.data.deletedCount).toBe(3);
            (0, vitest_1.expect)(response.body.data.failedCount).toBe(0);
            (0, vitest_1.expect)(response.body.data.deletedIds).toHaveLength(3);
            (0, vitest_1.expect)(response.body.data.failed).toHaveLength(0);
            const remaining = yield genre_model_1.Genre.countDocuments({ _id: { $in: ids } });
            (0, vitest_1.expect)(remaining).toBe(0);
        }));
        (0, vitest_1.it)('returns 207 when some IDs exist and some do not (partial success)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const genre1 = yield genre_model_1.Genre.create({ name: 'Action' });
            const genre2 = yield genre_model_1.Genre.create({ name: 'Drama' });
            const fakeId = new mongoose_1.default.Types.ObjectId().toString();
            const ids = [genre1._id.toString(), fakeId, genre2._id.toString()];
            const response = yield (0, supertest_1.default)(app_1.default)
                .delete('/api/v1/genres')
                .set('Authorization', `Bearer ${token}`)
                .send({ ids });
            (0, testLogger_1.logApi)('DELETE', '/api/v1/genres', { body: { ids } }, response.body, 'BULK-DELETE-PARTIAL', 'SUPER_ADMIN bulk deletes with 1 missing ID → 207 expected');
            (0, vitest_1.expect)(response.status).toBe(207);
            (0, vitest_1.expect)(response.body.success).toBe(true);
            (0, vitest_1.expect)(response.body.message).toBe('Bulk delete partially completed');
            (0, vitest_1.expect)(response.body.data.deletedCount).toBe(2);
            (0, vitest_1.expect)(response.body.data.failedCount).toBe(1);
            (0, vitest_1.expect)(response.body.data.deletedIds).toHaveLength(2);
            (0, vitest_1.expect)(response.body.data.failed).toHaveLength(1);
            (0, vitest_1.expect)(response.body.data.failed[0].id).toBe(fakeId);
            (0, vitest_1.expect)(response.body.data.failed[0].reason).toBe('NOT_FOUND');
        }));
        (0, vitest_1.it)('returns 404 when none of the provided IDs exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const { token } = yield createAuthUser(user_1.USER_ROLES.SUPER_ADMIN);
            const fakeId1 = new mongoose_1.default.Types.ObjectId().toString();
            const fakeId2 = new mongoose_1.default.Types.ObjectId().toString();
            const ids = [fakeId1, fakeId2];
            const response = yield (0, supertest_1.default)(app_1.default)
                .delete('/api/v1/genres')
                .set('Authorization', `Bearer ${token}`)
                .send({ ids });
            (0, testLogger_1.logApi)('DELETE', '/api/v1/genres', { body: { ids } }, response.body, 'BULK-DELETE-ALL-FAILED', 'SUPER_ADMIN bulk deletes with all invalid IDs → 404 expected');
            (0, vitest_1.expect)(response.status).toBe(404);
            (0, vitest_1.expect)(response.body.success).toBe(false);
            (0, vitest_1.expect)(response.body.data.deletedCount).toBe(0);
            (0, vitest_1.expect)(response.body.data.failedCount).toBe(2);
        }));
    });
});
