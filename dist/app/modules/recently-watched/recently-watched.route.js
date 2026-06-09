"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecentlyWatchedRoutes = void 0;
const express_1 = __importDefault(require("express"));
const guestOrAuth_1 = __importDefault(require("../../middlewares/guestOrAuth"));
const recently_watched_controller_1 = require("./recently-watched.controller");
const router = express_1.default.Router();
// Tracks user's video watching progress (seconds & percentage) for "Continue Watching" feature.
router.post('/track-progress', guestOrAuth_1.default, recently_watched_controller_1.RecentlyWatchedController.trackProgress);
// Retrieves the list of contents recently watched by the authenticated user.
router.get('/', guestOrAuth_1.default, recently_watched_controller_1.RecentlyWatchedController.getRecentlyWatched);
// Retrieves the progress of a specific content by its ID
router.get('/content/:contentId', guestOrAuth_1.default, recently_watched_controller_1.RecentlyWatchedController.getProgressByContentId);
exports.RecentlyWatchedRoutes = router;
