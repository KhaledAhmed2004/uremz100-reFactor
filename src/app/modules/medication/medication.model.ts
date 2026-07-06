import { Schema, model } from 'mongoose';
import {
  IMedication,
  MedicationModel,
  MedicationScheduleEnum,
  MedicationTypeEnum,
} from './medication.interface';

const medicationDurationSchema = new Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date },
  },
  { _id: false },
);

const medicationSchema = new Schema<IMedication>(
  {
    name: { type: String, required: true, trim: true },
    dosages: { type: String, required: true, trim: true },
    type: { type: String, enum: MedicationTypeEnum, required: true },
    duration: { type: medicationDurationSchema, required: true },
    ongoingMedication: { type: Boolean, required: true, default: false },
    schedule: { type: String, enum: MedicationScheduleEnum, required: true },
    doseTimes: { type: [String], required: true, default: [] },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

export const Medication = model<IMedication, MedicationModel>(
  'Medication',
  medicationSchema,
);
