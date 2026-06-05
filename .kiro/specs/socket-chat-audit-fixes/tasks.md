# Implementation Plan: socket-chat-audit-fixes

## Overview

Fix all 20 findings from the socket/chat audit across five logical areas: migrate process-local `NodeCache` state to Redis, remove dead code, correct socket event semantics, harden authorization, and clean up configuration and code quality issues. All changes are in TypeScript and use the existing `ioredis` client — no new dependencies.

---

## Tasks

- [x] 1. State migration — presenceHelper + typingThrottle → Redis
  - [x] 1.1 Rewrite `presenceHelper.ts` to use Redis
    - Replace the entire `NodeCache`-based implementation with `ioredis` calls
    - `setOnline`: `SADD presence:online {userId}` + `SET presence:lastActive:{userId} Date.now()`
    - `setOffline`: `SREM presence:online {userId}` + `SET presence:lastActive:{userId} Date.now()`
    - `isOnline`: `SISMEMBER presence:online {userId}` → return `result === 1`
    - `getLastActive`: `GET presence:lastActive:{userId}` → parse int or return `undefined`
    - `addUserRoom` / `removeUserRoom`: `SADD` / `SREM` on `presence:userRooms:{userId}`
    - `getUserRooms`: `SMEMBERS presence:userRooms:{userId}` → string array
    - `clearUserRooms`: `DEL presence:userRooms:{userId}`
    - `incrConnCount`: `INCR presence:connCount:{userId}` → return result
    - `decrConnCount`: `DECR presence:connCount:{userId}`; if result < 0 set key to `'0'` and return 0
    - `getConnCount`: `GET presence:connCount:{userId}` → parse int, default 0
    - Remove `NodeCache` import and instantiation entirely (Req 1.15)
    - Remove `colors` import — presence logs are informational, no color needed (Req 17.3)
    - Keep all exported function signatures identical so callers need no changes
    - _Requirements: 1.1–1.15, 17.3_

  - [ ]* 1.2 Write property tests for presenceHelper Redis migration
    - Use `ioredis-mock` for a fast, deterministic Redis substitute
    - **Property 1: Presence online round-trip** — `setOnline` then `isOnline` returns `true`; `setOffline` then `isOnline` returns `false`
    - **Validates: Requirements 1.1, 1.5, 1.6, 1.7**
    - **Property 2: lastActive is set on state change** — after `setOnline` or `setOffline`, `getLastActive` returns a value ≥ the timestamp recorded before the call
    - **Validates: Requirements 1.2, 1.5, 1.6, 1.8**
    - **Property 3: User-room membership round-trip** — `addUserRoom` then `getUserRooms` includes chatId; `removeUserRoom` then `getUserRooms` excludes chatId
    - **Validates: Requirements 1.3, 1.9, 1.10, 1.11**
    - **Property 4: clearUserRooms empties membership** — after adding N rooms and calling `clearUserRooms`, `getUserRooms` returns `[]`
    - **Validates: Requirements 1.12**
    - **Property 5: Connection count monotonicity and floor** — N `incrConnCount` calls yield count N; `decrConnCount` on count 0 returns 0, never negative
    - **Validates: Requirements 1.4, 1.13, 1.14**
    - Minimum 100 iterations per property with randomly generated userId / chatId strings

  - [x] 1.3 Replace `NodeCache` typing throttle in `socketHelper.ts` with Redis `SET NX`
    - Remove `import NodeCache from 'node-cache'` and the `typingThrottle` instantiation
    - In `TYPING_START` handler: replace `typingThrottle.has(key)` / `typingThrottle.set(key, 1, TTL)` with `await redisClient.set(key, '1', 'EX', TYPING_TTL_SECONDS, 'NX')`; suppress broadcast when result is `null`, proceed when result is `'OK'`
    - In `TYPING_STOP` handler: replace `typingThrottle.del(key)` with `await redisClient.del(TYPING_KEY(chatId, userId))`
    - `TYPING_KEY` helper already defined — no change needed
    - _Requirements: 2.1–2.6_

  - [ ]* 1.4 Write property tests for Redis typing throttle
    - Use `ioredis-mock`; mock time to control the 5-second TTL window
    - **Property 6: Typing throttle suppresses duplicates within window** — two `TYPING_START` events within 5 s result in exactly one broadcast; the second is suppressed
    - **Validates: Requirements 2.2, 2.3, 2.4**
    - **Property 7: TYPING_STOP clears throttle** — `TYPING_START` → `TYPING_STOP` → `TYPING_START` results in two broadcasts (throttle was cleared)
    - **Validates: Requirements 2.5**
    - Minimum 100 iterations per property

- [x] 2. Dead-code removal — 6 legacy methods + logEvent helper
  - [x] 2.1 Delete legacy methods from `message.service.ts`
    - Remove function bodies and declarations for: `sendMessageToDB`, `markChatAsRead`, `getMessageFromDB`, `markAsDelivered`
    - Update the export object to: `export const MessageService = { send, getHistory, markRead, getUnreadCount };`
    - Verify no remaining `global.io` references exist in the file after removal (Req 20)
    - _Requirements: 3.1–3.4, 3.7–3.8, 20.1–20.3_

  - [x] 2.2 Delete legacy methods from `chat.service.ts`
    - Remove function bodies and declarations for: `createChatToDB`, `getChatFromDB`
    - Update the export object to: `export const ChatService = { createOrGet, getList };`
    - _Requirements: 3.5–3.6, 3.9_

  - [x] 2.3 Remove `logEvent` helper and inline all call sites in `socketHelper.ts`
    - Delete the `logEvent` function definition at the bottom of the file
    - Replace every `logEvent(event, extra)` call with `logger.info(\`🔔 Event processed: ${event} ${extra || ''}\`)`
    - Replace `handleEventProcessed(event, extra)` inline: `updateLastActive(userId).catch(() => {}); logger.info(\`🔔 Event processed: ${event} ${extra || ''}\`)`
    - Remove the `handleEventProcessed` helper function
    - _Requirements: 16.1–16.2_

- [x] 3. Event correctness — MESSAGE_SENT single-emit, DELIVERED_ACK no DB write, READ_ACK → MESSAGES_READ
  - [x] 3.1 Fix `MESSAGE_SENT` double-delivery in `message.service.ts` `send()`
    - Remove the `for (const participantId of participantIds)` loop that emits to `user::{participantId}` rooms
    - Keep only: `io.to(\`chat::${chatId}\`).emit('MESSAGE_SENT', { message: populatedMessage })`
    - The `CHAT_UPDATED` event (already emitted to user rooms) handles clients not yet in the chat room
    - _Requirements: 4.1–4.3_

  - [ ]* 3.2 Write property test for MESSAGE_SENT single-emit
    - Mock `SocketManager.getIO()` to capture all `.to(...).emit(...)` calls
    - **Property 8: MESSAGE_SENT emits to chat room only** — for any valid send, `MESSAGE_SENT` is emitted exactly once to `chat::{chatId}` and zero times to any `user::{id}` room
    - **Validates: Requirements 4.1, 4.2**
    - Minimum 100 iterations with random chatId, senderId, text

  - [x] 3.3 Fix `DELIVERED_ACK` handler in `socketHelper.ts` — remove DB write
    - Remove the `Message.findByIdAndUpdate(messageId, { $addToSet: { deliveredTo: userId } }, ...)` call
    - After the participant check passes, emit `MESSAGE_DELIVERED` directly using the already-fetched `found` document: `io.to(CHAT_ROOM(String(found.chatId))).emit('MESSAGE_DELIVERED', { messageId: String(found._id), chatId: String(found.chatId), userId })`
    - Inline the log call replacing `handleEventProcessed`
    - _Requirements: 5.1–5.4_

  - [ ]* 3.4 Write property test for DELIVERED_ACK no mutation
    - Mock `Message.findById` to return a known document; mock `Message.findByIdAndUpdate` to track calls
    - **Property 9: DELIVERED_ACK does not mutate Message document** — for any valid messageId where the user is a participant, `findByIdAndUpdate` is never called and `MESSAGE_DELIVERED` is emitted with the correct shape
    - **Validates: Requirements 5.1, 5.2**
    - Minimum 100 iterations with random messageId and userId

  - [x] 3.5 Fix `READ_ACK` handler in `socketHelper.ts` — emit `MESSAGES_READ` (plural)
    - Change `io.to(...).emit('MESSAGE_READ', ...)` to `io.to(...).emit('MESSAGES_READ', ...)`
    - Update payload to match `markRead` shape: `{ chatId: String(msg.chatId), userId, updatedIds: [String(msg._id)] }`
    - _Requirements: 8.1–8.2_

  - [ ]* 3.6 Write property test for READ_ACK emits MESSAGES_READ
    - Mock socket `io.to(...).emit` to capture event name and payload
    - **Property 12: READ_ACK emits MESSAGES_READ with correct payload** — event name is exactly `'MESSAGES_READ'` (plural); payload contains `chatId`, `userId`, and `updatedIds` as an array with the messageId
    - **Validates: Requirements 8.1, 8.2**
    - Minimum 100 iterations with random messageId and userId

- [ ] 4. Authorization hardening — getHistory + JOIN_CHAT participant checks
  - [x] 4.1 Add participant authorization to `getHistory` in `message.service.ts`
    - After the `userId` ObjectId validation, add: `const isParticipant = await Chat.exists({ _id: chatId, participants: userId }); if (!isParticipant) throw new ApiError(StatusCodes.FORBIDDEN, 'You are not a participant of this chat');`
    - This satisfies Req 19 — `userId` is now used in an authorization check rather than validated and discarded
    - _Requirements: 6.1–6.3, 19.1–19.2_

  - [ ]* 4.2 Write property test for getHistory participant authorization
    - Mock `Chat.exists` to return falsy for non-member userIds
    - **Property 10: getHistory rejects non-participants** — for any chatId and userId not in participants, `getHistory` throws `ApiError` with HTTP status 403
    - **Validates: Requirements 6.1, 6.2, 19.1**
    - Minimum 100 iterations with random chatId and non-member userId

  - [x] 4.3 Add participant authorization to `JOIN_CHAT` handler in `socketHelper.ts`
    - At the top of the `JOIN_CHAT` handler (after the `!chatId` guard), add: `const isParticipant = await Chat.exists({ _id: chatId, participants: userId }); if (!isParticipant) { socket.emit('ACK_ERROR', { message: 'You are not a participant of this chat', chatId }); return; }`
    - The existing `socket.join`, `addUserRoom`, and `USER_ONLINE` broadcast logic follows unchanged
    - _Requirements: 7.1–7.3_

  - [ ]* 4.4 Write property test for JOIN_CHAT participant authorization
    - Mock `Chat.exists` to return falsy; mock `socket.emit` and `socket.join` to track calls
    - **Property 11: JOIN_CHAT rejects non-participants** — for any chatId and userId not in participants, `ACK_ERROR` is emitted to the socket and `socket.join` is never called
    - **Validates: Requirements 7.1, 7.2**
    - Minimum 100 iterations with random chatId and non-member userId

- [x] 5. Config and code quality — CORS, init order, static imports, compound cursor, rate limiting, export normalization, text maxlength, getList DB sort
  - [x] 5.1 Fix Socket.IO CORS configuration in `server.ts`
    - Import `allowedOrigins` from `'./app/logging/corsLogger'`
    - Replace `origin: '*'` with `origin: allowedOrigins` in the `Server` constructor options
    - Add `methods: ['GET', 'POST'], credentials: true` to the cors options block
    - _Requirements: 11.1–11.3_

  - [x] 5.2 Move Socket.IO initialization outside the `listen` callback in `server.ts`
    - Change `server = app.listen(port, host, callback)` to `server = app.listen(port, host)` (no inline callback)
    - Immediately after that line, construct `const io = new Server(server, { ... })`, call `socketHelper.socket(io)` and `SocketManager.init(io)`
    - Move the startup summary logging and spinner calls into a `server.on('listening', () => { ... })` handler
    - `SocketManager.getIO()` is now callable before the `'listening'` event fires
    - _Requirements: 14.1–14.3_

  - [x] 5.3 Replace `try/require` stubs with static imports in `socketHelper.ts`
    - Remove all three `try { require(...) } catch { ... }` blocks for `Message`, `Chat`, and `SupportTicket`
    - Add static imports at the top of the file:
      ```typescript
      import { Message } from '../app/modules/message/message.model';
      import { Chat } from '../app/modules/chat/chat.model';
      import { SupportTicket } from '../app/modules/support-ticket/support-ticket.model';
      ```
    - _Requirements: 15.1–15.4_

  - [x] 5.4 Implement compound cursor in `getHistory` in `message.service.ts`
    - Add `encodeCursor(createdAt: Date, id: string): string` — `Buffer.from(\`${createdAt.toISOString()}_${id}\`).toString('base64')`
    - Add `decodeCursor(cursor: string): { ts: Date; id: string }` — base64 decode, split on first `_`, validate timestamp and ObjectId; throw `ApiError` 400 `'Invalid cursor'` on any parse failure
    - Replace the existing single-field `createdAt: { $gt: cursorDate }` filter with the compound `$or` query: `[{ createdAt: { $gt: ts } }, { createdAt: ts, _id: { $gt: new mongoose.Types.ObjectId(id) } }]`
    - Update `.sort({ createdAt: 1 })` to `.sort({ createdAt: 1, _id: 1 })`
    - Update `nextCursor` to use `encodeCursor(lastMsg.createdAt, String(lastMsg._id))`
    - _Requirements: 13.1–13.4_

  - [ ]* 5.5 Write property test for compound cursor pagination completeness
    - Seed an in-memory MongoDB (e.g., `mongodb-memory-server`) with message sets that include timestamp collisions
    - **Property 16: Compound cursor pagination is complete and non-duplicating** — paginating through all pages yields each message exactly once; no message is skipped or duplicated even when multiple messages share the same `createdAt` millisecond
    - **Validates: Requirements 13.1, 13.2, 13.3**
    - Minimum 100 iterations with random message counts and timestamp distributions

  - [x] 5.6 Add `isRateLimited` helper and apply rate limits in `socketHelper.ts`
    - Add the helper function:
      ```typescript
      const isRateLimited = async (event: string, userId: string, limit: number, windowSeconds: number): Promise<boolean> => {
        const key = `ratelimit:${event}:${userId}`;
        const count = await redisClient.incr(key);
        if (count === 1) await redisClient.expire(key, windowSeconds);
        return count > limit;
      };
      ```
    - Apply at the top of `SEND_MESSAGE` / `MESSAGE_SENT`-triggering handler: `isRateLimited('MESSAGE_SENT', userId, 30, 60)`
    - Apply at the top of `TYPING_START` handler: `isRateLimited('TYPING_START', userId, 60, 60)`
    - Apply at the top of `READ_ACK` handler: `isRateLimited('READ_ACK', userId, 60, 60)`
    - On limit exceeded: `socket.emit('ACK_ERROR', { message: 'Rate limit exceeded', event: '<eventName>' }); return;`
    - _Requirements: 12.1–12.5_

  - [ ]* 5.7 Write property test for rate limiting
    - Mock `redisClient.incr` and `redisClient.expire` with an in-memory counter
    - **Property 15: Rate limit rejects events beyond threshold** — after the per-event limit is reached within the window (30 for `MESSAGE_SENT`, 60 for `TYPING_START`, 60 for `READ_ACK`), the next event emits `ACK_ERROR { message: 'Rate limit exceeded', event }` and the handler does not proceed
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
    - Minimum 100 iterations with random userId and event type

  - [x] 5.8 Normalize `unreadHelper.ts` exports — remove namespace object
    - Delete the `export const UnreadHelper = { ... }` block at the bottom of the file
    - All five functions (`getUnreadCountCached`, `setUnreadCount`, `incrementUnreadCount`, `clearUnreadCount`, `batchGetUnreadCounts`) remain as named exports
    - Verify all callers already use named imports (no `UnreadHelper.x` references in the codebase)
    - _Requirements: 18.1–18.3_

  - [x] 5.9 Fix `text` field `maxlength` in `message.model.ts`
    - Change `maxlength: 4000` to `maxlength: 10000` on the `text` field
    - The `send()` service function already validates at 10000 — schema and service are now consistent
    - _Requirements: 9.1–9.3_

  - [ ]* 5.10 Write property test for text length validation consistency
    - **Property 13: Text length validation is consistent at 10000** — for any text with `length > 10000`, `MessageService.send()` throws `ApiError` 400; for any text with `length <= 10000`, the length check does not throw
    - **Validates: Requirements 9.2, 9.3**
    - Minimum 100 iterations with randomly generated text strings of varying length

  - [x] 5.11 Move sort to DB query in `ChatService.getList`
    - Add `.sort({ 'lastMessage.createdAt': -1 })` to the `Chat.find(...)` chain, before `.populate(...)` and `.lean()`
    - Remove the JavaScript `chats.sort((a, b) => { ... })` block that follows the query
    - MongoDB sorts `null` values last in descending order — no application-layer special-casing needed
    - _Requirements: 10.1–10.3_

  - [ ]* 5.12 Write property test for getList descending sort order
    - Mock `Chat.find(...).sort(...).populate(...).lean()` to return chats with controlled `lastMessage.createdAt` values
    - **Property 14: getList returns chats in descending lastMessage order** — for any userId with multiple chats having different `lastMessage.createdAt` values, the result is ordered descending; chats with `null` lastMessage appear last
    - **Validates: Requirements 10.1, 10.3**
    - Minimum 100 iterations with random sets of chats and timestamps

  - [x] 5.13 Standardize `colors` usage in `socketHelper.ts`
    - Remove `colors.blue(...)` and `colors.green(...)` from routine informational log messages
    - Keep `colors.yellow(...)` for warnings and `colors.red(...)` for errors
    - _Requirements: 17.1–17.2_

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `ioredis-mock` for Redis and `mongodb-memory-server` for MongoDB — no real network calls
- Tasks 1.1 and 1.3 must be completed before any property tests in area 1 can run
- Tasks 2.1 and 2.2 (dead-code removal) are independent of each other and can be done in parallel
- Task 5.2 (init order) depends on 5.1 (CORS) since both touch the `Server` constructor call in `server.ts`
- Task 5.4 (compound cursor) depends on 4.1 (participant auth in `getHistory`) since both modify the same function
- The `logEvent` removal (2.3) and static imports (5.3) are both in `socketHelper.ts` — do them in the same editing pass to avoid conflicts

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "2.2", "5.3", "5.8", "5.9", "5.13"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.3", "3.1", "4.1", "5.1", "5.11"] },
    { "id": 2, "tasks": ["1.4", "3.2", "3.3", "4.3", "5.2", "5.4", "5.6", "5.10", "5.12"] },
    { "id": 3, "tasks": ["3.4", "3.5", "4.2", "4.4", "5.5", "5.7"] },
    { "id": 4, "tasks": ["3.6"] }
  ]
}
```
