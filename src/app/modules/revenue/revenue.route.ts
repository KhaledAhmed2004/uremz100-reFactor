import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import { RevenueController } from './revenue.controller';

const router = express.Router();

router.get(
  '/',
  auth(USER_ROLES.SUPER_ADMIN),
  RevenueController.getRevenuesData,
);

export const RevenueRoutes = router;
