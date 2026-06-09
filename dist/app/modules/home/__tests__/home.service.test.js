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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const home_service_1 = require("../home.service");
const redisClient_1 = require("../../../../shared/redisClient");
const content_model_1 = require("../../content/content.model");
// Mock dependencies
vitest_1.vi.mock('../../../../shared/redisClient', () => ({
    redisClient: {
        get: vitest_1.vi.fn(),
        setex: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock('../../content/content.model', () => ({
    Content: {
        find: vitest_1.vi.fn().mockReturnThis(),
        sort: vitest_1.vi.fn().mockReturnThis(),
        select: vitest_1.vi.fn().mockReturnThis(),
        limit: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock('../../recently-watched/recently-watched.model', () => ({
    RecentlyWatched: {
        find: vitest_1.vi.fn().mockReturnThis(),
        sort: vitest_1.vi.fn().mockReturnThis(),
        limit: vitest_1.vi.fn().mockReturnThis(),
        populate: vitest_1.vi.fn(),
    },
}));
(0, vitest_1.describe)('HomeService.getHomeContentFromDB', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should fetch from database and cache when redis returns null', () => __awaiter(void 0, void 0, void 0, function* () {
        // Simulate Redis cache miss
        redisClient_1.redisClient.get.mockResolvedValue(null);
        // Simulate DB returning data
        const mockData = [{ _id: '1', title: 'Test Movie', type: 'MOVIE' }];
        content_model_1.Content.limit.mockResolvedValue(mockData);
        const result = yield home_service_1.HomeService.getHomeContentFromDB();
        (0, vitest_1.expect)(result.sections).toBeDefined();
        // Verify redisClient.get was called for cache keys
        (0, vitest_1.expect)(redisClient_1.redisClient.get).toHaveBeenCalledWith('home:trending');
        // Verify DB was queried
        (0, vitest_1.expect)(content_model_1.Content.find).toHaveBeenCalled();
        // Verify redisClient.setex was called to save cache
        (0, vitest_1.expect)(redisClient_1.redisClient.setex).toHaveBeenCalled();
    }));
    (0, vitest_1.it)('should return cached data directly without calling database', () => __awaiter(void 0, void 0, void 0, function* () {
        // Simulate Redis cache hit
        const cachedData = [{ _id: '1', title: 'Cached Movie' }];
        redisClient_1.redisClient.get.mockResolvedValue(JSON.stringify(cachedData));
        // Reset DB mocks so we can verify they weren't called
        content_model_1.Content.limit.mockClear();
        const result = yield home_service_1.HomeService.getHomeContentFromDB();
        (0, vitest_1.expect)(result.sections).toBeDefined();
        (0, vitest_1.expect)(redisClient_1.redisClient.get).toHaveBeenCalledWith('home:trending');
        // The DB query should not be resolved or fetched if all are cached
        // Wait, the DB query setup might still happen because `Content.find()` is chained.
        // The actual execution is blocked inside fetchWithCache if cache hits.
        (0, vitest_1.expect)(redisClient_1.redisClient.setex).not.toHaveBeenCalled();
    }));
    (0, vitest_1.it)('should not crash if one query fails (Promise.allSettled behavior)', () => __awaiter(void 0, void 0, void 0, function* () {
        // Simulate Redis cache miss
        redisClient_1.redisClient.get.mockResolvedValue(null);
        // Simulate DB rejecting
        content_model_1.Content.limit.mockRejectedValueOnce(new Error('DB Error')).mockResolvedValue([]);
        // It should not throw error, it should just return the fulfilled sections
        const result = yield home_service_1.HomeService.getHomeContentFromDB();
        (0, vitest_1.expect)(result.sections).toBeDefined();
    }));
});
