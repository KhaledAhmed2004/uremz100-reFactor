import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../app';
import { Content } from '../modules/content/content.model';
import { StatusCodes } from 'http-status-codes';
import { logApi } from '../../helpers/__tests__/testLogger';

// Increase timeout for E2E tests
vi.setConfig({ testTimeout: 30000 });

let replSet: MongoMemoryReplSet;
let guestId: string;
let theMovieId: string;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  // 1. Generate a unique Guest ID for the test session
  guestId = `guest-${randomUUID()}`;

  // 2. Create some Content for the Guest to interact with
  const movie1 = await Content.create({
    title: 'Guest Movie Experience',
    description: 'A great movie for guests',
    type: 'MOVIE',
    status: 'PUBLISHED',
    planStatus: ['FREE'],
    videoUrl: 'http://video.com/guest-movie.mp4',
    posterUrl: 'http://image.com/guest.jpg',
    duration: 120,
    releaseYear: 2024,
    views: 50,
    publishedAt: new Date(),
  });
  theMovieId = movie1._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Guest User E2E Flow', () => {

  describe('1. Home Page & Progress Flow', () => {
    it('should track progress using x-guest-id', async () => {
      console.info(`
📖 DOC: 
A guest user starts watching a movie. We track their progress using the 'x-guest-id' header 
since they are not logged in and have no JWT token.
`);
      const res = await request(app)
        .post('/api/v1/recently-watched/track-progress')
        .set('x-guest-id', guestId)
        .send({
          contentId: theMovieId,
          watchedSeconds: 45,
        });

      logApi('POST', '/api/v1/recently-watched/track-progress', { headers: { 'x-guest-id': guestId }, body: { contentId: theMovieId, watchedSeconds: 45 } }, res.body, 'POST-GUEST-TRACK', 'Guest user tracks watch progress');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should show the "Continue Watching" section in popular tab for guest', async () => {
      console.info(`
📖 DOC: 
When the guest visits the home page, the 'Continue Watching' section is personalized 
based on their 'x-guest-id'. The server fetches the progress they made earlier.
`);
      const res = await request(app)
        .get('/api/v1/home/content?tab=popular')
        .set('x-guest-id', guestId);

      logApi('GET', '/api/v1/home/content?tab=popular', { headers: { 'x-guest-id': guestId } }, res.body, 'GET-GUEST-HOME', 'Guest user fetches home tab with continue watching');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      const continueWatchingSection = res.body.data.sections.find((s: any) => s.id === 'row_continue_watching');
      expect(continueWatchingSection).toBeDefined();
      expect(continueWatchingSection.items.length).toBeGreaterThan(0);
      expect(continueWatchingSection.items[0]._id || continueWatchingSection.items[0].id).toBe(theMovieId);
    });
  });

  describe('2. Guest My Collection Flow', () => {
    it('should add a movie to My Collection for guest', async () => {
      console.info(`
📖 DOC: 
Even without an account, guests can add movies to 'My Collection' (Watchlist) 
using their 'x-guest-id'.
`);
      const res = await request(app)
        .post('/api/v1/my-collection')
        .set('x-guest-id', guestId)
        .send({
          itemId: theMovieId,
        });

      logApi('POST', '/api/v1/my-collection', { headers: { 'x-guest-id': guestId }, body: { itemId: theMovieId } }, res.body, 'POST-GUEST-COLLECTION', 'Guest user adds item to collection');

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('should retrieve My Collection using x-guest-id', async () => {
      console.info(`
📖 DOC: 
When the guest visits the 'My Collection' page, their saved items are fetched using their 'x-guest-id'.
`);
      const res = await request(app)
        .get('/api/v1/my-collection')
        .set('x-guest-id', guestId);

      logApi('GET', '/api/v1/my-collection', { headers: { 'x-guest-id': guestId } }, res.body, 'GET-GUEST-COLLECTION', 'Guest user views collection');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      const items = res.body.data || res.body.data?.data;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });
  });
});
