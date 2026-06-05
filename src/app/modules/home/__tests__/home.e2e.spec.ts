import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Content } from '../../content/content.model';
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
    it('successfully retrieves home sections including Popular Movies and Popular Series', async () => {
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
        .get('/api/v1/home/content')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/home/content', {}, response.body, 'GET-HOME-CONTENT', 'User fetches home sections');

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
  });
});
