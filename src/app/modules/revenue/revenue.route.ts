import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import { RevenueController } from './revenue.controller';

const router = express.Router();

router.get(
  '/stats',
  auth(USER_ROLES.SUPER_ADMIN),
  RevenueController.getRevenueStats,
);

router.get(
  '/',
  auth(USER_ROLES.SUPER_ADMIN),
  RevenueController.getRevenueTransactions,
);

export const RevenueRoutes = router;
