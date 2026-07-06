"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationService = void 0;
const http_status_codes_1 = require("http-status-codes");
const ApiError_1 = __importDefault(require("../../../errors/ApiError"));
const medication_model_1 = require("./medication.model");
const createMedicationToDB = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    payload.userId = userId;
    const result = yield medication_model_1.Medication.create(payload);
    return result;
});
const getAllMedicationsFromDB = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield medication_model_1.Medication.find({ userId }).sort({ createdAt: -1 });
    return result;
});
const getSingleMedicationFromDB = (userId, medicationId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield medication_model_1.Medication.findOne({ _id: medicationId, userId });
    if (!result) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Medication not found');
    }
    return result;
});
const updateMedicationInDB = (userId, medicationId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield medication_model_1.Medication.findOne({ _id: medicationId, userId });
    if (!isExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Medication not found');
    }
    const result = yield medication_model_1.Medication.findOneAndUpdate({ _id: medicationId, userId }, payload, { new: true, runValidators: true });
    return result;
});
const deleteMedicationFromDB = (userId, medicationId) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield medication_model_1.Medication.findOne({ _id: medicationId, userId });
    if (!isExist) {
        throw new ApiError_1.default(http_status_codes_1.StatusCodes.NOT_FOUND, 'Medication not found');
    }
    const result = yield medication_model_1.Medication.findOneAndDelete({ _id: medicationId, userId });
    return result;
});
exports.MedicationService = {
    createMedicationToDB,
    getAllMedicationsFromDB,
    getSingleMedicationFromDB,
    updateMedicationInDB,
    deleteMedicationFromDB,
};
