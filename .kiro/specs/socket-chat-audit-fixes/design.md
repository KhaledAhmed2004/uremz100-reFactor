# Design Document — socket-chat-audit-fixes

## Overview

This document describes the architecture and implementation plan for all 20 findings from the socket/chat audit. The changes are grouped into five logical areas:

1. **State migration** — move process-local `NodeCache` state (presence, typing throttle) to Redis
2. **Dead-code removal** — delete six legacy service methods and the `logEvent` helper
3. **Event correctness** — fix double-delivery of `MESSAGE_SENT`, fix `DELIVERED_ACK` schema reference, fix `READ_ACK` event name
4. **Authorization hardening** — add participant checks to `getHistory` and `JOIN_CHAT`
5. **Configuration & code quality** — CORS alignment, rate limiting, cursor safety, import cleanup, export normalization

No new external dependencies are introduced. All Redis operations use the existing `ioredis` client exported from `src/shared/redisClient.ts`.

---

## Architecture

### Component Map

```
src/
├── server.ts                          ← Req 11, 14: CORS + init order
├── app.ts                             ← (read-only reference for allowedOrigins)
├── app/logging/corsLogger.ts          ← (read-only reference for allowedOrigins)
├── helpers/
│   ├── socketHelper.ts                ← Req 2, 4, 5, 7, 8, 12, 15, 16, 17
│   └── socketManager.ts              ← (unchanged)
└── app/
    ├── helpers/
    │   ├── presenceHelper.ts          ← Req 1, 17
    │   └── unreadHelper.ts            ← Req 18
    └── modules/
        ├── message/
        │   ├── message.model.ts       ← Req 9
        │   └── message.service.ts     ← Req 3, 4, 6, 8, 9, 13, 19, 20
        └── chat/
            └── chat.service.ts        ← Req 3, 10
```

### Data Flow — MESSAGE_SENT (after fix)

```
Client → socket SEND_MESSAGE
  → MessageService.send()
      → Chat.findById (auth check)
      → Message.create
      → SocketManager.getIO().to(`chat::${chatId}`).emit('MESSAGE_SENT')
                                    ↑
                          chat room only (no user room loop)
```

### Data Flow — Presence (after migration)

```
setOnline(userId)
  → redisClient.sadd('presence:online', userId)
  → redisClient.set(`presence:lastActive:${userId}`, Date.now())

isOnline(userId)
  → redisClient.sismember('presence:online', userId) → boolean

incrConnCount(userId)
  → redisClient.incr(`presence:connCount:${userId}`) → number

decrConnCount(userId)
  → redisClient.decr(`presence:connCount:${userId}`)
  → if result < 0: redisClient.set(..., '0')
  → return Math.max(0, result)
```

### Data Flow — Typing Throttle (after migration)

```
TYPING_START { chatId, userId }
  → redisClient.set(`typing:${chatId}:${userId}`, '1', 'EX', 5, 'NX')
  → result === 'OK'  → emit TYPING_START to chat room
  → result === null  → suppress (already throttled)

TYPING_STOP { chatId, userId }
  → redisClient.del(`typing:${chatId}:${userId}`)
  → emit TYPING_STOP to chat room
```

### Data Flow — Rate Limiting

```
MESSAGE_SENT / TYPING_START / READ_ACK
  → checkRateLimit(event, userId, limit, windowSeconds)
      → key = `ratelimit:${event}:${userId}`
      → count = redisClient.incr(key)
      → if count === 1: redisClient.expire(key, windowSeconds)
      → if count > limit: emit ACK_ERROR, return
  → proceed with handler
```

### Data Flow — getHistory Compound Cursor

```
getHistory(chatId, userId, cursor?, limit?)
  → participant auth check (Chat.exists)
  → decode cursor → { ts: Date, id: ObjectId } | null
  → query: { chatId, $or: [
      { createdAt: { $gt: ts } },
      { createdAt: ts, _id: { $gt: id } }
    ]}
  → sort: { createdAt: 1, _id: 1 }
  → nextCursor = base64(`${lastMsg.createdAt.toISOString()}_${lastMsg._id}`)
```

---

## Components and Interfaces

### 1. `presenceHelper.ts` — Redis Migration

Replace the entire `NodeCache`-based implementation with `ioredis` calls. The exported function signatures remain identical so all callers (`socketHelper.ts`, `chat.service.ts`) require no changes.

```typescript
import { redisClient } from '../../shared/redisClient';

const ONLINE_SET = 'presence:online';
const LAST_ACTIVE_KEY = (userId: string) => `presence:lastActive:${userId}`;
const USER_ROOMS_KEY  = (userId: string) => `presence:userRooms:${userId}`;
const CONN_COUNT_KEY  = (userId: string) => `presence:connCount:${userId}`;

export const setOnline = async (userId: string): Promise<void> => {
  await redisClient.sadd(ONLINE_SET, userId);
  await redisClient.set(LAST_ACTIVE_KEY(userId), String(Date.now()));
};

export const setOffline = async (userId: string): Promise<void> => {
  await redisClient.srem(ONLINE_SET, userId);
  await redisClient.set(LAST_ACTIVE_KEY(userId), String(Date.now()));
};

export const updateLastActive = async (userId: string): Promise<void> => {
  await redisClient.set(LAST_ACTIVE_KEY(userId), String(Date.now()));
};

export const isOnline = async (userId: string): Promise<boolean> => {
  const result = await redisClient.sismember(ONLINE_SET, userId);
  return result === 1;
};

export const getLastActive = async (userId: string): Promise<number | undefined> => {
  const raw = await redisClient.get(LAST_ACTIVE_KEY(userId));
  if (raw === null) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
};

export const addUserRoom = async (userId: string, chatId: string): Promise<void> => {
  await redisClient.sadd(USER_ROOMS_KEY(userId), chatId);
};

export const removeUserRoom = async (userId: string, chatId: string): Promise<void> => {
  await redisClient.srem(USER_ROOMS_KEY(userId), chatId);
};

export const getUserRooms = async (userId: string): Promise<string[]> => {
  return redisClient.smembers(USER_ROOMS_KEY(userId));
};

export const clearUserRooms = async (userId: string): Promise<void> => {
  await redisClient.del(USER_ROOMS_KEY(userId));
};

export const incrConnCount = async (userId: string): Promise<number> => {
  return redisClient.incr(CONN_COUNT_KEY(userId));
};

export const decrConnCount = async (userId: string): Promise<number> => {
  const result = await redisClient.decr(CONN_COUNT_KEY(userId));
  if (result < 0) {
    await redisClient.set(CONN_COUNT_KEY(userId), '0');
    return 0;
  }
  return result;
};

export const getConnCount = async (userId: string): Promise<number> => {
  const raw = await redisClient.get(CONN_COUNT_KEY(userId));
  if (raw === null) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
```

**Key changes:** `NodeCache` import removed; `logger.info` calls removed (Req 17 — presence logs are informational, no color needed; remove them entirely to reduce noise, or keep plain `logger.info` without `colors`).

---

### 2. `socketHelper.ts` — Typing Throttle, Rate Limiting, Auth, Event Fixes

#### 2a. Remove NodeCache, add Redis typing throttle

```typescript
// REMOVE:
import NodeCache from 'node-cache';
const typingThrottle = new NodeCache({ ... });

// REPLACE TYPING_START throttle block with:
const key = TYPING_KEY(chatId, userId);
const acquired = await redisClient.set(key, '1', 'EX', TYPING_TTL_SECONDS, 'NX');
if (acquired === null) {
  // already throttled — suppress
  return;
}
// acquired === 'OK' — proceed to emit

// REPLACE TYPING_STOP throttle clear with:
await redisClient.del(TYPING_KEY(chatId, userId));
```

#### 2b. Replace try/require stubs with static imports

```typescript
// REMOVE all try { require(...) } catch blocks

// ADD at top of file:
import { Message } from '../app/modules/message/message.model';
import { Chat } from '../app/modules/chat/chat.model';
import { SupportTicket } from '../app/modules/support-ticket/support-ticket.model';
```

#### 2c. Remove logEvent helper, use logger.info directly

```typescript
// REMOVE:
const logEvent = (event: string, extra?: string) => { ... };

// REPLACE all logEvent(...) calls with:
logger.info(`🔔 Event processed: ${event} ${extra || ''}`);

// REPLACE handleEventProcessed with inline calls:
updateLastActive(userId).catch(() => {});
logger.info(`🔔 Event processed: ${event} ${extra || ''}`);
```

#### 2d. Add participant auth check to JOIN_CHAT

```typescript
socket.on('JOIN_CHAT', async ({ chatId }: { chatId: string }) => {
  if (!chatId) return;

  // Req 7: participant authorization
  const isParticipant = await Chat.exists({ _id: chatId, participants: userId });
  if (!isParticipant) {
    socket.emit('ACK_ERROR', {
      message: 'You are not a participant of this chat',
      chatId,
    });
    return;
  }

  // ... existing active-chat Redis write, socket.join, addUserRoom, USER_ONLINE ...
});
```

#### 2e. Fix DELIVERED_ACK — no DB write

```typescript
socket.on('DELIVERED_ACK', async ({ messageId }: { messageId: string }) => {
  try {
    const found = await Message.findById(messageId).select('_id chatId');
    if (!found) {
      socket.emit('ACK_ERROR', { message: 'Message not found', messageId });
      return;
    }
    const allowed = await Chat.exists({ _id: found.chatId, participants: userId });
    if (!allowed) {
      socket.emit('ACK_ERROR', {
        message: 'You are not a participant of this chat',
        chatId: String(found.chatId),
        messageId: String(found._id),
      });
      return;
    }
    // Req 5: emit MESSAGE_DELIVERED without any DB write
    io.to(CHAT_ROOM(String(found.chatId))).emit('MESSAGE_DELIVERED', {
      messageId: String(found._id),
      chatId: String(found.chatId),
      userId,
    });
    logger.info(`🔔 Event processed: DELIVERED_ACK for message_id: ${String(found._id)}`);
  } catch (err) {
    logger.error(colors.red(`❌ DELIVERED_ACK error: ${String(err)}`));
  }
});
```

#### 2f. Fix READ_ACK — emit MESSAGES_READ (plural)

```typescript
socket.on('READ_ACK', async ({ messageId }: { messageId: string }) => {
  try {
    // rate limit check (Req 12)
    if (await isRateLimited('READ_ACK', userId, 60, 60)) {
      socket.emit('ACK_ERROR', { message: 'Rate limit exceeded', event: 'READ_ACK' });
      return;
    }

    const found = await Message.findById(messageId).select('_id chatId');
    if (!found) {
      socket.emit('ACK_ERROR', { message: 'Message not found', messageId });
      return;
    }
    const allowed = await Chat.exists({ _id: found.chatId, participants: userId });
    if (!allowed) {
      socket.emit('ACK_ERROR', {
        message: 'You are not a participant of this chat',
        chatId: String(found.chatId),
        messageId: String(found._id),
      });
      return;
    }
    const msg = await Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { readBy: userId } },
      { new: true }
    );
    if (msg) {
      // Req 8: MESSAGES_READ (plural), payload matches markRead shape
      io.to(CHAT_ROOM(String(msg.chatId))).emit('MESSAGES_READ', {
        chatId: String(msg.chatId),
        userId,
        updatedIds: [String(msg._id)],
      });
      logger.info(`🔔 Event processed: READ_ACK for message_id: ${String(msg._id)}`);
    }
  } catch (err) {
    logger.error(colors.red(`❌ READ_ACK error: ${String(err)}`));
  }
});
```

#### 2g. Rate limiting helper

```typescript
/**
 * Increments the rate-limit counter for an event+user pair.
 * Returns true if the limit has been exceeded (caller should reject).
 */
const isRateLimited = async (
  event: string,
  userId: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> => {
  const key = `ratelimit:${event}:${userId}`;
  const count = await redisClient.incr(key);
  if (count === 1) {
    // First increment — set TTL for the window
    await redisClient.expire(key, windowSeconds);
  }
  return count > limit;
};
```

Apply `isRateLimited` at the top of `MESSAGE_SENT` (limit 30/60s), `TYPING_START` (limit 60/60s), and `READ_ACK` (limit 60/60s) handlers.

#### 2h. Standardize colors usage (Req 17)

- Keep `colors.yellow` / `colors.red` for warnings and errors only.
- Remove `colors.blue`, `colors.green` from routine info logs.
- Remove `colors` from presence-related log messages entirely.

---

### 3. `message.service.ts` — Dead Code, Double-Delivery, Auth, Cursor

#### 3a. Delete legacy methods (Req 3)

Remove entirely: `sendMessageToDB`, `markChatAsRead`, `getMessageFromDB`, `markAsDelivered`.

Update the export object:
```typescript
export const MessageService = {
  send,
  getHistory,
  markRead,
  getUnreadCount,
};
```

#### 3b. Fix MESSAGE_SENT double-delivery (Req 4)

In `send()`, replace the dual-emit block:

```typescript
// REMOVE the user-room loop:
// for (const participantId of participantIds) {
//   io.to(`user::${participantId}`).emit('MESSAGE_SENT', ...);
// }

// KEEP only:
io.to(`chat::${chatId}`).emit('MESSAGE_SENT', { message: populatedMessage });
```

#### 3c. Add participant auth to getHistory (Req 6, 19)

```typescript
const getHistory = async (
  chatId: string,
  userId: string,
  cursor?: string,
  limit?: number,
): Promise<IHistoryResult> => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid chatId');
  }
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid userId');
  }

  // Req 6: participant authorization (userId is now used, not discarded — Req 19)
  const isParticipant = await Chat.exists({ _id: chatId, participants: userId });
  if (!isParticipant) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You are not a participant of this chat');
  }

  // ... rest of function
};
```

#### 3d. Compound cursor (Req 13)

```typescript
// Encode cursor
const encodeCursor = (createdAt: Date, id: string): string =>
  Buffer.from(`${createdAt.toISOString()}_${id}`).toString('base64');

// Decode cursor
const decodeCursor = (cursor: string): { ts: Date; id: string } => {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, 'base64').toString('utf8');
  } catch {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid cursor');
  }
  const underscoreIdx = decoded.indexOf('_');
  if (underscoreIdx === -1) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid cursor');
  }
  const tsStr = decoded.slice(0, underscoreIdx);
  const id = decoded.slice(underscoreIdx + 1);
  const ts = new Date(tsStr);
  if (isNaN(ts.getTime()) || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid cursor');
  }
  return { ts, id };
};
```

Query with compound cursor:
```typescript
const query: Record<string, unknown> = { chatId };
if (cursor) {
  const { ts, id } = decodeCursor(cursor);
  query.$or = [
    { createdAt: { $gt: ts } },
    { createdAt: ts, _id: { $gt: new mongoose.Types.ObjectId(id) } },
  ];
}

const messages = await Message.find(query)
  .sort({ createdAt: 1, _id: 1 })
  .limit(clampedLimit)
  .populate('sender', '_id name profilePicture')
  .lean();

const nextCursor =
  hasNextPage && messages.length > 0
    ? encodeCursor(
        new Date((messages[messages.length - 1] as any).createdAt),
        String((messages[messages.length - 1] as any)._id),
      )
    : null;
```

#### 3e. Remove global.io references (Req 20)

All `global.io` reads in `sendMessageToDB` are removed with the function itself (Req 3). The `send()` function already uses `SocketManager.getIO()` — no change needed there.

---

### 4. `chat.service.ts` — Dead Code, DB-Side Sort

#### 4a. Delete legacy methods (Req 3)

Remove entirely: `createChatToDB`, `getChatFromDB`.

Update the export object:
```typescript
export const ChatService = { createOrGet, getList };
```

#### 4b. Move sort to MongoDB query (Req 10)

```typescript
const chats = await Chat.find({ participants: userId })
  .sort({ 'lastMessage.createdAt': -1 })   // ← DB-side sort
  .populate('participants', '_id name image role')
  .lean();

// REMOVE the JavaScript sort block:
// chats.sort((a, b) => { ... });
```

MongoDB sorts `null` values last in descending order, satisfying Req 10.3 without any application-layer special-casing.

---

### 5. `message.model.ts` — Text Maxlength (Req 9)

```typescript
text: {
  type: String,
  required: false,
  maxlength: 10000,   // was 4000
  trim: true,
  // ... existing validator unchanged
},
```

---

### 6. `unreadHelper.ts` — Remove Namespace Export (Req 18)

```typescript
// REMOVE:
export const UnreadHelper = {
  getUnreadCountCached,
  setUnreadCount,
  incrementUnreadCount,
  clearUnreadCount,
  batchGetUnreadCounts,
};
```

All five functions remain as named exports. No callers use `UnreadHelper.x` — they all already use named imports — so no caller changes are needed.

---

### 7. `server.ts` — CORS + Init Order (Req 11, 14)

#### 7a. Pass allowedOrigins to Socket.IO (Req 11)

```typescript
import { allowedOrigins } from './app/logging/corsLogger';

// In server.ts, after app.listen() returns the server reference:
const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: allowedOrigins,   // ← was '*'
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
```

#### 7b. Move Socket.IO init outside listen callback (Req 14)

```typescript
// BEFORE (wrong — inside listen callback):
server = app.listen(port, host, () => {
  const io = new Server(server, { ... });
  socketHelper.socket(io);
  SocketManager.init(io);
});

// AFTER (correct — outside listen callback):
server = app.listen(port, host);
const io = new Server(server, {
  pingTimeout: 60000,
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});
socketHelper.socket(io);
SocketManager.init(io);

server.on('listening', () => {
  // startup summary logging here
});
```

This ensures `SocketManager.getIO()` is callable immediately after `app.listen()` returns, before the `'listening'` event fires.

---

## Data Models

### Message Schema Change

| Field | Before | After |
|-------|--------|-------|
| `text.maxlength` | `4000` | `10000` |
| `deliveredTo` | absent (already removed) | absent (no change) |

No migration needed — the `maxlength` change is a relaxation (existing documents are unaffected).

### Redis Key Inventory (after all changes)

| Key Pattern | Type | TTL | Owner |
|-------------|------|-----|-------|
| `presence:online` | Set | none | presenceHelper |
| `presence:lastActive:{userId}` | String | none | presenceHelper |
| `presence:userRooms:{userId}` | Set | none | presenceHelper |
| `presence:connCount:{userId}` | String | none | presenceHelper |
| `typing:{chatId}:{userId}` | String | 5s | socketHelper |
| `active:{userId}:chat` | String | 3600s | socketHelper |
| `ratelimit:MESSAGE_SENT:{userId}` | String | 60s | socketHelper |
| `ratelimit:TYPING_START:{userId}` | String | 60s | socketHelper |
| `ratelimit:READ_ACK:{userId}` | String | 60s | socketHelper |
| `unread:{chatId}:{userId}` | String | none | unreadHelper |
| `notif:dedup:{chatId}:{userId}` | String | 60s | message.service |

---

## Error Handling

| Scenario | Response |
|----------|----------|
| `JOIN_CHAT` — user not participant | `ACK_ERROR { message, chatId }` to socket |
| `DELIVERED_ACK` — message not found | `ACK_ERROR { message, messageId }` to socket |
| `DELIVERED_ACK` — user not participant | `ACK_ERROR { message, chatId, messageId }` to socket |
| `READ_ACK` — rate limit exceeded | `ACK_ERROR { message: 'Rate limit exceeded', event }` to socket |
| `MESSAGE_SENT` — rate limit exceeded | `ACK_ERROR { message: 'Rate limit exceeded', event }` to socket |
| `TYPING_START` — rate limit exceeded | `ACK_ERROR { message: 'Rate limit exceeded', event }` to socket |
| `getHistory` — user not participant | `ApiError 403 'You are not a participant of this chat'` |
| `getHistory` — invalid cursor | `ApiError 400 'Invalid cursor'` |
| Redis failure in rate limiter | Log error, allow the request through (fail open) |
| Redis failure in presence ops | Log error, propagate (caller's try/catch handles) |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Presence online round-trip

*For any* userId, calling `setOnline(userId)` followed by `isOnline(userId)` SHALL return `true`; calling `setOffline(userId)` followed by `isOnline(userId)` SHALL return `false`.

**Validates: Requirements 1.1, 1.5, 1.6, 1.7**

---

### Property 2: Presence lastActive is set on state change

*For any* userId, after calling `setOnline(userId)` or `setOffline(userId)`, `getLastActive(userId)` SHALL return a Unix millisecond integer that is greater than or equal to the timestamp recorded immediately before the call.

**Validates: Requirements 1.2, 1.5, 1.6, 1.8**

---

### Property 3: User-room membership round-trip

*For any* userId and chatId, calling `addUserRoom(userId, chatId)` followed by `getUserRooms(userId)` SHALL include `chatId` in the result; calling `removeUserRoom(userId, chatId)` followed by `getUserRooms(userId)` SHALL NOT include `chatId` in the result.

**Validates: Requirements 1.3, 1.9, 1.10, 1.11**

---

### Property 4: clearUserRooms empties membership

*For any* userId with one or more rooms added, calling `clearUserRooms(userId)` followed by `getUserRooms(userId)` SHALL return an empty array.

**Validates: Requirements 1.12**

---

### Property 5: Connection count monotonicity and floor

*For any* userId, calling `incrConnCount` N times SHALL result in a count of N; calling `decrConnCount` on a count of 0 SHALL return 0 (not a negative number).

**Validates: Requirements 1.4, 1.13, 1.14**

---

### Property 6: Typing throttle suppresses duplicates within window

*For any* chatId and userId, two `TYPING_START` events emitted within 5 seconds of each other SHALL result in exactly one broadcast to the chat room; the second SHALL be suppressed.

**Validates: Requirements 2.2, 2.3, 2.4**

---

### Property 7: TYPING_STOP clears throttle

*For any* chatId and userId, a `TYPING_START` event followed immediately by a `TYPING_STOP` event followed immediately by another `TYPING_START` event SHALL result in two broadcasts to the chat room (the throttle key was cleared by `TYPING_STOP`).

**Validates: Requirements 2.5**

---

### Property 8: MESSAGE_SENT emits to chat room only

*For any* valid message send, `MESSAGE_SENT` SHALL be emitted exactly once to `chat::{chatId}` and SHALL NOT be emitted to any `user::{participantId}` room.

**Validates: Requirements 4.1, 4.2**

---

### Property 9: DELIVERED_ACK does not mutate Message document

*For any* valid messageId where the requesting user is a participant, handling `DELIVERED_ACK` SHALL emit `MESSAGE_DELIVERED` to the chat room AND the Message document SHALL be identical before and after the handler executes (no field added, no field modified).

**Validates: Requirements 5.1, 5.2**

---

### Property 10: getHistory rejects non-participants

*For any* chatId and userId where userId is not in the chat's `participants` array, calling `getHistory(chatId, userId)` SHALL throw an `ApiError` with HTTP status 403.

**Validates: Requirements 6.1, 6.2, 19.1**

---

### Property 11: JOIN_CHAT rejects non-participants

*For any* chatId and userId where userId is not in the chat's `participants` array, a `JOIN_CHAT` event SHALL result in `ACK_ERROR` being emitted to the requesting socket and the socket SHALL NOT be added to the `chat::{chatId}` room.

**Validates: Requirements 7.1, 7.2**

---

### Property 12: READ_ACK emits MESSAGES_READ with correct payload

*For any* valid messageId where the requesting user is a participant, handling `READ_ACK` SHALL emit an event named exactly `MESSAGES_READ` (plural) to the chat room with a payload containing `chatId`, `userId`, and `updatedIds` as an array containing the messageId.

**Validates: Requirements 8.1, 8.2**

---

### Property 13: Text length validation is consistent at 10000

*For any* message text string with `length > 10000`, `MessageService.send()` SHALL throw an `ApiError` with HTTP status 400; *for any* message text string with `length <= 10000`, the length check SHALL NOT throw.

**Validates: Requirements 9.2, 9.3**

---

### Property 14: getList returns chats in descending lastMessage order

*For any* userId with multiple chats having different `lastMessage.createdAt` values, `ChatService.getList(userId)` SHALL return the chats ordered by `lastMessage.createdAt` descending, with chats where `lastMessage` is null appearing last.

**Validates: Requirements 10.1, 10.3**

---

### Property 15: Rate limit rejects events beyond threshold

*For any* userId, after the per-event rate limit is reached within the window (30 for `MESSAGE_SENT`, 60 for `TYPING_START`, 60 for `READ_ACK`), the next event SHALL result in `ACK_ERROR { message: 'Rate limit exceeded', event }` being emitted to the requesting socket and the event SHALL NOT be processed.

**Validates: Requirements 12.1, 12.2, 12.3, 12.4**

---

### Property 16: Compound cursor pagination is complete and non-duplicating

*For any* set of messages in a chat, paginating through all pages using the compound cursor returned by each `getHistory` call SHALL yield each message exactly once — no message is skipped and no message appears on more than one page, even when multiple messages share the same `createdAt` millisecond.

**Validates: Requirements 13.1, 13.2, 13.3**


---

## Testing Strategy

**Dual testing approach** — unit/example tests cover specific scenarios and structural checks; property-based tests cover universal invariants across generated inputs.

### Unit / Example Tests

- Verify `message.model.ts` schema rejects text longer than 10000 chars and accepts text of exactly 10000 chars
- Verify `READ_ACK` emits the string `'MESSAGES_READ'` (not `'MESSAGE_READ'`)
- Verify `server.ts` passes `allowedOrigins` (not `'*'`) to the `Server` constructor
- Verify `unreadHelper.ts` does not export `UnreadHelper` namespace object
- Verify `MessageService` export object contains exactly `{ send, getHistory, markRead, getUnreadCount }`
- Verify `ChatService` export object contains exactly `{ createOrGet, getList }`
- Verify `DELIVERED_ACK` handler emits `MESSAGE_DELIVERED` with correct shape on a known valid message

### Property-Based Tests

Each property listed in the Correctness Properties section maps to a property-based test. Tests use a minimum of 100 iterations with generated inputs.

Tag format: `Feature: socket-chat-audit-fixes, Property {N}: {title}`

| Property | Generator inputs | What varies |
|----------|-----------------|-------------|
| P1 — Presence online round-trip | random userId strings | userId format, call order |
| P2 — lastActive set on state change | random userId, timing | userId, call timing |
| P3 — User-room membership round-trip | random userId, chatId | both IDs |
| P4 — clearUserRooms empties membership | random userId, N rooms | userId, room count |
| P5 — Connection count floor | random userId, N increments | userId, increment count |
| P6 — Typing throttle suppresses duplicates | random chatId, userId | both IDs |
| P7 — TYPING_STOP clears throttle | random chatId, userId | both IDs |
| P8 — MESSAGE_SENT chat room only | random chatId, senderId, text | all three |
| P9 — DELIVERED_ACK no mutation | random messageId, userId | both IDs |
| P10 — getHistory rejects non-participants | random chatId, non-member userId | both IDs |
| P11 — JOIN_CHAT rejects non-participants | random chatId, non-member userId | both IDs |
| P12 — READ_ACK emits MESSAGES_READ | random messageId, userId | both IDs |
| P13 — Text length validation at 10000 | random text strings of varying length | text length |
| P14 — getList descending order | random sets of chats with timestamps | chat count, timestamps |
| P15 — Rate limit rejects beyond threshold | random userId, event type | userId, event |
| P16 — Compound cursor completeness | random message sets with timestamp collisions | message count, timestamps |

Properties P1–P7 (presence and typing) use a Redis mock (e.g., `ioredis-mock`) to keep tests fast and deterministic. Properties P8–P16 use in-memory mocks for MongoDB and Redis. No real network calls are made in property tests.
