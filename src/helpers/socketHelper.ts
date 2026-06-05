import colors from 'colors';
import { Server } from 'socket.io';
import { errorLogger, logger } from '../shared/logger';
import { jwtHelper } from './jwtHelper';
import config from '../config';
import { redisClient } from '../shared/redisClient';

import { SupportTicket } from '../app/modules/support-ticket/support-ticket.model';
import {
  setOnline,
  setOffline,
  addUserRoom,
  removeUserRoom,
  updateLastActive,
  getUserRooms,
  getLastActive,
  incrConnCount,
  decrConnCount,
  clearUserRooms,
} from '../app/helpers/presenceHelper';

// -------------------------
// 🔹 Room Name Generators
// -------------------------
// USER_ROOM: unique private room for each user (for personal notifications)
const USER_ROOM = (userId: string) => `user::${userId}`;
const TICKET_ROOM = (ticketId: string) => `ticket::${ticketId}`;
const ADMIN_TICKETS_ROOM = 'admin-tickets';

// -------------------------
// 🔹 Rate Limiting Helper (Req 12)
// -------------------------
/**
 * Increments the rate-limit counter for an event+user pair.
 * Returns true if the limit has been exceeded (caller should reject).
 * Fails open on Redis errors — logs the error and allows the request through.
 */
const isRateLimited = async (
  event: string,
  userId: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> => {
  try {
    const key = `ratelimit:${event}:${userId}`;
    const count = await redisClient.incr(key);
    if (count === 1) {
      // First increment — set TTL for the window
      await redisClient.expire(key, windowSeconds);
    }
    return count > limit;
  } catch (err) {
    errorLogger.error(`isRateLimited: Redis error for event=${event} user=${userId}: ${String(err)}`);
    return false; // fail open
  }
};

// -------------------------
// 🔹 Main Socket Handler
// -------------------------
const socket = (io: Server) => {
  io.on('connection', async socket => {
    try {
      // -----------------------------
      // 🧩 STEP 1 — Authenticate Socket
      // -----------------------------
      const token =
        (socket.handshake.auth as any)?.token ||
        (socket.handshake.query as any)?.token;

      if (!token || typeof token !== 'string') {
        logger.warn(
          colors.yellow('Socket connection without token. Disconnecting.')
        );
        return socket.disconnect(true);
      }

      let payload: any;
      try {
        payload = jwtHelper.verifyToken(token, config.jwt.jwt_secret as any);
      } catch (err) {
        logger.warn(
          colors.red('Invalid JWT on socket connection. Disconnecting.')
        );
        return socket.disconnect(true);
      }

      const userId = payload?.id as string;
      if (!userId) {
        logger.warn(colors.red('JWT payload missing id. Disconnecting.'));
        return socket.disconnect(true);
      }

      // -----------------------------
      // 🧩 STEP 2 — Mark Online & Join Personal Room
      // -----------------------------
      await setOnline(userId);
      await incrConnCount(userId);
      await updateLastActive(userId);
      socket.join(USER_ROOM(userId)); // join user's personal private room
      logger.info(`✅ User ${userId} connected & joined ${USER_ROOM(userId)}`);
      logger.info(`🔔 Event processed: socket_connected for user_id: ${userId}`);

      // Admins auto-join the global support-ticket broadcast room so they
      // receive TICKET_CREATED/TICKET_REPLY events without needing to
      // subscribe per-ticket. Per-ticket rooms (ticket::{id}) are still
      // joined on demand via JOIN_TICKET for the detail view.
      const role = (payload as any)?.role as string | undefined;
      if (role === 'SUPER_ADMIN') {
        socket.join(ADMIN_TICKETS_ROOM);
      }


      // ---------------------------------------------
      // 🔹 Support Ticket Room Join / Leave Events
      // ---------------------------------------------
      socket.on('JOIN_TICKET', async ({ ticketId }: { ticketId: string }) => {
        if (!ticketId) return;
        try {
          const ticket = await SupportTicket.findById(ticketId).select(
            '_id userId'
          );
          if (!ticket) {
            socket.emit('ACK_ERROR', {
              message: 'Ticket not found',
              ticketId: String(ticketId),
            });
            updateLastActive(userId).catch(() => {});
            logger.info(`🔔 Event processed: JOIN_TICKET_DENIED not_found ticket_id: ${ticketId}`);
            return;
          }
          const isAdmin = role === 'SUPER_ADMIN';
          const isOwner = String(ticket.userId) === String(userId);
          if (!isAdmin && !isOwner) {
            socket.emit('ACK_ERROR', {
              message: 'You do not have access to this ticket',
              ticketId: String(ticketId),
            });
            updateLastActive(userId).catch(() => {});
            logger.info(`🔔 Event processed: JOIN_TICKET_DENIED forbidden ticket_id: ${ticketId}`);
            return;
          }
          socket.join(TICKET_ROOM(String(ticketId)));
          updateLastActive(userId).catch(() => {});
          logger.info(`🔔 Event processed: JOIN_TICKET for ticket_id: ${ticketId}`);
        } catch (err) {
          logger.error(colors.red(`JOIN_TICKET error: ${String(err)}`));
        }
      });

      socket.on('LEAVE_TICKET', async ({ ticketId }: { ticketId: string }) => {
        if (!ticketId) return;
        socket.leave(TICKET_ROOM(String(ticketId)));
        updateLastActive(userId).catch(() => {});
        logger.info(`🔔 Event processed: LEAVE_TICKET for ticket_id: ${ticketId}`);
      });


      // ---------------------------------------------
      // 🔹 Handle Disconnect Event
      // ---------------------------------------------
      socket.on('disconnect', async () => {
        try {
          await updateLastActive(userId);
          const remaining = await decrConnCount(userId);
          const lastActive = await getLastActive(userId);

          // Only mark offline and broadcast if no other sessions remain
          if (!remaining || remaining <= 0) {
            await setOffline(userId);
            try {
              await clearUserRooms(userId);
            } catch {}
          } else {
            logger.info(colors.yellow(`User ${userId} disconnected one session; ${remaining} session(s) remain.`));
          }

          logger.info(colors.red(`User ${userId} disconnected`));
          logger.info(`🔔 Event processed: socket_disconnected for user_id: ${userId}`);
        } catch (err) {
          logger.error(
            colors.red(`❌ Disconnect handling error: ${String(err)}`)
          );
        }
      });
    } catch (err) {
      logger.error(colors.red(`Socket connection error: ${String(err)}`));
      try {
        socket.disconnect(true);
      } catch {}
    }
  });
};

export const socketHelper = { socket };
