import { Content } from '../modules/content/content.model';
import { logger } from '../../shared/logger';

let cron: any = null;
try {
  cron = require('node-cron');
} catch (error) {
  // node-cron not installed; fall back to setInterval
}

export class TrendingCronJob {
  private static cronJob: any = null;
  private static intervalId: NodeJS.Timeout | null = null;

  public static init() {
    if (this.cronJob || this.intervalId) {
      return; // Already started
    }

    if (cron) {
      this.cronJob = cron.schedule(
        '0 2 * * *',
        async () => {
          await this.runJob();
        },
        {
          scheduled: true,
          timezone: 'UTC',
        }
      );
      logger.info('TrendingCronJob started (node-cron, 02:00 UTC daily)');
    } else {
      logger.warn('node-cron not found, falling back to 24h setInterval for TrendingCronJob');
      this.intervalId = setInterval(
        async () => {
          await this.runJob();
        },
        24 * 60 * 60 * 1000
      );
    }
  }

  public static stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public static async runJob() {
    logger.info('TrendingCronJob: Starting nightly recalculation...');
    try {
      const today = new Date();

      // Recalculate scores using batch processing for optimization
      const BATCH_SIZE = 1000;
      let skip = 0;
      let processed = 0;

      while (true) {
        const contents = await Content.find({}).skip(skip).limit(BATCH_SIZE);
        if (contents.length === 0) break;

        for (const item of contents) {
          const createdAt = (item as any).createdAt ? new Date((item as any).createdAt).getTime() : Date.now();
          const daysSinceRelease = Math.max(
            1,
            (today.getTime() - createdAt) / (1000 * 60 * 60 * 24)
          );

          const weeklyViews = item.weeklyViews || 0;
          const views = item.views || 0;
          const totalWatchTime = item.totalWatchTime || 0;
          const rating = item.rating || 0;

          item.trendingScore = weeklyViews / daysSinceRelease;
          item.engagementScore =
            views * 0.4 +
            totalWatchTime * 0.001 * 0.3 +
            rating * views * 0.0001 * 0.3;

          await item.save();
          processed++;
        }

        skip += BATCH_SIZE;
      }

      logger.info(`TrendingCronJob: Processed ${processed} content items`);

      // Reset dailyViews
      await Content.updateMany({}, { $set: { dailyViews: 0 } });
      logger.info('TrendingCronJob: Reset dailyViews to 0');

      // Reset weeklyViews only on Monday
      if (today.getDay() === 1) {
        await Content.updateMany({}, { $set: { weeklyViews: 0 } });
        logger.info('TrendingCronJob: Reset weeklyViews to 0 (Monday)');
      }

      logger.info('TrendingCronJob: Finished successfully');
    } catch (error) {
      logger.error('TrendingCronJob Error:', error);
    }
  }
}
