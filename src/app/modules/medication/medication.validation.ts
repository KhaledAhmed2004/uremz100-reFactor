import { z } from 'zod';
import {
  MedicationScheduleEnum,
  MedicationTypeEnum,
} from './medication.interface';

const createMedicationZodSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }),
    dosages: z.string({ required_error: 'Dosages is required' }),
    type: z.enum(MedicationTypeEnum, {
      required_error: 'Type is required',
    }),
    duration: z.object({
      startDate: z.string({ required_error: 'Start date is required' }),
      endDate: z.string().optional(),
    }),
    ongoingMedication: z.boolean().default(false),
    schedule: z.enum(MedicationScheduleEnum, {
      required_error: 'Schedule is required',
    }),
    doseTimes: z
      .array(z.string(), { required_error: 'Dose times are required' })
      .min(1, 'At least one dose time is required'),
  }),
});

const updateMedicationZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    dosages: z.string().optional(),
    type: z.enum(MedicationTypeEnum).optional(),
    duration: z
      .object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
      .optional(),
    ongoingMedication: z.boolean().optional(),
    schedule: z.enum(MedicationScheduleEnum).optional(),
    doseTimes: z.array(z.string()).optional(),
  }),
});

export const MedicationValidation = {
  createMedicationZodSchema,
  updateMedicationZodSchema,
};
