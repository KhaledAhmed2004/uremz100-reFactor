import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLES } from '../../../enums/user';
import { GenreController } from './genre.controller';

const router = express.Router();

router.get(
  '/',
  auth(USER_ROLES.SUPER_ADMIN),
  GenreController.getAll,
);

router.post(
  '/',
  auth(USER_ROLES.SUPER_ADMIN),
  GenreController.createGenre,
);

router.patch(
  '/:genreId',
  auth(USER_ROLES.SUPER_ADMIN),
  GenreController.updateById,
);

router.delete(
  '/',
  auth(USER_ROLES.SUPER_ADMIN),
  GenreController.bulkDelete,
);


export const GenreRoutes = router;
