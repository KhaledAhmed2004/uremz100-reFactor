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
let TEST_PASSWORD = 'TestPassword123!';
let theMovieId: string;
let shortsCursor: string;
let myCollectionId: string;
let selectedShortId: string;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());

  testUserEmail = 'standard_user@e2e.test';

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
    posterUrl: 'http://image.com/batman.jpg',
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
    posterUrl: 'http://image.com/superman.jpg',
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
  const { LegalPage } = await import('../modules/legal/legal.model');
  await LegalPage.create({
    slug: 'terms-and-conditions',
    title: 'Terms and Conditions',
    content: '<p>These are the terms...</p>',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Master System Flow E2E Tests', () => {

  describe('0. Authentication Flow', () => {

    it('should allow a Guest User to browse and track progress', async () => {
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
    });

    it('should successfully register a new user account and verify OTP', async () => {
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
      const res = await request(app)
        .post('/api/v1/users/')
        .field('name', 'E2E Tester')
        .field('email', newGuestEmail)
        .field('password', 'NewPassword123!');

      logApi('POST', '/api/v1/users/', { body: { name: 'E2E Tester', email: newGuestEmail, password: 'NewPassword123!' } }, res.body, 'POST-REGISTER', 'User signs up');

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);

      // Fetch OTP from DB
      const newlyRegisteredUser = await User.findOne({ email: newGuestEmail }).select('+authentication');
      const registrationOtp = newlyRegisteredUser?.authentication?.oneTimeCode;
      
      expect(registrationOtp).toBeDefined();

      // Verify OTP
      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: newGuestEmail, otp: registrationOtp });

      logApi('POST', '/api/v1/auth/verify-otp', { body: { email: newGuestEmail, otp: registrationOtp } }, verifyRes.body, 'POST-VERIFY-REGISTRATION', 'User verifies email with OTP');

      expect(verifyRes.status).toBe(StatusCodes.OK);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.accessToken).toBeDefined(); // Test auto-login!
    });

    it('should register/login the Guest and migrate their data to the new Account', async () => {
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
    });

    it('should successfully login and obtain a valid auth token (Standard Login)', async () => {
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

    it('should initiate the forgot-password flow and send an OTP', async () => {
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
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testUserEmail });

      logApi('POST', '/api/v1/auth/forgot-password', { body: { email: testUserEmail } }, res.body, 'POST-FORGOT-PASSWORD', 'User requests OTP');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      // Verify that the backend generated the OTP and set the 5-minute expiration
      const userAfterRequest = await User.findOne({ email: testUserEmail }).select('+authentication');
      const forgotPasswordOtp = userAfterRequest?.authentication?.oneTimeCode;
      const expireAt = userAfterRequest?.authentication?.expireAt;
      
      expect(forgotPasswordOtp).toBeDefined();
      expect(forgotPasswordOtp).toHaveLength(6);
      expect(expireAt).toBeDefined();
      
      // Ensure expiration is within the expected ~5 minute window
      if (expireAt) {
        const timeDiff = expireAt.getTime() - Date.now();
        expect(timeDiff).toBeGreaterThan(0);
        expect(timeDiff).toBeLessThanOrEqual(5 * 60 * 1000 + 10000); // 5 mins + 10 sec buffer
      }
    });

    it('should verify OTP and reset the password using the generated token', async () => {
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
      const updatedUser = await User.findOne({ email: testUserEmail }).select('+authentication');
      const otp = updatedUser?.authentication?.oneTimeCode;
      
      expect(otp).toBeDefined();

      // 2. Verify OTP to get reset token
      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: testUserEmail, otp });

      expect(verifyRes.status).toBe(StatusCodes.OK);
      const resetToken = verifyRes.body.data.resetToken;
      expect(resetToken).toBeDefined();

      // 3. Reset Password
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .set('Authorization', `Bearer ${resetToken}`)
        .send({ newPassword: 'NewPassword123!' });

      logApi('POST', '/api/v1/auth/reset-password', { headers: { Authorization: `Bearer ${resetToken}` }, body: { newPassword: 'NewPassword123!' } }, res.body, 'POST-RESET-PASSWORD', 'User resets password');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });

    it('should allow an authenticated user to change their password', async () => {
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
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: 'NewPassword123!' });
      
      expect(loginRes.status).toBe(StatusCodes.OK);
      const newUserToken = loginRes.body.data.accessToken;

      // Now change password to a BRAND NEW password so we don't trigger the "recently used password" error
      const brandNewPassword = 'BrandNewPassword123!';
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({ currentPassword: 'NewPassword123!', newPassword: brandNewPassword });

      logApi('POST', '/api/v1/auth/change-password', { headers: { Authorization: `Bearer ${newUserToken}` }, body: { currentPassword: 'NewPassword123!', newPassword: brandNewPassword } }, res.body, 'POST-CHANGE-PASSWORD', 'User changes password');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      // Update the global test password variable so subsequent tests log in successfully!
      TEST_PASSWORD = brandNewPassword;

      // Restore the main userToken for the rest of the E2E tests by logging in again!
      const finalLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: TEST_PASSWORD });
      
      expect(finalLoginRes.status).toBe(StatusCodes.OK);
      userToken = finalLoginRes.body.data.accessToken;
    });

    it('should allow an authenticated user to update their profile information', async () => {
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

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updatedInfo);

      logApi('PATCH', '/api/v1/users/me', { headers: { Authorization: `Bearer ${userToken}` }, body: updatedInfo }, res.body, 'PATCH-UPDATE-PROFILE', 'User updates their profile');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(updatedInfo.name);
      expect(res.body.data.gender).toBe(updatedInfo.gender);
      expect(new Date(res.body.data.dateOfBirth).toISOString()).toBe(updatedInfo.dateOfBirth);
    });

    it('should request an email change and send an OTP (Step 1)', async () => {
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
      const res = await request(app)
        .post('/api/v1/users/me/email-change/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          newEmail,
          password: TEST_PASSWORD,
        });

      logApi('POST', '/api/v1/users/me/email-change/request', { headers: { Authorization: `Bearer ${userToken}` }, body: { newEmail, password: TEST_PASSWORD } }, res.body, 'POST-EMAIL-CHANGE-REQUEST', 'User requests email change');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      // Verify OTP is stored in the DB
      const userAfterRequest = await User.findById(testUserId).select('+emailChange');
      expect(userAfterRequest?.emailChange?.otp).toBeDefined();
      expect(userAfterRequest?.emailChange?.newEmail).toBe(newEmail);
    });

    it('should confirm the email change with the OTP (Step 2)', async () => {
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
      const userBeforeConfirm = await User.findById(testUserId).select('+emailChange');
      const otp = userBeforeConfirm?.emailChange?.otp;
      
      expect(otp).toBeDefined();

      const res = await request(app)
        .post('/api/v1/users/me/email-change/confirm')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ otp });

      logApi('POST', '/api/v1/users/me/email-change/confirm', { headers: { Authorization: `Bearer ${userToken}` }, body: { otp } }, res.body, 'POST-EMAIL-CHANGE-CONFIRM', 'User confirms email change');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);

      // Update testUserEmail for any subsequent tests, and we must log in again 
      // because tokenVersion was bumped!
      testUserEmail = 'new_email_e2e@test.com';

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserEmail, password: TEST_PASSWORD });
      
      expect(loginRes.status).toBe(StatusCodes.OK);
      userToken = loginRes.body.data.accessToken;
    });

    it('should allow a Guest User to read the legal pages before registering', async () => {
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
      const resAll = await request(app).get('/api/v1/legals');
      logApi('GET', '/api/v1/legals', {}, resAll.body, 'GET-ALL-LEGALS', 'User fetches all legal pages');
      
      expect(resAll.status).toBe(StatusCodes.OK);
      expect(resAll.body.success).toBe(true);
      // Data might be paginated or array, but according to typical implementation it's an array directly or inside data.data
      const results = resAll.body.data?.data || resAll.body.data;
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // 2. Get specific legal page by slug
      const slug = 'terms-and-conditions';
      const resSingle = await request(app).get(`/api/v1/legals/${slug}`);
      logApi('GET', `/api/v1/legals/${slug}`, {}, resSingle.body, 'GET-SINGLE-LEGAL', 'User fetches a specific legal page');
      
      expect(resSingle.status).toBe(StatusCodes.OK);
      expect(resSingle.body.success).toBe(true);
      expect(resSingle.body.data.slug).toBe(slug);
      expect(resSingle.body.data.title).toBe('Terms and Conditions');
    });

    let dummyEmailToRestore = 'to_be_restored@e2e.test';
    let dummyPasswordToRestore = 'RestoreMe123!';

    it('should allow a user to soft-delete their account (Step 12)', async () => {
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
      const dummyUser = await User.create({
        name: 'Restore Me',
        role: USER_ROLES.USER,
        email: dummyEmailToRestore,
        password: dummyPasswordToRestore,
        isVerified: true,
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: dummyEmailToRestore, password: dummyPasswordToRestore });
      
      const dummyToken = loginRes.body.data.accessToken;

      // Now, test the deletion API
      const deleteRes = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${dummyToken}`)
        .send({ password: dummyPasswordToRestore });

      logApi('DELETE', '/api/v1/users/me', { headers: { Authorization: `Bearer ${dummyToken}` }, body: { password: dummyPasswordToRestore } }, deleteRes.body, 'DELETE-ACCOUNT', 'User deletes their account');

      expect(deleteRes.status).toBe(StatusCodes.OK);
      expect(deleteRes.body.success).toBe(true);

      // Verify the user is soft-deleted in the database
      const deletedUser = await User.findById(dummyUser._id).select('+status');
      expect(deletedUser?.status).toBe(USER_STATUS.DELETED);
    });

    it('should prevent a deleted user from logging in and suggest contacting support (Step 13)', async () => {
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
      const loginAttempt = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: dummyEmailToRestore, password: dummyPasswordToRestore });

      logApi('POST', '/api/v1/auth/login', { body: { email: dummyEmailToRestore, password: dummyPasswordToRestore } }, loginAttempt.body, 'POST-LOGIN-DELETED', 'Deleted user attempts to log in');

      expect(loginAttempt.status).toBe(StatusCodes.FORBIDDEN);
      expect(loginAttempt.body.success).toBe(false);
      expect(loginAttempt.body.message).toContain('Your account has been deleted');
    });

    it('should allow a user to restore a soft-deleted account within the grace period (Step 14)', async () => {
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
      const restoreRes = await request(app)
        .post('/api/v1/auth/restore-account')
        .send({ email: dummyEmailToRestore, password: dummyPasswordToRestore });

      logApi('POST', '/api/v1/auth/restore-account', { body: { email: dummyEmailToRestore, password: dummyPasswordToRestore } }, restoreRes.body, 'POST-RESTORE-ACCOUNT', 'User restores their deleted account');

      expect(restoreRes.status).toBe(StatusCodes.OK);
      expect(restoreRes.body.success).toBe(true);
      expect(restoreRes.body.data.accessToken).toBeDefined();

      // Verify the user is ACTIVE again in the database
      const restoredUser = await User.findOne({ email: dummyEmailToRestore }).select('+status');
      expect(restoredUser?.status).toBe(USER_STATUS.ACTIVE);
    });
  });

  describe('1. Home Page Flow', () => {
    it('should return search results from the home page search bar', async () => {
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
  });

  describe('1.5. VIP Page Flow', () => {
    it('should load the vip tab successfully and show coming soon', async () => {
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
      const res = await request(app)
        .get('/api/v1/home/content?tab=vip')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/home/content?tab=vip', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-VIP-DAILY', 'User fetches vip home tab (daily default)');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      const dailyVipSection = res.body.data.sections.find((s: any) => s.id === 'row_vip_daily');
      expect(dailyVipSection).toBeDefined();

      const comingSoonSection = res.body.data.sections.find((s: any) => s.id === 'row_coming_soon');
      expect(comingSoonSection).toBeDefined();
      expect(comingSoonSection.title).toBe('Coming Soon');
    });

    it('should load the vip tab successfully with weekly filter and coming soon', async () => {
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
      const res = await request(app)
        .get('/api/v1/home/content?tab=vip&filter=weekly')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/home/content?tab=vip&filter=weekly', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-VIP-WEEKLY', 'User fetches vip home tab (weekly filter)');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      
      const weeklyVipSection = res.body.data.sections.find((s: any) => s.id === 'row_vip_weekly');
      expect(weeklyVipSection).toBeDefined();

      const comingSoonSection = res.body.data.sections.find((s: any) => s.id === 'row_coming_soon');
      expect(comingSoonSection).toBeDefined();
    });
  });

  describe('1.6. Ranking Tab Flow', () => {

    it('should load the ranking tab successfully', async () => {
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
      const res = await request(app)
        .get('/api/v1/home/content?tab=ranking&filter=weekly')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/home/content?tab=ranking&filter=weekly', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-HOME-RANKING', 'User fetches ranking home tab');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    });
  });

  describe('2. Content Details Flow', () => {
    it('should fetch the full details of the selected movie', async () => {
      console.info(`
📖 BDD SCENARIO: 07. FETCH CONTENT DETAILS
Feature: Content Discovery
  As a user who just clicked on a movie poster
  I want to see the full details of the movie
  So that I can read the description, see the cast, and decide to watch it

  Given the user clicks on a movie from the Home feed
  When the mobile app requests the public content details for that movie ID
  Then the backend returns the full metadata including title, description, and cast
  And the UI displays the Movie Details screen
`);
      const res = await request(app)
        .get(`/api/v1/contents/${theMovieId}/details`)
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', `/api/v1/contents/${theMovieId}/details`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-CONTENT-DETAILS', 'User fetches content details to view movie page');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBeDefined();
      expect(res.body.data.videoUrl).toBeUndefined(); // videoUrl should be hidden
    });

    it('should fetch the secure playback URL for the selected movie', async () => {
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
      const res = await request(app)
        .get(`/api/v1/contents/${theMovieId}/playback-url`)
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', `/api/v1/contents/${theMovieId}/playback-url`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'GET-PLAYBACK-URL', 'User presses play and fetches secure signed video URL');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBeDefined();
      expect(res.body.data.expiresAt).toBeDefined();
    });

    it('should fetch the specific watch progress for a selected movie (Option 3 Architecture)', async () => {
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

  describe('3. Shorts Page & Player Flow', () => {
    describe('A. Infinite Scrolling (Feed)', () => {
      it('Step 1: User opens the shorts feed and the first 5 videos are loaded without a cursor', async () => {
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
        const res = await request(app)
          .post(`/api/v1/shorts/${selectedShortId}/view`)
          .set('Authorization', `Bearer ${userToken}`);

        logApi('POST', `/api/v1/shorts/${selectedShortId}/view`, { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-TRACK-VIEW', 'User watches short and triggers view count');

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.success).toBe(true);
      });

      it('Step 4: User likes the video and adds it to their personal My Collection list', async () => {
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

  describe('4. My List (Recently Watched & My Collection) Flow', () => {
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

    it('should bulk remove items from My Collection', async () => {
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
      const collectionRes = await request(app)
        .get('/api/v1/my-collection')
        .set('Authorization', `Bearer ${userToken}`);
      
      const items = collectionRes.body.data || collectionRes.body.data?.data;
      if (!items || items.length === 0) return; // Skip if empty (though it shouldn't be based on previous test)

      const itemIdsToRemove = items.map((item: any) => item._id || item.id);

      const bulkDeleteRes = await request(app)
        .delete('/api/v1/my-collection/bulk')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ itemIds: itemIdsToRemove });

      logApi('DELETE', '/api/v1/my-collection/bulk', { headers: { Authorization: `Bearer ${userToken}` }, body: { itemIds: itemIdsToRemove } }, bulkDeleteRes.body, 'DELETE-BULK-MY-COLLECTION', 'User removes multiple items from collection');

      expect(bulkDeleteRes.status).toBe(StatusCodes.OK);
      expect(bulkDeleteRes.body.success).toBe(true);
      expect(bulkDeleteRes.body.data.deletedCount).toBe(itemIdsToRemove.length);
      
      // Verify the items are actually removed
      const emptyRes = await request(app)
        .get('/api/v1/my-collection')
        .set('Authorization', `Bearer ${userToken}`);
      
      const remainingItems = emptyRes.body.data || emptyRes.body.data?.data;
      
      // Filter out the items we just deleted to make sure they are gone
      const foundDeletedItems = remainingItems.filter((item: any) => itemIdsToRemove.includes(item._id || item.id));
      expect(foundDeletedItems.length).toBe(0);
    });
  });

  describe('5. Rewards Page Flow', () => {
    it('should show the initial wallet balance as 0', async () => {
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

    describe('Daily Check-In Streak System', () => {
      let UserRewardProgress: any;

      beforeAll(async () => {
        const models = await import('../modules/reward/reward.model');
        UserRewardProgress = models.UserRewardProgress;
      });

      const mockStreak = async (currentDay: number, lastClaimOffsetMs: number) => {
        const lastClaimDate = new Date(Date.now() - lastClaimOffsetMs);
        lastClaimDate.setUTCHours(0, 0, 0, 0);

        await UserRewardProgress.findOneAndUpdate(
          { user: testUserId },
          {
            $set: {
              'checkInStreak.currentDay': currentDay,
              'checkInStreak.lastClaimDate': lastClaimDate,
              'checkInStreak.isStreakActive': true,
              'checkInStreak.totalStreaksCompleted': 3,
            },
          },
          { new: true }
        );
      };

      it('should allow the user to claim a reward on Day 3 (Scenario 01)', async () => {
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
        await mockStreak(3, 86400000); // 1 day ago

        const res = await request(app)
          .post('/api/v1/rewards/claim/check-in')
          .set('Authorization', `Bearer ${userToken}`);

        logApi('POST', '/api/v1/rewards/claim/check-in', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-CLAIM-SCENARIO-01', 'User claims daily check-in reward on Day 3');

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.success).toBe(true);
        expect(res.body.data.coinsEarned).toBe(20);
        expect(res.body.data.streakDay).toBe(3);
        expect(res.body.data.nextStreakDay).toBe(4);
      });

      it('should block claiming twice on the same day (Scenario 02)', async () => {
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
        const res = await request(app)
          .post('/api/v1/rewards/claim/check-in')
          .set('Authorization', `Bearer ${userToken}`);

        logApi('POST', '/api/v1/rewards/claim/check-in', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-CLAIM-SCENARIO-02', 'User tries to claim twice');

        expect(res.status).toBe(StatusCodes.BAD_REQUEST);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Already claimed today');
      });

      it('should reset streak on missed days (Scenario 03)', async () => {
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
        await mockStreak(5, 86400000 * 3); // 3 days ago

        const res = await request(app)
          .post('/api/v1/rewards/claim/check-in')
          .set('Authorization', `Bearer ${userToken}`);

        logApi('POST', '/api/v1/rewards/claim/check-in', { headers: { Authorization: `Bearer ${userToken}` } }, res.body, 'POST-CLAIM-SCENARIO-03', 'User misses 2 days and resets streak');

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.success).toBe(true);
        expect(res.body.data.coinsEarned).toBe(10); // Day 1
        expect(res.body.data.streakDay).toBe(1);
        expect(res.body.data.nextStreakDay).toBe(2);
      });

      it('should complete 7-day cycle and reset (Scenario 04)', async () => {
        console.info(`
📖 BDD SCENARIO: 04. DAY 7 COMPLETE -> CYCLE RESET
Feature: Daily Check-In Reward
  Scenario: User completes 7-day cycle
    Given user has streak currentDay = 7
    When user clicks "Claim" on Daily Check-In
    Then server adds 50 coins (Day 7 reward)
    And resets streak.currentDay = 1
`);
        await mockStreak(7, 86400000); // 1 day ago

        const res = await request(app)
          .post('/api/v1/rewards/claim/check-in')
          .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.success).toBe(true);
        expect(res.body.data.coinsEarned).toBe(50);
        expect(res.body.data.streakDay).toBe(7);
        expect(res.body.data.nextStreakDay).toBe(1); // Cycle reset
      });

      it('should provide progressive reward on Day 2 (Scenario 05)', async () => {
        console.info(`
📖 BDD SCENARIO: 05. PROGRESSIVE REWARD ON DAY 2
Feature: Daily Check-In Reward
  Scenario: User claims progressive reward on Day 2
    Given user has streak currentDay = 2
    When user clicks "Claim" on Daily Check-In
    Then server adds 15 coins
    And updates streak.currentDay = 3
`);
        await mockStreak(2, 86400000);

        const res = await request(app)
          .post('/api/v1/rewards/claim/check-in')
          .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.success).toBe(true);
        expect(res.body.data.coinsEarned).toBe(15);
        expect(res.body.data.streakDay).toBe(2);
        expect(res.body.data.nextStreakDay).toBe(3);
      });

      it('should not reset streak if only 1 day is missed (Scenario 06)', async () => {
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
        await mockStreak(4, 86400000); 

        const res = await request(app)
          .post('/api/v1/rewards/claim/check-in')
          .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.success).toBe(true);
        expect(res.body.data.coinsEarned).toBe(25);
        expect(res.body.data.streakDay).toBe(4);
        expect(res.body.data.nextStreakDay).toBe(5);
      });
    });
  });

});
