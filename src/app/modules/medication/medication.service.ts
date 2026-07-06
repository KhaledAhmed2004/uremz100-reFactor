import { StatusCodes } from 'http-status-codes';
import ApiError from '../../../errors/ApiError';
import { IMedication } from './medication.interface';
import { Medication } from './medication.model';

const createMedicationToDB = async (
  userId: string,
  payload: IMedication,
): Promise<IMedication> => {
  payload.userId = userId as any;
  const result = await Medication.create(payload);
  return result;
};

const getAllMedicationsFromDB = async (
  userId: string,
): Promise<IMedication[]> => {
  const result = await Medication.find({ userId }).sort({ createdAt: -1 });
  return result;
};

const getSingleMedicationFromDB = async (
  userId: string,
  medicationId: string,
): Promise<IMedication | null> => {
  const result = await Medication.findOne({ _id: medicationId, userId });
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Medication not found');
  }
  return result;
};

const updateMedicationInDB = async (
  userId: string,
  medicationId: string,
  payload: Partial<IMedication>,
): Promise<IMedication | null> => {
  const isExist = await Medication.findOne({ _id: medicationId, userId });
  if (!isExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Medication not found');
  }

  const result = await Medication.findOneAndUpdate(
    { _id: medicationId, userId },
    payload,
    { new: true, runValidators: true },
  );
  return result;
};

const deleteMedicationFromDB = async (
  userId: string,
  medicationId: string,
): Promise<IMedication | null> => {
  const isExist = await Medication.findOne({ _id: medicationId, userId });
  if (!isExist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Medication not found');
  }

  const result = await Medication.findOneAndDelete({ _id: medicationId, userId });
  return result;
};

export const MedicationService = {
  createMedicationToDB,
  getAllMedicationsFromDB,
  getSingleMedicationFromDB,
  updateMedicationInDB,
  deleteMedicationFromDB,
};
