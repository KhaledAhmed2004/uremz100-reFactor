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
const mongodb_memory_server_1 = require("mongodb-memory-server");
const content_model_1 = require("../../modules/content/content.model");
const trending_cron_job_1 = require("../trending-cron.job");
let replSet;
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({ replSet: { count: 1 } });
    yield mongoose_1.default.connect(replSet.getUri());
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield replSet.stop();
}));
(0, vitest_1.describe)('TrendingCronJob', () => {
    (0, vitest_1.it)('should calculate trendingScore and engagementScore correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        // Insert dummy content
        const content = yield content_model_1.Content.create({
            title: 'Trending Test Movie',
            description: 'A test movie for trending scores',
            type: 'MOVIE',
            duration: 120,
            releaseYear: 2024,
            status: 'PUBLISHED',
            planStatus: ['FREE'],
            videoUrl: 'http://example.com/video.mp4',
            views: 1000,
            dailyViews: 500,
            weeklyViews: 800,
            totalWatchTime: 120000, // seconds
            rating: 4.5,
        });
        // Mock Date.now() or just let the job run
        // Since we just created it, daysSinceRelease will be 1 (Math.max(1, 0))
        yield trending_cron_job_1.TrendingCronJob.runJob();
        const updatedContent = yield content_model_1.Content.findById(content._id);
        (0, vitest_1.expect)(updatedContent).toBeDefined();
        // Verify dailyViews was reset
        (0, vitest_1.expect)(updatedContent.dailyViews).toBe(0);
        // Verify scores were calculated
        (0, vitest_1.expect)(updatedContent.trendingScore).toBeGreaterThan(0);
        (0, vitest_1.expect)(updatedContent.engagementScore).toBeGreaterThan(0);
        // Specifically:
        // trendingScore = weeklyViews(800) / max(1, daysSinceRelease) => 800
        // engagementScore = (1000 * 0.4) + (120000 * 0.001 * 0.3) + (4.5 * 1000 * 0.0001 * 0.3)
        // engagementScore = 400 + 36 + 0.135 = 436.135
        (0, vitest_1.expect)(updatedContent.trendingScore).toBe(800);
        (0, vitest_1.expect)(updatedContent.engagementScore).toBeCloseTo(436.135, 2);
    }));
});
