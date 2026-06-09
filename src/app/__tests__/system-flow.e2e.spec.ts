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
let testUserEmail: string;
const TEST_PASSWORD = 'password123';
let theMovieId: string;
let shortsCursor: string;
let myCollectionId: string;
let selectedShortId: string;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  testUserEmail = `${randomUUID()}@test.com`;

  // 1. Create a User
  const user = await User.create({
    name: 'E2E Flow User',
    role: USER_ROLES.USER,
    email: testUserEmail,
    password: TEST_PASSWORD,
    isVerified: true,
  });
  testUserId = user._id.toString();

  // Initialize Reward Wallet and Progress for the E2E user
  const { Wallet, UserRewardProgress } = await import('../modules/reward/reward.model');
  await Wallet.create({ user: user._id, goldBalance: 0, bonusLedger: [] });
  await UserRewardProgress.create({ user: user._id });

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
    publishedAt: new Date(),
    views: 1000,
    engagementScore: 100,
    trendingScore: 100,
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
    publishedAt: new Date(),
    views: 500,
    engagementScore: 80,
    trendingScore: 80,
  });

  // Create 10 more movies to trigger cursor pagination for limit=10
  for (let i = 0; i < 10; i++) {
    await Content.create({
      title: `Extra Movie ${i}`,
      description: 'Just to fill the feed',
      type: i % 2 === 0 ? 'MOVIE' : 'SERIES',
      status: 'PUBLISHED',
      planStatus: ['FREE'],
      videoUrl: 'http://video.com/extra.mp4',
      poster: 'http://image.com/extra.jpg',
      duration: 120,
      releaseYear: 2020,
      publishedAt: new Date(),
      views: 10,
      engagementScore: 20 + i,
      trendingScore: 20 + i,
    });
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Master System Flow E2E Tests', () => {

  describe('0. Authentication Flow', () => {
    it('should successfully login and obtain a valid auth token', async () => {
      console.info(`
📖 DOC: 
Step 0: The user enters their email and password to log in.
The system verifies the credentials and returns a JWT token.
`);
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserEmail,
          password: TEST_PASSWORD,
        });

      logApi('POST', '/api/v1/auth/login', { body: { email: testUserEmail, password: TEST_PASSWORD } }, res.body, 'POST-AUTH-LOGIN', 'User logs in to the system');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();

      // Ensure the newly issued token actually works (overriding the one generated in beforeAll if needed)
      userToken = res.body.data.accessToken;
    });
  });

  describe('1. Home Page Flow', () => {
    it('should return search results from the home page search bar', async () => {
      console.info(`
📖 DOC: 
When a user searches for a movie from the search bar (e.g., 'Batman'), 
the system queries the content collection to find matches and returns them instantly.
`);
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
      console.info(`
📖 DOC: 
Step 2: The user switches to the 'Popular' tab on the home screen.
The system dynamically fetches the 'Trending Now' and 'Most Popular' sections.
Instead of relying on simple "all-time views" (which unfairly favors old content), 
the system uses a Netflix-style hybrid algorithm. It calculates a 'trendingScore' 
based on weekly momentum, and an 'engagementScore' based on a composite of views, 
watch time, and user ratings. This ensures that only high-quality, truly viral 
content floats to the top of the user's feed.
`);
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

    it('should load the new tab successfully and include virtual isRecent flag', async () => {
      console.info(`
📖 DOC: 
The 'New' tab displays freshly published movies and series.
Instead of relying on a manual boolean flag, the system automatically 
calculates a 30-day rolling window based on the 'publishedAt' date. 
It dynamically appends an 'isRecent' virtual field to the API response 
so the frontend can display a "NEW" badge without any extra logic!
`);
      const res = await request(app)
        .get('/api/v1/home/content?tab=new')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/home/content?tab=new', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-NEW', 'User fetches new home tab');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      const newReleasesSection = res.body.data.sections.find((s: any) => s.id === 'row_new_releases');
      expect(newReleasesSection).toBeDefined();
      
      // Ensure the virtual field is attached to the response
      if (newReleasesSection.items.length > 0) {
        expect(newReleasesSection.items[0].isRecent).toBeDefined();
        // Since the dummy data uses 'new Date()' for publishedAt, this should be true.
        expect(newReleasesSection.items[0].isRecent).toBe(true);
      }
    });

    it('should load the vip tab successfully with default daily filter', async () => {
      console.info(`
📖 DOC: 
The 'VIP' tab loads premium content exclusively available to paid subscribers.
By default, when no filter is provided, it returns "Today's VIP Picks".
`);
      const res = await request(app)
        .get('/api/v1/home/content?tab=vip')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/home/content?tab=vip', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-VIP-DAILY', 'User fetches vip home tab (daily default)');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      const dailyVipSection = res.body.data.sections.find((s: any) => s.id === 'row_vip_daily');
      expect(dailyVipSection).toBeDefined();
    });

    it('should load the vip tab successfully with weekly filter', async () => {
      console.info(`
📖 DOC: 
Users can click the "Weekly" toggle on the VIP page to filter premium content 
based on weekly performance.
`);
      const res = await request(app)
        .get('/api/v1/home/content?tab=vip&filter=weekly')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/home/content?tab=vip&filter=weekly', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-VIP-WEEKLY', 'User fetches vip home tab (weekly filter)');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      const weeklyVipSection = res.body.data.sections.find((s: any) => s.id === 'row_vip_weekly');
      expect(weeklyVipSection).toBeDefined();
    });

    it('should load the ranking tab successfully', async () => {
      console.info(`
📖 DOC: 
The 'Ranking' tab shows leaderboards (e.g., weekly or monthly top charts) 
based on total views and user engagement.
`);
      const res = await request(app)
        .get('/api/v1/home/content?tab=ranking&filter=weekly')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/home/content?tab=ranking&filter=weekly', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-RANKING', 'User fetches ranking home tab');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should fetch the specific watch progress for a selected movie (Option 3 Architecture)', async () => {
      console.info(`
📖 DOC: 
When a user clicks on a movie from the search results or a category (not from "Continue Watching"),
the frontend makes a specific request to fetch the user's progress for that single movie.
This allows playback to resume from the exact paused location, independent of the home page feed.
`);
      const res = await request(app)
        .get(`/api/v1/recently-watched/content/${theMovieId}`)
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', `/api/v1/recently-watched/content/${theMovieId}`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SINGLE-PROGRESS', 'User fetches progress for a specific movie');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      // Data will be null if not watched yet, which is expected for theMovieId right now
      expect(res.body.data).toBeDefined();
    });

    it('should track progress for the selected movie to appear in Recently Watched', async () => {
      console.info(`
📖 DOC: 
While watching the movie, the app tracks progress. This ensures the movie appears in the "Continue Watching" list.
`);
      const res = await request(app)
        .post('/api/v1/recently-watched/track-progress')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          contentId: theMovieId,
          watchedSeconds: 60,
        });

      logApi('POST', '/api/v1/recently-watched/track-progress', { headers: { Authorization: `Bearer ${userToken}` }, body: { contentId: theMovieId, watchedSeconds: 60 } }, res.body, 'POST-TRACK-PROGRESS', 'User tracks watch progress for movie');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should return the "Continue Watching" section in the popular tab after tracking progress', async () => {
      console.info(`
📖 DOC: 
Because the user just tracked progress for a movie, reloading the Home page (Popular tab)
will now dynamically return the 'Continue Watching' row as the very first section!
`);
      const res = await request(app)
        .get('/api/v1/home/content?tab=popular')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/home/content?tab=popular', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-CONTINUE-WATCHING', 'User fetches home tab to see continue watching');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      const continueWatchingSection = res.body.data.sections.find((s: any) => s.id === 'row_continue_watching');
      expect(continueWatchingSection).toBeDefined();
      expect(continueWatchingSection.items.length).toBeGreaterThan(0);
      expect(continueWatchingSection.items[0]._id || continueWatchingSection.items[0].id).toBe(theMovieId);
    });

  });

  describe('2. Shorts Page & Player Flow', () => {
    describe('A. Infinite Scrolling (Feed)', () => {
      it('Step 1: User opens the shorts feed and the first 5 videos are loaded without a cursor', async () => {
        console.info(`
📖 DOC: 
When the user first opens the shorts page, a request is made without a cursor. 
The server returns the first batch of videos and a nextCursor to load the subsequent videos.

❓ WHY NO CURSOR?: Because this is the initial page load. 
Without a cursor, the server knows to start fetching from the very beginning (the latest or top videos in the feed). 
The returned nextCursor acts as a pointer for all subsequent scrolling requests.
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
      it('Step 3: User watches a video for 3 seconds and a view is tracked', async () => {
        console.info(`
📖 DOC: 
For Shorts, we do not track 'watchedSeconds' or allow resuming because videos are too short.
Instead, we only track the number of views (e.g., when a user watches more than 3 seconds).
`);
        const res = await request(app)
          .post(`/api/v1/shorts/${selectedShortId}/view`)
          .set('Authorization', `Bearer ${userToken}`);

        logApi('POST', `/api/v1/shorts/${selectedShortId}/view`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-TRACK-VIEW', 'User watches short and triggers view count');

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.success).toBe(true);
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
    beforeAll(async () => {
      // Seed data to ensure these tests can be run in isolation (e.g. from Vitest UI)
      await request(app).post('/api/v1/recently-watched/track-progress').set('Authorization', `Bearer ${userToken}`).send({
        contentId: theMovieId, watchedSeconds: 60,
      });
      await request(app).post('/api/v1/my-collection').set('Authorization', `Bearer ${userToken}`).send({
        itemId: theMovieId,
      });
    });

    it('should show the movie in Recently Watched', async () => {
      console.info(`
📖 DOC: 
Step 1: The user navigates to the 'My List' section and opens 'Recently Watched'.
The server retrieves all the content the user has started watching, 
allowing them to easily resume playback right from where they left off.
`);
      const res = await request(app)
        .get('/api/v1/recently-watched')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/recently-watched', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-RECENTLY-WATCHED', 'User views recently watched list');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      const items = res.body.data.data || res.body.data;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);

      // Ensure the movie we tracked is in the list
      const watchedItem = items.find((item: any) => item.contentId?.id === theMovieId || item.contentId?._id?.toString() === theMovieId || item.contentId === theMovieId);
      if (!watchedItem) console.log('RECENTLY WATCHED ITEMS:', JSON.stringify(items, null, 2));
      expect(watchedItem).toBeDefined();
    });

    it('should show the movie in My Collection', async () => {
      console.info(`
📖 DOC: 
Step 2: The user switches to the 'My Collection' (or Watchlist) tab.
The server retrieves all the movies, series, and shorts the user has explicitly saved or liked.
This acts as a personal library of favorite content.
`);
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

  describe('4. Rewards Page Flow', () => {
    it('should show the initial wallet balance as 0', async () => {
      console.info(`
📖 DOC: 
Step 1: The user navigates to the 'Rewards' page.
The server retrieves the user's wallet details, which defaults to 0 upon registration.
`);
      const res = await request(app)
        .get('/api/v1/rewards/wallet')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/rewards/wallet', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-WALLET', 'User views their coin wallet');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.goldBalance).toBe(0);
      expect(res.body.data.bonusBalance).toBe(0);
      expect(res.body.data.transactions).toEqual([]);
    });

    it('should allow the user to claim a daily check-in reward', async () => {
      console.info(`
📖 DOC: 
Step 2: The user clicks "Claim" on the Daily Check-In reward.
The server verifies the streak and adds 20 coins to the user's wallet.
`);
      const res = await request(app)
        .post('/api/v1/rewards/claim/check-in')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('POST', '/api/v1/rewards/claim/check-in', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-CLAIM-CHECKIN', 'User claims daily check-in reward');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rewardAmount).toBe(20);
      expect(res.body.data.currentStreak).toBe(1);
    });

    it('should show the updated wallet balance after claiming a reward', async () => {
      console.info(`
📖 DOC: 
Step 3: The Rewards page reloads or the wallet updates instantly.
The server retrieves the updated wallet showing 20 coins and 1 recent transaction.
`);
      const res = await request(app)
        .get('/api/v1/rewards/wallet')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/rewards/wallet', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-WALLET-UPDATED', 'User views updated coin wallet');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.goldBalance).toBe(0);
      expect(res.body.data.bonusBalance).toBe(20);
      expect(res.body.data.transactions.length).toBe(1);
      expect(res.body.data.transactions[0].source).toBe('daily_check_in');
      expect(res.body.data.transactions[0].amount).toBe(20);
    });
  });

});
