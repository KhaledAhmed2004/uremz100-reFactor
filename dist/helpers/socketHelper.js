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
exports.socketHelper = void 0;
const colors_1 = __importDefault(require("colors"));
const logger_1 = require("../shared/logger");
const jwtHelper_1 = require("./jwtHelper");
const config_1 = __importDefault(require("../config"));
const redisClient_1 = require("../shared/redisClient");
const support_ticket_model_1 = require("../app/modules/support-ticket/support-ticket.model");
const presenceHelper_1 = require("../app/helpers/presenceHelper");
// -------------------------
// 🔹 Room Name Generators
// -------------------------
// USER_ROOM: unique private room for each user (for personal notifications)
const USER_ROOM = (userId) => `user::${userId}`;
const TICKET_ROOM = (ticketId) => `ticket::${ticketId}`;
const ADMIN_TICKETS_ROOM = 'admin-tickets';
// -------------------------
// 🔹 Rate Limiting Helper (Req 12)
// -------------------------
/**
 * Increments the rate-limit counter for an event+user pair.
 * Returns true if the limit has been exceeded (caller should reject).
 * Fails open on Redis errors — logs the error and allows the request through.
 */
const isRateLimited = (event, userId, limit, windowSeconds) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const key = `ratelimit:${event}:${userId}`;
        const count = yield redisClient_1.redisClient.incr(key);
        if (count === 1) {
            // First increment — set TTL for the window
            yield redisClient_1.redisClient.expire(key, windowSeconds);
        }
        return count > limit;
    }
    catch (err) {
        logger_1.errorLogger.error(`isRateLimited: Redis error for event=${event} user=${userId}: ${String(err)}`);
        return false; // fail open
    }
});
// -------------------------
// 🔹 Main Socket Handler
// -------------------------
const socket = (io) => {
    io.on('connection', (socket) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        try {
            // -----------------------------
            // 🧩 STEP 1 — Authenticate Socket
            // -----------------------------
            const token = ((_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token) ||
                ((_b = socket.handshake.query) === null || _b === void 0 ? void 0 : _b.token);
            if (!token || typeof token !== 'string') {
                logger_1.logger.warn(colors_1.default.yellow('Socket connection without token. Disconnecting.'));
                return socket.disconnect(true);
            }
            let payload;
            try {
                payload = jwtHelper_1.jwtHelper.verifyToken(token, config_1.default.jwt.jwt_secret);
            }
            catch (err) {
                logger_1.logger.warn(colors_1.default.red('Invalid JWT on socket connection. Disconnecting.'));
                return socket.disconnect(true);
            }
            const userId = payload === null || payload === void 0 ? void 0 : payload.id;
            if (!userId) {
                logger_1.logger.warn(colors_1.default.red('JWT payload missing id. Disconnecting.'));
                return socket.disconnect(true);
            }
            // -----------------------------
            // 🧩 STEP 2 — Mark Online & Join Personal Room
            // -----------------------------
            yield (0, presenceHelper_1.setOnline)(userId);
            yield (0, presenceHelper_1.incrConnCount)(userId);
            yield (0, presenceHelper_1.updateLastActive)(userId);
            socket.join(USER_ROOM(userId)); // join user's personal private room
            logger_1.logger.info(`✅ User ${userId} connected & joined ${USER_ROOM(userId)}`);
            logger_1.logger.info(`🔔 Event processed: socket_connected for user_id: ${userId}`);
            // Admins auto-join the global support-ticket broadcast room so they
            // receive TICKET_CREATED/TICKET_REPLY events without needing to
            // subscribe per-ticket. Per-ticket rooms (ticket::{id}) are still
            // joined on demand via JOIN_TICKET for the detail view.
            const role = payload === null || payload === void 0 ? void 0 : payload.role;
            if (role === 'SUPER_ADMIN') {
                socket.join(ADMIN_TICKETS_ROOM);
            }
            // ---------------------------------------------
            // 🔹 Support Ticket Room Join / Leave Events
            // ---------------------------------------------
            socket.on('JOIN_TICKET', (_a) => __awaiter(void 0, [_a], void 0, function* ({ ticketId }) {
                if (!ticketId)
                    return;
                try {
                    const ticket = yield support_ticket_model_1.SupportTicket.findById(ticketId).select('_id userId');
                    if (!ticket) {
                        socket.emit('ACK_ERROR', {
                            message: 'Ticket not found',
                            ticketId: String(ticketId),
                        });
                        (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                        logger_1.logger.info(`🔔 Event processed: JOIN_TICKET_DENIED not_found ticket_id: ${ticketId}`);
                        return;
                    }
                    const isAdmin = role === 'SUPER_ADMIN';
                    const isOwner = String(ticket.userId) === String(userId);
                    if (!isAdmin && !isOwner) {
                        socket.emit('ACK_ERROR', {
                            message: 'You do not have access to this ticket',
                            ticketId: String(ticketId),
                        });
                        (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                        logger_1.logger.info(`🔔 Event processed: JOIN_TICKET_DENIED forbidden ticket_id: ${ticketId}`);
                        return;
                    }
                    socket.join(TICKET_ROOM(String(ticketId)));
                    (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                    logger_1.logger.info(`🔔 Event processed: JOIN_TICKET for ticket_id: ${ticketId}`);
                }
                catch (err) {
                    logger_1.logger.error(colors_1.default.red(`JOIN_TICKET error: ${String(err)}`));
                }
            }));
            socket.on('LEAVE_TICKET', (_a) => __awaiter(void 0, [_a], void 0, function* ({ ticketId }) {
                if (!ticketId)
                    return;
                socket.leave(TICKET_ROOM(String(ticketId)));
                (0, presenceHelper_1.updateLastActive)(userId).catch(() => { });
                logger_1.logger.info(`🔔 Event processed: LEAVE_TICKET for ticket_id: ${ticketId}`);
            }));
            // ---------------------------------------------
            // 🔹 Handle Disconnect Event
            // ---------------------------------------------
            socket.on('disconnect', () => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    yield (0, presenceHelper_1.updateLastActive)(userId);
                    const remaining = yield (0, presenceHelper_1.decrConnCount)(userId);
                    const lastActive = yield (0, presenceHelper_1.getLastActive)(userId);
                    // Only mark offline and broadcast if no other sessions remain
                    if (!remaining || remaining <= 0) {
                        yield (0, presenceHelper_1.setOffline)(userId);
                        try {
                            yield (0, presenceHelper_1.clearUserRooms)(userId);
                        }
                        catch (_a) { }
                    }
                    else {
                        logger_1.logger.info(colors_1.default.yellow(`User ${userId} disconnected one session; ${remaining} session(s) remain.`));
                    }
                    logger_1.logger.info(colors_1.default.red(`User ${userId} disconnected`));
                    logger_1.logger.info(`🔔 Event processed: socket_disconnected for user_id: ${userId}`);
                }
                catch (err) {
                    logger_1.logger.error(colors_1.default.red(`❌ Disconnect handling error: ${String(err)}`));
                }
            }));
        }
        catch (err) {
            logger_1.logger.error(colors_1.default.red(`Socket connection error: ${String(err)}`));
            try {
                socket.disconnect(true);
            }
            catch (_c) { }
        }
    }));
};
exports.socketHelper = { socket };
