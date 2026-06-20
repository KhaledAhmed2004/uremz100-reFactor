import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Content } from '../../content/content.model';
import { RecentlyWatched } from '../recently-watched.model';
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
  await RecentlyWatched.deleteMany({});
  await Content.deleteMany({});
  await User.deleteMany({});
  vi.clearAllMocks();
});

describe('Recently Watched E2E Tests', () => {
  describe('Track Progress (POST /api/v1/recently-watched/track-progress)', () => {
    it('successfully tracks content progress for a user', async () => {
      const { user, token } = await createAuthUser(USER_ROLES.USER);
      const content = await Content.create({
        title: 'Test Movie',
        description: 'desc',
        type: 'MOVIE',
        videoUrl: 'http://video.com',
        duration: 120,
        releaseYear: 2024
      });

      const payload = {
        contentId: content._id.toString(),
        watchedSeconds: 60, // 1 minute watched of a 120 minute movie
      };

      const response = await request(app)
        .post('/api/v1/recently-watched/track-progress')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      logApi('POST', '/api/v1/recently-watched/track-progress', { body: payload }, response.body, 'TRACK-PROGRESS', 'User tracks watching progress');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.watchedSeconds).toBe(60);
      // (60s / (120m * 60s)) * 100 = (60 / 7200) * 100 = 0.833... -> rounded to 1
      expect(response.body.data.completionPercentage).toBe(1);
      expect(response.body.data.contentId).toBe(content._id.toString());

      // Verify DB
      const dbCheck = await RecentlyWatched.findOne({ userId: user._id, contentId: content._id });
      expect(dbCheck).not.toBeNull();
      expect(dbCheck?.watchedSeconds).toBe(60);
      
      // Verify content views incremented
      const contentCheck = await Content.findById(content._id);
      expect(contentCheck?.views).toBeGreaterThan(0);
    });
  });

  describe('Get Recently Watched (GET /api/v1/recently-watched)', () => {
    it('successfully retrieves user watch history', async () => {
      const { user, token } = await createAuthUser(USER_ROLES.USER);
      const content = await Content.create({
        title: 'Test Movie',
        description: 'desc',
        type: 'MOVIE',
        videoUrl: 'http://video.com',
        duration: 120,
        releaseYear: 2024
      });

      await RecentlyWatched.create({
        userId: user._id,
        contentId: content._id,
        watchedSeconds: 500,
        completionPercentage: 20,
        lastWatchedAt: new Date()
      });

      const response = await request(app)
        .get('/api/v1/recently-watched')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/recently-watched', {}, response.body, 'GET-RECENTLY-WATCHED', 'User fetches watch history');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].contentId.title).toBe('Test Movie');
    });
  });
});
