import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Content } from '../../modules/content/content.model';
import { TrendingCronJob } from '../trending-cron.job';

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('TrendingCronJob', () => {
  it('should calculate trendingScore and engagementScore correctly', async () => {
    // Insert dummy content
    const content = await Content.create({
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
    await TrendingCronJob.runJob();

    const updatedContent = await Content.findById(content._id);
    expect(updatedContent).toBeDefined();

    // Verify dailyViews was reset
    expect(updatedContent!.dailyViews).toBe(0);

    // Verify scores were calculated
    expect(updatedContent!.trendingScore).toBeGreaterThan(0);
    expect(updatedContent!.engagementScore).toBeGreaterThan(0);

    // Specifically:
    // trendingScore = weeklyViews(800) / max(1, daysSinceRelease) => 800
    // engagementScore = (1000 * 0.4) + (120000 * 0.001 * 0.3) + (4.5 * 1000 * 0.0001 * 0.3)
    // engagementScore = 400 + 36 + 0.135 = 436.135
    expect(updatedContent!.trendingScore).toBe(800);
    expect(updatedContent!.engagementScore).toBeCloseTo(436.135, 2);
  });
});
