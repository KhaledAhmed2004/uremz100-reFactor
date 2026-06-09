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
        revertDate: new Date(),
        dateOfBirth: new Date('1985-01-01'),
        profileImage: '/admin.jpg',
        verificationImage: '/admin-img.jpg',
        verificationVideo: '/admin-vid.mp4',
    });
    // 2. Create a Dummy Regular User to Manage
    const regularUser = yield user_model_1.User.create({
        name: 'Target User',
        role: user_1.USER_ROLES.BROTHER,
        email: `target_${(0, crypto_1.randomUUID)()}@test.com`,
        password: 'securePassword123!',
        isVerified: true,
        status: user_1.USER_STATUS.ACTIVE,
        revertDate: new Date(),
        dateOfBirth: new Date('1995-01-01'),
        profileImage: '/user.jpg',
        verificationImage: '/user-img.jpg',
        verificationVideo: '/user-vid.mp4',
    });
    targetUserId = regularUser._id.toString();
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
📖 DOC: 
Step 1: The Administrator logs into the management portal securely.
The system validates the credentials and issues a SUPER_ADMIN JWT.
With this token, the admin is granted god-mode access to all system 
metrics, user data, and financial overviews.
`);
            (0, vitest_1.expect)(adminToken).toBeDefined();
            (0, vitest_1.expect)(typeof adminToken).toBe('string');
        });
    });
    (0, vitest_1.describe)('2. Dashboard Overview & Analytics Page', () => {
        (0, vitest_1.it)('should fetch the high-level Growth Metrics successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
Step 2: The Admin navigates to the primary Dashboard Overview page.
The frontend immediately requests the high-level 'Growth Metrics'.
This includes total active users, revenue metrics, and system 
health indicators.
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
📖 DOC: 
Step 3: The Admin scrolls to the 'Visitor Traffic' section.
The frontend requests time-series data to render beautiful charts
showing DAU (Daily Active Users) and MAU (Monthly Active Users).
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
📖 DOC: 
Step 4: The Admin clicks the 'Financial Overview' tab.
The system calculates gross revenue, recent transaction volumes,
and highlights top-grossing subscriptions.
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
📖 DOC: 
Step 5: The Admin checks the 'User Base' widget.
This pulls aggregated metrics on new signups, active memberships,
and general user demographics for targeted marketing analysis.
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
📖 DOC: 
Step 6: The Admin reviews the 'Subscription Health' monitor.
The system returns a breakdown of Free vs Premium tiers, churn rate
predictions, and current active VIP members.
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
        (0, vitest_1.it)('should list all users securely', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
Step 7: The Admin navigates to the 'User Management' page.
The frontend issues a request to fetch a paginated list of all registered users
along with their statuses and roles.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/admin/users', { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USERS-LIST', 'Admin fetches user list');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
        (0, vitest_1.it)('should view a specific user profile successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
Step 8: The Admin clicks on 'Target User' to inspect their profile.
The system securely retrieves their PII, active subscriptions, and watch 
history for administrative support.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/admin/users/${targetUserId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/admin/users/${targetUserId}`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'GET-ADMIN-USER-PROFILE', 'Admin inspects a specific user');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data._id.toString() === targetUserId || res.body.data.id === targetUserId).toBe(true);
        }));
        (0, vitest_1.it)('should suspend or block the user successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
Step 9: The Admin detects suspicious activity and updates the user's status 
to 'BLOCKED'.
The backend enforces this change instantly, preventing the user from 
accessing the platform until resolved.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch(`/api/v1/admin/users/${targetUserId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'BLOCKED' });
            (0, testLogger_1.logApi)('PATCH', `/api/v1/admin/users/${targetUserId}/status`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` }, body: { status: 'BLOCKED' } }, res.body, 'PATCH-ADMIN-USER-STATUS', 'Admin blocks a user');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should securely delete the user from the system', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 DOC: 
Step 10: The Admin permanently deletes the user account per GDPR request.
The system cascades the deletion and fully removes the user from the database.
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .delete(`/api/v1/admin/users/${targetUserId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            (0, testLogger_1.logApi)('DELETE', `/api/v1/admin/users/${targetUserId}`, { headers: { Authorization: `Bearer <ADMIN_TOKEN>` } }, res.body, 'DELETE-ADMIN-USER', 'Admin permanently deletes a user');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
    });
});
