import express from 'express';
import { ShortsController } from './shorts.controller';

const router = express.Router();

router.get('/', ShortsController.getShortsFeed);
router.post('/:id/view', ShortsController.incrementShortView);

export const ShortsRoutes = router;
