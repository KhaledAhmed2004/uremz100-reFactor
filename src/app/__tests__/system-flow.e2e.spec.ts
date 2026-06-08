import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../app';
import { User } from '../modules/user/user.model';
import { Content } from '../modules/content/content.model';
import { jwtHelper } from '../../helpers/jwtHelper';
import config from '../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../enums/user';
import { StatusCodes } from 'http-status-codes';
import { logApi } from '../../helpers/__tests__/testLogger';

// Increase timeout for E2E tests
vi.setConfig({ testTimeout: 30000 });

let replSet: MongoMemoryReplSet;
let userToken: string;
let testUserId: string;
let theMovieId: string;
let shortsCursor: string;
let myCollectionId: string;
let selectedShortId: string;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  // 1. Create a User
  const user = await User.create({
    name: 'E2E Flow User',
    role: USER_ROLES.BROTHER,
    email: `${randomUUID()}@test.com`,
    password: 'password123',
    isVerified: true,
    status: USER_STATUS.ACTIVE,
    revertDate: new Date(),
    dateOfBirth: new Date('1990-01-01'),
    profileImage: '/default.jpg',
    verificationImage: '/img.jpg',
    verificationVideo: '/vid.mp4',
  });
  testUserId = user._id.toString();

  userToken = jwtHelper.createToken(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
    config.jwt.jwt_secret as Secret,
    '1d',
  );

  // 2. Create some Content
  const movie1 = await Content.create({
    title: 'Batman The Dark Knight',
    description: 'A great movie',
    type: 'MOVIE',
    status: 'PUBLISHED',
    planStatus: ['FREE'],
    videoUrl: 'http://video.com/batman.mp4',
    poster: 'http://image.com/batman.jpg',
    duration: 120,
    releaseYear: 2008,
    isRecent: true,
    views: 1000,
  });
  theMovieId = movie1._id.toString();

  await Content.create({
    title: 'Superman Returns',
    description: 'Another great movie',
    type: 'MOVIE',
    status: 'PUBLISHED',
    planStatus: ['MONTHLY'],
    trailerUrl: 'http://trailer.com/superman.mp4',
    videoUrl: 'http://video.com/superman.mp4',
    poster: 'http://image.com/superman.jpg',
    duration: 120,
    releaseYear: 2006,
    isRecent: true,
    views: 500,
  });

  // Create 10 more movies to trigger cursor pagination for limit=10
  for (let i = 0; i < 10; i++) {
    await Content.create({
      title: `Extra Movie ${i}`,
      description: 'Just to fill the feed',
      type: 'MOVIE',
      status: 'PUBLISHED',
      planStatus: ['FREE'],
      videoUrl: 'http://video.com/extra.mp4',
      poster: 'http://image.com/extra.jpg',
      duration: 120,
      releaseYear: 2020,
      isRecent: true,
      views: 10,
    });
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Master System Flow E2E Tests', () => {

  describe('1. Home Page Flow', () => {
    it('should return search results from the home page search bar', async () => {
      const res = await request(app)
        .get('/api/v1/contents/search?searchTerm=Batman')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/contents/search?searchTerm=Batman', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SEARCH', 'User searches for a movie from home page');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      // The search endpoint might return paginated structure
      const results = res.body.data?.data || res.body.data;
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Batman');
    });

    it('should load the popular tab successfully', async () => {
      const res = await request(app)
        .get('/api/v1/home/content?tab=popular')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/home/content?tab=popular', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-POPULAR', 'User fetches popular home tab');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sections).toBeDefined();
      expect(Array.isArray(res.body.data.sections)).toBe(true);

      // Ensure the trending section is returned
      const trendingSection = res.body.data.sections.find((s: any) => s.id === 'row_trending_now');
      expect(trendingSection).toBeDefined();
    });

    it('should load the new tab successfully', async () => {
      const res = await request(app)
        .get('/api/v1/home/content?tab=new')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/home/content?tab=new', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-NEW', 'User fetches new home tab');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should load the vip tab successfully', async () => {
      const res = await request(app)
        .get('/api/v1/home/content?tab=vip')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/home/content?tab=vip', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-VIP', 'User fetches vip home tab');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should load the ranking tab successfully', async () => {
      const res = await request(app)
        .get('/api/v1/home/content?tab=ranking&filter=weekly')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/home/content?tab=ranking&filter=weekly', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-RANKING', 'User fetches ranking home tab');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

  });

  describe('2. Shorts Page & Player Flow', () => {
    describe('A. Infinite Scrolling (Feed)', () => {
      it('Step 1: User opens the shorts feed and the first 5 videos are loaded without a cursor', async () => {
        console.info(`
📖 DOC: 
When the user first opens the shorts page, a request is made without a cursor. 
The server returns the first batch of videos and a nextCursor to load the subsequent videos.

❓ WHY NO CURSOR?: Because this is the initial page load. Without a cursor, the server knows to start fetching from the very beginning (the latest or top videos in the feed). The returned nextCursor acts as a pointer for all subsequent scrolling requests.
`);
        const res = await request(app)
          .get('/api/v1/shorts?limit=5')
          .set('Authorization', `Bearer ${userToken}`);

        logApi('GET', '/api/v1/shorts?limit=5', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SHORTS-P1', 'User fetches shorts page 1');

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);

        // Save cursor for next test
        if (res.body.meta?.nextCursor) {
          shortsCursor = res.body.meta.nextCursor;
        }

        // A real user sees the shorts and its details from the feed response
        const firstShort = res.body.data[0];
        expect(firstShort.title).toBeDefined();
        expect(firstShort.videoUrl).toBeDefined();

        // Save the selected short for subsequent actions (play, add to collection)
        selectedShortId = firstShort.contentId || firstShort.id || firstShort._id;
      });

      it('Step 2: User scrolls down, triggering a request with the nextCursor to load the next 5 videos', async () => {
        console.info(`
📖 DOC: 
As the user scrolls to the bottom, the app uses the previously received nextCursor to fetch the next set of videos. 
This creates an infinite scrolling experience.
`);
        // If no cursor was returned (because total items < 5), we will just pass a dummy or omit it.
        // But to test the endpoint handles it, we will append it if it exists.
        const cursorParam = shortsCursor ? `&cursor=${shortsCursor}` : '';
        const res = await request(app)
          .get(`/api/v1/shorts?limit=5${cursorParam}`)
          .set('Authorization', `Bearer ${userToken}`);

        logApi('GET', `/api/v1/shorts?limit=5${cursorParam}`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SHORTS-P2', 'User fetches shorts page 2');

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.success).toBe(true);
      });
    });

    describe('B. Video Playback & Engagement', () => {
      it('Step 3: User watches a video and their watch progress is tracked to allow resuming later', async () => {
        console.info(`
📖 DOC: 
While the user watches a video, the app periodically sends the watchedSeconds and completionPercentage to the server. 
This allows the user to resume the video from exactly where they left off.
`);
        const res = await request(app)
          .post('/api/v1/recently-watched/track-progress')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            contentId: selectedShortId,
            watchedSeconds: 60, // user watches for 60 seconds
            completionPercentage: 50,
          });

        logApi('POST', '/api/v1/recently-watched/track-progress', { headers: { Authorization: `Bearer ${userToken}` }, body: { contentId: selectedShortId, watchedSeconds: 60, completionPercentage: 50 } }, res.body, 'POST-TRACK-PROGRESS', 'User tracks watch progress');

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.success).toBe(true);
        expect(res.body.data.contentId.toString()).toBe(selectedShortId);
      });

      it('Step 4: User likes the video and adds it to their personal My Collection list', async () => {
        console.info(`
📖 DOC: 
If the user enjoys the video, they can add it to their personal collection. 
The server saves this relationship so it can be retrieved later in the My List page.
`);
        const res = await request(app)
          .post('/api/v1/my-collection')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            itemId: selectedShortId,
          });

        logApi('POST', '/api/v1/my-collection', { headers: { Authorization: `Bearer ${userToken}` }, body: { itemId: selectedShortId } }, res.body, 'POST-MY-COLLECTION', 'User adds short to collection');

        if (![200, 201].includes(res.status)) console.log('MY COLLECTION POST ERROR:', res.status, res.body);
        expect([200, 201]).toContain(res.status);
        expect(res.body.success).toBe(true);

        myCollectionId = res.body.data._id || res.body.data.id;
      });
    });
  });

  describe('3. My List Page Flow', () => {
    it('should show the short in Recently Watched', async () => {
      const res = await request(app)
        .get('/api/v1/recently-watched')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/recently-watched', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-RECENTLY-WATCHED', 'User views recently watched list');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      const items = res.body.data.data || res.body.data;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);

      // Ensure the short we tracked is in the list
      const watchedItem = items.find((item: any) => item.contentId?.id === selectedShortId || item.contentId?._id?.toString() === selectedShortId || item.contentId === selectedShortId);
      if (!watchedItem) console.log('RECENTLY WATCHED ITEMS:', JSON.stringify(items, null, 2));
      expect(watchedItem).toBeDefined();
    });

    it('should show the movie in My Collection', async () => {
      const res = await request(app)
        .get('/api/v1/my-collection')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/my-collection', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-MY-COLLECTION', 'User views their collection');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      const items = res.body.data || res.body.data?.data;
      expect(Array.isArray(items)).toBe(true);
      if (items.length === 0) console.log('MY COLLECTION GET ITEMS:', JSON.stringify(res.body, null, 2));
      expect(items.length).toBeGreaterThan(0);
    });
  });

});
