import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLES } from '../../../enums/user';
import { MedicationController } from './medication.controller';
import { MedicationValidation } from './medication.validation';

const router = express.Router();

router.post(
  '/',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  validateRequest(MedicationValidation.createMedicationZodSchema),
  MedicationController.createMedication,
);

router.get(
  '/',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  MedicationController.getAllMedications,
);

router.get(
  '/:id',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  MedicationController.getSingleMedication,
);

router.patch(
  '/:id',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  validateRequest(MedicationValidation.updateMedicationZodSchema),
  MedicationController.updateMedication,
);

router.delete(
  '/:id',
  auth(USER_ROLES.USER, USER_ROLES.ADMIN),
  MedicationController.deleteMedication,
);

export const MedicationRoutes = router;
