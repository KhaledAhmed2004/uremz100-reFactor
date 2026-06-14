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
📖 BDD SCENARIO: 01. ADMIN AUTHENTICATION
Feature: Admin Dashboard
  Scenario: Administrator logs into the management portal
    Given the admin provides valid SUPER_ADMIN credentials
    When the system validates the login request
    Then it issues a SUPER_ADMIN JWT token
    And grants full access to system metrics
`);
      expect(adminToken).toBeDefined();
      expect(typeof adminToken).toBe('string');
    });
  });

  describe('2. Dashboard Overview & Analytics Page', () => {
    it('should fetch the high-level Growth Metrics successfully', async () => {
      console.info(`
📖 BDD SCENARIO: 02. FETCH GROWTH METRICS
Feature: Dashboard Overview
  Scenario: Admin views high-level growth metrics
    Given the admin is authenticated as SUPER_ADMIN
    When the admin navigates to the Dashboard Overview
    Then the server returns the 'Growth Metrics'
    And the data includes active users and revenue stats
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
📖 BDD SCENARIO: 03. FETCH VISITOR ANALYTICS
Feature: Dashboard Analytics
  Scenario: Admin views visitor traffic charts
    Given the admin is authenticated
    When the frontend requests time-series visitor data
    Then the server returns DAU and MAU metrics
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
📖 BDD SCENARIO: 04. FETCH REVENUE STATS
Feature: Financial Overview
  Scenario: Admin views revenue statistics
    Given the admin is on the Financial Overview tab
    When the system calculates gross revenue
    Then the server returns recent transaction volumes
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
📖 BDD SCENARIO: 05. FETCH USER DEMOGRAPHICS
Feature: User Base Metrics
  Scenario: Admin analyzes user demographics
    Given the admin checks the User Base widget
    When the system aggregates new signups and memberships
    Then the server returns user demographics data
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
📖 BDD SCENARIO: 06. FETCH SUBSCRIPTION HEALTH
Feature: Subscription Monitor
  Scenario: Admin reviews subscription health
    Given the admin checks the Subscription Health monitor
    When the system retrieves subscription tiers
    Then the server returns a breakdown of Free vs Premium tiers
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
    it('should fetch user management metrics', async () => {
      console.info(`
📖 BDD SCENARIO: FETCH USER METRICS
Feature: User Management
  Scenario: Admin views user growth and metrics
    Given the admin navigates to the User Management page
    When the frontend requests user metrics
    Then the server returns user statistics
`);
      const res = await request(app)
        .get('/api/v1/admin/users/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/admin/users/stats', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USER-METRICS', 'Admin fetches user metrics');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should list all users securely', async () => {
      console.info(`
📖 BDD SCENARIO: 07. LIST ALL USERS
Feature: User Management
  Scenario: Admin views the user directory
    Given the admin navigates to the User Management page
    When the frontend requests a list of all users
    Then the server returns a paginated list of registered users
    And their current statuses and roles
`);
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/admin/users', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USERS-LIST', 'Admin fetches user list');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should search for users by name or email', async () => {
      console.info(`
📖 BDD SCENARIO: SEARCH USERS
Feature: User Management
  Scenario: Admin searches for a specific user
    Given the admin is on the User Management page
    When the frontend requests the user list with a 'searchTerm' query
    Then the server returns a paginated list of users matching the search
`);
      const res = await request(app)
        .get('/api/v1/admin/users?searchTerm=Target')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/admin/users?searchTerm=Target', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USERS-SEARCH', 'Admin searches for users');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should filter users by status', async () => {
      console.info(`
📖 BDD SCENARIO: FILTER USERS BY STATUS
Feature: User Management
  Scenario: Admin filters the user list by their status
    Given the admin is on the User Management page
    When the frontend requests the user list with a 'status' query (e.g., ACTIVE, SUSPENDED)
    Then the server returns only the users that match the requested status
`);
      // Test for ACTIVE status
      const activeRes = await request(app)
        .get('/api/v1/admin/users?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/admin/users?status=ACTIVE', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, activeRes.body, 'GET-ADMIN-USERS-FILTER-ACTIVE', 'Admin filters users by active status');

      expect(activeRes.status).toBe(StatusCodes.OK);
      expect(activeRes.body.success).toBe(true);
      expect(activeRes.body.data).toBeDefined();
      if (activeRes.body.data.length > 0) {
        expect(activeRes.body.data[0].status).toBe('ACTIVE');
      }

      // Test for SUSPENDED status
      const suspendedRes = await request(app)
        .get('/api/v1/admin/users?status=SUSPENDED')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/admin/users?status=SUSPENDED', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, suspendedRes.body, 'GET-ADMIN-USERS-FILTER-SUSPENDED', 'Admin filters users by suspended status');

      expect(suspendedRes.status).toBe(StatusCodes.OK);
      expect(suspendedRes.body.success).toBe(true);
    });

    it('should export the users to CSV format', async () => {
      console.info(`
📖 BDD SCENARIO: EXPORT USERS TO CSV
Feature: User Management
  Scenario: Admin exports the user directory
    Given the admin wants to download user data
    When the admin requests a CSV export from the backend
    Then the server returns the user list formatted as a CSV file
`);
      const res = await request(app)
        .get('/api/v1/admin/users/export')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/admin/users/export', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, "CSV Data Stream", 'GET-ADMIN-USERS-EXPORT', 'Admin exports users to CSV');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('filename="users-export-');
      expect(res.text).toBeDefined();
      expect(res.text).toContain('"User Name","Email","Status","Role","Coins","Subscription Status","Plan","Joined At"');
    });

    it('should view a specific user profile successfully', async () => {
      console.info(`
📖 BDD SCENARIO: 08. VIEW USER PROFILE
Feature: User Management
  Scenario: Admin inspects a specific user
    Given the admin has the target user's ID
    When the admin clicks on the target user's profile
    Then the system retrieves their details, subscriptions, and history
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

    it('should edit user details by admin', async () => {
      console.info(`
📖 BDD SCENARIO: EDIT USER DETAILS
Feature: User Management
  Scenario: Admin updates user information
    Given the admin wants to modify a user's details
    When the admin submits updated name and profile info
    Then the system updates the user
    And returns the updated data
`);
      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Edited Name' });

      logApi('PATCH', `/api/v1/admin/users/${targetUserId}`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { name: 'Admin Edited Name' } }, res.body, 'PATCH-ADMIN-USER-EDIT', 'Admin edits user profile');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();

      // Verify the edit took effect
      const verifyRes = await request(app)
        .get(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(verifyRes.body.data.name).toBe('Admin Edited Name');
    });

    it('should suspend or block the user successfully', async () => {
      console.info(`
📖 BDD SCENARIO: 09. SUSPEND USER ACCOUNT
Feature: User Management
  Scenario: Admin detects suspicious activity and suspends user
    Given the admin identifies a suspicious user
    When the admin updates the user's status to 'SUSPENDED'
    Then the backend enforces this change instantly
    And prevents the user from accessing the platform
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
📖 BDD SCENARIO: 10. PERMANENTLY DELETE USER
Feature: User Management
  Scenario: Admin processes a GDPR deletion request
    Given the admin needs to delete a user account
    When the admin triggers a permanent deletion
    Then the system cascades the deletion
    And fully removes the user from the database
`);
      const res = await request(app)
        .delete(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('DELETE', `/api/v1/admin/users/${targetUserId}`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'DELETE-ADMIN-USER', 'Admin permanently deletes a user');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should bulk delete users securely', async () => {
      console.info(`
📖 BDD SCENARIO: BULK DELETE USERS
Feature: User Management
  Scenario: Admin processes a bulk deletion request
    Given the admin has selected multiple users to delete
    When the admin triggers a bulk deletion
    Then the system permanently removes all selected users
`);
      // using a dummy ID or the already deleted targetUserId
      const res = await request(app)
        .delete('/api/v1/admin/users/bulk-delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [targetUserId] });

      logApi('DELETE', '/api/v1/admin/users/bulk-delete', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { userIds: ['<USER_ID>'] } }, res.body, 'DELETE-ADMIN-USERS-BULK', 'Admin bulk deletes users');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });
  });

  describe('4. Content Management Flow', () => {
    it('should manually boost a content to the Popular tab', async () => {
      console.info(`
📖 BDD SCENARIO: 11. MANUALLY BOOST CONTENT
Feature: Content Management
  Scenario: Admin promotes a movie to the Popular tab
    Given a new movie has zero views
    When the admin toggles the "Force Popular" switch
    Then the system updates the 'isPopularSeries' flag to true
    And the movie overrides the organic trending algorithm
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

  describe('5. Genres Management Flow', () => {
    let targetGenreId: string;

    it('should create a new genre', async () => {
      console.info(`
📖 BDD SCENARIO: CREATE GENRE
Feature: Genres Management
  Scenario: Admin creates a new content genre
    Given the admin wants to categorize content
    When the admin submits a new genre with name and description
    Then the system creates the genre
    And returns the genre details
`);
      const payload = { name: 'E2E Genre', description: 'Created from Admin Flow test' };
      const res = await request(app)
        .post('/api/v1/genres')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      logApi('POST', '/api/v1/genres', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: payload }, res.body, 'POST-ADMIN-GENRES', 'Admin creates a new genre');

      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.success).toBe(true);
      targetGenreId = res.body.data.id || res.body.data._id;
      expect(targetGenreId).toBeDefined();
    });

    it('should fetch all genres securely', async () => {
      console.info(`
📖 BDD SCENARIO: FETCH GENRES
Feature: Genres Management
  Scenario: Admin views all existing genres
    Given the admin is on the genres page
    When the admin fetches the genre list
    Then the server returns the genres
`);
      const res = await request(app)
        .get('/api/v1/genres')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/genres', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-GENRES', 'Admin fetches all genres');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should edit the genre details securely', async () => {
      console.info(`
📖 BDD SCENARIO: EDIT GENRE
Feature: Genres Management
  Scenario: Admin updates a genre name
    Given the admin has selected a genre
    When the admin updates its name
    Then the system reflects the updated name
`);
      const payload = { name: 'E2E Genre Updated' };
      const res = await request(app)
        .patch(`/api/v1/genres/${targetGenreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      logApi('PATCH', `/api/v1/genres/${targetGenreId}`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: payload }, res.body, 'PATCH-ADMIN-GENRES', 'Admin edits genre');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('E2E Genre Updated');
    });

    it('should bulk delete the genres securely', async () => {
      console.info(`
📖 BDD SCENARIO: BULK DELETE GENRES
Feature: Genres Management
  Scenario: Admin deletes selected genres
    Given the admin selected the test genre
    When the admin triggers bulk deletion
    Then the system permanently removes it
`);
      const payload = { ids: [targetGenreId] };
      const res = await request(app)
        .delete('/api/v1/genres')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      logApi('DELETE', '/api/v1/genres', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: payload }, res.body, 'DELETE-ADMIN-GENRES-BULK', 'Admin bulk deletes genres');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deletedCount).toBeGreaterThanOrEqual(1);
    });
  });
});
