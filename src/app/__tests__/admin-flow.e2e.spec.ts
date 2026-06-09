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
let adminToken: string;
let targetUserId: string;
let targetContentId: string;

beforeAll(async () => {
  // Start In-Memory MongoDB ReplSet
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  // 1. Create a SUPER_ADMIN User
  const adminUser = await User.create({
    name: 'System Admin',
    role: USER_ROLES.SUPER_ADMIN,
    email: `admin_${randomUUID()}@test.com`,
    password: 'secureAdminPassword123!',
    isVerified: true,
    status: USER_STATUS.ACTIVE,
  });

  // 2. Create a Dummy Regular User to Manage
  const regularUser = await User.create({
    name: 'Target User',
    role: USER_ROLES.USER,
    email: `target_${randomUUID()}@test.com`,
    password: 'securePassword123!',
    isVerified: true,
    status: USER_STATUS.ACTIVE,
  });
  targetUserId = regularUser._id.toString();

  // 3. Create a Dummy Content to Boost
  const content = await Content.create({
    title: 'Brand New Original Movie',
    description: 'An expensive new production with zero organic views initially.',
    type: 'MOVIE',
    duration: 120,
    releaseYear: 2026,
    status: 'PUBLISHED',
    planStatus: ['FREE'],
    videoUrl: 'http://video.com/new_movie.mp4',
    views: 0,
    isPopularSeries: false,
  });
  targetContentId = content._id.toString();

  // Generate valid JWT token for the admin
  adminToken = jwtHelper.createToken(
    { id: adminUser._id, role: adminUser.role, tokenVersion: adminUser.tokenVersion || 0 },
    config.jwt.jwt_secret as Secret,
    '1d',
  );

  // Note: For a fully populated dashboard, we would usually seed thousands of transactions,
  // users, and contents here. For the E2E flow, we just ensure the endpoints return 200 OK 
  // and match the expected response structure.
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

describe('Master Admin Dashboard Flow (E2E)', () => {
  describe('1. Admin Authentication', () => {
    it('should successfully authenticate the admin and grant super access', () => {
      console.info(`
📖 DOC: 
Step 1: The Administrator logs into the management portal securely.
The system validates the credentials and issues a SUPER_ADMIN JWT.
With this token, the admin is granted god-mode access to all system 
metrics, user data, and financial overviews.
`);
      expect(adminToken).toBeDefined();
      expect(typeof adminToken).toBe('string');
    });
  });

  describe('2. Dashboard Overview & Analytics Page', () => {
    it('should fetch the high-level Growth Metrics successfully', async () => {
      console.info(`
📖 DOC: 
Step 2: The Admin navigates to the primary Dashboard Overview page.
The frontend immediately requests the high-level 'Growth Metrics'.
This includes total active users, revenue metrics, and system 
health indicators.
`);
      const res = await request(app)
        .get('/api/v1/admin/growth-metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/admin/growth-metrics', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-GROWTH', 'Admin fetches high-level growth metrics');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should fetch the Visitors Analytics successfully', async () => {
      console.info(`
📖 DOC: 
Step 3: The Admin scrolls to the 'Visitor Traffic' section.
The frontend requests time-series data to render beautiful charts
showing DAU (Daily Active Users) and MAU (Monthly Active Users).
`);
      const res = await request(app)
        .get('/api/v1/admin/visitors/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/admin/visitors/analytics', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-VISITORS', 'Admin fetches visitor analytics chart data');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should fetch the Revenue & Financial Stats successfully', async () => {
      console.info(`
📖 DOC: 
Step 4: The Admin clicks the 'Financial Overview' tab.
The system calculates gross revenue, recent transaction volumes,
and highlights top-grossing subscriptions.
`);
      const res = await request(app)
        .get('/api/v1/admin/revenue/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/admin/revenue/stats', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-REVENUE', 'Admin fetches revenue stats');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should fetch the User Demographic Stats successfully', async () => {
      console.info(`
📖 DOC: 
Step 5: The Admin checks the 'User Base' widget.
This pulls aggregated metrics on new signups, active memberships,
and general user demographics for targeted marketing analysis.
`);
      const res = await request(app)
        .get('/api/v1/admin/users/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/admin/users/stats', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USERS-STATS', 'Admin fetches user demographic stats');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should fetch the active Subscriptions Stats successfully', async () => {
      console.info(`
📖 DOC: 
Step 6: The Admin reviews the 'Subscription Health' monitor.
The system returns a breakdown of Free vs Premium tiers, churn rate
predictions, and current active VIP members.
`);
      const res = await request(app)
        .get('/api/v1/admin/subscriptions/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/admin/subscriptions/stats', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-SUBSCRIPTIONS', 'Admin fetches subscription analytics');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('3. User Management Flow', () => {
    it('should list all users securely', async () => {
      console.info(`
📖 DOC: 
Step 7: The Admin navigates to the 'User Management' page.
The frontend issues a request to fetch a paginated list of all registered users
along with their statuses and roles.
`);
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/admin/users', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USERS-LIST', 'Admin fetches user list');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should view a specific user profile successfully', async () => {
      console.info(`
📖 DOC: 
Step 8: The Admin clicks on 'Target User' to inspect their profile.
The system securely retrieves their PII, active subscriptions, and watch 
history for administrative support.
`);
      const res = await request(app)
        .get(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', `/api/v1/admin/users/${targetUserId}`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USER-PROFILE', 'Admin inspects a specific user');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      const returnedId = res.body.data._id || res.body.data.id;
      expect(returnedId).toBe(targetUserId);
    });

    it('should suspend or block the user successfully', async () => {
      console.info(`
📖 DOC: 
Step 9: The Admin detects suspicious activity and updates the user's status 
to 'SUSPENDED'.
The backend enforces this change instantly, preventing the user from 
accessing the platform until resolved.
`);
      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });

      logApi('PATCH', `/api/v1/admin/users/${targetUserId}/status`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { status: 'SUSPENDED' } }, res.body, 'PATCH-ADMIN-USER-STATUS', 'Admin blocks a user');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should securely delete the user from the system', async () => {
      console.info(`
📖 DOC: 
Step 10: The Admin permanently deletes the user account per GDPR request.
The system cascades the deletion and fully removes the user from the database.
`);
      const res = await request(app)
        .delete(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('DELETE', `/api/v1/admin/users/${targetUserId}`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'DELETE-ADMIN-USER', 'Admin permanently deletes a user');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });
  describe('4. Content Management Flow', () => {
    it('should manually boost a content to the Popular tab', async () => {
      console.info(`
📖 DOC: 
Step 11: The Admin wants to promote a brand-new movie that has zero views.
They navigate to the Content Manager and toggle the "Force Popular" switch.
The system securely updates the 'isPopularSeries' flag to true, instantly 
placing the movie at the top of the user's Popular Feed, overriding the organic 
Trending algorithm.
`);
      const res = await request(app)
        .patch(`/api/v1/admin/content/${targetContentId}/boost`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPopularSeries: true });

      logApi('PATCH', `/api/v1/admin/content/${targetContentId}/boost`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { isPopularSeries: true } }, res.body, 'PATCH-ADMIN-BOOST-CONTENT', 'Admin manually boosts a movie to the popular tab');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPopularSeries).toBe(true);
    });
  });
});
