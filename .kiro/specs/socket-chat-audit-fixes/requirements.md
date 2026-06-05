# Requirements Document

## Introduction

This spec addresses all 20 findings from the socket/chat audit. The fixes span four severity tiers — critical, significant, moderate, and minor — and touch `presenceHelper.ts`, `socketHelper.ts`, `message.service.ts`, `chat.service.ts`, `server.ts`, and `unreadHelper.ts`. The goals are: eliminate process-local in-memory state that breaks multi-process (PM2) deployments, remove dangerous dead code, fix double-delivery of socket events, enforce consistent authorization, align schema constraints with service-layer validation, harden Socket.IO configuration, and clean up minor code-quality issues.

---

## Glossary

- **PresenceHelper**: The module at `src/app/helpers/presenceHelper.ts` responsible for tracking online/offline status, last-active timestamps, connection counts, and user-room membership.
- **TypingThrottle**: The per-process `NodeCache` instance in `socketHelper.ts` used to rate-limit `TYPING_START` events per user per chat.
- **SocketHelper**: The module at `src/helpers/socketHelper.ts` that registers all Socket.IO event handlers.
- **MessageService**: The module at `src/app/modules/message/message.service.ts` that handles message persistence and real-time delivery.
- **ChatService**: The module at `src/app/modules/chat/chat.service.ts` that handles chat list retrieval and chat creation.
- **SocketManager**: The singleton at `src/helpers/socketManager.ts` that holds the initialized `Server` instance.
- **RedisClient**: The shared `ioredis` client exported from `src/shared/redisClient.ts`.
- **LegacyMethods**: The six service functions `createChatToDB`, `getChatFromDB`, `sendMessageToDB`, `markChatAsRead`, `getMessageFromDB`, and `markAsDelivered` that are no longer called by any active code path.
- **ChatRoom**: A Socket.IO room identified by the key `chat::{chatId}`, joined explicitly by clients via `JOIN_CHAT`.
- **UserRoom**: A Socket.IO room identified by the key `user::{userId}`, joined automatically on socket connection.
- **CORS Allowlist**: The array of permitted origins configured for the HTTP layer via the Express CORS middleware.
- **Cursor**: An ISO 8601 timestamp string used as a pagination marker in `getHistory`.
- **deliveredTo**: A field that was removed from the `Message` schema but is still referenced in `DELIVERED_ACK` handler logic.
- **global.io**: The deprecated pattern of attaching the Socket.IO server to the Node.js `global` object, replaced by `SocketManager`.

---

## Requirements

### Requirement 1: Migrate PresenceHelper to Redis

**User Story:** As a backend engineer, I want presence state stored in Redis so that online/offline status, connection counts, last-active timestamps, and user-room membership are consistent across all Node.js worker processes in a PM2 cluster.

#### Acceptance Criteria

1. THE PresenceHelper SHALL store the online-user set under the Redis key `presence:online` using a Redis Set (`SADD` / `SREM`).
2. THE PresenceHelper SHALL store each user's last-active timestamp under the Redis key `presence:lastActive:{userId}` as a Unix millisecond integer string.
3. THE PresenceHelper SHALL store each user's chat-room membership under the Redis key `presence:userRooms:{userId}` using a Redis Set (`SADD` / `SREM`).
4. THE PresenceHelper SHALL store each user's connection count under the Redis key `presence:connCount:{userId}` using Redis `INCR` / `DECR` operations.
5. WHEN `setOnline` is called for a userId, THE PresenceHelper SHALL execute `SADD presence:online {userId}` and set `presence:lastActive:{userId}` to the current Unix millisecond timestamp via a single pipeline or two sequential commands.
6. WHEN `setOffline` is called for a userId, THE PresenceHelper SHALL execute `SREM presence:online {userId}` and update `presence:lastActive:{userId}` to the current Unix millisecond timestamp.
7. WHEN `isOnline` is called for a userId, THE PresenceHelper SHALL return `true` if and only if `SISMEMBER presence:online {userId}` returns 1.
8. WHEN `getLastActive` is called for a userId, THE PresenceHelper SHALL return the integer stored at `presence:lastActive:{userId}`, or `undefined` when the key does not exist.
9. WHEN `addUserRoom` is called with a userId and chatId, THE PresenceHelper SHALL execute `SADD presence:userRooms:{userId} {chatId}`.
10. WHEN `removeUserRoom` is called with a userId and chatId, THE PresenceHelper SHALL execute `SREM presence:userRooms:{userId} {chatId}`.
11. WHEN `getUserRooms` is called for a userId, THE PresenceHelper SHALL return all members of the Redis Set at `presence:userRooms:{userId}` as a string array, or an empty array when the key does not exist.
12. WHEN `clearUserRooms` is called for a userId, THE PresenceHelper SHALL execute `DEL presence:userRooms:{userId}`.
13. WHEN `incrConnCount` is called for a userId, THE PresenceHelper SHALL execute `INCR presence:connCount:{userId}` and return the resulting integer.
14. WHEN `decrConnCount` is called for a userId, THE PresenceHelper SHALL execute `DECR presence:connCount:{userId}`, clamp the stored value to a minimum of 0, and return the resulting integer.
15. THE PresenceHelper SHALL NOT import or instantiate `NodeCache` after this migration.

---

### Requirement 2: Migrate TypingThrottle to Redis

**User Story:** As a backend engineer, I want typing-throttle state stored in Redis so that duplicate `TYPING_START` events are suppressed consistently across all worker processes.

#### Acceptance Criteria

1. THE SocketHelper SHALL replace the `NodeCache`-based `typingThrottle` instance with Redis-backed TTL keys for throttling `TYPING_START` events.
2. WHEN a `TYPING_START` event is received for a chatId and userId, THE SocketHelper SHALL attempt `SET typing:{chatId}:{userId} 1 EX 5 NX` via RedisClient.
3. WHEN the `SET NX` command returns `null` (key already exists), THE SocketHelper SHALL suppress the `TYPING_START` broadcast and return without emitting to the ChatRoom.
4. WHEN the `SET NX` command returns `"OK"` (key did not exist), THE SocketHelper SHALL emit `TYPING_START` to the ChatRoom.
5. WHEN a `TYPING_STOP` event is received for a chatId and userId, THE SocketHelper SHALL execute `DEL typing:{chatId}:{userId}` via RedisClient to clear the throttle key immediately.
6. THE SocketHelper SHALL NOT import or instantiate `NodeCache` for typing throttle after this migration.

---

### Requirement 3: Delete All Legacy Dead Code

**User Story:** As a backend engineer, I want the six legacy service methods removed entirely so that no code path can accidentally invoke `global.io` or operate on the removed `deliveredTo` schema field.

#### Acceptance Criteria

1. THE MessageService SHALL NOT export or define the function `sendMessageToDB`.
2. THE MessageService SHALL NOT export or define the function `markChatAsRead`.
3. THE MessageService SHALL NOT export or define the function `getMessageFromDB`.
4. THE MessageService SHALL NOT export or define the function `markAsDelivered`.
5. THE ChatService SHALL NOT export or define the function `createChatToDB`.
6. THE ChatService SHALL NOT export or define the function `getChatFromDB`.
7. THE MessageService SHALL NOT contain any reference to `global.io`.
8. WHEN the legacy methods are deleted, THE MessageService SHALL continue to export `send`, `getHistory`, `markRead`, and `getUnreadCount` without modification.
9. WHEN the legacy methods are deleted, THE ChatService SHALL continue to export `createOrGet` and `getList` without modification.

---

### Requirement 4: Fix MESSAGE_SENT Double-Delivery

**User Story:** As a client developer, I want each new message delivered exactly once per connected client so that the chat UI does not render duplicate message bubbles.

#### Acceptance Criteria

1. WHEN MessageService `send` emits `MESSAGE_SENT`, THE MessageService SHALL emit to `chat::{chatId}` only, using `SocketManager.getIO().to(\`chat::${chatId}\`).emit('MESSAGE_SENT', ...)`.
2. THE MessageService SHALL NOT emit `MESSAGE_SENT` to any `user::{participantId}` room.
3. WHEN a client has not joined the ChatRoom via `JOIN_CHAT`, THE system SHALL rely on the `CHAT_UPDATED` event (already emitted to the UserRoom) to notify the client of new messages, rather than a duplicate `MESSAGE_SENT` emission.

---

### Requirement 5: Fix DELIVERED_ACK Schema Reference

**User Story:** As a backend engineer, I want the `DELIVERED_ACK` handler to operate only on fields that exist in the current Message schema so that the handler does not silently fail or corrupt documents.

#### Acceptance Criteria

1. THE SocketHelper `DELIVERED_ACK` handler SHALL NOT perform `$addToSet: { deliveredTo: userId }` on the Message document, as the `deliveredTo` field does not exist in the current schema.
2. WHEN a `DELIVERED_ACK` event is received with a valid messageId and the requesting user is a participant of the associated chat, THE SocketHelper SHALL emit `MESSAGE_DELIVERED` to the ChatRoom with `{ messageId, chatId, userId }` without modifying the Message document.
3. IF the Message document identified by messageId does not exist, THEN THE SocketHelper SHALL emit `ACK_ERROR` to the requesting socket with `{ message: 'Message not found', messageId }`.
4. IF the requesting user is not a participant of the chat associated with the message, THEN THE SocketHelper SHALL emit `ACK_ERROR` to the requesting socket with `{ message: 'You are not a participant of this chat', chatId, messageId }`.

---

### Requirement 6: Add Participant Authorization to getHistory

**User Story:** As a security engineer, I want `getHistory` to verify that the requesting user is a participant of the chat before returning messages so that users cannot read messages from chats they do not belong to.

#### Acceptance Criteria

1. WHEN `getHistory` is called with a chatId and userId, THE MessageService SHALL verify that a Chat document exists with `_id === chatId` and `participants` containing `userId`.
2. IF no such Chat document exists or the userId is not in `participants`, THEN THE MessageService SHALL throw an `ApiError` with HTTP status 403 and the message `'You are not a participant of this chat'`.
3. WHEN the participant check passes, THE MessageService SHALL proceed with the existing cursor-based query and return the message page.

---

### Requirement 7: Add Participant Authorization to JOIN_CHAT

**User Story:** As a security engineer, I want the `JOIN_CHAT` socket handler to verify that the connecting user is a participant of the requested chat before joining the Socket.IO room so that users cannot eavesdrop on chats they do not belong to.

#### Acceptance Criteria

1. WHEN a `JOIN_CHAT` event is received with a chatId, THE SocketHelper SHALL query `Chat.exists({ _id: chatId, participants: userId })`.
2. IF the query returns falsy, THEN THE SocketHelper SHALL emit `ACK_ERROR` to the requesting socket with `{ message: 'You are not a participant of this chat', chatId }` and SHALL NOT join the socket to the ChatRoom.
3. WHEN the participant check passes, THE SocketHelper SHALL join the socket to `chat::{chatId}` and proceed with the existing `addUserRoom` and `USER_ONLINE` broadcast logic.

---

### Requirement 8: Fix READ_ACK / markRead Event Name Mismatch

**User Story:** As a client developer, I want a single, consistent event name for bulk read acknowledgements so that the client does not need to handle two different event names for the same semantic action.

#### Acceptance Criteria

1. THE SocketHelper `READ_ACK` handler SHALL emit `MESSAGES_READ` (plural) to the ChatRoom, not `MESSAGE_READ` (singular).
2. THE SocketHelper `READ_ACK` handler SHALL emit `MESSAGES_READ` with the payload `{ chatId, userId, updatedIds: [messageId] }` to match the shape emitted by `markRead` in MessageService.
3. THE MessageService `markRead` function SHALL continue to emit `MESSAGES_READ` (plural) unchanged.

---

### Requirement 9: Align Text Length Limit

**User Story:** As a backend engineer, I want the text length constraint enforced at exactly one value across the schema and the service layer so that validation is predictable and consistent.

#### Acceptance Criteria

1. THE Message schema `text` field `maxlength` SHALL be set to `10000` characters.
2. THE MessageService `send` function SHALL validate that `payload.text.length` does not exceed `10000` characters, throwing `ApiError` 400 when exceeded.
3. THE system SHALL NOT enforce a `4000`-character limit on message text at any layer.

---

### Requirement 10: Fix getList DB-Side Sorting

**User Story:** As a backend engineer, I want the chat list sorted by the database rather than in application memory so that the sort is correct and efficient regardless of result set size.

#### Acceptance Criteria

1. THE ChatService `getList` function SHALL apply `.sort({ 'lastMessage.createdAt': -1 })` to the `Chat.find()` query before calling `.lean()`.
2. THE ChatService `getList` function SHALL NOT sort the result array in JavaScript after fetching from the database.
3. WHEN `lastMessage` is null for a chat document, THE ChatService SHALL treat that chat as having the lowest sort priority (sorted last), consistent with MongoDB's behavior of sorting null values last in descending order.

---

### Requirement 11: Fix Socket.IO CORS Configuration

**User Story:** As a security engineer, I want Socket.IO to use the same origin allowlist as the HTTP layer so that the real-time transport does not bypass the application's CORS policy.

#### Acceptance Criteria

1. THE server initialization in `server.ts` SHALL pass the HTTP-layer CORS allowlist (the same array used by the Express CORS middleware) as the `origin` option when constructing the `Server` instance.
2. THE `Server` constructor call SHALL NOT use `origin: '*'`.
3. WHERE the `NODE_ENV` environment variable equals `'development'`, THE server MAY include `'http://localhost:3000'` and `'http://localhost:5173'` in the allowlist.

---

### Requirement 12: Add Socket Event Rate Limiting

**User Story:** As a security engineer, I want per-user rate limits on high-frequency socket events so that a single client cannot flood the server with `MESSAGE_SENT`, `TYPING_START`, or `READ_ACK` events.

#### Acceptance Criteria

1. THE SocketHelper SHALL enforce a rate limit of no more than 30 `MESSAGE_SENT`-triggering events per user per 60-second window.
2. THE SocketHelper SHALL enforce a rate limit of no more than 60 `TYPING_START` events per user per 60-second window.
3. THE SocketHelper SHALL enforce a rate limit of no more than 60 `READ_ACK` events per user per 60-second window.
4. WHEN a user exceeds a rate limit, THE SocketHelper SHALL emit `ACK_ERROR` to the requesting socket with `{ message: 'Rate limit exceeded', event: '<eventName>' }` and SHALL NOT process the event.
5. THE SocketHelper SHALL store rate-limit counters in Redis using keys of the form `ratelimit:{event}:{userId}` with a TTL equal to the window duration in seconds.

---

### Requirement 13: Fix Timestamp Cursor Collision Safety

**User Story:** As a backend engineer, I want the `getHistory` cursor to be collision-safe so that messages created at the same millisecond are not silently skipped or duplicated across pages.

#### Acceptance Criteria

1. THE MessageService `getHistory` function SHALL use a compound cursor consisting of a createdAt timestamp and a MongoDB ObjectId string, encoded as a single opaque string (e.g., base64 of `{ts}_{id}`).
2. WHEN a cursor is provided, THE MessageService SHALL filter messages where `createdAt > cursorTimestamp` OR (`createdAt === cursorTimestamp` AND `_id > cursorId`), using a `$or` query.
3. THE MessageService `getHistory` function SHALL set `nextCursor` to the compound cursor derived from the last returned message when `hasNextPage` is true, or `null` when there are no further pages.
4. THE MessageService `getHistory` function SHALL return an `ApiError` with HTTP status 400 when a provided cursor string cannot be decoded into a valid timestamp and ObjectId pair.

---

### Requirement 14: Move Socket.IO Initialization Outside listen Callback

**User Story:** As a backend engineer, I want Socket.IO initialized immediately after the HTTP server is created so that the initialization order is explicit and not dependent on the `listen` callback timing.

#### Acceptance Criteria

1. THE `server.ts` module SHALL create the `Server` instance and call `socketHelper.socket(io)` and `SocketManager.init(io)` after `app.listen()` returns the `http.Server` reference but before the `listen` callback fires.
2. THE `server.ts` module SHALL NOT initialize Socket.IO inside the `listen` callback.
3. WHEN the HTTP server emits the `'listening'` event, THE Socket.IO server SHALL already be attached and ready to accept connections.

---

### Requirement 15: Remove try/require Stubs for Always-Present Modules

**User Story:** As a backend engineer, I want `socketHelper.ts` to import `Message`, `Chat`, and `SupportTicket` with standard static imports so that missing-module errors surface at startup rather than silently falling back to no-op stubs.

#### Acceptance Criteria

1. THE SocketHelper SHALL import `Message` from `'../app/modules/message/message.model'` using a static ES module import statement.
2. THE SocketHelper SHALL import `Chat` from `'../app/modules/chat/chat.model'` using a static ES module import statement.
3. THE SocketHelper SHALL import `SupportTicket` from `'../app/modules/support-ticket/support-ticket.model'` using a static ES module import statement.
4. THE SocketHelper SHALL NOT contain any `try { require(...) } catch` blocks for these three modules.

---

### Requirement 16: Remove Redundant logEvent Helper

**User Story:** As a backend engineer, I want the `logEvent` wrapper removed so that logging calls use the shared `logger` directly and the codebase has one fewer indirection layer.

#### Acceptance Criteria

1. THE SocketHelper SHALL NOT define or call the `logEvent` function.
2. WHEN an event is processed, THE SocketHelper SHALL call `logger.info(...)` directly with the same message content previously passed through `logEvent`.

---

### Requirement 17: Standardize colors Library Usage

**User Story:** As a backend engineer, I want `colors` used consistently so that log output has a uniform style and the library is not applied redundantly or omitted inconsistently.

#### Acceptance Criteria

1. THE SocketHelper SHALL apply `colors` only to log messages that represent warnings or errors (e.g., `colors.yellow` for warnings, `colors.red` for errors).
2. THE SocketHelper SHALL NOT apply `colors` to routine informational log messages that do not require visual emphasis.
3. THE PresenceHelper SHALL NOT import or use the `colors` library, as presence log messages are informational and do not require color formatting.

---

### Requirement 18: Normalize unreadHelper Exports

**User Story:** As a backend engineer, I want `unreadHelper.ts` to use a single export style so that consumers import functions consistently without mixing named and namespace imports.

#### Acceptance Criteria

1. THE unreadHelper module SHALL export all functions (`getUnreadCountCached`, `setUnreadCount`, `incrementUnreadCount`, `clearUnreadCount`, `batchGetUnreadCounts`) as named exports only.
2. THE unreadHelper module SHALL NOT export the `UnreadHelper` namespace object.
3. WHEN existing callers import from `unreadHelper`, THE callers SHALL use named imports (e.g., `import { setUnreadCount } from '../../helpers/unreadHelper'`).

---

### Requirement 19: Remove Unused userId Validation in getHistory

**User Story:** As a backend engineer, I want the `userId` parameter in `getHistory` to be used in the participant authorization check (Requirement 6) rather than validated but ignored in the query so that the validation has a functional purpose.

#### Acceptance Criteria

1. THE MessageService `getHistory` function SHALL use the validated `userId` in the participant authorization check introduced by Requirement 6.
2. THE MessageService `getHistory` function SHALL NOT validate `userId` as an ObjectId and then discard it without using it in any query or authorization check.

---

### Requirement 20: Remove global.io References from MessageService

**User Story:** As a backend engineer, I want all `global.io` references removed from `message.service.ts` so that socket emission always goes through the typed `SocketManager` singleton and no code path relies on the deprecated global pattern.

#### Acceptance Criteria

1. THE MessageService SHALL NOT contain any expression that reads from or writes to `global.io`.
2. WHEN socket emission is required inside MessageService, THE MessageService SHALL obtain the `Server` instance exclusively via `SocketManager.getIO()`.
3. THE MessageService SHALL NOT assign the Socket.IO server instance to `global.io` at any point during initialization or runtime.
