import { Model, Types } from 'mongoose';

export const MedicationTypeEnum = [
  'Pill',
  'Capsule',
  'Liquid',
  'Injection',
  'Tablet',
  'Inhaler',
] as const;

export const MedicationScheduleEnum = [
  'Daily',
  'Weekly',
  'Monthly',
  'Every 2 days',
  'As needed',
] as const;

export type IMedicationType = (typeof MedicationTypeEnum)[number];
export type IMedicationSchedule = (typeof MedicationScheduleEnum)[number];

export interface IMedicationDuration {
  startDate: Date;
  endDate?: Date;
}

export interface IMedication {
  name: string;
  dosages: string;
  type: IMedicationType;
  duration: IMedicationDuration;
  ongoingMedication: boolean;
  schedule: IMedicationSchedule;
  doseTimes: string[];
  userId: Types.ObjectId;
}

export type MedicationModel = Model<IMedication, Record<string, unknown>>;
