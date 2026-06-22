import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';
import { AdminController } from './admin.controller';
import validateRequest from '../../middlewares/validateRequest';
import { UserValidation } from '../user/user.validation';
import { UserController } from '../user/user.controller';

const router = express.Router();

router.get(
  '/growth-metrics',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getDashboardStats,
);

router.get(
  '/visitors/analytics',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getVisitorAnalytics,
);

router.get(
  '/watchlist/status',
  auth(USER_ROLES.SUPER_ADMIN),
  AdminController.getWatchlistStatus,
);

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
