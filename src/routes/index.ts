import { ContentRoutes } from '../app/modules/content/content.route';
import express from 'express';
import { AuthRoutes } from '../app/modules/auth/auth.route';
import { UserRoutes } from '../app/modules/user/user.route';
import { NotificationRoutes } from '../app/modules/notification/notification.routes';
import { SubscriptionRoutes } from '../app/modules/subscription/subscription.route';
import { AdminRoutes } from '../app/modules/admin/admin.route';
import { LegalRoutes } from '../app/modules/legal/legal.route';
import { PendingEmailRoutes } from '../app/modules/pending-email/pending-email.route';
import { SupportTicketRoutes } from '../app/modules/support-ticket/support-ticket.route';
import { GenreRoutes } from '../app/modules/genre/genre.route';
import { RecentlyWatchedRoutes } from '../app/modules/recently-watched/recently-watched.route';
import { HomeRoutes } from '../app/modules/home/home.route';
import { MyCollectionRoutes } from '../app/modules/my-collection/my-collection.route';
import { ShortsRoutes } from '../app/modules/shorts/shorts.route';
import { RewardRoutes } from '../app/modules/reward/reward.route';
import { RevenueRoutes } from '../app/modules/revenue/revenue.route';

const router = express.Router();

const apiRoutes = [
  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/notifications',
    route: NotificationRoutes,
  },
  {
    path: '/subscriptions',
    route: SubscriptionRoutes,
  },
  {
    path: '/admin',
    route: AdminRoutes,
  },
  {
    path: '/legals',
    route: LegalRoutes,
  },
  {
    path: '/admin/pending-emails',
    route: PendingEmailRoutes,
  },
  {
    path: '/admin/revenues',
    route: RevenueRoutes,
  },
  {
    path: '/support-tickets',
    route: SupportTicketRoutes,
  },
  {
    path: '/genres',
    route: GenreRoutes,
  },

  {
    path: '/contents',
    route: ContentRoutes,
  },
  {
    path: '/recently-watched',
    route: RecentlyWatchedRoutes,
  },
  {
    path: '/home',
    route: HomeRoutes,
  },
  {
    path: '/my-collection',
    route: MyCollectionRoutes,
  },
  {
    path: '/shorts',
    route: ShortsRoutes,
  },
  {
    path: '/rewards',
    route: RewardRoutes,
  },
];

apiRoutes.forEach(route => router.use(route.path, route.route));

export default router;
