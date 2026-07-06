import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import catchAsync from '../../../shared/catchAsync';
import sendResponse from '../../../shared/sendResponse';
import { MedicationService } from './medication.service';

const createMedication = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await MedicationService.createMedicationToDB(
    user.id,
    req.body,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'Medication created successfully',
    data: result,
  });
});

const getAllMedications = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const result = await MedicationService.getAllMedicationsFromDB(user.id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Medications retrieved successfully',
    data: result,
  });
});

const getSingleMedication = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { id } = req.params;
  const result = await MedicationService.getSingleMedicationFromDB(user.id, id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Medication retrieved successfully',
    data: result,
  });
});

const updateMedication = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { id } = req.params;
  const result = await MedicationService.updateMedicationInDB(
    user.id,
    id,
    req.body,
  );

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Medication updated successfully',
    data: result,
  });
});

const deleteMedication = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as JwtPayload;
  const { id } = req.params;
  await MedicationService.deleteMedicationFromDB(user.id, id);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Medication deleted successfully',
    data: null,
  });
});

export const MedicationController = {
  createMedication,
  getAllMedications,
  getSingleMedication,
  updateMedication,
  deleteMedication,
};
