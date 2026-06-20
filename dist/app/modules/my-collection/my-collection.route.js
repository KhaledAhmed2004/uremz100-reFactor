"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyCollectionRoutes = void 0;
const express_1 = __importDefault(require("express"));
const guestOrAuth_1 = __importDefault(require("../../middlewares/guestOrAuth"));
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const my_collection_controller_1 = require("./my-collection.controller");
const my_collection_validation_1 = require("./my-collection.validation");
const router = express_1.default.Router();
// Adds a movie, series, season, or episode to user's personal collection.
router.post('/', guestOrAuth_1.default, my_collection_controller_1.MyCollectionController.addToCollection);
// Retrieves the list of items in user's personal collection.
router.get('/', guestOrAuth_1.default, my_collection_controller_1.MyCollectionController.getMyCollection);
// Removes multiple items from user's personal collection.
router.delete('/bulk', guestOrAuth_1.default, (0, validateRequest_1.default)(my_collection_validation_1.MyCollectionValidation.removeBulkZodSchema), my_collection_controller_1.MyCollectionController.removeFromCollectionBulk);
// Removes an item from user's personal collection.
router.delete('/:collectionId', guestOrAuth_1.default, my_collection_controller_1.MyCollectionController.removeFromCollection);
exports.MyCollectionRoutes = router;
