"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Medication = void 0;
const mongoose_1 = require("mongoose");
const medication_interface_1 = require("./medication.interface");
const medicationDurationSchema = new mongoose_1.Schema({
    startDate: { type: Date, required: true },
    endDate: { type: Date },
}, { _id: false });
const medicationSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    dosages: { type: String, required: true, trim: true },
    type: { type: String, enum: medication_interface_1.MedicationTypeEnum, required: true },
    duration: { type: medicationDurationSchema, required: true },
    ongoingMedication: { type: Boolean, required: true, default: false },
    schedule: { type: String, enum: medication_interface_1.MedicationScheduleEnum, required: true },
    doseTimes: { type: [String], required: true, default: [] },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
exports.Medication = (0, mongoose_1.model)('Medication', medicationSchema);
