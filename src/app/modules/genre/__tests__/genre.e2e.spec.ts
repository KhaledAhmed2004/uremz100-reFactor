import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Genre } from '../genre.model';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../../../enums/user';
import { logApi } from '../../../../helpers/__tests__/testLogger';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../content/content.model', () => ({
  Content: {
    countDocuments: vi.fn().mockResolvedValue(0),
  },
}));



// ── Test helpers ─────────────────────────────────────────────────────────────


let replSet: MongoMemoryReplSet;

/** Create an auth user and return its document and a valid JWT. */
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

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Genre.deleteMany({});
  await User.deleteMany({});
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Genre E2E Tests', () => {

  describe('Create Genre (POST /api/v1/genres)', () => {
    it('allows SUPER_ADMIN to create a genre', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);

      const payload = { name: 'Action', description: 'Action movies' };

      const response = await request(app)
        .post('/api/v1/genres')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      logApi('POST', '/api/v1/genres', { body: payload }, response.body, 'CREATE-GENRE', 'SUPER_ADMIN creates a new genre');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(payload.name);
      expect(response.body.data.description).toBe(payload.description);
      expect(response.body.data.id).toBeDefined();

      const dbCheck = await Genre.findById(response.body.data.id);
      expect(dbCheck).not.toBeNull();
      expect(dbCheck?.name).toBe(payload.name);
    });


  });

  describe('Get All Genres (GET /api/v1/genres)', () => {
    it('successfully retrieves all genres with pagination and count', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);

      await Genre.create({ name: 'Horror', description: 'Scary stuff' });
      await Genre.create({ name: 'Romance' });

      const response = await request(app)
        .get('/api/v1/genres')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/genres', {}, response.body, 'GET-GENRES', 'Fetch all genres');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2);
      expect(response.body.data[0].contentCount).toBeDefined();
    });

    it('successfully filters genres by searchTerm (name and description)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);

      await Genre.create({ name: 'Action', description: 'Explosions and car chases' });
      await Genre.create({ name: 'Comedy', description: 'Funny and hilarious' });
      await Genre.create({ name: 'Drama', description: 'Serious storytelling' });

      const queryParams = { searchTerm: 'Explosions' };

      const response = await request(app)
        .get('/api/v1/genres')
        .query(queryParams)
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/genres', { query: queryParams }, response.body, 'GET-GENRES-SEARCH', 'Search genres by description');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Action');
    });
  });

  describe('Update Genre (PATCH /api/v1/genres/:genreId)', () => {
    it('allows SUPER_ADMIN to update a genre', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);

      const genre = await Genre.create({ name: 'OldName' });

      const payload = { name: 'NewName' };

      const response = await request(app)
        .patch(`/api/v1/genres/${genre._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      logApi('PATCH', '/api/v1/genres/:genreId', { params: { genreId: genre._id }, body: payload }, response.body, 'UPDATE-GENRE', 'SUPER_ADMIN updates a genre');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('NewName');

      const dbCheck = await Genre.findById(genre._id);
      expect(dbCheck?.name).toBe('NewName');
    });
  });


  describe('Bulk Delete Genres (DELETE /api/v1/genres)', () => {
    it('returns 200 when all provided IDs are successfully deleted', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);

      const genre1 = await Genre.create({ name: 'Horror' });
      const genre2 = await Genre.create({ name: 'Comedy' });
      const genre3 = await Genre.create({ name: 'Thriller' });

      const ids = [genre1._id.toString(), genre2._id.toString(), genre3._id.toString()];

      const response = await request(app)
        .delete('/api/v1/genres')
        .set('Authorization', `Bearer ${token}`)
        .send({ ids });

      logApi('DELETE', '/api/v1/genres', { body: { ids } }, response.body, 'BULK-DELETE-ALL-SUCCESS', 'SUPER_ADMIN bulk deletes all 3 genres');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Genres deleted successfully');
      expect(response.body.data.deletedCount).toBe(3);
      expect(response.body.data.failedCount).toBe(0);
      expect(response.body.data.deletedIds).toHaveLength(3);
      expect(response.body.data.failed).toHaveLength(0);

      const remaining = await Genre.countDocuments({ _id: { $in: ids } });
      expect(remaining).toBe(0);
    });

    it('returns 207 when some IDs exist and some do not (partial success)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);

      const genre1 = await Genre.create({ name: 'Action' });
      const genre2 = await Genre.create({ name: 'Drama' });
      const fakeId = new mongoose.Types.ObjectId().toString();

      const ids = [genre1._id.toString(), fakeId, genre2._id.toString()];

      const response = await request(app)
        .delete('/api/v1/genres')
        .set('Authorization', `Bearer ${token}`)
        .send({ ids });

      logApi('DELETE', '/api/v1/genres', { body: { ids } }, response.body, 'BULK-DELETE-PARTIAL', 'SUPER_ADMIN bulk deletes with 1 missing ID → 207 expected');

      expect(response.status).toBe(207);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Bulk delete partially completed');
      expect(response.body.data.deletedCount).toBe(2);
      expect(response.body.data.failedCount).toBe(1);
      expect(response.body.data.deletedIds).toHaveLength(2);
      expect(response.body.data.failed).toHaveLength(1);
      expect(response.body.data.failed[0].id).toBe(fakeId);
      expect(response.body.data.failed[0].reason).toBe('NOT_FOUND');
    });

    it('returns 404 when none of the provided IDs exist', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);

      const fakeId1 = new mongoose.Types.ObjectId().toString();
      const fakeId2 = new mongoose.Types.ObjectId().toString();

      const ids = [fakeId1, fakeId2];

      const response = await request(app)
        .delete('/api/v1/genres')
        .set('Authorization', `Bearer ${token}`)
        .send({ ids });

      logApi('DELETE', '/api/v1/genres', { body: { ids } }, response.body, 'BULK-DELETE-ALL-FAILED', 'SUPER_ADMIN bulk deletes with all invalid IDs → 404 expected');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.data.deletedCount).toBe(0);
      expect(response.body.data.failedCount).toBe(2);
    });
  });

});
