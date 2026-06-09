import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Content } from '../content.model';
import { Genre } from '../../genre/genre.model';
import { Season } from '../season.model';
import { Episode } from '../episode.model';
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../../../enums/user';
import { logApi } from '../../../../helpers/__tests__/testLogger';
import { StatusCodes } from 'http-status-codes';
import { ContentService } from '../content.service';
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
  await Content.deleteMany({});
  await User.deleteMany({});
  await Genre.deleteMany({});
  await Season.deleteMany({});
  await Episode.deleteMany({});
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Content E2E Tests', () => {

  describe('Search Content (GET /api/v1/contents/search)', () => {
    it('successfully retrieves content based on search query', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);

      await Content.create({
        title: 'Inception',
        description: 'A mind-bending thriller',
        type: 'MOVIE',
        status: 'PUBLISHED',
        releaseYear: 2010,
        duration: 148,
        videoUrl: 'http://video.com',
        poster: 'http://poster.jpg'
      });
      await Content.create({
        title: 'Interstellar',
        description: 'Space exploration',
        type: 'MOVIE',
        status: 'PUBLISHED',
        releaseYear: 2014,
        duration: 169,
        videoUrl: 'http://video2.com'
      });

      const queryParams = { searchTerm: 'Inception' };

      const response = await request(app)
        .get('/api/v1/contents/search')
        .query(queryParams)
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/contents/search', { query: queryParams }, response.body, 'GET-CONTENT-SEARCH', 'Search content by title');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].title).toBe('Inception');
    });
  });

  describe('Get Best Movies (GET /api/v1/contents/best-movies)', () => {
    it('successfully retrieves top rated movies', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);

      await Content.create({ title: 'Bad Movie', description: 'desc', releaseYear: 2020, duration: 120, videoUrl: 'url', type: 'MOVIE', rating: 2, status: 'PUBLISHED' });
      await Content.create({ title: 'Good Movie', description: 'desc', releaseYear: 2020, duration: 120, videoUrl: 'url', type: 'MOVIE', rating: 8, status: 'PUBLISHED' });
      await Content.create({ title: 'Best Movie', description: 'desc', releaseYear: 2020, duration: 120, videoUrl: 'url', type: 'MOVIE', rating: 10, status: 'PUBLISHED' });

      const response = await request(app)
        .get('/api/v1/contents/best-movies')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/contents/best-movies', {}, response.body, 'GET-BEST-MOVIES', 'Fetch top rated movies');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(3);
      // Ensure the highest rating is first
      expect(response.body.data[0].title).toBe('Best Movie');
    });
  });

  describe('Get Coming Soon Content (GET /api/v1/contents/coming-soon)', () => {
    it('successfully retrieves upcoming content based on future release date', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);

      const now = new Date();
      const nextYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const lastYear = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      await Content.create({ title: 'Old Movie', description: 'desc', releaseYear: 2020, duration: 120, videoUrl: 'url', type: 'MOVIE', releaseDate: lastYear, status: 'PUBLISHED' });
      await Content.create({ title: 'Upcoming Movie', description: 'desc', releaseYear: 2020, duration: 120, videoUrl: 'url', type: 'MOVIE', releaseDate: nextYear, status: 'PUBLISHED' });

      const response = await request(app)
        .get('/api/v1/contents/coming-soon')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/contents/coming-soon', {}, response.body, 'GET-COMING-SOON', 'Fetch upcoming movies');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].title).toBe('Upcoming Movie');
    });
  });

  describe('Admin Movie Management', () => {
    it('successfully creates a movie (POST /api/v1/contents/movies)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const genre = await Genre.create({ name: 'Action' });

      const payload = {
        title: 'New Movie',
        description: 'Action packed',
        genres: [genre._id.toString()],
        duration: 120,
        releaseYear: 2024,
        videoUrl: 'http://video.com',
        availability: ['FREE'],
        isDraft: false
      };

      const response = await request(app)
        .post('/api/v1/contents/movies')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      logApi('POST', '/api/v1/contents/movies', { body: payload }, response.body, 'CREATE-MOVIE', 'Admin creates a movie');

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('New Movie');
      expect(response.body.data.type).toBe('MOVIE');
    });

    it('successfully fetches admin movies list (GET /api/v1/contents/movies)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      await Content.create({ title: 'Movie 1', description: 'desc', duration: 120, releaseYear: 2024, type: 'MOVIE', videoUrl: 'url' });

      const response = await request(app)
        .get('/api/v1/contents/movies')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/contents/movies', {}, response.body, 'GET-ADMIN-MOVIES', 'Admin fetches movies list');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
    });

    it('successfully updates a movie (PATCH /api/v1/contents/movies/:movieId)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const movie = await Content.create({ title: 'Old Title', description: 'desc', duration: 120, releaseYear: 2024, type: 'MOVIE', videoUrl: 'url' });

      const payload = { title: 'Updated Title' };

      const response = await request(app)
        .patch(`/api/v1/contents/movies/${movie._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      logApi('PATCH', '/api/v1/contents/movies/:movieId', { body: payload }, response.body, 'UPDATE-MOVIE', 'Admin updates a movie');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
    });

    it('successfully deletes a movie (DELETE /api/v1/contents/movies/:movieId)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const movie = await Content.create({ title: 'To Delete', description: 'desc', duration: 120, releaseYear: 2024, type: 'MOVIE', videoUrl: 'url' });

      const response = await request(app)
        .delete(`/api/v1/contents/movies/${movie._id}`)
        .set('Authorization', `Bearer ${token}`);

      logApi('DELETE', '/api/v1/contents/movies/:movieId', {}, response.body, 'DELETE-MOVIE', 'Admin deletes a movie');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);

      const dbCheck = await Content.findById(movie._id);
      expect(dbCheck).toBeNull();
    });

    it('successfully updates movie status (PATCH /api/v1/contents/movies/:movieId/status)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const movie = await Content.create({ title: 'Status Movie', description: 'desc', duration: 120, releaseYear: 2024, type: 'MOVIE', videoUrl: 'url', status: 'DRAFT' });

      const response = await request(app)
        .patch(`/api/v1/contents/movies/${movie._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PUBLISHED' });

      logApi('PATCH', '/api/v1/contents/movies/:movieId/status', { body: { status: 'PUBLISHED' } }, response.body, 'UPDATE-MOVIE-STATUS', 'Admin updates movie status');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PUBLISHED');
    });
  });

  describe('Admin Series Management', () => {
    it('successfully creates a series (POST /api/v1/contents/series)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const genre = await Genre.create({ name: 'Sci-Fi' });

      const payload = {
        title: 'New Series',
        description: 'Epic journey',
        genres: [genre._id.toString()],
        releaseYear: 2024,
        availability: ['MONTHLY'],
        isDraft: false
      };

      const response = await request(app)
        .post('/api/v1/contents/series')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      logApi('POST', '/api/v1/contents/series', { body: payload }, response.body, 'CREATE-SERIES', 'Admin creates a series');

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('New Series');
      expect(response.body.data.type).toBe('SERIES');
    });

    it('successfully fetches admin series list (GET /api/v1/contents/series)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      await Content.create({ title: 'Series 1', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES' });

      const response = await request(app)
        .get('/api/v1/contents/series')
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/contents/series', {}, response.body, 'GET-ADMIN-SERIES', 'Admin fetches series list');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
    });

    it('successfully fetches series details (GET /api/v1/contents/series/:seriesId/details)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const series = await Content.create({ title: 'Detailed Series', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES' });

      const response = await request(app)
        .get(`/api/v1/contents/series/${series._id}/details`)
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/contents/series/:seriesId/details', {}, response.body, 'GET-SERIES-DETAILS', 'Admin fetches series details');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Detailed Series');
      expect(response.body.data.seasons).toBeInstanceOf(Array);
    });

    it('successfully updates series status (PATCH /api/v1/contents/series/:seriesId/status)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const series = await Content.create({ title: 'Status Series', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES', status: 'DRAFT' });

      const response = await request(app)
        .patch(`/api/v1/contents/series/${series._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PUBLISHED' });

      logApi('PATCH', '/api/v1/contents/series/:seriesId/status', { body: { status: 'PUBLISHED' } }, response.body, 'UPDATE-SERIES-STATUS', 'Admin updates series status');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PUBLISHED');
    });
  });

  describe('Season Management', () => {
    it('successfully creates a season (POST /api/v1/contents/series/:seriesId/seasons)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const series = await Content.create({ title: 'Series', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES' });

      const payload = {
        title: 'Season 1',
        seasonNumber: 1,
        poster: 'http://poster.jpg'
      };

      const response = await request(app)
        .post(`/api/v1/contents/series/${series._id}/seasons`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      logApi('POST', '/api/v1/contents/series/:seriesId/seasons', { body: payload }, response.body, 'CREATE-SEASON', 'Admin creates a season');

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Season 1');
    });

    it('successfully fetches seasons (GET /api/v1/contents/series/:seriesId/seasons)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const series = await Content.create({ title: 'Series', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES' });
      await Season.create({ title: 'Season 1', seasonNumber: 1, seriesId: series._id, poster: 'url' });

      const response = await request(app)
        .get(`/api/v1/contents/series/${series._id}/seasons`)
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/contents/series/:seriesId/seasons', {}, response.body, 'GET-SEASONS', 'Admin fetches seasons');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
    });
  });

  describe('Episode Management', () => {
    it('successfully creates an episode (POST /api/v1/contents/series/:seriesId/episodes)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const series = await Content.create({ title: 'Series', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES' });
      const season = await Season.create({ title: 'Season 1', seasonNumber: 1, seriesId: series._id, poster: 'url' });

      const payload = {
        title: 'Episode 1',
        description: 'First episode',
        videoUrl: 'http://video.com',
        thumbnail: 'http://thumb.jpg',
        duration: 45,
        releaseDate: new Date(),
        seasonId: season._id.toString(),
        seasonNumber: 1,
        episodeNumber: 1,
        availability: 'FREE'
      };

      const response = await request(app)
        .post(`/api/v1/contents/series/${series._id}/episodes`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      logApi('POST', '/api/v1/contents/series/:seriesId/episodes', { body: payload }, response.body, 'CREATE-EPISODE', 'Admin creates an episode');

      expect(response.status).toBe(StatusCodes.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Episode 1');
    });

    it('successfully fetches episodes (GET /api/v1/contents/series/:seriesId/episodes)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const series = await Content.create({ title: 'Series', description: 'desc', duration: 0, releaseYear: 2024, type: 'SERIES' });
      const season = await Season.create({ title: 'Season 1', seasonNumber: 1, seriesId: series._id, poster: 'url' });
      await Episode.create({
        title: 'Episode 1',
        description: 'desc',
        videoUrl: 'url',
        thumbnail: 'url',
        duration: 45,
        releaseDate: new Date(),
        seriesId: series._id,
        seasonId: season._id,
        seasonNumber: 1,
        episodeNumber: 1
      });

      const response = await request(app)
        .get(`/api/v1/contents/series/${series._id}/episodes`)
        .set('Authorization', `Bearer ${token}`);

      logApi('GET', '/api/v1/contents/series/:seriesId/episodes', {}, response.body, 'GET-EPISODES', 'Admin fetches episodes');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
    });
  });

  describe('Multipart Upload Management', () => {
    it('successfully initiates a multipart upload (POST /api/v1/contents/upload/initiate)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const payload = { fileName: 'test.mp4', contentType: 'video/mp4' };

      vi.spyOn(ContentService, 'initiateMultipartUpload').mockResolvedValueOnce({
        uploadId: 'test-upload-id',
        key: 'movies/test.mp4'
      });

      const response = await request(app)
        .post('/api/v1/contents/upload/initiate')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      logApi('POST', '/api/v1/contents/upload/initiate', { body: payload }, response.body, 'UPLOAD-INITIATE', 'Admin initiates multipart upload');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.uploadId).toBe('test-upload-id');
      expect(response.body.data.key).toBe('movies/test.mp4');
    });

    it('successfully generates presigned URLs (POST /api/v1/contents/upload/presigned-urls)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const payload = { uploadId: 'test-upload-id', key: 'movies/test.mp4', partNumbers: [1, 2] };

      vi.spyOn(ContentService, 'generateMultipartPresignedUrls').mockResolvedValueOnce([
        { partNumber: 1, url: 'http://presigned.url/part1' },
        { partNumber: 2, url: 'http://presigned.url/part2' }
      ] as any);

      const response = await request(app)
        .post('/api/v1/contents/upload/presigned-urls')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      logApi('POST', '/api/v1/contents/upload/presigned-urls', { body: payload }, response.body, 'UPLOAD-PRESIGNED', 'Admin gets presigned URLs');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2);
      expect(response.body.data[0].url).toBe('http://presigned.url/part1');
    });

    it('successfully completes a multipart upload (POST /api/v1/contents/upload/complete)', async () => {
      const { token } = await createAuthUser(USER_ROLES.SUPER_ADMIN);
      const payload = { 
        uploadId: 'test-upload-id', 
        key: 'movies/test.mp4', 
        parts: [{ ETag: 'etag1', PartNumber: 1 }] 
      };

      vi.spyOn(ContentService, 'completeMultipartUpload').mockResolvedValueOnce({
        location: 'http://bunnycdn.url/movies/test.mp4'
      });

      const response = await request(app)
        .post('/api/v1/contents/upload/complete')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      logApi('POST', '/api/v1/contents/upload/complete', { body: payload }, response.body, 'UPLOAD-COMPLETE', 'Admin completes multipart upload');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.location).toBe('http://bunnycdn.url/movies/test.mp4');
    });
  });

});
