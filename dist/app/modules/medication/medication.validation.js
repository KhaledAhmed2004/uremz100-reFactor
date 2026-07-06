"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationValidation = void 0;
const zod_1 = require("zod");
const medication_interface_1 = require("./medication.interface");
const createMedicationZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string({ required_error: 'Name is required' }),
        dosages: zod_1.z.string({ required_error: 'Dosages is required' }),
        type: zod_1.z.enum(medication_interface_1.MedicationTypeEnum, {
            required_error: 'Type is required',
        }),
        duration: zod_1.z.object({
            startDate: zod_1.z.string({ required_error: 'Start date is required' }),
            endDate: zod_1.z.string().optional(),
        }),
        ongoingMedication: zod_1.z.boolean().default(false),
        schedule: zod_1.z.enum(medication_interface_1.MedicationScheduleEnum, {
            required_error: 'Schedule is required',
        }),
        doseTimes: zod_1.z
            .array(zod_1.z.string(), { required_error: 'Dose times are required' })
            .min(1, 'At least one dose time is required'),
    }),
});
const updateMedicationZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().optional(),
        dosages: zod_1.z.string().optional(),
        type: zod_1.z.enum(medication_interface_1.MedicationTypeEnum).optional(),
        duration: zod_1.z
            .object({
            startDate: zod_1.z.string().optional(),
            endDate: zod_1.z.string().optional(),
        })
            .optional(),
        ongoingMedication: zod_1.z.boolean().optional(),
        schedule: zod_1.z.enum(medication_interface_1.MedicationScheduleEnum).optional(),
        doseTimes: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
exports.MedicationValidation = {
    createMedicationZodSchema,
    updateMedicationZodSchema,
};
