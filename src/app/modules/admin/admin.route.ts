import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';
import { AdminController } from './admin.controller';
import validateRequest from '../../middlewares/validateRequest';
import { UserValidation } from '../user/user.validation';
import { UserController } from '../user/user.controller';
import fileUploadHandler from '../../middlewares/fileUploadHandler';

const router = express.Router();
const upload = fileUploadHandler();

// Dashboard Overview
router.get(
  '/growth-metrics',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getDashboardStats,
);

// Visitors analytics chart
router.get(
  '/visitors/analytics',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getVisitorAnalytics,
);

// Watchlist status breakdown
router.get(
  '/watchlist/status',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getWatchlistStatus,
);

// User Management (Admin Dashboard)
router.get(
  '/users/stats',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.getUserMetrics,
);

router.get(
  '/users/export',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.exportUsers,
);

router.get(
  '/users',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.getAllUserRoles,
);

router.patch(
  '/users/:userId',
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(UserValidation.adminUpdateUserZodSchema),
  UserController.adminUpdateUser,
);

router.delete(
  '/users/bulk-delete',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.bulkDeleteUsers,
);

router.delete(
  '/users/:userId',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.deleteUser,
);

router.get(
  '/users/:userId',
  auth(USER_ROLES.SUPER_ADMIN),
  UserController.getUserById,
);

// Revenue Management
router.get(
  '/revenue/stats',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getRevenueStats,
);

router.get(
  '/transactions',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getTransactions,
);

router.patch(
  '/users/:userId/status',
  auth(USER_ROLES.SUPER_ADMIN),
  validateRequest(UserValidation.updateUserStatusZodSchema),
  UserController.updateUserStatus,
);

// Subscriptions Management
router.get(
  '/subscriptions/stats',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getSubscriptionsStats,
);

router.get(
  '/movies/:movieId/revenue',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getMovieAnalyticsRevenue,
);

router.patch(
  '/content/:id/boost',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.patchContentBoost,
);

router.get(
  '/subscriptions',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getAdminSubscriptions,
);

export const AdminRoutes = router;
