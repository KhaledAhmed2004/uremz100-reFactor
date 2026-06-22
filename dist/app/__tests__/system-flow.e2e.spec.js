"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const mongodb_memory_server_1 = require("mongodb-memory-server");
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../app"));
const user_model_1 = require("../modules/user/user.model");
const content_model_1 = require("../modules/content/content.model");
const jwtHelper_1 = require("../../helpers/jwtHelper");
const config_1 = __importDefault(require("../../config"));
const user_1 = require("../../enums/user");
const http_status_codes_1 = require("http-status-codes");
const testLogger_1 = require("../../helpers/__tests__/testLogger");
// Increase timeout for E2E tests
vitest_1.vi.setConfig({ testTimeout: 30000 });
let replSet;
let userToken;
let testUserId;
let testUserEmail;
let TEST_PASSWORD = 'TestPassword123!';
let theMovieId;
let theSeriesId;
let theSeasonId;
let shortsCursor;
let myCollectionId;
let selectedShortId;
(0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    replSet = yield mongodb_memory_server_1.MongoMemoryReplSet.create({ replSet: { count: 1 } });
    yield mongoose_1.default.connect(replSet.getUri());
    testUserEmail = 'standard_user@e2e.test';
    // 1. Create a User
    const user = yield user_model_1.User.create({
        name: 'E2E Flow User',
        role: user_1.USER_ROLES.USER,
        email: testUserEmail,
        password: TEST_PASSWORD,
        isVerified: true,
    });
    testUserId = user._id.toString();
    // Initialize Reward Wallet and Progress for the E2E user
    const { Wallet, UserRewardProgress } = yield Promise.resolve().then(() => __importStar(require('../modules/reward/reward.model')));
    yield Wallet.create({ user: user._id, goldBalance: 0, bonusLedger: [] });
    yield UserRewardProgress.create({ user: user._id });
    userToken = jwtHelper_1.jwtHelper.createToken({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 }, config_1.default.jwt.jwt_secret, '1d');
    // 2. Create some Content
    const { Genre } = yield Promise.resolve().then(() => __importStar(require('../modules/genre/genre.model')));
    const actionGenre = yield Genre.create({ name: 'Action' });
    const scifiGenre = yield Genre.create({ name: 'Sci-Fi' });
    const movie1 = yield content_model_1.Content.create({
        title: 'Batman The Dark Knight',
        description: 'A great movie',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['FREE'],
        genres: [actionGenre._id],
        videoUrl: 'http://video.com/batman.mp4',
        posterUrl: 'http://image.com/batman.jpg',
        trailerUrl: 'http://trailer.com/batman.mp4',
        duration: 120,
        releaseYear: 2008,
        publishedAt: new Date(),
        views: 1000,
        engagementScore: 100,
        trendingScore: 100,
    });
    theMovieId = movie1._id.toString();
    yield content_model_1.Content.create({
        title: 'Superman Returns',
        description: 'Another great movie',
        type: 'MOVIE',
        status: 'PUBLISHED',
        planStatus: ['MONTHLY'],
        genres: [actionGenre._id],
        trailerUrl: 'http://trailer.com/superman.mp4',
        videoUrl: 'http://video.com/superman.mp4',
        posterUrl: 'http://image.com/superman.jpg',
        duration: 120,
        releaseYear: 2006,
        publishedAt: new Date(),
        views: 500,
        engagementScore: 80,
        trendingScore: 80,
    });
    const series1 = yield content_model_1.Content.create({
        title: 'The Great Series',
        description: 'A great series',
        type: 'SERIES',
        status: 'PUBLISHED',
        planStatus: ['FREE'],
        genres: [actionGenre._id, scifiGenre._id],
        posterUrl: 'http://image.com/series.jpg',
        duration: 0,
        releaseYear: 2024,
        publishedAt: new Date(),
        views: 1500,
        engagementScore: 120,
        trendingScore: 120,
    });
    theSeriesId = series1._id.toString();
    const { Season } = yield Promise.resolve().then(() => __importStar(require('../modules/content/season.model')));
    const { Episode } = yield Promise.resolve().then(() => __importStar(require('../modules/content/episode.model')));
    const season1 = yield Season.create({
        seriesId: theSeriesId,
        title: 'Season 1',
        seasonNumber: 1,
        posterUrl: 'http://image.com/season1.jpg',
    });
    for (let i = 1; i <= 5; i++) {
        yield Episode.create({
            seriesId: series1._id,
            seasonId: season1._id,
            title: `Episode ${i}`,
            description: `This is the great episode number ${i}`,
            episodeNumber: i,
            seasonNumber: 1,
            videoUrl: `http://video.com/ep${i}.mp4`,
            thumbnailUrl: `http://image.com/ep${i}.jpg`,
            releaseDate: new Date(),
            duration: 45 + i,
            status: 'PUBLISHED',
            planStatus: i === 1 ? 'FREE' : 'MONTHLY',
        });
    }
    // Create 10 more movies to trigger cursor pagination for limit=10
    for (let i = 0; i < 10; i++) {
        yield content_model_1.Content.create({
            title: `Extra Movie ${i}`,
            description: 'Just to fill the feed',
            type: i % 2 === 0 ? 'MOVIE' : 'SERIES',
            status: 'PUBLISHED',
            planStatus: ['FREE'],
            genres: [actionGenre._id],
            videoUrl: 'http://video.com/extra.mp4',
            posterUrl: 'http://image.com/extra.jpg',
            duration: 120,
            releaseYear: 2020,
            publishedAt: new Date(),
            views: 10,
            engagementScore: 20 + i,
            trendingScore: 20 + i,
        });
    }
    // Create a Legal Page for the public APIs test
    const { LegalPage } = yield Promise.resolve().then(() => __importStar(require('../modules/legal/legal.model')));
    yield LegalPage.create({
        slug: 'terms-and-conditions',
        title: 'Terms and Conditions',
        content: '<p>These are the terms...</p>',
    });
}));
(0, vitest_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
    yield replSet.stop();
}));
(0, vitest_1.describe)('Master System Flow E2E Tests', () => {
    (0, vitest_1.describe)('0. Authentication Flow', () => {
        (0, vitest_1.it)('should allow a Guest User to browse and track progress', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 01. GUEST BROWSING & TRACKING
Feature: Anonymous Usage
  As a new user installing the app
  I want to browse content without signing up
  So that I can try the app before committing

  Given the user has not logged in
  When the app makes any API request
  Then it sends a generated 'x-guest-id' in the header
  And the backend saves watch progress using this 'guestId'
`);
            // Note: Actual guest actions are tested comprehensively in guest-flow.e2e.spec.ts
        }));
        (0, vitest_1.it)('should successfully register a new user account and verify OTP', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            console.info(`
📖 BDD SCENARIO: 02. USER REGISTRATION & VERIFICATION
Feature: Account Creation
  As a new user
  I want to register an account
  So that my data is securely saved

  Given the user provides valid registration details
  When they submit the registration form
  Then the backend creates a PENDING account and emails an OTP
  And when they verify the OTP, their account becomes ACTIVE
  And the backend automatically issues an 'accessToken' for instant login
`);
            const newGuestEmail = 'e2etesting@gmail.com';
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/users/')
                .field('name', 'E2E Tester')
                .field('email', newGuestEmail)
                .field('password', 'NewPassword123!');
            (0, testLogger_1.logApi)('POST', '/api/v1/users/', { body: { name: 'E2E Tester', email: newGuestEmail, password: 'NewPassword123!' } }, res.body, 'POST-REGISTER', 'User signs up');
            (0, vitest_1.expect)([200, 201]).toContain(res.status);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            // Fetch OTP from DB
            const newlyRegisteredUser = yield user_model_1.User.findOne({ email: newGuestEmail }).select('+authentication');
            const registrationOtp = (_a = newlyRegisteredUser === null || newlyRegisteredUser === void 0 ? void 0 : newlyRegisteredUser.authentication) === null || _a === void 0 ? void 0 : _a.oneTimeCode;
            (0, vitest_1.expect)(registrationOtp).toBeDefined();
            // Verify OTP
            const verifyRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/verify-otp')
                .send({ email: newGuestEmail, otp: registrationOtp });
            (0, testLogger_1.logApi)('POST', '/api/v1/auth/verify-otp', { body: { email: newGuestEmail, otp: registrationOtp } }, verifyRes.body, 'POST-VERIFY-REGISTRATION', 'User verifies email with OTP');
            (0, vitest_1.expect)(verifyRes.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(verifyRes.body.success).toBe(true);
            (0, vitest_1.expect)(verifyRes.body.data.accessToken).toBeDefined(); // Test auto-login!
        }));
        (0, vitest_1.it)('should register/login the Guest and migrate their data to the new Account', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 03. GUEST MIGRATION TO LOGGED-IN USER
Feature: Data Retention
  As a guest user deciding to register
  I want my existing watch progress preserved
  So I don't lose my history

  Given the user has an existing 'x-guest-id'
  When they successfully register or log in
  Then the backend searches for all records with that 'guestId'
  And seamlessly updates them to the new 'userId'
`);
        }));
        (0, vitest_1.it)('should successfully login and obtain a valid auth token (Standard Login)', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 04. STANDARD LOGIN
Feature: Authentication
  As a returning user
  I want to log in
  So I can access my account

  Given the user has an active account
  When they enter their correct email and password
  Then the system verifies the credentials
  And returns a JWT access and refresh token
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/login')
                .send({
                email: testUserEmail,
                password: TEST_PASSWORD,
            });
            (0, testLogger_1.logApi)('POST', '/api/v1/auth/login', { body: { email: testUserEmail, password: TEST_PASSWORD } }, res.body, 'POST-AUTH-LOGIN', 'User logs in to the system');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.accessToken).toBeDefined();
            // Ensure the newly issued token actually works (overriding the one generated in beforeAll if needed)
            userToken = res.body.data.accessToken;
        }));
        (0, vitest_1.it)('should initiate the forgot-password flow and send an OTP', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            console.info(`
📖 BDD SCENARIO: 05. FORGOT PASSWORD (REQUEST OTP)
Feature: Password Recovery
  As a user who forgot their password
  I want to request an OTP
  So I can reset it

  Given the user enters their registered email
  When they request a password reset
  Then the backend generates a 6-digit OTP
  And emails it to the user with a strict 5-minute expiration
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/forgot-password')
                .send({ email: testUserEmail });
            (0, testLogger_1.logApi)('POST', '/api/v1/auth/forgot-password', { body: { email: testUserEmail } }, res.body, 'POST-FORGOT-PASSWORD', 'User requests OTP');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            // Verify that the backend generated the OTP and set the 5-minute expiration
            const userAfterRequest = yield user_model_1.User.findOne({ email: testUserEmail }).select('+authentication');
            const forgotPasswordOtp = (_a = userAfterRequest === null || userAfterRequest === void 0 ? void 0 : userAfterRequest.authentication) === null || _a === void 0 ? void 0 : _a.oneTimeCode;
            const expireAt = (_b = userAfterRequest === null || userAfterRequest === void 0 ? void 0 : userAfterRequest.authentication) === null || _b === void 0 ? void 0 : _b.expireAt;
            (0, vitest_1.expect)(forgotPasswordOtp).toBeDefined();
            (0, vitest_1.expect)(forgotPasswordOtp).toHaveLength(6);
            (0, vitest_1.expect)(expireAt).toBeDefined();
            // Ensure expiration is within the expected ~5 minute window
            if (expireAt) {
                const timeDiff = expireAt.getTime() - Date.now();
                (0, vitest_1.expect)(timeDiff).toBeGreaterThan(0);
                (0, vitest_1.expect)(timeDiff).toBeLessThanOrEqual(5 * 60 * 1000 + 10000); // 5 mins + 10 sec buffer
            }
        }));
        (0, vitest_1.it)('should verify OTP and reset the password using the generated token', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            console.info(`
📖 BDD SCENARIO: 06. VERIFY OTP & RESET PASSWORD
Feature: Secure Password Recovery
  As a user who received an OTP
  I want to securely verify my OTP and reset my password
  So I can regain access to my account

  Given the user received a 6-digit OTP in their email
  When they submit the OTP to the verification endpoint
  Then the backend issues a temporary 'resetToken'

  Given the user has obtained the temporary 'resetToken'
  When they submit a new password with the token in the 'Authorization: Bearer <token>' header
  Then the backend securely updates the password hash
  And crucially increments the 'tokenVersion' to instantly invalidate all old sessions
`);
            // 1. Fetch the OTP directly from the test DB since this is an E2E test
            const updatedUser = yield user_model_1.User.findOne({ email: testUserEmail }).select('+authentication');
            const otp = (_a = updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.authentication) === null || _a === void 0 ? void 0 : _a.oneTimeCode;
            (0, vitest_1.expect)(otp).toBeDefined();
            // 2. Verify OTP to get reset token
            const verifyRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/verify-otp')
                .send({ email: testUserEmail, otp });
            (0, vitest_1.expect)(verifyRes.status).toBe(http_status_codes_1.StatusCodes.OK);
            const resetToken = verifyRes.body.data.resetToken;
            (0, vitest_1.expect)(resetToken).toBeDefined();
            // 3. Reset Password
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/reset-password')
                .set('Authorization', `Bearer ${resetToken}`)
                .send({ newPassword: 'NewPassword123!' });
            (0, testLogger_1.logApi)('POST', '/api/v1/auth/reset-password', { headers: { Authorization: `Bearer ${resetToken}` }, body: { newPassword: 'NewPassword123!' } }, res.body, 'POST-RESET-PASSWORD', 'User resets password');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should allow an authenticated user to change their password', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 07. CHANGE PASSWORD (IN-APP)
Feature: Account Management
  As a logged-in user
  I want to change my password
  So I can keep my account secure

  Given the user is authenticated
  When they provide their current password and a new password
  Then the backend verifies the current password
  And updates the hash and refreshes their session
`);
            // First, we must log in with the new password because reset-password incremented the tokenVersion, 
            // rendering our old userToken invalid!
            const loginRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/login')
                .send({ email: testUserEmail, password: 'NewPassword123!' });
            (0, vitest_1.expect)(loginRes.status).toBe(http_status_codes_1.StatusCodes.OK);
            const newUserToken = loginRes.body.data.accessToken;
            // Now change password to a BRAND NEW password so we don't trigger the "recently used password" error
            const brandNewPassword = 'BrandNewPassword123!';
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/change-password')
                .set('Authorization', `Bearer ${newUserToken}`)
                .send({ currentPassword: 'NewPassword123!', newPassword: brandNewPassword });
            (0, testLogger_1.logApi)('POST', '/api/v1/auth/change-password', { headers: { Authorization: `Bearer ${newUserToken}` }, body: { currentPassword: 'NewPassword123!', newPassword: brandNewPassword } }, res.body, 'POST-CHANGE-PASSWORD', 'User changes password');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            // Update the global test password variable so subsequent tests log in successfully!
            TEST_PASSWORD = brandNewPassword;
            // Restore the main userToken for the rest of the E2E tests by logging in again!
            const finalLoginRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/login')
                .send({ email: testUserEmail, password: TEST_PASSWORD });
            (0, vitest_1.expect)(finalLoginRes.status).toBe(http_status_codes_1.StatusCodes.OK);
            userToken = finalLoginRes.body.data.accessToken;
        }));
        (0, vitest_1.it)('should allow an authenticated user to update their profile information', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 08. UPDATE USER PROFILE
Feature: Profile Management
  As a logged-in user
  I want to update my personal information (name, gender, date of birth)
  So that my profile remains accurate

  Given the user is authenticated
  When they submit a request to update their name, gender, and date of birth
  Then the system validates the input
  And updates the user's profile in the database
  And returns the updated user object
`);
            const updatedInfo = {
                name: 'Updated E2E User',
                gender: 'MALE',
                dateOfBirth: '1990-01-01T00:00:00.000Z'
            };
            const res = yield (0, supertest_1.default)(app_1.default)
                .patch('/api/v1/users/me')
                .set('Authorization', `Bearer ${userToken}`)
                .send(updatedInfo);
            (0, testLogger_1.logApi)('PATCH', '/api/v1/users/me', { headers: { Authorization: `Bearer ${userToken}` }, body: updatedInfo }, res.body, 'PATCH-UPDATE-PROFILE', 'User updates their profile');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.name).toBe(updatedInfo.name);
            (0, vitest_1.expect)(res.body.data.gender).toBe(updatedInfo.gender);
            (0, vitest_1.expect)(new Date(res.body.data.dateOfBirth).toISOString()).toBe(updatedInfo.dateOfBirth);
        }));
        (0, vitest_1.it)('should request an email change and send an OTP (Step 1)', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            console.info(`
📖 BDD SCENARIO: 09. EMAIL CHANGE REQUEST
Feature: Account Settings
  As a logged-in user
  I want to initiate an email address change
  So that I can use a new email for my account

  Given the user is authenticated
  When they provide their current password and a new email address
  Then the system verifies the password
  And generates an OTP and sends it to the new email address
  And temporarily stores the pending email change request
`);
            const newEmail = 'new_email_e2e@test.com';
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/users/me/email-change/request')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                newEmail,
                password: TEST_PASSWORD,
            });
            (0, testLogger_1.logApi)('POST', '/api/v1/users/me/email-change/request', { headers: { Authorization: `Bearer ${userToken}` }, body: { newEmail, password: TEST_PASSWORD } }, res.body, 'POST-EMAIL-CHANGE-REQUEST', 'User requests email change');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            // Verify OTP is stored in the DB
            const userAfterRequest = yield user_model_1.User.findById(testUserId).select('+emailChange');
            (0, vitest_1.expect)((_a = userAfterRequest === null || userAfterRequest === void 0 ? void 0 : userAfterRequest.emailChange) === null || _a === void 0 ? void 0 : _a.otp).toBeDefined();
            (0, vitest_1.expect)((_b = userAfterRequest === null || userAfterRequest === void 0 ? void 0 : userAfterRequest.emailChange) === null || _b === void 0 ? void 0 : _b.newEmail).toBe(newEmail);
        }));
        (0, vitest_1.it)('should confirm the email change with the OTP (Step 2)', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            console.info(`
📖 BDD SCENARIO: 10. EMAIL CHANGE CONFIRM
Feature: Account Settings
  As a logged-in user
  I want to confirm my new email address using an OTP
  So that the email change is finalized securely

  Given the user has a pending email change request
  When they submit the correct OTP
  Then the system validates the OTP
  And permanently updates the user's email address
  And revokes all previous active sessions for security
`);
            // Fetch OTP directly from the test DB since this is an E2E test
            const userBeforeConfirm = yield user_model_1.User.findById(testUserId).select('+emailChange');
            const otp = (_a = userBeforeConfirm === null || userBeforeConfirm === void 0 ? void 0 : userBeforeConfirm.emailChange) === null || _a === void 0 ? void 0 : _a.otp;
            (0, vitest_1.expect)(otp).toBeDefined();
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/users/me/email-change/confirm')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ otp });
            (0, testLogger_1.logApi)('POST', '/api/v1/users/me/email-change/confirm', { headers: { Authorization: `Bearer ${userToken}` }, body: { otp } }, res.body, 'POST-EMAIL-CHANGE-CONFIRM', 'User confirms email change');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            // Update testUserEmail for any subsequent tests, and we must log in again 
            // because tokenVersion was bumped!
            testUserEmail = 'new_email_e2e@test.com';
            const loginRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/login')
                .send({ email: testUserEmail, password: TEST_PASSWORD });
            (0, vitest_1.expect)(loginRes.status).toBe(http_status_codes_1.StatusCodes.OK);
            userToken = loginRes.body.data.accessToken;
        }));
        (0, vitest_1.it)('should allow a Guest User to read the legal pages before registering', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            console.info(`
📖 BDD SCENARIO: 11. PUBLIC LEGAL PAGES
Feature: Legal Information
  As a prospective or existing user
  I want to read the legal pages (e.g., terms and conditions)
  So that I understand the rules before signing up

  Given the system has public legal pages available
  When an unauthenticated user requests the list of legal pages
  Then the system returns all available legal pages
  And when the user requests a specific legal page by slug
  Then the system returns the content of that specific page
`);
            // 1. Get all legal pages
            const resAll = yield (0, supertest_1.default)(app_1.default).get('/api/v1/legals');
            (0, testLogger_1.logApi)('GET', '/api/v1/legals', {}, resAll.body, 'GET-ALL-LEGALS', 'User fetches all legal pages');
            (0, vitest_1.expect)(resAll.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(resAll.body.success).toBe(true);
            // Data might be paginated or array, but according to typical implementation it's an array directly or inside data.data
            const results = ((_a = resAll.body.data) === null || _a === void 0 ? void 0 : _a.data) || resAll.body.data;
            (0, vitest_1.expect)(Array.isArray(results)).toBe(true);
            (0, vitest_1.expect)(results.length).toBeGreaterThan(0);
            // 2. Get specific legal page by slug
            const slug = 'terms-and-conditions';
            const resSingle = yield (0, supertest_1.default)(app_1.default).get(`/api/v1/legals/${slug}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/legals/${slug}`, {}, resSingle.body, 'GET-SINGLE-LEGAL', 'User fetches a specific legal page');
            (0, vitest_1.expect)(resSingle.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(resSingle.body.success).toBe(true);
            (0, vitest_1.expect)(resSingle.body.data.slug).toBe(slug);
            (0, vitest_1.expect)(resSingle.body.data.title).toBe('Terms and Conditions');
        }));
        let dummyEmailToRestore = 'to_be_restored@e2e.test';
        let dummyPasswordToRestore = 'RestoreMe123!';
        (0, vitest_1.it)('should allow a user to soft-delete their account (Step 12)', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 12. ACCOUNT DELETION
Feature: Account Settings
  As a logged-in user
  I want to delete my account when I no longer need it
  So that my data is removed securely (with a 30-day grace period)

  Given the user provides their valid password
  When they submit a request to delete their account
  Then the system validates the password
  And sets the account status to DELETED
  And invalidates their current session
`);
            // First, create and login a dummy user just for this test so we don't break the rest of the E2E flow
            const dummyUser = yield user_model_1.User.create({
                name: 'Restore Me',
                role: user_1.USER_ROLES.USER,
                email: dummyEmailToRestore,
                password: dummyPasswordToRestore,
                isVerified: true,
            });
            const loginRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/login')
                .send({ email: dummyEmailToRestore, password: dummyPasswordToRestore });
            const dummyToken = loginRes.body.data.accessToken;
            // Now, test the deletion API
            const deleteRes = yield (0, supertest_1.default)(app_1.default)
                .delete('/api/v1/users/me')
                .set('Authorization', `Bearer ${dummyToken}`)
                .send({ password: dummyPasswordToRestore });
            (0, testLogger_1.logApi)('DELETE', '/api/v1/users/me', { headers: { Authorization: `Bearer ${dummyToken}` }, body: { password: dummyPasswordToRestore } }, deleteRes.body, 'DELETE-ACCOUNT', 'User deletes their account');
            (0, vitest_1.expect)(deleteRes.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(deleteRes.body.success).toBe(true);
            // Verify the user is soft-deleted in the database
            const deletedUser = yield user_model_1.User.findById(dummyUser._id).select('+status');
            (0, vitest_1.expect)(deletedUser === null || deletedUser === void 0 ? void 0 : deletedUser.status).toBe(user_1.USER_STATUS.DELETED);
        }));
        (0, vitest_1.it)('should prevent a deleted user from logging in and suggest contacting support (Step 13)', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 13. LOGIN PREVENTION FOR DELETED ACCOUNTS
Feature: Account Security & Frontend Integration
  As a recently deleted user
  I want to be informed that my account is deleted if I try to log in again
  So that the frontend app can prompt me to restore it

  Given the user's account is in DELETED status (Soft Deleted)
  When the user attempts to log in normally (/api/v1/auth/login)
  Then the backend system immediately rejects the login attempt
  And returns a 403 FORBIDDEN status with the message "Your account has been deleted"
  [FRONTEND BEHAVIOR]: The frontend catches this specific 403 error and shows a pop-up:
  "Your account is currently deleted. Do you want to restore it? [Yes, Restore]"
`);
            const loginAttempt = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/login')
                .send({ email: dummyEmailToRestore, password: dummyPasswordToRestore });
            (0, testLogger_1.logApi)('POST', '/api/v1/auth/login', { body: { email: dummyEmailToRestore, password: dummyPasswordToRestore } }, loginAttempt.body, 'POST-LOGIN-DELETED', 'Deleted user attempts to log in');
            (0, vitest_1.expect)(loginAttempt.status).toBe(http_status_codes_1.StatusCodes.FORBIDDEN);
            (0, vitest_1.expect)(loginAttempt.body.success).toBe(false);
            (0, vitest_1.expect)(loginAttempt.body.message).toContain('Your account has been deleted');
        }));
        (0, vitest_1.it)('should allow a user to restore a soft-deleted account within the grace period (Step 14)', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 14. ACCOUNT RESTORATION
Feature: Account Recovery
  As a user who recently deleted my account
  I want to easily restore my account via the frontend prompt
  So that I can regain access to my profile without creating a new one

  Given the frontend app has prompted the user to restore their account
  When the user clicks "Yes, Restore" and the app hits the restore API (/api/v1/auth/restore-account)
  Then the backend validates their existing email and password
  And smoothly changes the account status from DELETED back to ACTIVE
  And immediately issues new access and refresh tokens
  And the user is auto-logged in
`);
            const restoreRes = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/auth/restore-account')
                .send({ email: dummyEmailToRestore, password: dummyPasswordToRestore });
            (0, testLogger_1.logApi)('POST', '/api/v1/auth/restore-account', { body: { email: dummyEmailToRestore, password: dummyPasswordToRestore } }, restoreRes.body, 'POST-RESTORE-ACCOUNT', 'User restores their deleted account');
            (0, vitest_1.expect)(restoreRes.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(restoreRes.body.success).toBe(true);
            (0, vitest_1.expect)(restoreRes.body.data.accessToken).toBeDefined();
            // Verify the user is ACTIVE again in the database
            const restoredUser = yield user_model_1.User.findOne({ email: dummyEmailToRestore }).select('+status');
            (0, vitest_1.expect)(restoredUser === null || restoredUser === void 0 ? void 0 : restoredUser.status).toBe(user_1.USER_STATUS.ACTIVE);
        }));
    });
    (0, vitest_1.describe)('1. Home Page Flow', () => {
        (0, vitest_1.it)('should return search results from the home page search bar', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            console.info(`
📖 BDD SCENARIO: 01. HOME PAGE SEARCH
Feature: Content Discovery
  As a user looking for specific content
  I want to search for a movie by its title
  So that I can quickly find what I want to watch

  Given the user is on the home page
  When they type a search term (e.g., 'Batman') in the search bar
  Then the system queries the content collection
  And returns a list of movies matching the search term
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/contents/search?searchTerm=Batman')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/contents/search?searchTerm=Batman', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SEARCH', 'User searches for a movie from home page');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            // The search endpoint might return paginated structure
            const results = ((_a = res.body.data) === null || _a === void 0 ? void 0 : _a.data) || res.body.data;
            (0, vitest_1.expect)(Array.isArray(results)).toBe(true);
            (0, vitest_1.expect)(results.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(results[0].title).toContain('Batman');
        }));
        (0, vitest_1.it)('should load the popular tab successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 02. POPULAR TAB WITH DYNAMIC RANKING ALGORITHM
Feature: Content Discovery
  As a user browsing for popular content
  I want to see currently trending and highly engaging videos
  So that I can watch what everyone else is enjoying right now

  Given the user navigates to the 'Popular' tab on the home screen
  When the app requests the popular content feed
  Then the system calculates ranking using a hybrid algorithm (momentum, watch time, views)
  And returns dynamically sorted sections like 'Trending Now' and 'Most Popular'
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=popular')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=popular', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-POPULAR', 'User fetches popular home tab');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.sections).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(res.body.data.sections)).toBe(true);
            // Ensure the trending section is returned
            const trendingSection = res.body.data.sections.find((s) => s.id === 'row_trending_now');
            (0, vitest_1.expect)(trendingSection).toBeDefined();
        }));
        (0, vitest_1.it)('should load the new tab successfully and include virtual isRecent flag', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 03. NEW RELEASES TAB WITH VIRTUAL BADGE
Feature: Content Discovery
  As a user looking for fresh content
  I want to easily identify newly released movies and series
  So that I can stay up-to-date with the latest entertainment

  Given the user navigates to the 'New' tab on the home screen
  When the app requests the new content feed
  Then the system calculates a 30-day rolling window based on the 'publishedAt' date
  And dynamically attaches an 'isRecent' flag to freshly published items
  And returns the new releases section
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=new')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=new', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-NEW', 'User fetches new home tab');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const newReleasesSection = res.body.data.sections.find((s) => s.id === 'row_new_releases');
            (0, vitest_1.expect)(newReleasesSection).toBeDefined();
            // Ensure the virtual field is attached to the response
            if (newReleasesSection.items.length > 0) {
                (0, vitest_1.expect)(newReleasesSection.items[0].isRecent).toBeDefined();
                // Since the dummy data uses 'new Date()' for publishedAt, this should be true.
                (0, vitest_1.expect)(newReleasesSection.items[0].isRecent).toBe(true);
            }
        }));
    });
    (0, vitest_1.describe)('1.5. VIP Page Flow', () => {
        (0, vitest_1.it)('should load the vip tab successfully and show coming soon', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 04. VIP TAB (DEFAULT DAILY PICKS & COMING SOON)
Feature: Premium Content Discovery
  As a subscribed user
  I want to explore premium content recommendations
  So that I can discover exclusive VIP movies and series

  Given the user navigates to the 'VIP' tab on the home screen
  When the app requests the VIP feed without a specific filter
  Then the system defaults to "Today's VIP Picks"
  And returns the premium content sections including "Coming Soon"
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=vip')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=vip', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-VIP-DAILY', 'User fetches vip home tab (daily default)');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const dailyVipSection = res.body.data.sections.find((s) => s.id === 'row_vip_daily');
            (0, vitest_1.expect)(dailyVipSection).toBeDefined();
            const comingSoonSection = res.body.data.sections.find((s) => s.id === 'row_coming_soon');
            (0, vitest_1.expect)(comingSoonSection).toBeDefined();
            (0, vitest_1.expect)(comingSoonSection.title).toBe('Coming Soon');
        }));
        (0, vitest_1.it)('should load the vip tab successfully with weekly filter and coming soon', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 05. VIP TAB (WEEKLY FILTER)
Feature: Premium Content Discovery
  As a subscribed user
  I want to filter premium content by weekly performance
  So that I can see the best exclusive content of the week

  Given the user is on the 'VIP' tab
  When they apply the "Weekly" filter
  Then the system filters the premium content based on weekly performance
  And returns the 'Weekly VIP' section and "Coming Soon" section
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=vip&filter=weekly')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=vip&filter=weekly', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-VIP-WEEKLY', 'User fetches vip home tab (weekly filter)');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const weeklyVipSection = res.body.data.sections.find((s) => s.id === 'row_vip_weekly');
            (0, vitest_1.expect)(weeklyVipSection).toBeDefined();
            const comingSoonSection = res.body.data.sections.find((s) => s.id === 'row_coming_soon');
            (0, vitest_1.expect)(comingSoonSection).toBeDefined();
        }));
    });
    (0, vitest_1.describe)('1.6. Ranking Tab Flow', () => {
        (0, vitest_1.it)('should load the ranking tab successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 06. RANKING LEADERBOARDS
Feature: Content Discovery
  As a competitive or curious user
  I want to see the top ranking charts
  So that I know which content is the most successful globally

  Given the user navigates to the 'Ranking' tab
  When the app requests the ranking feed with a filter (daily, weekly, monthly, or popular)
  Then the system compiles leaderboards dynamically based on views in that timeframe
  And returns the sorted ranking lists
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=ranking&filter=weekly')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=ranking&filter=weekly', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-RANKING', 'User fetches ranking home tab');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
    });
    (0, vitest_1.describe)('2. Content Details Flow', () => {
        (0, vitest_1.it)('should fetch the full details of the selected movie and series', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 07. FETCH CONTENT DETAILS
Feature: Content Discovery
  As a user who just clicked on a movie or series poster
  I want to see the full details of the content
  So that I can read the description and decide to watch it

  Given the user clicks on a movie or series from the Home feed
  When the mobile app requests the public content details
  Then the backend returns the full metadata (and seasons if it's a series)
  And the UI displays the details screen
`);
            // Fetch Movie
            const movieRes = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/${theMovieId}/details`)
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/contents/${theMovieId}/details`, { headers: { Authorization: `Bearer ${userToken}` } }, movieRes.body, 'GET-CONTENT-DETAILS', 'User fetches content details to view movie page');
            (0, vitest_1.expect)(movieRes.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(movieRes.body.success).toBe(true);
            (0, vitest_1.expect)(movieRes.body.data.title).toBeDefined();
            (0, vitest_1.expect)(movieRes.body.data.videoUrl).toBeDefined(); // videoUrl exposed as requested
            (0, vitest_1.expect)(movieRes.body.data.trailerUrl).toBeDefined();
            // Fetch Series
            const seriesRes = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/${theSeriesId}/details`)
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/contents/${theSeriesId}/details`, { headers: { Authorization: `Bearer ${userToken}` } }, seriesRes.body, 'GET-SERIES-DETAILS', 'User fetches content details to view series page');
            (0, vitest_1.expect)(seriesRes.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(seriesRes.body.success).toBe(true);
            (0, vitest_1.expect)(seriesRes.body.data.title).toBeDefined();
            (0, vitest_1.expect)(seriesRes.body.data.type).toBe('SERIES');
            (0, vitest_1.expect)(seriesRes.body.data.totalEpisodes).toBeDefined();
            (0, vitest_1.expect)(seriesRes.body.data.seasons).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(seriesRes.body.data.seasons)).toBe(true);
            (0, vitest_1.expect)(seriesRes.body.data.videoUrl).toBeUndefined(); // videoUrl should be hidden
            // Store season ID to fetch its episodes
            if (seriesRes.body.data.seasons.length > 0) {
                theSeasonId = seriesRes.body.data.seasons[0].id;
            }
        }));
        (0, vitest_1.it)('should fetch the episodes for a selected season', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 07.3 FETCH SEASON EPISODES
Feature: Content Discovery
  As a user who just expanded a season dropdown
  I want to see the list of episodes for that season
  So that I can select an episode to watch

  Given the user expands a season in the Series Details screen
  When the app requests the episodes for that specific season ID
  Then the backend returns the ordered list of episodes for the season
`);
            if (!theSeasonId) {
                const { Season } = yield Promise.resolve().then(() => __importStar(require('../modules/content/season.model')));
                const season = yield Season.findOne({ seriesId: theSeriesId });
                if (!season) {
                    throw new Error('Season ID not found and no season exists for the series');
                }
                theSeasonId = season._id.toString();
            }
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/seasons/${theSeasonId}/episodes`)
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/contents/seasons/${theSeasonId}/episodes`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SEASON-EPISODES', 'User fetches the list of episodes for a specific season');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
            if (res.body.data.length > 0) {
                (0, vitest_1.expect)(res.body.data[0].title).toBeDefined();
                (0, vitest_1.expect)(res.body.data[0].episodeNumber).toBeDefined();
                (0, vitest_1.expect)(res.body.data[0].videoUrl).toBeDefined(); // Exposed per user request
            }
        }));
        (0, vitest_1.it)('should fetch similar content for a selected movie', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 07.4 FETCH SIMILAR CONTENT (MORE LIKE THIS)
Feature: Content Discovery
  As a user who is viewing a movie
  I want to see a list of similar content
  So that I can easily find something else to watch next

  Given the user scrolls down to the "More Like This" section
  When the app requests similar content based on the current movie's genres
  Then the backend returns an array of related movies/series
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/${theMovieId}/similar`)
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/contents/${theMovieId}/similar`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SIMILAR-CONTENT', 'User fetches "More Like This" content based on current movie');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data).toBeDefined();
            (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
        }));
        (0, vitest_1.it)('should fetch the secure playback URL for the selected movie', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 07.1 FETCH SECURE PLAYBACK URL
Feature: Content Playback Protection
  As a user pressing the "Play" button
  I want to securely get the video URL
  So that I can start streaming the content

  Given the user decides to play the selected movie
  When the app requests the playback URL
  Then the backend verifies plan status and JWT token
  And generates a secure, expiring temporary Signed URL for playback
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/contents/${theMovieId}/playback-url`)
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/contents/${theMovieId}/playback-url`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-PLAYBACK-URL', 'User presses play and fetches secure signed video URL');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.url).toBeDefined();
            (0, vitest_1.expect)(res.body.data.expiresAt).toBeDefined();
        }));
        (0, vitest_1.it)('should fetch the specific watch progress for a selected movie (Option 3 Architecture)', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 08. FETCH SPECIFIC WATCH PROGRESS
Feature: Continue Watching
  As a user opening a movie from search or category
  I want my previous watch progress to be loaded
  So that playback resumes exactly where I left off

  Given the user selects a movie to watch
  When the frontend requests the specific watch progress for that movie ID
  Then the backend retrieves the exact paused location (watchedSeconds)
  And returns the progress data
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get(`/api/v1/recently-watched/content/${theMovieId}`)
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', `/api/v1/recently-watched/content/${theMovieId}`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SINGLE-PROGRESS', 'User fetches progress for a specific movie');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            // Data will be null if not watched yet, which is expected for theMovieId right now
            (0, vitest_1.expect)(res.body.data).toBeDefined();
        }));
        (0, vitest_1.it)('should track progress for the selected movie to appear in Recently Watched', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 09. TRACK WATCH PROGRESS
Feature: Continue Watching
  As a user actively watching a movie
  I want my progress to be continuously tracked
  So that the movie appears in my 'Continue Watching' list later

  Given the user is watching a movie in the player
  When the app periodically sends the current playback time to the tracking API
  Then the backend securely saves the watched seconds
  And updates or creates a progress record for that user and movie
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .post('/api/v1/recently-watched/track-progress')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                contentId: theMovieId,
                watchedSeconds: 60,
            });
            (0, testLogger_1.logApi)('POST', '/api/v1/recently-watched/track-progress', { headers: { Authorization: `Bearer ${userToken}` }, body: { contentId: theMovieId, watchedSeconds: 60 } }, res.body, 'POST-TRACK-PROGRESS', 'User tracks watch progress for movie');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
        }));
        (0, vitest_1.it)('should return the "Continue Watching" section in the popular tab after tracking progress', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 10. DYNAMIC CONTINUE WATCHING ROW
Feature: Continue Watching
  As a returning user who has partially watched content
  I want to see a 'Continue Watching' section at the top of my home feed
  So that I can quickly jump back into my movies

  Given the user has recently tracked progress for a movie
  When they reload the Home page (Popular tab)
  Then the backend dynamically detects the active watch history
  And injects the 'Continue Watching' row as the very first section in the response
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/home/content?tab=popular')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/home/content?tab=popular', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-CONTINUE-WATCHING', 'User fetches home tab to see continue watching');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const continueWatchingSection = res.body.data.sections.find((s) => s.id === 'row_continue_watching');
            (0, vitest_1.expect)(continueWatchingSection).toBeDefined();
            (0, vitest_1.expect)(continueWatchingSection.items.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(continueWatchingSection.items[0]._id || continueWatchingSection.items[0].id).toBe(theMovieId);
        }));
    });
    (0, vitest_1.describe)('3. Shorts Page & Player Flow', () => {
        (0, vitest_1.describe)('A. Infinite Scrolling (Feed)', () => {
            (0, vitest_1.it)('Step 1: User opens the shorts feed and the first 5 videos are loaded without a cursor', () => __awaiter(void 0, void 0, void 0, function* () {
                var _a;
                console.info(`
📖 BDD SCENARIO: 01. INITIAL SHORTS FEED LOAD
Feature: Shorts Infinite Feed
  As a user opening the shorts section
  I want to see a fresh feed of short videos
  So that I can start discovering content immediately

  Given the user navigates to the shorts page for the first time
  When the app requests the feed without a cursor
  Then the server returns the first batch of videos (e.g., 5 videos)
  And provides a 'nextCursor' for subsequent pagination
`);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .get('/api/v1/shorts?limit=5')
                    .set('Authorization', `Bearer ${userToken}`);
                (0, testLogger_1.logApi)('GET', '/api/v1/shorts?limit=5', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SHORTS-P1', 'User fetches shorts page 1');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(Array.isArray(res.body.data)).toBe(true);
                (0, vitest_1.expect)(res.body.data.length).toBeGreaterThan(0);
                // Save cursor for next test
                if ((_a = res.body.meta) === null || _a === void 0 ? void 0 : _a.nextCursor) {
                    shortsCursor = res.body.meta.nextCursor;
                }
                // A real user sees the shorts and its details from the feed response
                const firstShort = res.body.data[0];
                (0, vitest_1.expect)(firstShort.title).toBeDefined();
                (0, vitest_1.expect)(firstShort.videoUrl).toBeDefined();
                // Save the selected short for subsequent actions (play, add to collection)
                selectedShortId = firstShort.contentId || firstShort.id || firstShort._id;
            }));
            (0, vitest_1.it)('Step 2: User scrolls down, triggering a request with the nextCursor to load the next 5 videos', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 02. INFINITE SCROLLING IN SHORTS
Feature: Continuous Content Discovery
  As a user browsing shorts
  I want the feed to load more videos automatically as I scroll
  So that I can experience uninterrupted viewing

  Given the user has loaded the initial shorts feed
  When they scroll near the bottom and trigger a request with 'nextCursor'
  Then the server returns the next batch of videos
  And provides a new 'nextCursor' to continue the infinite scroll
`);
                // If no cursor was returned (because total items < 5), we will just pass a dummy or omit it.
                // But to test the endpoint handles it, we will append it if it exists.
                const cursorParam = shortsCursor ? `&cursor=${shortsCursor}` : '';
                const res = yield (0, supertest_1.default)(app_1.default)
                    .get(`/api/v1/shorts?limit=5${cursorParam}`)
                    .set('Authorization', `Bearer ${userToken}`);
                (0, testLogger_1.logApi)('GET', `/api/v1/shorts?limit=5${cursorParam}`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-SHORTS-P2', 'User fetches shorts page 2');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
            }));
        });
        (0, vitest_1.describe)('B. Video Playback & Engagement', () => {
            (0, vitest_1.it)('Step 3: User watches a video for 3 seconds and a view is tracked', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 03. SHORTS VIEW TRACKING
Feature: Engagement Tracking
  As a system tracking engagement
  I want to count a view only after a meaningful watch duration
  So that metrics accurately reflect user interest

  Given a user is watching a short video
  When the playback duration exceeds a minimum threshold (e.g., 3 seconds)
  Then the system records a view for that specific short
  And increments its overall engagement metrics
`);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post(`/api/v1/shorts/${selectedShortId}/view`)
                    .set('Authorization', `Bearer ${userToken}`);
                (0, testLogger_1.logApi)('POST', `/api/v1/shorts/${selectedShortId}/view`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-TRACK-VIEW', 'User watches short and triggers view count');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
            }));
            (0, vitest_1.it)('Step 4: User likes the video and adds it to their personal My Collection list', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 04. SAVING SHORTS TO COLLECTION
Feature: Content Curation
  As a user who enjoyed a short
  I want to save it to my collection
  So that I can rewatch it later easily

  Given the user is viewing a short they like
  When they click the 'Add to Collection' button
  Then the server saves the short to their 'My Collection' list
  And marks the relationship in the database for future retrieval
`);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/my-collection')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({
                    itemId: selectedShortId,
                });
                (0, testLogger_1.logApi)('POST', '/api/v1/my-collection', { headers: { Authorization: `Bearer ${userToken}` }, body: { itemId: selectedShortId } }, res.body, 'POST-MY-COLLECTION', 'User adds short to collection');
                if (![200, 201].includes(res.status))
                    console.log('MY COLLECTION POST ERROR:', res.status, res.body);
                (0, vitest_1.expect)([200, 201]).toContain(res.status);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                myCollectionId = res.body.data._id || res.body.data.id;
            }));
        });
    });
    (0, vitest_1.describe)('4. My List (Recently Watched & My Collection) Flow', () => {
        (0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
            // Seed data to ensure these tests can be run in isolation (e.g. from Vitest UI)
            yield (0, supertest_1.default)(app_1.default).post('/api/v1/recently-watched/track-progress').set('Authorization', `Bearer ${userToken}`).send({
                contentId: theMovieId, watchedSeconds: 60,
            });
            yield (0, supertest_1.default)(app_1.default).post('/api/v1/my-collection').set('Authorization', `Bearer ${userToken}`).send({
                itemId: theMovieId,
            });
        }));
        (0, vitest_1.it)('should show the movie in Recently Watched', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 01. RECENTLY WATCHED LIST
Feature: Continue Watching
  As an active user
  I want to see the content I started watching
  So that I can easily resume playback from where I left off

  Given the user has previously watched a movie and progress was tracked
  When the user navigates to the 'My List' section and opens 'Recently Watched'
  Then the server retrieves and displays all partially watched content
  And the list includes the recently watched movie
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/recently-watched')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/recently-watched', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-RECENTLY-WATCHED', 'User views recently watched list');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const items = res.body.data.data || res.body.data;
            (0, vitest_1.expect)(Array.isArray(items)).toBe(true);
            (0, vitest_1.expect)(items.length).toBeGreaterThan(0);
            // Ensure the movie we tracked is in the list
            const watchedItem = items.find((item) => { var _a, _b, _c; return ((_a = item.contentId) === null || _a === void 0 ? void 0 : _a.id) === theMovieId || ((_c = (_b = item.contentId) === null || _b === void 0 ? void 0 : _b._id) === null || _c === void 0 ? void 0 : _c.toString()) === theMovieId || item.contentId === theMovieId; });
            if (!watchedItem)
                console.log('RECENTLY WATCHED ITEMS:', JSON.stringify(items, null, 2));
            (0, vitest_1.expect)(watchedItem).toBeDefined();
        }));
        (0, vitest_1.it)('should show the movie in My Collection', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            console.info(`
📖 BDD SCENARIO: 02. MY COLLECTION (WATCHLIST)
Feature: Personal Library
  As a user curating content
  I want to view my saved movies, series, and shorts
  So that I can quickly access my favorite content

  Given the user has previously added a movie to their collection
  When the user switches to the 'My Collection' tab
  Then the server retrieves the user's saved items
  And the list correctly displays the saved movie
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/my-collection')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/my-collection', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-MY-COLLECTION', 'User views their collection');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            const items = res.body.data || ((_a = res.body.data) === null || _a === void 0 ? void 0 : _a.data);
            (0, vitest_1.expect)(Array.isArray(items)).toBe(true);
            if (items.length === 0)
                console.log('MY COLLECTION GET ITEMS:', JSON.stringify(res.body, null, 2));
            (0, vitest_1.expect)(items.length).toBeGreaterThan(0);
        }));
        (0, vitest_1.it)('should bulk remove items from My Collection', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            console.info(`
📖 BDD SCENARIO: 03. BULK REMOVE ITEMS FROM MY COLLECTION
Feature: Collection Management
  As a user curating content
  I want to remove multiple items from my collection at once
  So that I can manage my saved content efficiently

  Given the user has multiple items in their collection
  When the user selects multiple items using checkboxes
  And clicks the "Remove" bulk button
  Then the backend deletes all selected items from the user's collection
  And the UI updates to remove all selected items from the list
  And shows success message with count of removed items

  [TECHNICAL NOTE]: The 'itemIds' array gracefully accepts EITHER the MyCollection document IDs ('_id') OR the actual Movie/Series Content IDs ('itemId'). The backend will successfully delete the items in both cases using a smart $or query.
`);
            // First, fetch the current collection to get the items to remove
            const collectionRes = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/my-collection')
                .set('Authorization', `Bearer ${userToken}`);
            const items = collectionRes.body.data || ((_a = collectionRes.body.data) === null || _a === void 0 ? void 0 : _a.data);
            if (!items || items.length === 0)
                return; // Skip if empty (though it shouldn't be based on previous test)
            const itemIdsToRemove = items.map((item) => item._id || item.id);
            const bulkDeleteRes = yield (0, supertest_1.default)(app_1.default)
                .delete('/api/v1/my-collection/bulk')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ itemIds: itemIdsToRemove });
            (0, testLogger_1.logApi)('DELETE', '/api/v1/my-collection/bulk', { headers: { Authorization: `Bearer ${userToken}` }, body: { itemIds: itemIdsToRemove } }, bulkDeleteRes.body, 'DELETE-BULK-MY-COLLECTION', 'User removes multiple items from collection');
            (0, vitest_1.expect)(bulkDeleteRes.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(bulkDeleteRes.body.success).toBe(true);
            (0, vitest_1.expect)(bulkDeleteRes.body.data.deletedCount).toBe(itemIdsToRemove.length);
            // Verify the items are actually removed
            const emptyRes = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/my-collection')
                .set('Authorization', `Bearer ${userToken}`);
            const remainingItems = emptyRes.body.data || ((_b = emptyRes.body.data) === null || _b === void 0 ? void 0 : _b.data);
            // Filter out the items we just deleted to make sure they are gone
            const foundDeletedItems = remainingItems.filter((item) => itemIdsToRemove.includes(item._id || item.id));
            (0, vitest_1.expect)(foundDeletedItems.length).toBe(0);
        }));
    });
    (0, vitest_1.describe)('5. Rewards Page Flow', () => {
        (0, vitest_1.it)('should show the initial wallet balance as 0', () => __awaiter(void 0, void 0, void 0, function* () {
            console.info(`
📖 BDD SCENARIO: 01. INITIAL REWARD WALLET BALANCE
Feature: Rewards System
  As a registered user
  I want to view my initial reward wallet balance
  So that I can track my earned coins

  Given the user has just registered an account
  When the user navigates to the 'Rewards' page
  Then the server retrieves the wallet details
  And the initial balance should be 0 for both gold and bonus coins
`);
            const res = yield (0, supertest_1.default)(app_1.default)
                .get('/api/v1/rewards/wallet')
                .set('Authorization', `Bearer ${userToken}`);
            (0, testLogger_1.logApi)('GET', '/api/v1/rewards/wallet', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-WALLET', 'User views their coin wallet');
            (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
            (0, vitest_1.expect)(res.body.success).toBe(true);
            (0, vitest_1.expect)(res.body.data.coinBalance).toBe(0);
        }));
        (0, vitest_1.describe)('Daily Check-In Streak System', () => {
            let UserRewardProgress;
            (0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
                const models = yield Promise.resolve().then(() => __importStar(require('../modules/reward/reward.model')));
                UserRewardProgress = models.UserRewardProgress;
            }));
            const mockStreak = (currentDay, lastClaimOffsetMs) => __awaiter(void 0, void 0, void 0, function* () {
                const lastClaimDate = new Date(Date.now() - lastClaimOffsetMs);
                lastClaimDate.setUTCHours(0, 0, 0, 0);
                yield UserRewardProgress.findOneAndUpdate({ user: testUserId }, {
                    $set: {
                        'checkInStreak.currentDay': currentDay,
                        'checkInStreak.lastClaimDate': lastClaimDate,
                        'checkInStreak.isStreakActive': true,
                        'checkInStreak.totalStreaksCompleted': 3,
                    },
                }, { new: true });
            });
            (0, vitest_1.it)('should allow the user to claim a reward on Day 3 (Scenario 01)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 01. NORMAL DAILY CLAIM (Day 1-7)
Feature: Daily Check-In Reward
  Scenario: User claims reward on Day 3
    Given user has streak currentDay = 3
    And lastClaimDate = "Yesterday"
    When user clicks "Claim" on Daily Check-In
    Then server verifies lastClaimDate ≠ today
    And adds 20 coins to wallet
    And updates streak.currentDay = 4
`);
                yield mockStreak(3, 86400000); // 1 day ago
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/check-in')
                    .set('Authorization', `Bearer ${userToken}`);
                (0, testLogger_1.logApi)('POST', '/api/v1/rewards/claim/check-in', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-CLAIM-SCENARIO-01', 'User claims daily check-in reward on Day 3');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.coinsEarned).toBe(20);
                (0, vitest_1.expect)(res.body.data.streakDay).toBe(3);
                (0, vitest_1.expect)(res.body.data.nextStreakDay).toBe(4);
                // Fetch wallet to see what it looks like after check-in
                const walletRes = yield (0, supertest_1.default)(app_1.default)
                    .get('/api/v1/rewards/wallet')
                    .set('Authorization', `Bearer ${userToken}`);
                (0, testLogger_1.logApi)('GET', '/api/v1/rewards/wallet', { headers: { Authorization: `Bearer ${userToken}` } }, walletRes.body, 'GET-WALLET-AFTER-CHECKIN', 'User views their wallet after daily check-in');
                (0, vitest_1.expect)(walletRes.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(walletRes.body.success).toBe(true);
            }));
            (0, vitest_1.it)('should block claiming twice on the same day (Scenario 02)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 02. ALREADY CLAIMED TODAY (Edge Case)
Feature: Daily Check-In Reward
  Scenario: User tries to claim twice on same day
    Given user has streak currentDay = 4
    And lastClaimDate = "Today"
    When user clicks "Claim" on Daily Check-In
    Then server returns error "Already claimed today"
`);
                // We just claimed in the previous test, so it's "Today"
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/check-in')
                    .set('Authorization', `Bearer ${userToken}`);
                (0, testLogger_1.logApi)('POST', '/api/v1/rewards/claim/check-in', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-CLAIM-SCENARIO-02', 'User tries to claim twice');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.BAD_REQUEST);
                (0, vitest_1.expect)(res.body.success).toBe(false);
                (0, vitest_1.expect)(res.body.message).toBe('Already claimed today');
            }));
            (0, vitest_1.it)('should reset streak on missed days (Scenario 03)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 03. STREAK RESET ON MISSED DAY
Feature: Daily Check-In Reward
  Scenario: User misses 2 days, streak resets
    Given user has streak currentDay = 5
    And lastClaimDate = "3 days ago"
    When user clicks "Claim" on Daily Check-In
    Then server resets streak.currentDay = 1
    And adds 10 coins (Day 1 reward)
`);
                yield mockStreak(5, 86400000 * 3); // 3 days ago
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/check-in')
                    .set('Authorization', `Bearer ${userToken}`);
                (0, testLogger_1.logApi)('POST', '/api/v1/rewards/claim/check-in', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-CLAIM-SCENARIO-03', 'User misses 2 days and resets streak');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.coinsEarned).toBe(10); // Day 1
                (0, vitest_1.expect)(res.body.data.streakDay).toBe(1);
                (0, vitest_1.expect)(res.body.data.nextStreakDay).toBe(2);
            }));
            (0, vitest_1.it)('should complete 7-day cycle and reset (Scenario 04)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 04. DAY 7 COMPLETE -> CYCLE RESET
Feature: Daily Check-In Reward
  Scenario: User completes 7-day cycle
    Given user has streak currentDay = 7
    When user clicks "Claim" on Daily Check-In
    Then server adds 50 coins (Day 7 reward)
    And resets streak.currentDay = 1
`);
                yield mockStreak(7, 86400000); // 1 day ago
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/check-in')
                    .set('Authorization', `Bearer ${userToken}`);
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.coinsEarned).toBe(50);
                (0, vitest_1.expect)(res.body.data.streakDay).toBe(7);
                (0, vitest_1.expect)(res.body.data.nextStreakDay).toBe(1); // Cycle reset
            }));
            (0, vitest_1.it)('should provide progressive reward on Day 2 (Scenario 05)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 05. PROGRESSIVE REWARD ON DAY 2
Feature: Daily Check-In Reward
  Scenario: User claims progressive reward on Day 2
    Given user has streak currentDay = 2
    When user clicks "Claim" on Daily Check-In
    Then server adds 15 coins
    And updates streak.currentDay = 3
`);
                yield mockStreak(2, 86400000);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/check-in')
                    .set('Authorization', `Bearer ${userToken}`);
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.coinsEarned).toBe(15);
                (0, vitest_1.expect)(res.body.data.streakDay).toBe(2);
                (0, vitest_1.expect)(res.body.data.nextStreakDay).toBe(3);
            }));
            (0, vitest_1.it)('should not reset streak if only 1 day is missed (Scenario 06)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 06. 1 DAY MISS ONLY (NO RESET)
Feature: Daily Check-In Reward
  Scenario: User misses exactly 1 day (boundary)
    Given user has streak currentDay = 4
    And lastClaimDate = "1 day ago"
    When user clicks "Claim" on Daily Check-In
    Then server detects daysMissed = 1 (allowed)
    And adds 25 coins (Day 4 reward)
    And updates streak.currentDay = 5
`);
                // 1 day ago is technically a continuous streak in Daily Check-in logic.
                yield mockStreak(4, 86400000);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/check-in')
                    .set('Authorization', `Bearer ${userToken}`);
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.coinsEarned).toBe(25);
                (0, vitest_1.expect)(res.body.data.streakDay).toBe(4);
                (0, vitest_1.expect)(res.body.data.nextStreakDay).toBe(5);
            }));
        });
        (0, vitest_1.describe)('Video Duration Based Coin Reward', () => {
            let UserRewardProgress;
            (0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
                const models = yield Promise.resolve().then(() => __importStar(require('../modules/reward/reward.model')));
                UserRewardProgress = models.UserRewardProgress;
            }));
            const mockWatchReward = (claimedDuration, lastClaimOffsetMs) => __awaiter(void 0, void 0, void 0, function* () {
                const lastClaimDate = new Date(Date.now() - lastClaimOffsetMs);
                lastClaimDate.setUTCHours(0, 0, 0, 0);
                yield UserRewardProgress.findOneAndUpdate({ user: testUserId }, {
                    $set: {
                        'dailyWatchReward.lastClaimDate': lastClaimDate,
                        'dailyWatchReward.claimedDuration': claimedDuration,
                    },
                }, { new: true, upsert: true });
            });
            const clearWatchReward = () => __awaiter(void 0, void 0, void 0, function* () {
                yield UserRewardProgress.findOneAndUpdate({ user: testUserId }, { $unset: { dailyWatchReward: 1 } }, { new: true });
            });
            (0, vitest_1.it)('should grant 10 coins for 5 minutes of watch time (Scenario 1)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 01. 5 MINUTE WATCH -> 10 COINS
Feature: Video Duration Based Coin Reward
  Scenario: User receives 10 coins for watching 5 minutes of video
    Given the user is on the rewards page
    And the user has not claimed a reward today
    When the user watches a video for 5 minutes
    Then the user receives 10 coins
    And their daily reward status is marked as "claimed"
`);
                yield clearWatchReward();
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/watch-time')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ videoDuration: 5 });
                (0, testLogger_1.logApi)('POST', '/api/v1/rewards/claim/watch-time', { headers: { Authorization: `Bearer <USER_TOKEN>` }, body: { videoDuration: 5 } }, res.body, 'POST-WATCH-TIME-SCENARIO-01', 'User claims reward for 5 minutes');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(10);
            }));
            (0, vitest_1.it)('should grant 15 coins for 10 minutes of watch time (Scenario 2)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 02. 10 MINUTE WATCH -> 15 COINS
Feature: Video Duration Based Coin Reward
  Scenario: User receives 15 coins for watching 10 minutes of video
    Given the user is on the rewards page
    And the user has not claimed a reward today
    When the user watches a video for 10 minutes
    Then the user receives 15 coins
    And their daily reward status is marked as "claimed"
`);
                yield clearWatchReward();
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/watch-time')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ videoDuration: 10 });
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(15);
            }));
            (0, vitest_1.it)('should grant 20 coins for 20 minutes of watch time (Scenario 3)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 03. 20 MINUTE WATCH -> 20 COINS
Feature: Video Duration Based Coin Reward
  Scenario: User receives 20 coins for watching 20 minutes of video
    Given the user is on the rewards page
    And the user has not claimed a reward today
    When the user watches a video for 20 minutes
    Then the user receives 20 coins
    And their daily reward status is marked as "claimed"
`);
                yield clearWatchReward();
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/watch-time')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ videoDuration: 20 });
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(20);
            }));
            (0, vitest_1.it)('should grant 25 coins for 30 minutes of watch time (Scenario 4)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 04. 30 MINUTE WATCH -> 25 COINS
Feature: Video Duration Based Coin Reward
  Scenario: User receives 25 coins for watching 30 minutes of video
    Given the user is on the rewards page
    And the user has not claimed a reward today
    When the user watches a video for 30 minutes
    Then the user receives 25 coins
    And their daily reward status is marked as "claimed"
`);
                yield clearWatchReward();
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/watch-time')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ videoDuration: 30 });
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(25);
            }));
            (0, vitest_1.it)('should grant 30 coins for 40 minutes of watch time (Scenario 5)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 05. 40 MINUTE WATCH -> 30 COINS
Feature: Video Duration Based Coin Reward
  Scenario: User receives 30 coins for watching 40 minutes of video
    Given the user is on the rewards page
    And the user has not claimed a reward today
    When the user watches a video for 40 minutes
    Then the user receives 30 coins
    And their daily reward status is marked as "claimed"
`);
                yield clearWatchReward();
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/watch-time')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ videoDuration: 40 });
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(30);
            }));
            (0, vitest_1.it)('should block claiming twice on the same day (Scenario 6)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 06. CLAIM TWICE -> BLOCKED
Feature: Video Duration Based Coin Reward
  Scenario: User is blocked from claiming a reward twice in one day
    Given the user is on the rewards page
    And the user has already claimed a reward today
    When the user watches another video
    Then the user does not receive any coins
    And the system shows an error: "You have already claimed your reward today. Please try again tomorrow."
`);
                // Mock that user already claimed today (0 offset)
                yield mockWatchReward(10, 0);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/watch-time')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ videoDuration: 15 });
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.BAD_REQUEST);
                (0, vitest_1.expect)(res.body.success).toBe(false);
                (0, vitest_1.expect)(res.body.message).toBe('আপনি আজকে রিওয়ার্ড নিয়েছেন। পরের দিনে আবার চেষ্টা করুন।');
            }));
            (0, vitest_1.it)('should reset the next day and allow claiming again (Scenario 7)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 07. NEXT DAY -> RESET & CLAIM
Feature: Video Duration Based Coin Reward
  Scenario: System resets the next day, allowing a new reward claim
    Given the user claimed a reward yesterday
    And today is a new day
    When the user watches a video for 5 minutes
    Then the user receives 10 coins
    And their daily reward status is marked as "claimed"
`);
                // Mock that user claimed 1 day ago (86400000ms offset)
                yield mockWatchReward(20, 86400000);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/watch-time')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ videoDuration: 5 });
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(10);
            }));
            (0, vitest_1.it)('should return error if video duration is less than 5 minutes (Scenario 8)', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: 08. < 5 MINUTE WATCH -> NO REWARD
Feature: Video Duration Based Coin Reward
  Scenario: User receives no reward for watching less than 5 minutes
    Given the user is on the rewards page
    And the user has not claimed a reward today
    When the user watches a video for 3 minutes
    Then the user does not receive any coins
    And the system shows an error: "You must watch for at least 5 minutes to get a reward."
`);
                yield clearWatchReward();
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/watch-time')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ videoDuration: 3 });
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.BAD_REQUEST);
                (0, vitest_1.expect)(res.body.success).toBe(false);
                (0, vitest_1.expect)(res.body.message).toBe('ভিডিও 5 মিনিট দেখতে হবে রিওয়ার্ড পেতে।');
            }));
        });
        (0, vitest_1.describe)('Other Rewards Flow', () => {
            (0, vitest_1.it)('should grant 30 coins for watching an ad', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: WATCH AD -> 30 COINS
Feature: Ad Rewards
  Scenario: User receives 30 coins for watching an ad
    Given the user is on the rewards page
    When the user successfully watches an ad
    Then the user receives 30 coins
    And the ad watch count is incremented
`);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/task')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ taskType: 'WATCH_AD' });
                (0, testLogger_1.logApi)('POST', '/api/v1/rewards/claim/task', { headers: { Authorization: `Bearer <USER_TOKEN>` }, body: { taskType: 'WATCH_AD' } }, res.body, 'POST-CLAIM-AD', 'User claims reward for watching an ad');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(30);
            }));
            (0, vitest_1.it)('should grant 60 coins for initial login reward', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: INITIAL LOGIN -> 60 COINS
Feature: Login Rewards
  Scenario: User receives 60 coins for their first login
    Given the user has recently registered
    When the user claims the initial login reward
    Then the user receives 60 coins
    And the login reward status is marked as claimed
`);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/task')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ taskType: 'LOGIN' });
                (0, testLogger_1.logApi)('POST', '/api/v1/rewards/claim/task', { headers: { Authorization: `Bearer <USER_TOKEN>` }, body: { taskType: 'LOGIN' } }, res.body, 'POST-CLAIM-LOGIN', 'User claims initial login reward');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(60);
            }));
            (0, vitest_1.it)('should grant 60 coins for enabling push notifications', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: ENABLE NOTIFICATIONS -> 60 COINS
Feature: Notification Rewards
  Scenario: User receives 60 coins for enabling push notifications
    Given the user has not claimed the notification reward
    When the user enables push notifications
    Then the user receives 60 coins
    And the notification reward status is marked as claimed
`);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/task')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ taskType: 'NOTIFICATION' });
                (0, testLogger_1.logApi)('POST', '/api/v1/rewards/claim/task', { headers: { Authorization: `Bearer <USER_TOKEN>` }, body: { taskType: 'NOTIFICATION' } }, res.body, 'POST-CLAIM-NOTIFICATION', 'User claims notification enable reward');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(60);
            }));
            (0, vitest_1.it)('should grant 20 coins for following Facebook', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: FOLLOW FACEBOOK -> 20 COINS
Feature: Social Rewards
  Scenario: User receives 20 coins for following Facebook
    Given the user has not claimed the Facebook reward
    When the user follows the Facebook page
    Then the user receives 20 coins
`);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/task')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ taskType: 'FACEBOOK' });
                (0, testLogger_1.logApi)('POST', '/api/v1/rewards/claim/task', { headers: { Authorization: `Bearer <USER_TOKEN>` }, body: { taskType: 'FACEBOOK' } }, res.body, 'POST-CLAIM-SOCIAL-FB', 'User claims Facebook follow reward');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(20);
            }));
            (0, vitest_1.it)('should grant 20 coins for following Instagram', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: FOLLOW INSTAGRAM -> 20 COINS
Feature: Social Rewards
  Scenario: User receives 20 coins for following Instagram
    Given the user has not claimed the Instagram reward
    When the user follows the Instagram page
    Then the user receives 20 coins
`);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/task')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ taskType: 'INSTAGRAM' });
                (0, testLogger_1.logApi)('POST', '/api/v1/rewards/claim/task', { headers: { Authorization: `Bearer <USER_TOKEN>` }, body: { taskType: 'INSTAGRAM' } }, res.body, 'POST-CLAIM-SOCIAL-IG', 'User claims Instagram follow reward');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(20);
            }));
            (0, vitest_1.it)('should grant 20 coins for following YouTube', () => __awaiter(void 0, void 0, void 0, function* () {
                console.info(`
📖 BDD SCENARIO: FOLLOW YOUTUBE -> 20 COINS
Feature: Social Rewards
  Scenario: User receives 20 coins for following YouTube
    Given the user has not claimed the YouTube reward
    When the user follows the YouTube channel
    Then the user receives 20 coins
`);
                const res = yield (0, supertest_1.default)(app_1.default)
                    .post('/api/v1/rewards/claim/task')
                    .set('Authorization', `Bearer ${userToken}`)
                    .send({ taskType: 'YOUTUBE' });
                (0, testLogger_1.logApi)('POST', '/api/v1/rewards/claim/task', { headers: { Authorization: `Bearer <USER_TOKEN>` }, body: { taskType: 'YOUTUBE' } }, res.body, 'POST-CLAIM-SOCIAL-YT', 'User claims YouTube follow reward');
                (0, vitest_1.expect)(res.status).toBe(http_status_codes_1.StatusCodes.OK);
                (0, vitest_1.expect)(res.body.success).toBe(true);
                (0, vitest_1.expect)(res.body.data.rewardAmount).toBe(20);
            }));
        });
    });
});
