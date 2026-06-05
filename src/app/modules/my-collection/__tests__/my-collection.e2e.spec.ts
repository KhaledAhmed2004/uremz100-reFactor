import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Content } from '../../content/content.model';
import { MyCollection } from '../my-collection.model';
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
  await MyCollection.deleteMany({});
  await Content.deleteMany({});
  await User.deleteMany({});
  vi.clearAllMocks();
});

describe('My Collection E2E Tests', () => {
  describe('Add to Collection (POST /api/v1/my-collection)', () => {
    it('successfully adds a movie to user collection', async () => {
      const { token } = await createAuthUser(USER_ROLES.BROTHER);
      const content = await Content.create({
        title: 'Collection Movie',
        description: 'desc',
        type: 'MOVIE',
        videoUrl: 'http://video.com',
        duration: 120,
        releaseYear: 2024
      });

      const payload = {
        itemId: content._id.toString()
      };

      const response = await request(app)
        .post('/api/v1/my-collection')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      logApi('POST', '/api/v1/my-collection', { body: payload }, response.body, 'ADD-TO-COLLECTION', 'User adds a movie to collection');

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data.itemType).toBe('MOVIE');
      expect(response.body.data.itemId).toBe(content._id.toString());
    });
  });

  describe('Get My Collection (GET /api/v1/my-collection)', () => {
    it('successfully retrieves user collection with populated items', async () => {
      const { user, token } = await createAuthUser(USER_ROLES.BROTHER);
      const content = await Content.create({
        title: 'Saved Movie',
        description: 'desc',
        type: 'MOVIE',
        videoUrl: 'http://video.com',
        duration: 120,
        releaseYear: 2024
      });

      await MyCollection.create({
        userId: user._id,
        itemType: 'MOVIE',
        itemId: content._id,
        itemModel: 'Content'
      });

      const response = await request(app)
        .get('/api/v1/my-collection')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/my-collection', {}, response.body, 'GET-MY-COLLECTION', 'User fetches their collection');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].itemId.title).toBe('Saved Movie');
    });
  });

  describe('Remove from Collection (DELETE /api/v1/my-collection/:collectionId)', () => {
    it('successfully removes an item from collection', async () => {
      const { user, token } = await createAuthUser(USER_ROLES.BROTHER);
      const collectionItem = await MyCollection.create({
        userId: user._id,
        itemType: 'MOVIE',
        itemId: new mongoose.Types.ObjectId(),
        itemModel: 'Content'
      });

      const response = await request(app)
        .delete(`/api/v1/my-collection/${collectionItem._id}`)
        .set('Authorization', `Bearer ${token}`);

      logApi('DELETE', '/api/v1/my-collection/:collectionId', {}, response.body, 'REMOVE-FROM-COLLECTION', 'User removes item from collection');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);

      const dbCheck = await MyCollection.findById(collectionItem._id);
      expect(dbCheck).toBeNull();
    });
  });
});
