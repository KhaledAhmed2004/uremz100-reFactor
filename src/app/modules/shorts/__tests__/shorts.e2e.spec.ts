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

async function createAuthUser(role: string = USER_ROLES.BROTHER) {
  const user = await User.create({
    name: `Test ${role}`,
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
  });

  const token = jwtHelper.createToken(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
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

describe('Shorts Module E2E Tests', () => {
  describe('Get Shorts Feed (GET /api/v1/shorts)', () => {
    it('successfully retrieves a mix of free contents and movie trailers with cursor pagination', async () => {
      const { token } = await createAuthUser();

      // 1. Premium Movie WITHOUT trailer (Should NOT be in shorts)
      await Content.create({
        title: 'Premium Movie No Trailer',
        description: 'desc',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['MONTHLY'],
        videoUrl: 'http://video.com',
        duration: 120,
        releaseYear: 2024,
      });

      // 2. Premium Movie WITH trailer (Should be in shorts as TRAILER)
      const premiumMovieWithTrailer = await Content.create({
        title: 'Premium Movie With Trailer',
        description: 'desc',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['MONTHLY'],
        videoUrl: 'http://video.com',
        trailerUrl: 'http://trailer.com/vid1.mp4',
        duration: 120,
        releaseYear: 2024,
      });

      // 3. Free Movie (Should be in shorts as FREE_CONTENT)
      const freeMovie = await Content.create({
        title: 'Free Movie',
        description: 'desc',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['FREE'],
        videoUrl: 'http://free.com/vid2.mp4',
        duration: 120,
        releaseYear: 2024,
      });

      const response = await request(app)
        .get('/api/v1/shorts?limit=1')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/shorts?limit=1', { headers: { Authorization: `Bearer ${token}` } }, response.body, 'GET-SHORTS-PAGE1', 'User fetches first page of shorts feed');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      
      const firstItem = response.body.data[0];
      // Since it sorts by _id descending, the most recently created (freeMovie) should be first
      expect(firstItem.type).toBe('FREE_CONTENT');
      expect(firstItem.videoUrl).toBe('http://free.com/vid2.mp4');

      expect(response.body.meta.hasNextPage).toBe(true);
      expect(response.body.meta.nextCursor).toBeDefined();

      // Fetch page 2
      const cursor = response.body.meta.nextCursor;
      const responsePage2 = await request(app)
        .get(`/api/v1/shorts?limit=1&cursor=${cursor}`)
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', `/api/v1/shorts?limit=1&cursor=${cursor}`, { headers: { Authorization: `Bearer ${token}` } }, responsePage2.body, 'GET-SHORTS-PAGE2', 'User fetches second page of shorts feed using cursor');

      expect(responsePage2.status).toBe(StatusCodes.OK);
      expect(responsePage2.body.data.length).toBe(1);
      
      const secondItem = responsePage2.body.data[0];
      // Second item should be the trailer
      expect(secondItem.type).toBe('TRAILER');
      expect(secondItem.videoUrl).toBe('http://trailer.com/vid1.mp4');
      // ID should have '_trailer' suffix
      expect(secondItem.id).toBe(`${premiumMovieWithTrailer._id.toString()}_trailer`);

      expect(responsePage2.body.meta.hasNextPage).toBe(false);
      expect(responsePage2.body.meta.nextCursor).toBeNull();
    });
  });
});
