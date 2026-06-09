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
const app_1 = __importDefault(require("../../../../app")); // Assuming app.ts is at src/app.ts
const redisClient_1 = require("../../../../shared/redisClient");
// Mock Redis to avoid requiring a real Redis instance during integration tests
vitest_1.vi.mock('../../../../shared/redisClient', () => ({
    redisClient: {
        get: vitest_1.vi.fn(),
        setex: vitest_1.vi.fn(),
    },
}));
(0, vitest_1.describe)('Home API Integration Tests', () => {
    (0, vitest_1.beforeAll)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('GET /api/v1/home/content should return 200 and sections array', () => __awaiter(void 0, void 0, void 0, function* () {
        // Mock redis cache miss
        redisClient_1.redisClient.get.mockResolvedValue(null);
        const res = yield (0, supertest_1.default)(app_1.default).get('/api/v1/home/content');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.success).toBe(true);
        (0, vitest_1.expect)(res.body.data).toHaveProperty('sections');
        (0, vitest_1.expect)(Array.isArray(res.body.data.sections)).toBe(true);
    }));
    (0, vitest_1.it)('GET /api/v1/home/content should not crash if x-guest-id is provided', () => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield (0, supertest_1.default)(app_1.default)
            .get('/api/v1/home/content')
            .set('x-guest-id', 'test-guest-123');
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.body.success).toBe(true);
    }));
});
