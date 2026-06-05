import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { UserController } from './user.controller';
import { UserValidation } from './user.validation';
import { fileHandler } from '../../middlewares/fileHandler';
import { rateLimitMiddleware } from '../../middlewares/rateLimit';
import { idempotency } from '../../middlewares/idempotency';
import { verifyCaptcha } from '../../middlewares/captcha';
import express from 'express';

const router = express.Router();

// --- Public / General ---

// Create new user (Public Registration)
router.post(
  '/',
  idempotency('registration'),
  fileHandler([
    { name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' },
    { name: 'verificationImage', maxCount: 1, subfolder: 'users/verifications' },
    { name: 'verificationVideo', maxCount: 1, subfolder: 'users/videos' },
  ], { maxFileSizeMB: 100 }),
  validateRequest(UserValidation.createUserZodSchema),
  verifyCaptcha(),
  UserController.createUser,
);

// Re-verification of a REJECTED account. PUBLIC (no auth) because
// REJECTED users are blocked by both login and the auth middleware —
// the only recovery path is the one-time token they received by email
// when the admin rejected them. Accepts the new verification artefacts
// (image + video, optional profileImage) as multipart.
router.post(
  '/reverify',
  rateLimitMiddleware({
    windowMs: 3600_000, // 1 hour
    max: 5,
    routeName: 'reverify',
  }),
  idempotency('reverify'),
  fileHandler(
    [
      { name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' },
      { name: 'verificationImage', maxCount: 1, subfolder: 'users/verifications' },
      { name: 'verificationVideo', maxCount: 1, subfolder: 'users/videos' },
    ],
    { maxFileSizeMB: 100 },
  ),
  validateRequest(UserValidation.reverifyAccountZodSchema),
  UserController.reverifyAccount,
);

// Public user details (Authenticated users only) — rate limited
router.get(
  '/:userId/public',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  rateLimitMiddleware({
    windowMs: 60_000,
    max: 60,
    routeName: 'public-user-details',
  }),
  validateRequest(UserValidation.getUserDetailsZodSchema),
  UserController.getUserDetailsById,
);

// Community Discovery (Lists active users of the same role)
router.get(
  '/profiles',
  auth(USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  UserController.getUserProfiles,
);

// --- Self Management (User/Doctor) ---

// Fetch own profile details
router.get(
  '/me',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  UserController.getUserProfile,
);

// Update own profile
router.patch(
  '/me',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  fileHandler([{ name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' }]),
  validateRequest(UserValidation.updateUserZodSchema),
  UserController.updateProfile,
);

// Request account self-deletion (soft-delete with 30-day recovery window).
// Restore happens through POST /auth/restore-account.
router.delete(
  '/me',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  idempotency('account-delete'),
  validateRequest(UserValidation.deleteAccountZodSchema),
  UserController.requestAccountDeletion,
);

// Email-change: 2-step OTP flow. Step 1 — request: validates current
// password, stores pending newEmail + 6-digit OTP, sends OTP to NEW
// address and a heads-up to the OLD address.
router.post(
  '/me/email-change/request',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  idempotency('email-change-request'),
  validateRequest(UserValidation.requestEmailChangeZodSchema),
  UserController.requestEmailChange,
);

// Email-change: Step 2 — confirm. Verifies the OTP, commits the new
// email, bumps tokenVersion (every JWT under the old email becomes
// invalid), and clears the refresh cookie.
router.post(
  '/me/email-change/confirm',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  idempotency('email-change-confirm'),
  validateRequest(UserValidation.confirmEmailChangeZodSchema),
  UserController.confirmEmailChange,
);

// GDPR data export — returns everything the system stores about the
// requesting user as a JSON envelope.
router.post(
  '/me/data-export',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  idempotency('data-export'),
  UserController.exportMyData,
);

// Sessions — list every device this user has logged in from. Returns
// metadata only; never the raw FCM/APNs token.
router.get(
  '/me/sessions',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  UserController.listMySessions,
);

// Revoke EVERY session (logout-all-devices). Bumps tokenVersion so
// every issued JWT becomes invalid. Fixed path — must be declared
// before `:tokenId` so Express doesn't match `revoke-all` as an id.
router.post(
  '/me/sessions/revoke-all',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  idempotency('sessions-revoke-all'),
  UserController.revokeAllMySessions,
);

// Revoke ONE specific session by its subdoc id. Only removes that
// device from push delivery; the JWT remains valid until natural
// expiry (short-lived).
router.delete(
  '/me/sessions/:tokenId',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  validateRequest(UserValidation.revokeSessionZodSchema),
  UserController.revokeMySession,
);

// --- Admin Only ---

// List all users with stats (Admin)
router.get(
  '/',
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(UserValidation.getAllUserRolesZodSchema),
  UserController.getAllUserRoles,
);

// Get user metrics (Admin)
router.get(
  '/metrics',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.getUserMetrics,
);

// Review user (Approve/Reject)
router.patch(
  '/:userId/review',
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(UserValidation.updateUserReviewZodSchema),
  UserController.updateUserReview,
);

// Get specific user details by ID (Admin Only)
router.get(
  '/:userId',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.getUserById,
);

// Admin: Update any user (Update fields including role, status)
router.patch(
  '/:userId',
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(UserValidation.adminUpdateUserZodSchema),
  UserController.adminUpdateUser,
);

// Admin: Delete user permanently
router.delete(
  '/:userId',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.deleteUser,
);

export const UserRoutes = router;
