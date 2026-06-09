"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenreRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_1 = require("../../../enums/user");
const genre_controller_1 = require("./genre.controller");
const router = express_1.default.Router();
router.get('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), genre_controller_1.GenreController.getAll);
router.post('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), genre_controller_1.GenreController.createGenre);
router.patch('/:genreId', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), genre_controller_1.GenreController.updateById);
router.delete('/', (0, auth_1.default)(user_1.USER_ROLES.SUPER_ADMIN), genre_controller_1.GenreController.bulkDelete);
exports.GenreRoutes = router;
