"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoutes = void 0;
const user_1 = require("../../../enums/user");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_controller_1 = require("./user.controller");
const user_validation_1 = require("./user.validation");
const fileHandler_1 = require("../../middlewares/fileHandler");
const rateLimit_1 = require("../../middlewares/rateLimit");
const idempotency_1 = require("../../middlewares/idempotency");
const captcha_1 = require("../../middlewares/captcha");
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
// --- Public / General ---
// Create new user (Public Registration)
router.post('/', (0, idempotency_1.idempotency)('registration'), (0, fileHandler_1.fileHandler)([
    { name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' },
    { name: 'verificationImage', maxCount: 1, subfolder: 'users/verifications' },
    { name: 'verificationVideo', maxCount: 1, subfolder: 'users/videos' },
], { maxFileSizeMB: 100 }), (0, validateRequest_1.default)(user_validation_1.UserValidation.createUserZodSchema), (0, captcha_1.verifyCaptcha)(), user_controller_1.UserController.createUser);
// Re-verification of a REJECTED account. PUBLIC (no auth) because
// REJECTED users are blocked by both login and the auth middleware —
// the only recovery path is the one-time token they received by email
// when the admin rejected them. Accepts the new verification artefacts
// (image + video, optional profileImage) as multipart.
router.post('/reverify', (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 3600000, // 1 hour
    max: 5,
    routeName: 'reverify',
}), (0, idempotency_1.idempotency)('reverify'), (0, fileHandler_1.fileHandler)([
    { name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' },
    { name: 'verificationImage', maxCount: 1, subfolder: 'users/verifications' },
    { name: 'verificationVideo', maxCount: 1, subfolder: 'users/videos' },
], { maxFileSizeMB: 100 }), (0, validateRequest_1.default)(user_validation_1.UserValidation.reverifyAccountZodSchema), user_controller_1.UserController.reverifyAccount);
// Public user details (Authenticated users only) — rate limited
router.get('/:userId/public', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), (0, rateLimit_1.rateLimitMiddleware)({
    windowMs: 60000,
    max: 60,
    routeName: 'public-user-details',
}), (0, validateRequest_1.default)(user_validation_1.UserValidation.getUserDetailsZodSchema), user_controller_1.UserController.getUserDetailsById);
// Community Discovery (Lists active users of the same role)
router.get('/profiles', (0, auth_1.default)(user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), user_controller_1.UserController.getUserProfiles);
// --- Self Management (User/Doctor) ---
// Fetch own profile details
router.get('/me', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), user_controller_1.UserController.getUserProfile);
// Update own profile
router.patch('/me', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), (0, fileHandler_1.fileHandler)([{ name: 'profileImage', maxCount: 1, subfolder: 'users/profiles' }]), (0, validateRequest_1.default)(user_validation_1.UserValidation.updateUserZodSchema), user_controller_1.UserController.updateProfile);
// Request account self-deletion (soft-delete with 30-day recovery window).
// Restore happens through POST /auth/restore-account.
router.delete('/me', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), (0, idempotency_1.idempotency)('account-delete'), (0, validateRequest_1.default)(user_validation_1.UserValidation.deleteAccountZodSchema), user_controller_1.UserController.requestAccountDeletion);
// Email-change: 2-step OTP flow. Step 1 — request: validates current
// password, stores pending newEmail + 6-digit OTP, sends OTP to NEW
// address and a heads-up to the OLD address.
router.post('/me/email-change/request', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), (0, idempotency_1.idempotency)('email-change-request'), (0, validateRequest_1.default)(user_validation_1.UserValidation.requestEmailChangeZodSchema), user_controller_1.UserController.requestEmailChange);
// Email-change: Step 2 — confirm. Verifies the OTP, commits the new
// email, bumps tokenVersion (every JWT under the old email becomes
// invalid), and clears the refresh cookie.
router.post('/me/email-change/confirm', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), (0, idempotency_1.idempotency)('email-change-confirm'), (0, validateRequest_1.default)(user_validation_1.UserValidation.confirmEmailChangeZodSchema), user_controller_1.UserController.confirmEmailChange);
// GDPR data export — returns everything the system stores about the
// requesting user as a JSON envelope.
router.post('/me/data-export', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), (0, idempotency_1.idempotency)('data-export'), user_controller_1.UserController.exportMyData);
// Sessions — list every device this user has logged in from. Returns
// metadata only; never the raw FCM/APNs token.
router.get('/me/sessions', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), user_controller_1.UserController.listMySessions);
// Revoke EVERY session (logout-all-devices). Bumps tokenVersion so
// every issued JWT becomes invalid. Fixed path — must be declared
// before `:tokenId` so Express doesn't match `revoke-all` as an id.
router.post('/me/sessions/revoke-all', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), (0, idempotency_1.idempotency)('sessions-revoke-all'), user_controller_1.UserController.revokeAllMySessions);
// Revoke ONE specific session by its subdoc id. Only removes that
// device from push delivery; the JWT remains valid until natural
// expiry (short-lived).
router.delete('/me/sessions/:tokenId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN, user_1.USER_ROLES.BROTHER, user_1.USER_ROLES.SISTER, user_1.USER_ROLES.JUMMAH), (0, validateRequest_1.default)(user_validation_1.UserValidation.revokeSessionZodSchema), user_controller_1.UserController.revokeMySession);
// --- Admin Only ---
// List all users with stats (Admin)
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(user_validation_1.UserValidation.getAllUserRolesZodSchema), user_controller_1.UserController.getAllUserRoles);
// Get user metrics (Admin)
router.get('/metrics', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), user_controller_1.UserController.getUserMetrics);
// Review user (Approve/Reject)
router.patch('/:userId/review', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(user_validation_1.UserValidation.updateUserReviewZodSchema), user_controller_1.UserController.updateUserReview);
// Get specific user details by ID (Admin Only)
router.get('/:userId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), user_controller_1.UserController.getUserById);
// Admin: Update any user (Update fields including role, status)
router.patch('/:userId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), (0, validateRequest_1.default)(user_validation_1.UserValidation.adminUpdateUserZodSchema), user_controller_1.UserController.adminUpdateUser);
// Admin: Delete user permanently
router.delete('/:userId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), user_controller_1.UserController.deleteUser);
exports.UserRoutes = router;
