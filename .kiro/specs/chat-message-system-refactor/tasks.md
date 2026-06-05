# Implementation Plan: Chat Message System Refactor

## Overview

Refactor the existing chat and message modules into a clean, industry-standard 1-on-1 messaging system. The plan proceeds in layers: shared infrastructure first (Redis client, SocketManager), then data models, then service logic, then socket wiring, and finally test coverage. Each step builds on the previous so there is no orphaned code.

## Tasks

- [x] 1. Set up shared infrastructure
  - [x] 1.1 Create `src/shared/redisClient.ts` — export a shared ioredis instance reading `config.redis_url`
    - Replace any existing `node-cache`-based unread helper with this shared client
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 1.2 Create `src/helpers/socketManager.ts` — implement the typed `SocketManager` singleton with `init(io)` and `getIO()` methods
    - `getIO()` must throw if called before `init()`
    - _Requirements: 8.5, 8.6_
  - [x] 1.3 Update `src/server.ts` (or equivalent entry point) to call `SocketManager.init(io)` after the Socket.io server is created and remove all `global.io` assignments
    - _Requirements: 8.5_

- [x] 2. Refactor Chat data model
  - [x] 2.1 Update `src/app/modules/chat/chat.interface.ts` — define `ILastMessage` and `IChat` types; remove the `status` boolean field
    - _Requirements: 1.1, 1.2_
  - [x] 2.2 Update `src/app/modules/chat/chat.model.ts` — implement `lastMessageSchema` sub-document (text max 2000 chars, sender ref, createdAt), update `chatSchema` to include `lastMessage` (default `null`), remove `status` field, ensure `{ participants: 1 }` index exists
    - _Requirements: 1.1, 1.2, 1.4_

- [x] 3. Refactor Message data model
  - [x] 3.1 Update `src/app/modules/message/message.interface.ts` — define `IMessage` with `chatId`, `sender`, `text?`, `type`, `attachments` (max 10), `readBy` (max 1000), timestamps; remove `deliveredTo`, `status`, `editedAt`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 3.2 Update `src/app/modules/message/message.model.ts` — remove `pre('find')` and `pre('findOne')` auto-populate hooks, remove `deliveredTo`/`status`/`editedAt` fields, add Mongoose custom validator requiring `text` to be present and non-empty when `type === 'text'`, ensure `{ chatId: 1, createdAt: -1 }` index exists
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 4. Implement ChatService
  - [x] 4.1 Implement `createOrGet(userId, otherUserId)` in `src/app/modules/chat/chat.service.ts`
    - Validate both IDs as valid ObjectIds (throw 400 if invalid)
    - Throw 400 if `userId === otherUserId`
    - Throw 404 if `otherUserId` does not exist in the User collection
    - Use `findOne({ participants: { $all: [userId, otherUserId] } })` to find existing chat; create if not found
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 4.2 Write property test for `createOrGet` idempotency (Property 1)
    - **Property 1: createOrGet is idempotent**
    - **Validates: Requirements 3.1, 3.2**
  - [ ]* 4.3 Write property test for `createOrGet` commutativity (Property 2)
    - **Property 2: createOrGet is commutative**
    - **Validates: Requirements 3.1**
  - [ ]* 4.4 Write property test for invalid ObjectId rejection in ChatService (Property 3)
    - **Property 3: Invalid ObjectId inputs are rejected before any database query**
    - **Validates: Requirements 3.5, 4.7**
  - [x] 4.5 Implement `getList(userId, search?)` in `src/app/modules/chat/chat.service.ts`
    - Validate `userId` as a valid ObjectId (throw 400 if invalid)
    - Single `Chat.find({ participants: userId })` with explicit `.populate('participants', '_id name image role')`
    - Sort by `lastMessage.createdAt` descending; null `lastMessage` sorts last
    - Batch-fetch all unread counts via single Redis `MGET`; return `0` on any Redis error (log with `errorLogger`)
    - Apply optional case-insensitive `search` filter on the other participant's `name`
    - Return empty array when no chats found
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 11.4_
  - [ ]* 4.6 Write property test for `getList` unread counts non-negative (Property 12)
    - **Property 12: getList unread counts are always non-negative integers**
    - **Validates: Requirements 4.3, 4.4, 9.3, 9.5, 10.2**

- [x] 5. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement MessageService — send
  - [x] 6.1 Implement `send(chatId, senderId, payload)` in `src/app/modules/message/message.service.ts`
    - Validate `chatId` and `senderId` as valid ObjectIds (throw 400 if invalid)
    - Fetch Chat; throw 404 if not found, 403 if `senderId` not in `participants`
    - Validate payload: throw 400 if no non-empty `text` and no attachments; throw 400 if `text` > 10,000 chars; throw 400 if attachments > 10
    - Save Message with `Message.create()`; explicitly `.populate('sender', '_id name profilePicture')` on the returned document
    - Atomically update `Chat.lastMessage` via `findByIdAndUpdate`; re-throw on failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.11, 10.3, 10.4, 11.2_
  - [x] 6.2 Add side-effect logic to `send`: socket emission, Redis unread increment, push notification dispatch
    - Emit `MESSAGE_SENT` to `chat::{chatId}` room via `SocketManager.getIO()`
    - Read `active:{receiverId}:chat` from Redis to determine routing
    - If receiver's active chat equals `chatId`: no push, no `CHAT_UPDATED`
    - If receiver's active chat is a different chatId: emit `CHAT_UPDATED` to `user::{receiverId}` room
    - If key absent: send push notification with 60-second deduplication via `notif:dedup:{chatId}:{receiverId}` Redis key
    - Increment `unread:{chatId}:{receiverId}` in Redis
    - Wrap all side effects in individual try/catch; log errors with `errorLogger`; never propagate
    - _Requirements: 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 9.1, 10.1_
  - [ ]* 6.3 Write property test for `send` rejecting empty content (Property 4)
    - **Property 4: send rejects all forms of empty content**
    - **Validates: Requirements 5.3, 5.4, 5.5**
  - [ ]* 6.4 Write property test for `send` updating lastMessage and unread count (Property 5)
    - **Property 5: send updates Chat.lastMessage and increments receiver unread count**
    - **Validates: Requirements 5.11, 9.1, 1.3**
  - [ ]* 6.5 Write property test for `send` notification routing (Property 6)
    - **Property 6: send notification routing follows active-chat state**
    - **Validates: Requirements 5.8, 5.9, 5.10**
  - [ ]* 6.6 Write property test for `send` side-effect failure isolation (Property 7)
    - **Property 7: send side-effect failures do not suppress the saved message**
    - **Validates: Requirements 5.12, 10.1**
  - [ ]* 6.7 Write property test for invalid ObjectId rejection in MessageService (Property 3 — message side)
    - **Property 3: Invalid ObjectId inputs are rejected before any database query**
    - **Validates: Requirements 5.1 (ObjectId path), 10.4**

- [x] 7. Implement MessageService — getHistory
  - [x] 7.1 Implement `getHistory(chatId, userId, cursor?, limit?)` in `src/app/modules/message/message.service.ts`
    - Validate `chatId` and `userId` as valid ObjectIds (throw 400 if invalid)
    - Clamp `limit` to 1–100; default to 20
    - Build query: `{ chatId }` plus `{ createdAt: { $gt: cursor } }` when cursor provided
    - Sort ascending by `createdAt`; explicitly `.populate('sender', '_id name profilePicture')`
    - Return `{ messages, pagination: { total, limit, hasNextPage, nextCursor } }`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 11.3_
  - [ ]* 7.2 Write property test for `getHistory` cursor pagination consistency (Property 8)
    - **Property 8: getHistory cursor pagination is consistent and complete**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.5**
  - [ ]* 7.3 Write property test for `getHistory` limit clamping (Property 9)
    - **Property 9: getHistory limit is always clamped to the valid range**
    - **Validates: Requirements 6.2**

- [x] 8. Implement MessageService — markRead
  - [x] 8.1 Implement `markRead(chatId, userId)` in `src/app/modules/message/message.service.ts`
    - Validate `chatId` and `userId` as valid ObjectIds (throw 400 if invalid)
    - Verify `userId` is a participant of the Chat; throw 403 if not
    - Query for Message IDs where `sender !== userId` and `readBy` does not contain `userId`
    - Perform single `updateMany` using those IDs to `$addToSet: { readBy: userId }`
    - If `modifiedCount === 0`, return `{ modifiedCount: 0, updatedIds: [] }` without emitting socket event
    - Set `unread:{chatId}:{userId}` to `0` in Redis; log error with `errorLogger` if Redis fails
    - Emit `MESSAGES_READ` to `chat::{chatId}` room with `{ chatId, userId, updatedIds }`
    - Return `{ modifiedCount, updatedIds }`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 9.2, 10.5_
  - [ ]* 8.2 Write property test for `markRead` only affecting others' messages (Property 10)
    - **Property 10: markRead only adds userId to readBy for messages sent by others**
    - **Validates: Requirements 7.1, 7.8**
  - [ ]* 8.3 Write property test for `markRead` resetting unread count to zero (Property 11)
    - **Property 11: markRead resets unread count to zero**
    - **Validates: Requirements 7.4, 9.2**

- [x] 9. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 10. Refactor socket event handlers
  - [x] 10.1 Update `src/helpers/socketHelper.ts` (or equivalent) — implement `JOIN_CHAT` handler
    - Ignore event if `chatId` is absent or empty string
    - Write `active:{userId}:chat = chatId` to Redis with 3600-second TTL (overwrite any existing key)
    - Join the socket to room `chat::{chatId}`
    - _Requirements: 8.1, 8.2_
  - [x] 10.2 Implement `LEAVE_CHAT` handler — delete `active:{userId}:chat` from Redis; leave room `chat::{chatId}`
    - _Requirements: 8.3_
  - [x] 10.3 Implement `disconnect` handler — delete `active:{userId}:chat` from Redis
    - _Requirements: 8.4_

- [x] 11. Wire controllers and routes
  - [x] 11.1 Update `src/app/modules/chat/chat.controller.ts` — wire `createOrGet` and `getList` to their HTTP routes; ensure all `global.io` references are replaced with `SocketManager.getIO()`
    - _Requirements: 3.1, 4.1_
  - [x] 11.2 Update `src/app/modules/message/message.controller.ts` — wire `send`, `getHistory`, and `markRead` to their HTTP routes; replace any remaining `global.io` references
    - _Requirements: 5.1, 6.1, 7.1_

- [x] 12. Write unit tests
  - [x]* 12.1 Write unit tests for `ChatService`
    - `createOrGet` with `userId === otherUserId` → 400
    - `createOrGet` with non-existent `otherUserId` → 404
    - `getList` returns empty array when no chats exist
    - _Requirements: 3.3, 3.4, 4.8_
  - [x]* 12.2 Write unit tests for `MessageService`
    - `send` with non-existent `chatId` → 404
    - `send` with sender not in participants → 403
    - `getHistory` with invalid ObjectId → 400
    - `markRead` with user not a participant → 403
    - `markRead` with no unread messages → `{ modifiedCount: 0, updatedIds: [] }`, no socket event
    - _Requirements: 5.1, 5.2, 6.6, 7.2, 7.5_
  - [x]* 12.3 Write unit tests for `SocketManager`
    - `getIO()` before `init()` → throws
    - `JOIN_CHAT` with empty `chatId` → no Redis write
    - _Requirements: 8.2, 8.6_

- [x] 13. Write integration tests
  - [x]* 13.1 Write integration test for full `send` → `getHistory` round-trip using `mongodb-memory-server`
    - _Requirements: 5.6, 6.1, 6.4_
  - [x]* 13.2 Write integration test for `markRead` resetting Redis unread count to `0`
    - _Requirements: 7.4, 9.2_
  - [x]* 13.3 Write integration test for `getList` returning `unreadCount: 0` when Redis is unavailable (mock ioredis to throw)
    - _Requirements: 4.4, 9.5, 10.2_

- [x] 14. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `@fast-check/vitest` with a minimum of 100 iterations per property
- Unit tests use Vitest with `mongodb-memory-server` for DB-touching tests
- Redis is mocked with `ioredis-mock` or a manual Vitest mock in unit/property tests
- `SocketManager.getIO()` is mocked in unit tests; real Socket.io client used in integration tests
- Run tests with `npm run test:run` (single-pass, no watch mode)
- The `presenceHelper.ts` (online/offline tracking) continues to use `node-cache` — do not migrate it

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2"] },
    { "id": 3, "tasks": ["4.1", "7.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5", "6.1"] },
    { "id": 5, "tasks": ["4.6", "6.2", "8.1"] },
    { "id": 6, "tasks": ["6.3", "6.4", "6.5", "6.6", "6.7", "7.2", "7.3", "8.2", "8.3"] },
    { "id": 7, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 8, "tasks": ["11.1", "11.2"] },
    { "id": 9, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 10, "tasks": ["13.1", "13.2", "13.3"] }
  ]
}
```
