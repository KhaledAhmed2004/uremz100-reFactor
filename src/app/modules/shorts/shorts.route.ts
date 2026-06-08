import express from 'express';
import { ShortsController } from './shorts.controller';

const router = express.Router();

router.get('/', ShortsController.getShortsFeed);

export const ShortsRoutes = router;
