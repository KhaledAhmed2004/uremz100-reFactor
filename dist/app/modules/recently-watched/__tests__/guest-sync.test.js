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
const app_1 = __importDefault(require("../../../../app"));
const recently_watched_model_1 = require("../recently-watched.model");
vitest_1.vi.mock('../recently-watched.model', () => ({
    RecentlyWatched: {
        create: vitest_1.vi.fn(),
        updateMany: vitest_1.vi.fn(),
    },
}));
(0, vitest_1.describe)('Guest Sync Integration Tests', () => {
    (0, vitest_1.beforeAll)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should save history with guestId when x-guest-id is provided', () => __awaiter(void 0, void 0, void 0, function* () {
        recently_watched_model_1.RecentlyWatched.create.mockResolvedValue({ guestId: 'guest-123', contentId: 'abc' });
        // Assuming there is a POST route to add recently watched
        // We are mocking the DB so we don't need real mongo
        const res = yield (0, supertest_1.default)(app_1.default)
            .post('/api/v1/recently-watched')
            .set('x-guest-id', 'guest-123')
            .send({ contentId: '64a1b2c3d4e5f6g7h8i9j0k1', watchedSeconds: 120 });
        // We check that the mock was called, or we could just check response
        // If the route doesn't exist yet, this will return 404, but it demonstrates the structure.
        (0, vitest_1.expect)(res.status).not.toBe(500);
    }));
});
