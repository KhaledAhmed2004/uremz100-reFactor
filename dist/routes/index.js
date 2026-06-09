"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const content_route_1 = require("../app/modules/content/content.route");
const express_1 = __importDefault(require("express"));
const auth_route_1 = require("../app/modules/auth/auth.route");
const user_route_1 = require("../app/modules/user/user.route");
const notification_routes_1 = require("../app/modules/notification/notification.routes");
const subscription_route_1 = require("../app/modules/subscription/subscription.route");
const admin_route_1 = require("../app/modules/admin/admin.route");
const legal_route_1 = require("../app/modules/legal/legal.route");
const pending_email_route_1 = require("../app/modules/pending-email/pending-email.route");
const support_ticket_route_1 = require("../app/modules/support-ticket/support-ticket.route");
const genre_route_1 = require("../app/modules/genre/genre.route");
const recently_watched_route_1 = require("../app/modules/recently-watched/recently-watched.route");
const home_route_1 = require("../app/modules/home/home.route");
const my_collection_route_1 = require("../app/modules/my-collection/my-collection.route");
const shorts_route_1 = require("../app/modules/shorts/shorts.route");
const reward_route_1 = require("../app/modules/reward/reward.route");
const router = express_1.default.Router();
const apiRoutes = [
    {
        path: '/users',
        route: user_route_1.UserRoutes,
    },
    {
        path: '/auth',
        route: auth_route_1.AuthRoutes,
    },
    {
        path: '/notifications',
        route: notification_routes_1.NotificationRoutes,
    },
    {
        path: '/subscriptions',
        route: subscription_route_1.SubscriptionRoutes,
    },
    {
        path: '/admin',
        route: admin_route_1.AdminRoutes,
    },
    {
        path: '/legal',
        route: legal_route_1.LegalRoutes,
    },
    {
        path: '/admin/pending-emails',
        route: pending_email_route_1.PendingEmailRoutes,
    },
    {
        path: '/support-tickets',
        route: support_ticket_route_1.SupportTicketRoutes,
    },
    {
        path: '/genres',
        route: genre_route_1.GenreRoutes,
    },
    {
        path: '/contents',
        route: content_route_1.ContentRoutes,
    },
    {
        path: '/recently-watched',
        route: recently_watched_route_1.RecentlyWatchedRoutes,
    },
    {
        path: '/home',
        route: home_route_1.HomeRoutes,
    },
    {
        path: '/my-collection',
        route: my_collection_route_1.MyCollectionRoutes,
    },
    {
        path: '/shorts',
        route: shorts_route_1.ShortsRoutes,
    },
    {
        path: '/rewards',
        route: reward_route_1.RewardRoutes,
    },
];
apiRoutes.forEach(route => router.use(route.path, route.route));
exports.default = router;
