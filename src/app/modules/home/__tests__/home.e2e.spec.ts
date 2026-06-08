import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Content } from '../../content/content.model';
import { RecentlyWatched } from '../../recently-watched/recently-watched.model';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../../../enums/user';
import { logApi } from '../../../../helpers/__tests__/testLogger';
import { StatusCodes } from 'http-status-codes';

let replSet: MongoMemoryReplSet;

async function createAuthUser(role: string = USER_ROLES.SUPER_ADMIN, nameSuffix = 'admin') {
  const user = await User.create({
    name: `Test ${role} ${nameSuffix}`,
    role,
    email: `${randomUUID()}@test.com`,
    password: 'password123',
    isVerified: true,
    status: USER_STATUS.ACTIVE,
    revertDate: new Date(),
    dateOfBirth: new Date('1990-01-01'),
    profileImage: '/default-avatar.svg',
    verificationImage: 'https://example.com/img.jpg',
    verificationVideo: 'https://example.com/vid.mp4',
    tokenVersion: 0,
  });

  const token = jwtHelper.createToken(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion },
    config.jwt.jwt_secret as Secret,
    '1h',
  );

  return { user, token };
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Content.deleteMany({});
  await User.deleteMany({});
  vi.clearAllMocks();
});

describe('Home Module E2E Tests', () => {
  describe('Get Home Content (GET /api/v1/home/content)', () => {
    it('successfully retrieves popular sections using ?tab=popular', async () => {
      const { token } = await createAuthUser(USER_ROLES.BROTHER);
      
      // 1. Trending Movie (views > 100)
      await Content.create({
        title: 'Trending Movie',
        description: 'desc',
        type: 'MOVIE',
        videoUrl: 'http://video.com',
        duration: 120,
        releaseYear: 2024,
        views: 150,
        rating: 4.0,
      });

      // 2. Popular Movie
      await Content.create({
        title: 'Popular Movie',
        description: 'desc',
        type: 'MOVIE',
        videoUrl: 'http://video.com',
        duration: 110,
        releaseYear: 2024,
        views: 90,
        rating: 4.2,
      });

      // 3. Popular Series
      await Content.create({
        title: 'Popular Series',
        description: 'desc',
        type: 'SERIES',
        videoUrl: 'http://video.com',
        duration: 0,
        releaseYear: 2024,
        isPopularSeries: true,
        views: 80,
        rating: 4.5,
      });

      // 4. Top Pick (rating >= 4.5)
      await Content.create({
        title: 'Top Pick Content',
        description: 'desc',
        type: 'MOVIE',
        videoUrl: 'http://video.com',
        duration: 130,
        releaseYear: 2024,
        views: 50,
        rating: 4.8,
      });

      const response = await request(app)
        .get('/api/v1/home/content?tab=popular')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/home/content?tab=popular', { headers: { Authorization: `Bearer ${token}` } }, response.body, 'GET-HOME-CONTENT', 'User fetches popular sections');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sections).toBeInstanceOf(Array);

      const sections = response.body.data.sections;
      
      // Verify specific sections exist
      const popularMoviesSection = sections.find((s: any) => s.id === 'row_popular_movies');
      expect(popularMoviesSection).toBeDefined();
      expect(popularMoviesSection.title).toBe('Most Popular Movies');
      expect(popularMoviesSection.items.length).toBeGreaterThan(0);

      const popularSeriesSection = sections.find((s: any) => s.id === 'row_popular_series');
      expect(popularSeriesSection).toBeDefined();
      expect(popularSeriesSection.title).toBe('Most Popular Series');

      const youMightLikeSection = sections.find((s: any) => s.id === 'row_you_might_like');
      expect(youMightLikeSection).toBeDefined();

      const trendingSection = sections.find((s: any) => s.id === 'row_trending_now');
      expect(trendingSection).toBeDefined();
    });

    it('successfully retrieves popular sections for a guest user using ?tab=popular', async () => {
      const guestId = 'e2e-guest-123';
      
      const content = await Content.create({
        title: 'Guest Top Pick',
        description: 'desc',
        type: 'MOVIE',
        videoUrl: 'http://video.com',
        duration: 130,
        releaseYear: 2024,
        views: 50,
        rating: 4.8,
      });
      
      await RecentlyWatched.create({
        guestId,
        contentId: content._id,
        watchedSeconds: 120,
        completionPercentage: 50,
      });

      const response = await request(app)
        .get('/api/v1/home/content?tab=popular')
        .set('x-guest-id', guestId);

      logApi('GET', '/api/v1/home/content?tab=popular', { headers: { 'x-guest-id': guestId } }, response.body, 'GET-HOME-CONTENT-GUEST', 'Guest user fetches popular sections');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      
      const sections = response.body.data.sections;
      const continueWatchingSection = sections.find((s: any) => s.id === 'row_continue_watching');
      expect(continueWatchingSection).toBeDefined();
      expect(continueWatchingSection.items.length).toBeGreaterThan(0);
      expect(continueWatchingSection.items[0].title).toBe('Guest Top Pick');
    });
    it('successfully retrieves new sections using ?tab=new', async () => {
      const { token } = await createAuthUser(USER_ROLES.BROTHER);

      await Content.create({
        title: 'New Coming Soon',
        description: 'desc',
        type: 'MOVIE',
        status: 'DRAFT',
        videoUrl: 'http://video.com',
        duration: 120,
        releaseYear: 2025,
      });

      // New Release
      await Content.create({
        title: 'New Release Movie',
        description: 'desc',
        type: 'MOVIE',
        status: 'PUBLISHED',
        isRecent: true,
        videoUrl: 'http://video.com',
        duration: 120,
        releaseYear: 2024,
      });

      const response = await request(app)
        .get('/api/v1/home/content?tab=new')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/home/content?tab=new', { headers: { Authorization: `Bearer ${token}` } }, response.body, 'GET-HOME-CONTENT-NEW', 'User fetches new sections');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);

      const sections = response.body.data.sections;
      const comingSoonSection = sections.find((s: any) => s.id === 'row_coming_soon');
      expect(comingSoonSection).toBeDefined();
      expect(comingSoonSection.title).toBe('Coming Soon');

      const newReleaseSection = sections.find((s: any) => s.id === 'row_new_releases');
      expect(newReleaseSection).toBeDefined();
      expect(newReleaseSection.title).toBe('New Releases');
    });

    it('successfully retrieves vip sections using ?tab=vip', async () => {
      const { token } = await createAuthUser(USER_ROLES.BROTHER);

      await Content.create({
        title: 'VIP Movie',
        description: 'Premium content',
        type: 'MOVIE',
        videoUrl: 'http://video.com',
        duration: 120,
        releaseYear: 2024,
        isPremium: true,
        rating: 4.9,
      });

      const response = await request(app)
        .get('/api/v1/home/content?tab=vip')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/home/content?tab=vip', { headers: { Authorization: `Bearer ${token}` } }, response.body, 'GET-HOME-CONTENT-VIP', 'User fetches VIP sections');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);

      const sections = response.body.data.sections;
      
      const vipDailySection = sections.find((s: any) => s.id === 'row_vip_daily');
      expect(vipDailySection).toBeDefined();
      expect(vipDailySection.title).toBe("Today's VIP Picks");
      
      const vipWeeklySection = sections.find((s: any) => s.id === 'row_vip_weekly');
      expect(vipWeeklySection).toBeDefined();
      expect(vipWeeklySection.title).toBe("Weekly VIP Picks");
    });

    it('successfully retrieves ranking sections using ?tab=ranking&filter=weekly', async () => {
      const { token } = await createAuthUser(USER_ROLES.BROTHER);

      await Content.create({
        title: 'Weekly Hit Movie',
        description: 'Hits of the week',
        type: 'MOVIE',
        videoUrl: 'http://video.com',
        duration: 120,
        releaseYear: 2024,
        views: 500,
      });

      const response = await request(app)
        .get('/api/v1/home/content?tab=ranking&filter=weekly')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/home/content?tab=ranking&filter=weekly', { headers: { Authorization: `Bearer ${token}` } }, response.body, 'GET-HOME-CONTENT-RANKING', 'User fetches weekly ranking sections');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);

      const sections = response.body.data.sections;
      const rankingSection = sections.find((s: any) => s.id === 'row_ranking_weekly');
      expect(rankingSection).toBeDefined();
      expect(rankingSection.title).toBe('Weekly Rankings');
      expect(rankingSection.items.length).toBeGreaterThan(0);
    });

    it('returns an empty sections array when there is no content matching the tab', async () => {
      const { token } = await createAuthUser(USER_ROLES.BROTHER);

      // We do NOT create any Content here, so the DB is empty for this test

      const response = await request(app)
        .get('/api/v1/home/content?tab=new')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/home/content?tab=new', { headers: { Authorization: `Bearer ${token}` } }, response.body, 'GET-HOME-CONTENT-EMPTY', 'User fetches new sections when empty');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sections).toBeInstanceOf(Array);
      expect(response.body.data.sections.length).toBe(2);

      const sections = response.body.data.sections;
      const comingSoonSection = sections.find((s: any) => s.id === 'row_coming_soon');
      expect(comingSoonSection).toBeDefined();
      expect(comingSoonSection.items).toBeInstanceOf(Array);
      expect(comingSoonSection.items.length).toBe(0);

      const newReleaseSection = sections.find((s: any) => s.id === 'row_new_releases');
      expect(newReleaseSection).toBeDefined();
      expect(newReleaseSection.items).toBeInstanceOf(Array);
      expect(newReleaseSection.items.length).toBe(0);
    });
  });
});
