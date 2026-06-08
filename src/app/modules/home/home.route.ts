import express from 'express';
import guestOrAuth from '../../middlewares/guestOrAuth';
import { HomeController } from './home.controller';

const router = express.Router();

router.get(
  '/content',
  guestOrAuth,
  HomeController.getHomeContent,
);

export const HomeRoutes = router;
