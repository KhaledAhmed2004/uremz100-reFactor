import express from 'express';
import guestOrAuth from '../../middlewares/guestOrAuth';
import { USER_ROLES } from '../../../enums/user';
import { MyCollectionController } from './my-collection.controller';

const router = express.Router();

// Adds a movie, series, season, or episode to user's personal collection.
router.post(
  '/',
  guestOrAuth,
  MyCollectionController.addToCollection,
);

// Retrieves the list of items in user's personal collection.
router.get(
  '/',
  guestOrAuth,
  MyCollectionController.getMyCollection,
);

// Removes an item from user's personal collection.
router.delete(
  '/:collectionId',
  guestOrAuth,
  MyCollectionController.removeFromCollection,
);

export const MyCollectionRoutes = router;
