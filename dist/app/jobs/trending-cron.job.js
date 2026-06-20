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
exports.TrendingCronJob = void 0;
const content_model_1 = require("../modules/content/content.model");
const logger_1 = require("../../shared/logger");
let cron = null;
try {
    cron = require('node-cron');
}
catch (error) {
    // node-cron not installed; fall back to setInterval
}
class TrendingCronJob {
    static init() {
        if (this.cronJob || this.intervalId) {
            return; // Already started
        }
        if (cron) {
            this.cronJob = cron.schedule('0 2 * * *', () => __awaiter(this, void 0, void 0, function* () {
                yield this.runJob();
            }), {
                scheduled: true,
                timezone: 'UTC',
            });
            logger_1.logger.info('TrendingCronJob started (node-cron, 02:00 UTC daily)');
        }
        else {
            logger_1.logger.warn('node-cron not found, falling back to 24h setInterval for TrendingCronJob');
            this.intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                yield this.runJob();
            }), 24 * 60 * 60 * 1000);
        }
    }
    static stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    static runJob() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.info('TrendingCronJob: Starting nightly recalculation...');
            try {
                const today = new Date();
                // Recalculate scores using batch processing for optimization
                const BATCH_SIZE = 1000;
                let skip = 0;
                let processed = 0;
                while (true) {
                    const contents = yield content_model_1.Content.find({}).skip(skip).limit(BATCH_SIZE);
                    if (contents.length === 0)
                        break;
                    for (const item of contents) {
                        const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : Date.now();
                        const daysSinceRelease = Math.max(1, (today.getTime() - createdAt) / (1000 * 60 * 60 * 24));
                        const weeklyViews = item.weeklyViews || 0;
                        const views = item.views || 0;
                        const totalWatchTime = item.totalWatchTime || 0;
                        const rating = item.rating || 0;
                        item.trendingScore = weeklyViews / daysSinceRelease;
                        item.engagementScore =
                            views * 0.4 +
                                totalWatchTime * 0.001 * 0.3 +
                                rating * views * 0.0001 * 0.3;
                        yield item.save();
                        processed++;
                    }
                    skip += BATCH_SIZE;
                }
                logger_1.logger.info(`TrendingCronJob: Processed ${processed} content items`);
                // Reset dailyViews
                yield content_model_1.Content.updateMany({}, { $set: { dailyViews: 0 } });
                logger_1.logger.info('TrendingCronJob: Reset dailyViews to 0');
                // Reset weeklyViews only on Monday
                if (today.getDay() === 1) {
                    yield content_model_1.Content.updateMany({}, { $set: { weeklyViews: 0 } });
                    logger_1.logger.info('TrendingCronJob: Reset weeklyViews to 0 (Monday)');
                }
                logger_1.logger.info('TrendingCronJob: Finished successfully');
            }
            catch (error) {
                logger_1.logger.error('TrendingCronJob Error:', error);
            }
        });
    }
}
exports.TrendingCronJob = TrendingCronJob;
TrendingCronJob.cronJob = null;
TrendingCronJob.intervalId = null;
