import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';
import { MyCollectionController } from './my-collection.controller';

const router = express.Router();

// Adds a movie, series, season, or episode to user's personal collection.
router.post(
  '/',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  MyCollectionController.addToCollection,
);

// Retrieves the list of items in user's personal collection.
router.get(
  '/',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  MyCollectionController.getMyCollection,
);

// Removes an item from user's personal collection.
router.delete(
  '/:collectionId',
  auth(USER_ROLES.SUPER_ADMIN, USER_ROLES.BROTHER, USER_ROLES.SISTER, USER_ROLES.JUMMAH),
  MyCollectionController.removeFromCollection,
);

export const MyCollectionRoutes = router;
