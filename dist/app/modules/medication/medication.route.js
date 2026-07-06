"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const user_1 = require("../../../enums/user");
const medication_controller_1 = require("./medication.controller");
const medication_validation_1 = require("./medication.validation");
const router = express_1.default.Router();
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(medication_validation_1.MedicationValidation.createMedicationZodSchema), medication_controller_1.MedicationController.createMedication);
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), medication_controller_1.MedicationController.getAllMedications);
router.get('/:id', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), medication_controller_1.MedicationController.getSingleMedication);
router.patch('/:id', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), (0, validateRequest_1.default)(medication_validation_1.MedicationValidation.updateMedicationZodSchema), medication_controller_1.MedicationController.updateMedication);
router.delete('/:id', (0, auth_1.default)(user_1.USER_ROLES.USER, user_1.USER_ROLES.ADMIN), medication_controller_1.MedicationController.deleteMedication);
exports.MedicationRoutes = router;
