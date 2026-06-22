"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = require("crypto");
const mongodb_memory_server_1 = require("mongodb-memory-server");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../app"));
const user_model_1 = require("../modules/user/user.model");
const content_model_1 = require("../modules/content/content.model");
const revenue_model_1 = require("../modules/revenue/revenue.model");
const subscription_model_1 = require("../modules/subscription/subscription.model");
const jwtHelper_1 = require("../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../config"));
const user_1 = require("../../enums/user");
const http_status_codes_1 = require("http-status-codes");
const testLogger_1 = require("../../helpers/__tests__/testLogger");
// Increase timeout for E2E tests
vitest_1.vi.setConfig({ testTimeout: 30000 });
let replSet;
let adminToken;
let targetUserId;
let targetContentId;
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    // Start In-Memory MongoDB ReplSet
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({ replSet: { count: 1 } });
    yield mongoose_1.default.connect(replSet.getUri());
    // 1. Create a SUPER_ADMIN User
    const adminUser = yield user_model_1.User.create({
        name: 'System Admin',
        role: user_1.USER_ROLES.SUPER_ADMIN,
        email: `admin_${(0, crypto_1.randomUUID)()}@test.com`,
        password: 'secureAdminPassword123!',
        isVerified: true,
        status: user_1.USER_STATUS.ACTIVE,
    });
    // 2. Create a Dummy Regular User to Manage
    const regularUser = yield user_model_1.User.create({
        name: 'Target User',
        role: user_1.USER_ROLES.USER,
        email: `target_${(0, crypto_1.randomUUID)()}@test.com`,
        password: 'securePassword123!',
        isVerified: true,
        status: user_1.USER_STATUS.ACTIVE,
    });
    targetUserId = regularUser._id.toString();
    // 3. Create a Dummy Content to Boost
    const content = yield content_model_1.Content.create({
        title: 'Brand New Original Movie',
        description: 'An expensive new production with zero organic views initially.',
        type: 'MOVIE',
        duration: 120,
        releaseYear: 2026,
        status: 'PUBLISHED',
        planStatus: ['FREE'],
        posterUrl: 'https://picsum.photos/seed/movie8/1920/1080',
        videoUrl: 'http://video.com/new_movie.mp4',
        views: 0,
        isPopularSeries: false,
    });
    targetContentId = content._id.toString();
    // 4. Create a Dummy Revenue Transaction
    yield revenue_model_1.RevenueTransaction.create({
        userId: targetUserId,
        trxId: `TRX-${(0, crypto_1.randomUUID)()}`,
        coinAmount: 10,
        subscriptionAmount: 0,
        totalAmount: 10,
        currency: 'USD',
        platform: 'stripe',
        status: 'SUCCESS',
    });
    // 5. Create a Dummy Subscription
    yield subscription_model_1.Subscription.create({
        userId: targetUserId,
        plan: 'PREMIUM',
        status: 'active',
        platform: 'admin',
        productId: 'premium_weekly',
        startedAt: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    // 6. Create a Dummy Guest Subscription
    yield subscription_model_1.Subscription.create({
        guestId: 'guest-a1b2c3d4-e5f6-7890',
        plan: 'PREMIUM',
        status: 'active',
        platform: 'apple',
        productId: 'premium_monthly',
        appleOriginalTransactionId: `TRX-GUEST-${(0, crypto_1.randomUUID)().slice(0, 8)}`,
        startedAt: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    // Generate valid JWT token for the admin
    adminToken = jwtHelper_1.jwtHelper.createToken({ id: adminUser._id, role: adminUser.role, tokenVersion: adminUser.tokenVersion || 0 }, config_1.default.jwt.jwt_secret, '1d');
    // Note: For a fully populated dashboard, we would usually seed thousands of transactions,
    // users, and contents here. For the E2E flow, we just ensure the endpoints return 200 OK 
    // and match the expected response structure.
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    if (replSet)
        yield replSet.stop();
}));
(0, vitest_1.describe)('Master Admin Dashboard Flow (E2E)', () => {
    (0, vitest_1.describe)('1. Admin Authentication', () => {
        (0, vitest_1.it)('should successfully authenticate the admin and grant super access', () => {
            console.info(`
📖 BDD SCENARIO: 01. ADMIN AUTHENTICATION
Feature: Admin Dashboard
  Scenario: Administrator logs into the management portal
    Given the admin provides valid SUPER_ADMIN credentials
    When the system validates the login request
    Then it issues a SUPER_ADMIN JWT token
    And grants full access to system metrics
`);
            (0, vitest_1.expect)(adminToken).toBeDefined();
            (0, vitest_1.expect)(typeof adminToken).toBe('string');
        });
    });
    (0, vitest_1.describe)('2. Dashboard Overview & Analytics Page', () => {
        (0, vitest_1.it)('should fetch the high-level Growth Metrics successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 02. FETCH GROWTH METRICS
Feature: Dashboard Overview
  Scenario: Admin views high-level growth metrics
    Given the admin is authenticated as SUPER_ADMIN
    When the admin navigates to the Dashboard Overview
    Then the server returns the 'Growth Metrics'
    And the data includes active users and revenue stats
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/admin/growth-metrics')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/admin/growth-metrics', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-GROWTH', 'Admin fetches high-level growth metrics');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
        (0, vitest_1.it)('should fetch the Visitors Analytics successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 03. FETCH VISITOR ANALYTICS
Feature: Dashboard Analytics
  Scenario: Admin views visitor traffic charts
    Given the admin is authenticated
    When the frontend requests time-series visitor data
    Then the server returns DAU and MAU metrics
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/admin/visitors/analytics')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/admin/visitors/analytics', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-VISITORS', 'Admin fetches visitor analytics chart data');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
        (0, vitest_1.it)('should fetch the Revenue & Financial Stats successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 04. FETCH REVENUE STATS
Feature: Financial Overview
  Scenario: Admin views revenue statistics
    Given the admin is on the Financial Overview tab
    When the system calculates gross revenue
    Then the server returns recent transaction volumes
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/admin/revenue/stats')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/admin/revenue/stats', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-REVENUE', 'Admin fetches revenue stats');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
        (0, vitest_1.it)('should fetch the User Demographic Stats successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 05. FETCH USER DEMOGRAPHICS
Feature: User Base Metrics
  Scenario: Admin analyzes user demographics
    Given the admin checks the User Base widget
    When the system aggregates new signups and memberships
    Then the server returns user demographics data
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/admin/users/stats')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/admin/users/stats', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USERS-STATS', 'Admin fetches user demographic stats');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
        (0, vitest_1.it)('should fetch the active Subscriptions Stats successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 06. FETCH SUBSCRIPTION HEALTH
Feature: Subscription Monitor
  Scenario: Admin reviews subscription health
    Given the admin checks the Subscription Health monitor
    When the system retrieves subscription tiers
    Then the server returns a breakdown of Free vs Premium tiers
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/admin/subscriptions/stats')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/admin/subscriptions/stats', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-SUBSCRIPTIONS', 'Admin fetches subscription analytics');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
    });
    (0, vitest_1.describe)('3. User Management Flow', () => {
        (0, vitest_1.it)('should fetch user management metrics', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH USER METRICS
Feature: User Management
  Scenario: Admin views user growth and metrics
    Given the admin navigates to the User Management page
    When the frontend requests user metrics
    Then the server returns user statistics
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/admin/users/stats')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/admin/users/stats', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USER-METRICS', 'Admin fetches user metrics');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
        (0, vitest_1.it)('should list all users securely', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 07. LIST ALL USERS
Feature: User Management
  Scenario: Admin views the user directory
    Given the admin navigates to the User Management page
    When the frontend requests a list of all users
    Then the server returns a paginated list of registered users
    And their current statuses and roles
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/admin/users', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USERS-LIST', 'Admin fetches user list');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
        (0, vitest_1.it)('should search for users by name or email', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: SEARCH USERS
Feature: User Management
  Scenario: Admin searches for a specific user
    Given the admin is on the User Management page
    When the frontend requests the user list with a 'searchTerm' query
    Then the server returns a paginated list of users matching the search
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/admin/users?searchTerm=Target')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/admin/users?searchTerm=Target', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USERS-SEARCH', 'Admin searches for users');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
            (0, vitest_1.expect)(res.body.data.length).toBeGreaterThan(0);
        }));
        (0, vitest_1.it)('should filter users by status', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FILTER USERS BY STATUS
Feature: User Management
  Scenario: Admin filters the user list by their status
    Given the admin is on the User Management page
    When the frontend requests the user list with a 'status' query (e.g., ACTIVE, SUSPENDED)
    Then the server returns only the users that match the requested status
`);
            // Test for ACTIVE status
            const activeRes = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/admin/users?status=ACTIVE')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/admin/users?status=ACTIVE', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, activeRes.body, 'GET-ADMIN-USERS-FILTER-ACTIVE', 'Admin filters users by active status');
            (0, vitest_1.expect)(activeRes.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(activeRes.body.success).toBe(true);
            (0, vitest_1.expect)(activeRes.body.data).toBeDefined();
            if (activeRes.body.data.length > 0) {
                (0, vitest_1.expect)(activeRes.body.data[0].status).toBe('ACTIVE');
            }
            // Test for SUSPENDED status
            const suspendedRes = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/admin/users?status=SUSPENDED')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/admin/users?status=SUSPENDED', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, suspendedRes.body, 'GET-ADMIN-USERS-FILTER-SUSPENDED', 'Admin filters users by suspended status');
            (0, vitest_1.expect)(suspendedRes.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(suspendedRes.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should export the users to CSV format', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: EXPORT USERS TO CSV
Feature: User Management
  Scenario: Admin exports the user directory
    Given the admin wants to download user data
    When the admin requests a CSV export from the backend
    Then the server returns the user list formatted as a CSV file
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/admin/users/export')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/admin/users/export', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, "CSV Data Stream", 'GET-ADMIN-USERS-EXPORT', 'Admin exports users to CSV');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.headers['content-type']).toContain('text/csv');
            (0, vitest_1.expect)(res.headers['content-disposition']).toContain('filename="users-export-');
            (0, vitest_1.expect)(res.text).toBeDefined();
            (0, vitest_1.expect)(res.text).toContain('"User Name","Email","Status","Role","Coins","Subscription Status","Plan","Joined At"');
        }));
        (0, vitest_1.it)('should view a specific user profile successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 08. VIEW USER PROFILE
Feature: User Management
  Scenario: Admin inspects a specific user
    Given the admin has the target user's ID
    When the admin clicks on the target user's profile
    Then the system retrieves their details, subscriptions, and history
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/admin/users/${targetUserId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/admin/users/${targetUserId}`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USER-PROFILE', 'Admin inspects a specific user');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const returnedId = res.body.data._id || res.body.data.id;
            (0, vitest_1.expect)(returnedId).toBe(targetUserId);
        }));
        (0, vitest_1.it)('should edit user details by admin', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: EDIT USER DETAILS
Feature: User Management
  Scenario: Admin updates user information
    Given the admin wants to modify a user's details
    When the admin submits updated name and profile info
    Then the system updates the user
    And returns the updated data
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/admin/users/${targetUserId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Admin Edited Name' });
            (0, testLogger_1.logApi)('PATCH', `/api/v1/admin/users/${targetUserId}`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { name: 'Admin Edited Name' } }, res.body, 'PATCH-ADMIN-USER-EDIT', 'Admin edits user profile');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.id).toBeDefined();
            // Verify the edit took effect
            const verifyRes = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/admin/users/${targetUserId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, vitest_1.expect)(verifyRes.body.data.name).toBe('Admin Edited Name');
        }));
        (0, vitest_1.it)('should suspend or block the user successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 09. SUSPEND USER ACCOUNT
Feature: User Management
  Scenario: Admin detects suspicious activity and suspends user
    Given the admin identifies a suspicious user
    When the admin updates the user's status to 'SUSPENDED'
    Then the backend enforces this change instantly
    And prevents the user from accessing the platform
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/admin/users/${targetUserId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'SUSPENDED' });
            (0, testLogger_1.logApi)('PATCH', `/api/v1/admin/users/${targetUserId}/status`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { status: 'SUSPENDED' } }, res.body, 'PATCH-ADMIN-USER-STATUS', 'Admin blocks a user');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should securely delete the user from the system', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 10. PERMANENTLY DELETE USER
Feature: User Management
  Scenario: Admin processes a GDPR deletion request
    Given the admin needs to delete a user account
    When the admin triggers a permanent deletion
    Then the system cascades the deletion
    And fully removes the user from the database
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/admin/users/${targetUserId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('DELETE', `/api/v1/admin/users/${targetUserId}`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'DELETE-ADMIN-USER', 'Admin permanently deletes a user');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should bulk delete users securely', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: BULK DELETE USERS
Feature: User Management
  Scenario: Admin processes a bulk deletion request
    Given the admin has selected multiple users to delete
    When the admin triggers a bulk deletion
    Then the system permanently removes all selected users
`);
            // using a dummy ID or the already deleted targetUserId
            const res = yield (0, supertest_1.default)(app_1.default)
                .delete('/api/v1/admin/users/bulk-delete')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ userIds: [targetUserId] });
            (0, testLogger_1.logApi)('DELETE', '/api/v1/admin/users/bulk-delete', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { userIds: ['<USER_ID>'] } }, res.body, 'DELETE-ADMIN-USERS-BULK', 'Admin bulk deletes users');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
    });
    (0, vitest_1.describe)('4. Content Management Flow', () => {
        (0, vitest_1.it)('should manually boost a content to the Popular tab', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 11. MANUALLY BOOST CONTENT
Feature: Content Management
  Scenario: Admin promotes a movie to the Popular tab
    Given a new movie has zero views
    When the admin toggles the "Force Popular" switch
    Then the system updates the 'isPopularSeries' flag to true
    And the movie overrides the organic trending algorithm
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/admin/content/${targetContentId}/boost`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isPopularSeries: true });
            (0, testLogger_1.logApi)('PATCH', `/api/v1/admin/content/${targetContentId}/boost`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { isPopularSeries: true } }, res.body, 'PATCH-ADMIN-BOOST-CONTENT', 'Admin manually boosts a movie to the popular tab');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.isPopularSeries).toBe(true);
        }));
    });
    (0, vitest_1.describe)('4.1. Movies Management Flow', () => {
        (0, vitest_1.it)('should fetch the overall movies statistics successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH MOVIES STATS
Feature: Movies Management
  Scenario: Admin views overall movies statistics
    Given the admin is on the Movies Management page
    When the admin requests movies statistics
    Then the system returns metrics for all movies
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/movies/stats')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/movies/stats', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-MOVIES-STATS', 'Admin fetches movies stats');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
        (0, vitest_1.it)('should fetch the paginated list of movies successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH ADMIN MOVIES LIST
Feature: Movies Management
  Scenario: Admin views the list of movies
    Given the admin is on the Movies Management page
    When the admin requests the list of movies with pagination parameters
    Then the system returns a paginated list of movies
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/movies?page=1&limit=10')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/movies?page=1&limit=10', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-MOVIES-LIST', 'Admin fetches paginated movies list');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
            (0, vitest_1.expect)(res.body.meta).toBeDefined();
        }));
        (0, vitest_1.it)('should search for movies by name', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: SEARCH MOVIES
Feature: Movies Management
  Scenario: Admin searches for a movie by name
    Given the admin is on the Movies Management page
    When the admin enters a movie name in the search bar
    Then the system returns the matching movies
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/movies?searchTerm=Brand')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/movies', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, query: { searchTerm: 'Brand' } }, res.body, 'GET-ADMIN-MOVIES-SEARCH', 'Admin searches for a movie by name');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
            (0, vitest_1.expect)(res.body.data.length).toBeGreaterThanOrEqual(1);
        }));
        (0, vitest_1.it)('should filter movies by status', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FILTER MOVIES BY STATUS
Feature: Movies Management
  Scenario: Admin filters movies by status
    Given the admin is on the Movies Management page
    When the admin selects a status filter (PUBLISHED or DRAFT)
    Then the system returns movies matching the exact status
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/movies?status=PUBLISHED')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/movies', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, query: { status: 'PUBLISHED' } }, res.body, 'GET-ADMIN-MOVIES-FILTER-STATUS', 'Admin filters movies by status');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
        }));
        (0, vitest_1.it)('should filter movies by availability (planStatus)', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FILTER MOVIES BY AVAILABILITY
Feature: Movies Management
  Scenario: Admin filters movies by subscription plan
    Given the admin is on the Movies Management page
    When the admin selects an availability filter (FREE, WEEKLY, MONTHLY, YEARLY, ALL)
    Then the system returns movies matching the availability plan
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/movies?planStatus=FREE')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/movies', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, query: { planStatus: 'FREE' } }, res.body, 'GET-ADMIN-MOVIES-FILTER-PLAN', 'Admin filters movies by availability plan');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
        }));
        (0, vitest_1.it)('should fetch the movie details successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH MOVIE DETAILS
Feature: Movies Management
  Scenario: Admin views detailed information for a specific movie
    Given the admin has selected a movie
    When the admin requests the movie details
    Then the system returns the comprehensive profile of the movie
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/movies/${targetContentId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/movies/:movieId', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-MOVIE-DETAILS', 'Admin fetches details for a specific movie');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
            (0, vitest_1.expect)(res.body.data.id || res.body.data._id).toBe(targetContentId);
        }));
        (0, vitest_1.it)('should fetch the movie analytics engagement successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH MOVIE ANALYTICS ENGAGEMENT
Feature: Movies Management
  Scenario: Admin views engagement analytics for a specific movie
    Given the admin has selected a movie
    When the admin requests the movie engagement analytics
    Then the system returns the engagement data
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/movies/${targetContentId}/analytics/engagement`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/movies/:movieId/analytics/engagement', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-MOVIE-ANALYTICS-ENGAGEMENT', 'Admin fetches engagement analytics for a specific movie');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
            (0, vitest_1.expect)(res.body.data.engagement).toBeDefined();
            // expect(res.body.data.audience).toBeDefined();
            // expect(res.body.data.revenue).toBeDefined();
        }));
        (0, vitest_1.it)('should fetch the movie analytics overview successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH MOVIE ANALYTICS OVERVIEW
Feature: Movies Management
  Scenario: Admin views overview analytics for a specific movie
    Given the admin has selected a movie
    When the admin requests the movie analytics overview
    Then the system returns the overview data including views, watchTime, and realtimeAnalytics
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/movies/${targetContentId}/analytics/overview`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/movies/:movieId/analytics/overview', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-MOVIE-ANALYTICS-OVERVIEW', 'Admin fetches overview analytics for a specific movie');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
            (0, vitest_1.expect)(res.body.data.views).toBeDefined();
            (0, vitest_1.expect)(res.body.data.watchTime).toBeDefined();
            (0, vitest_1.expect)(res.body.data.realtimeAnalytics).toBeDefined();
        }));
        (0, vitest_1.it)('should fetch the movie analytics audience successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH MOVIE ANALYTICS AUDIENCE
Feature: Movies Management
  Scenario: Admin views audience analytics for a specific movie
    Given the admin has selected a movie
    When the admin requests the movie analytics audience
    Then the system returns the audience data including watchTimeFromSubscribers, demographics, and geography
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/movies/${targetContentId}/analytics/audience`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/movies/:movieId/analytics/audience', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-MOVIE-ANALYTICS-AUDIENCE', 'Admin fetches audience analytics for a specific movie');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
            (0, vitest_1.expect)(res.body.data.watchTimeFromSubscribers).toBeDefined();
            (0, vitest_1.expect)(res.body.data.demographics).toBeDefined();
            (0, vitest_1.expect)(res.body.data.geography).toBeDefined();
        }));
        (0, vitest_1.it)('should set requiredCoin on a movie successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: SET REQUIRED COIN
Feature: Movies Management
  Scenario: Admin sets a required coin value for a movie
    Given the admin has selected a movie
    When the admin updates the requiredCoin field
    Then the system updates the movie with the new coin requirement
`);
            const payload = { requiredCoin: 50 };
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/contents/movies/${targetContentId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(payload);
            (0, testLogger_1.logApi)('PATCH', '/api/v1/contents/movies/:movieId', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: payload }, res.body, 'PATCH-ADMIN-MOVIE-REQUIRED-COIN', 'Admin sets requiredCoin for a movie');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.requiredCoin).toBe(50);
        }));
        (0, vitest_1.it)('should delete a movie successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: DELETE MOVIE
Feature: Movies Management
  Scenario: Admin deletes a single movie
    Given the admin has a movie to delete
    When the admin requests to delete the movie
    Then the system permanently removes the movie
`);
            // First, create a dummy movie to delete
            const dummyMovie = yield content_model_1.Content.create({
                title: 'Movie To Delete',
                description: 'This movie will be deleted in the E2E test.',
                type: 'MOVIE',
                duration: 120,
                releaseYear: 2026,
                status: 'PUBLISHED',
                planStatus: ['FREE'],
                videoUrl: 'http://video.com/delete_me.mp4',
                views: 0,
            });
            const res = yield (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/contents/movies/${dummyMovie._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('DELETE', '/api/v1/contents/movies/:movieId', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'DELETE-ADMIN-MOVIE', 'Admin deletes a single movie');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
    });
    (0, vitest_1.describe)('4.2. Series Management Flow', () => {
        let targetSeriesId;
        (0, vitest_1.it)('should fetch the overall series statistics successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH SERIES STATS
Feature: Series Management
  Scenario: Admin views overall series statistics
    Given the admin is on the Series Management page
    When the admin requests series statistics
    Then the system returns metrics for all series
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/series/stats')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/series/stats', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-SERIES-STATS', 'Admin fetches series stats');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
        (0, vitest_1.it)('should create a new series successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: CREATE SERIES
Feature: Series Management
  Scenario: Admin creates a new series
    Given the admin has all series details (title, description, genres, etc.)
    When the admin submits the series creation form
    Then the system validates the input
    And stores the new series in the database
`);
            const payload = {
                title: 'E2E Testing Series',
                description: 'This is an amazing series created by E2E test.',
                releaseYear: 2026,
                status: 'DRAFT',
                planStatus: ['FREE'],
                genres: ['60d5ecb54cb7c1a3b8d4f7a1'],
            };
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/contents/series')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/contents/series', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: payload }, res.body, 'POST-ADMIN-SERIES', 'Admin creates a new series');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.CREATED);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            targetSeriesId = res.body.data.id || res.body.data._id;
            (0, vitest_1.expect)(targetSeriesId).toBeDefined();
        }));
        (0, vitest_1.it)('should fetch the paginated list of series', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH ADMIN SERIES
Feature: Series Management
  Scenario: Admin views all series in the CMS
    Given the admin is on the Series Management table
    When the admin fetches the series list
    Then the system returns a paginated list of series
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/series?limit=5')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/series', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, query: { limit: 5 } }, res.body, 'GET-ADMIN-SERIES-LIST', 'Admin fetches paginated series list');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
        }));
        (0, vitest_1.it)('should search for series by title', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: SEARCH SERIES
Feature: Series Management
  Scenario: Admin searches for a series by title
    Given the admin is on the Series Management page
    When the admin enters a series title in the search bar
    Then the system returns the matching series
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/series?searchTerm=Test')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/series?searchTerm=Test', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, query: { searchTerm: 'Test' } }, res.body, 'GET-ADMIN-SERIES-SEARCH', 'Admin searches for a series by title');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
        }));
        (0, vitest_1.it)('should filter series by status', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FILTER SERIES BY STATUS
Feature: Series Management
  Scenario: Admin filters series by their status
    Given the admin is on the Series Management page
    When the admin selects the 'PUBLISHED' status filter
    Then the system returns only published series
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/series?status=PUBLISHED')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/series?status=PUBLISHED', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, query: { status: 'PUBLISHED' } }, res.body, 'GET-ADMIN-SERIES-FILTER-STATUS', 'Admin filters series by status');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            if (res.body.data.length > 0) {
                (0, vitest_1.expect)(res.body.data[0].status).toBe('PUBLISHED');
            }
        }));
        (0, vitest_1.it)('should filter series by availability (planStatus)', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FILTER SERIES BY AVAILABILITY
Feature: Series Management
  Scenario: Admin filters series by planStatus
    Given the admin is on the Series Management page
    When the admin selects the 'FREE' plan filter
    Then the system returns only free series
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/series?planStatus=FREE')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/series?planStatus=FREE', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, query: { planStatus: 'FREE' } }, res.body, 'GET-ADMIN-SERIES-FILTER-PLAN', 'Admin filters series by availability');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            if (res.body.data.length > 0) {
                (0, vitest_1.expect)(res.body.data[0].planStatus).toContain('FREE');
            }
        }));
        (0, vitest_1.it)('should update series details securely', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: UPDATE SERIES
Feature: Series Management
  Scenario: Admin edits a specific series
    Given the admin has selected a series to edit
    When the admin updates the series title
    Then the system reflects the updated details
`);
            const payload = { title: 'E2E Testing Series - Updated' };
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/contents/series/${targetSeriesId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(payload);
            (0, testLogger_1.logApi)('PATCH', '/api/v1/contents/series/:seriesId', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: payload }, res.body, 'PATCH-ADMIN-SERIES', 'Admin edits series details');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.title).toBe('E2E Testing Series - Updated');
        }));
        (0, vitest_1.it)('should update series status', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: PUBLISH SERIES
Feature: Series Management
  Scenario: Admin changes series status to PUBLISHED
    Given the admin has finalized a series
    When the admin changes the status from DRAFT to PUBLISHED
    Then the system marks the series as live
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/contents/series/${targetSeriesId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'PUBLISHED' });
            (0, testLogger_1.logApi)('PATCH', '/api/v1/contents/series/:seriesId/status', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { status: 'PUBLISHED' } }, res.body, 'PATCH-ADMIN-SERIES-STATUS', 'Admin changes series status');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.status).toBe('PUBLISHED');
        }));
        (0, vitest_1.it)('should fetch specific series details', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: VIEW SERIES DETAILS
Feature: Series Management
  Scenario: Admin views full details of a specific series
    Given the admin clicks on a series
    When the system requests the series details
    Then the system returns the full document
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/series/${targetSeriesId}/details`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/series/:seriesId/details', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-SERIES-DETAILS', 'Admin fetches specific series details');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.id || res.body.data._id).toBe(targetSeriesId);
        }));
        let targetSeasonId;
        (0, vitest_1.it)('should create a season for the series', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: CREATE SEASON
Feature: Series Management
  Scenario: Admin creates a season
    Given the admin has a series
    When the admin submits season details
    Then the system creates the season
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/contents/series/${targetSeriesId}/seasons`)
                .set('Authorization', `Bearer ${adminToken}`)
                .field('title', 'Season 1')
                .field('seasonNumber', 1)
                .field('posterUrl', 'https://test.com/poster.jpg')
                .field('trailerUrl', 'https://test.com/trailer.mp4');
            (0, testLogger_1.logApi)('POST', '/api/v1/contents/series/:seriesId/seasons', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { title: 'Season 1', seasonNumber: 1, posterUrl: 'https://test.com/poster.jpg', trailerUrl: 'https://test.com/trailer.mp4' } }, res.body, 'POST-ADMIN-SEASON', 'Admin creates a season');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.CREATED);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            targetSeasonId = res.body.data._id || res.body.data.id;
        }));
        (0, vitest_1.it)('should create an episode for the season', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: CREATE EPISODE
Feature: Series Management
  Scenario: Admin creates an episode
    Given the admin has a season
    When the admin submits episode details
    Then the system creates the episode
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .post(`/api/v1/contents/series/${targetSeriesId}/episodes`)
                .set('Authorization', `Bearer ${adminToken}`)
                .field('title', 'Episode 1: The Beginning')
                .field('description', 'First episode description')
                .field('duration', 45)
                .field('releaseDate', new Date().toISOString())
                .field('planStatus', 'FREE')
                .field('status', 'PUBLISHED')
                .field('seasonId', targetSeasonId || '6a35811b959603e76aa75b28') // Prevent crash if targetSeasonId is somehow undefined
                .field('seasonNumber', 1)
                .field('episodeNumber', 1)
                .field('videoUrl', 'https://test.com/video.mp4')
                .field('thumbnailUrl', 'https://test.com/thumb.jpg');
            (0, testLogger_1.logApi)('POST', '/api/v1/contents/series/:seriesId/episodes', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { title: 'Episode 1' } }, res.body, 'POST-ADMIN-EPISODE', 'Admin creates an episode');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.CREATED);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should fetch paginated episodes of a series', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH SERIES EPISODES
Feature: Series Management
  Scenario: Admin views the list of episodes for a specific series or season
    Given the admin is managing a specific series
    When the admin requests the list of episodes
    Then the system returns a paginated list of episodes
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/series/${targetSeriesId}/episodes?limit=10&seasonId=${targetSeasonId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/series/:seriesId/episodes', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, query: { limit: 10, seasonId: '<SEASON_ID>' } }, res.body, 'GET-ADMIN-SERIES-EPISODES', 'Admin fetches paginated series episodes');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
            (0, vitest_1.expect)(res.body.data.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(res.body.meta).toBeDefined();
        }));
        (0, vitest_1.it)('should delete a series successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: DELETE SERIES
Feature: Series Management
  Scenario: Admin deletes a single series
    Given the admin has a series to delete
    When the admin requests to delete the series
    Then the system permanently removes the series and all nested seasons/episodes
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/contents/series/${targetSeriesId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('DELETE', '/api/v1/contents/series/:seriesId', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'DELETE-ADMIN-SERIES', 'Admin deletes a single series');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
    });
    (0, vitest_1.describe)('5. Genres Management Flow', () => {
        let targetGenreId;
        (0, vitest_1.it)('should create a new genre', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/genres')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/genres', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: payload }, res.body, 'POST-ADMIN-GENRES', 'Admin creates a new genre');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.CREATED);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            targetGenreId = res.body.data.id || res.body.data._id;
            (0, vitest_1.expect)(targetGenreId).toBeDefined();
        }));
        (0, vitest_1.it)('should fetch all genres securely', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH GENRES
Feature: Genres Management
  Scenario: Admin views all existing genres
    Given the admin is on the genres page
    When the admin fetches the genre list
    Then the server returns the genres
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/genres')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/genres', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-GENRES', 'Admin fetches all genres');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
        }));
        (0, vitest_1.it)('should edit the genre details securely', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: EDIT GENRE
Feature: Genres Management
  Scenario: Admin updates a genre name
    Given the admin has selected a genre
    When the admin updates its name
    Then the system reflects the updated name
`);
            const payload = { name: 'E2E Genre Updated' };
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/genres/${targetGenreId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(payload);
            (0, testLogger_1.logApi)('PATCH', `/api/v1/genres/${targetGenreId}`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: payload }, res.body, 'PATCH-ADMIN-GENRES', 'Admin edits genre');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.name).toBe('E2E Genre Updated');
        }));
        (0, vitest_1.it)('should bulk delete the genres securely', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: BULK DELETE GENRES
Feature: Genres Management
  Scenario: Admin deletes selected genres
    Given the admin selected the test genre
    When the admin triggers bulk deletion
    Then the system permanently removes it
`);
            const payload = { ids: [targetGenreId] };
            const res = yield (0, supertest_1.default)(app_1.default)
                .delete('/api/v1/genres')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(payload);
            (0, testLogger_1.logApi)('DELETE', '/api/v1/genres', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: payload }, res.body, 'DELETE-ADMIN-GENRES-BULK', 'Admin bulk deletes genres');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.deletedCount).toBeGreaterThanOrEqual(1);
        }));
    });
    (0, vitest_1.describe)('6. Subscription Management Flow', () => {
        (0, vitest_1.it)('should fetch the subscription analytics successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH SUBSCRIPTION STATS
Feature: Subscription Management
  Scenario: Admin views subscription metrics
    Given the admin is on the subscription page
    When the admin requests subscription stats
    Then the system returns the metrics
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/subscriptions/stats')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/subscriptions/stats', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-SUBSCRIPTIONS-STATS', 'Admin fetches subscription stats');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.totalUsers.value).toBeDefined();
            (0, vitest_1.expect)(res.body.data.totalUsers.changePct).toBeDefined();
            (0, vitest_1.expect)(res.body.data.totalUsers.direction).toBeDefined();
            (0, vitest_1.expect)(res.body.data.totalRevenue.value).toBeDefined();
            (0, vitest_1.expect)(res.body.data.activeSubscribers.value).toBeDefined();
            (0, vitest_1.expect)(res.body.data.growthRate.value).toBeDefined();
        }));
        (0, vitest_1.it)('should fetch the subscriptions table data successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH SUBSCRIPTIONS LIST
Feature: Subscription Management
  Scenario: Admin views paginated subscriptions
    Given the admin is on the subscription page
    When the admin requests subscriptions
    Then the system returns the paginated subscriptions with formatted table data
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/subscriptions')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/subscriptions', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-SUBSCRIPTIONS-LIST', 'Admin fetches subscriptions list');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
            if (res.body.data.length > 0) {
                const item = res.body.data[0];
                (0, vitest_1.expect)(item.transactionId).toBeDefined();
                (0, vitest_1.expect)(item.plan).toBeDefined();
            }
        }));
        (0, vitest_1.it)('should search subscriptions by user email or transaction ID', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: SEARCH SUBSCRIPTIONS
Feature: Subscription Management
  Scenario: Admin searches for a specific subscription
    Given the admin wants to find a specific transaction
    When the admin enters a search term (Applicable fields: User Email, Transaction ID)
    Then the system returns the matching subscriptions
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/subscriptions?searchTerm=TRX-GUEST-')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/subscriptions?searchTerm=TRX-GUEST-', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, query: { searchTerm: 'TRX-GUEST-' } }, res.body, 'GET-ADMIN-SUBSCRIPTIONS-SEARCH', 'Admin searches subscriptions');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
            // We expect the regular user to show up in search
            (0, vitest_1.expect)(res.body.data.length).toBeGreaterThanOrEqual(1);
        }));
        (0, vitest_1.it)('should filter subscriptions by package (pkg)', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FILTER SUBSCRIPTIONS
Feature: Subscription Management
  Scenario: Admin filters subscriptions by WEEKLY package
    Given the admin wants to see only weekly subscribers
    When the admin selects the weekly filter (Applicable pkg filters: weekly, monthly, yearly)
    Then the system returns only subscriptions with weekly product IDs
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/subscriptions?pkg=weekly')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/subscriptions?pkg=weekly', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, query: { pkg: 'weekly' } }, res.body, 'GET-ADMIN-SUBSCRIPTIONS-FILTER', 'Admin filters subscriptions by package');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
            // We expect at least one weekly subscription (the regular user one)
            (0, vitest_1.expect)(res.body.data.length).toBeGreaterThanOrEqual(1);
        }));
    });
    (0, vitest_1.describe)('7. Legal Pages Management Flow', () => {
        let targetSlug = 'e2e-privacy-policy';
        (0, vitest_1.it)('should create a new legal page', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: CREATE LEGAL PAGE
Feature: Legal Pages
  Scenario: Admin creates a new privacy policy page
    Given the admin wants to publish legal documents
    When the admin submits title, slug, and HTML content
    Then the system stores the new legal page
`);
            const payload = {
                title: 'E2E Privacy Policy',
                content: '<p>This is a test privacy policy generated by E2E</p>'
            };
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/legals')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(payload);
            (0, testLogger_1.logApi)('POST', '/api/v1/legals', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: payload }, res.body, 'POST-ADMIN-LEGALS', 'Admin creates a legal page');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.CREATED);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.slug).toBe(targetSlug);
        }));
        (0, vitest_1.it)('should fetch all legal pages successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH ALL LEGAL PAGES
Feature: Legal Pages
  Scenario: Admin views all legal pages
    Given legal pages exist in the system
    When the admin requests the list of legal pages
    Then the system returns an array of all legal documents
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/legals')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/legals', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-LEGALS-ALL', 'Admin fetches all legal pages');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
            (0, vitest_1.expect)(res.body.data.length).toBeGreaterThan(0);
        }));
        (0, vitest_1.it)('should fetch the created legal page by slug', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH LEGAL PAGE
Feature: Legal Pages
  Scenario: Admin or User views a legal page
    Given a legal page exists
    When a request is made with the page slug
    Then the system returns the page details
`);
            const res = yield (0, supertest_1.default)(app_1.default).get(`/api/v1/legals/${targetSlug}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/legals/:slug', { params: { slug: targetSlug } }, res.body, 'GET-ADMIN-LEGALS-SLUG', 'Fetch legal page by slug');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.title).toBe('E2E Privacy Policy');
        }));
        (0, vitest_1.it)('should update the legal page', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: UPDATE LEGAL PAGE
Feature: Legal Pages
  Scenario: Admin updates the privacy policy
    Given the admin has selected a legal page
    When the admin updates the content
    Then the system reflects the changes
`);
            const payload = { title: 'Updated E2E Privacy Policy', content: '<p>Updated content</p>' };
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/legals/${targetSlug}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(payload);
            (0, testLogger_1.logApi)('PATCH', '/api/v1/legals/:slug', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, params: { slug: targetSlug }, body: payload }, res.body, 'PATCH-ADMIN-LEGALS', 'Admin updates a legal page');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.title).toBe('Updated E2E Privacy Policy');
            // Update the targetSlug since patching the title automatically changes the slug
            targetSlug = res.body.data.slug;
        }));
        (0, vitest_1.it)('should update only the title of the legal page', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: UPDATE LEGAL PAGE TITLE ONLY
Feature: Legal Pages
  Scenario: Admin updates only the title of the privacy policy
    Given the admin has selected a legal page
    When the admin updates only the title
    Then the system reflects the changes and generates a new slug
`);
            const payload = { title: 'Updated E2E Privacy Policy Title Only' };
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/legals/${targetSlug}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(payload);
            (0, testLogger_1.logApi)('PATCH', '/api/v1/legals/:slug', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, params: { slug: targetSlug }, body: payload }, res.body, 'PATCH-ADMIN-LEGALS-TITLE-ONLY', 'Admin updates only title of legal page');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.title).toBe('Updated E2E Privacy Policy Title Only');
            // Update the targetSlug since patching the title automatically changes the slug
            targetSlug = res.body.data.slug;
        }));
        (0, vitest_1.it)('should update only the content of the legal page', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: UPDATE LEGAL PAGE CONTENT ONLY
Feature: Legal Pages
  Scenario: Admin updates only the content of the privacy policy
    Given the admin has selected a legal page
    When the admin updates only the content
    Then the system reflects the changes without changing the slug
`);
            // Simulate real frontend payload by sending the existing title along with the updated content
            const payload = { title: 'Updated E2E Privacy Policy Title Only', content: '<p>Updated content only</p>' };
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/legals/${targetSlug}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(payload);
            (0, testLogger_1.logApi)('PATCH', '/api/v1/legals/:slug', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, params: { slug: targetSlug }, body: payload }, res.body, 'PATCH-ADMIN-LEGALS-CONTENT-ONLY', 'Admin updates only content of legal page');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.content).toBe('<p>Updated content only</p>');
            (0, vitest_1.expect)(res.body.data.slug).toBe(targetSlug); // slug should not change
        }));
        (0, vitest_1.it)('should delete the legal page', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: DELETE LEGAL PAGE
Feature: Legal Pages
  Scenario: Admin deletes a deprecated legal page
    Given the admin wants to remove an old policy
    When the admin triggers deletion by slug
    Then the system permanently removes it
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/legals/${targetSlug}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('DELETE', '/api/v1/legals/:slug', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, params: { slug: targetSlug } }, res.body, 'DELETE-ADMIN-LEGALS', 'Admin deletes a legal page');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
    });
    (0, vitest_1.describe)('8. Settings Page Flow', () => {
        (0, vitest_1.it)('should fetch the admin profile successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: FETCH ADMIN PROFILE
Feature: Settings
  Scenario: Admin views their own profile details
    Given the admin is on the settings page
    When the admin requests their profile information
    Then the system returns the admin profile details
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/users/me')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/users/me', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-PROFILE', 'Admin fetches their own profile');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
        (0, vitest_1.it)('should update the admin profile successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: UPDATE ADMIN PROFILE
Feature: Settings
  Scenario: Admin updates their own profile details
    Given the admin is on the settings page
    When the admin submits updated profile information
    Then the system updates the admin profile
    And returns the updated details
`);
            const dummyBuffer = Buffer.from('dummy image content');
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch('/api/v1/users/me')
                .set('Authorization', `Bearer ${adminToken}`)
                .field('name', 'Super Admin Updated')
                .attach('profileImage', dummyBuffer, 'profile.jpg');
            (0, testLogger_1.logApi)('PATCH', '/api/v1/users/me', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { name: 'Super Admin Updated', profileImage: '(binary)' } }, res.body, 'PATCH-ADMIN-PROFILE', 'Admin updates their own profile with image');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.name).toBe('Super Admin Updated');
            (0, vitest_1.expect)(res.body.data.profileImage).toBeDefined();
        }));
        (0, vitest_1.it)('should update only the profile image successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: UPDATE ADMIN PROFILE IMAGE ONLY
Feature: Settings
  Scenario: Admin updates only their profile picture
    Given the admin is on the settings page
    When the admin uploads a new profile image
    Then the system updates the profile image without affecting other fields
`);
            // Simulating a real frontend file upload flow using multipart/form-data
            const imageBuffer = Buffer.from('fake image content for testing');
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch('/api/v1/users/me')
                .set('Authorization', `Bearer ${adminToken}`)
                .attach('profileImage', imageBuffer, {
                filename: 'avatar.png',
                contentType: 'image/png'
            });
            (0, testLogger_1.logApi)('PATCH', '/api/v1/users/me', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { profileImage: '(binary PNG)' } }, res.body, 'PATCH-ADMIN-PROFILE-IMAGE-ONLY', 'Admin updates only their profile image');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.profileImage).toBeDefined();
        }));
    });
});
