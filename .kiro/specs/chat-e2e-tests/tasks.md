# Implementation Plan: chat-e2e-tests

## Overview

This plan breaks down the implementation of `src/app/modules/chat/__tests__/chat.e2e.spec.ts` — a comprehensive, flow-based E2E test suite for the Chat module — into 9 sequential tasks. Each task is independently executable and maps directly to requirements and design sections.

The test file exercises the full chat lifecycle: connection establishment → chat creation → message exchange → read receipts → notification routing → connection removal. It uses supertest, MongoMemoryReplSet, and carefully controlled mocks for Firebase, Redis, and Socket.io, following the same patterns established in `connection.e2e.spec.ts`.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1"]
    },
    {
      "wave": 2,
      "tasks": ["2"]
    },
    {
      "wave": 3,
      "tasks": ["3"]
    },
    {
      "wave": 4,
      "tasks": ["4", "5", "6", "7", "8"]
    },
    {
      "wave": 5,
      "tasks": ["9"]
    }
  ]
}
```

## Tasks

- [x] 1. Create the test file skeleton with infrastructure setup
  - Create `src/app/modules/chat/__tests__/chat.e2e.spec.ts` with the full import block (vitest, mongoose, crypto, mongodb-memory-server, supertest, app, User/Connection/Chat/Message/Notification models, jwtHelper, config, Secret, USER_ROLES/USER_STATUS, logApi, SocketManager, pushNotificationHelper, redisClient).
  - Add the two hoisted `vi.mock` calls at the top of the file (before imports): one for `../../notification/pushNotificationHelper` stubbing `sendPushNotification` and `sendPushNotifications` to `Promise.resolve(undefined)`, and one for `../../../../shared/redisClient` with defaults `get → null`, `set → 'OK'`, `del → 1`, `mget → []`, `on → vi.fn()`.
  - Declare the module-level `let replSet: MongoMemoryReplSet` variable.
  - Implement `beforeAll`: create `MongoMemoryReplSet` with `{ replSet: { count: 1 } }`, connect Mongoose via `mongoose.connect(replSet.getUri())`.
  - Implement `afterAll`: `await mongoose.disconnect()` then `await replSet.stop()`.
  - Implement `beforeEach`: (a) delete all documents from `Connection`, `Notification`, `Message`, `Chat`, `User` in that order; (b) call `vi.clearAllMocks()`; (c) create `mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() }`, assign to `(global as any).io`, and call `SocketManager.init(mockIo as any)`.
  - Add the top-level `describe('Chat E2E Tests', () => { })` block.
  - Add a nested `describe('Infrastructure & Helpers', ...)` block with three placeholder `it` stubs: `'mongoose is connected after beforeAll'`, `'mocks are in place'`, `'beforeEach clears all collections'`.
  - **References**: Requirements 1.1–1.8; Design §Infrastructure Stack, §ReplSet Lifecycle, §beforeEach Pattern, §Mock Strategy.

- [x] 2. Implement the four test helper functions
  - Implement `createAuthUser(role = USER_ROLES.BROTHER, nameSuffix = 'user')`: creates a `User` document with all required fields (`name`, `role`, `email` via `randomUUID()`, `password`, `isVerified: true`, `status: USER_STATUS.ACTIVE`, `revertDate`, `dateOfBirth`, `profileImage`, `verificationImage`, `verificationVideo`, `tokenVersion: 0`), signs a JWT with `config.jwt.jwt_secret` and `'1h'` expiry, returns `{ user, token }`.
  - Implement `setupPendingConnection()`: calls `createAuthUser` twice for `userA` and `userB`, calls `POST /api/v1/connections` as `userA` with `{ receiverId: userB._id.toString() }`, throws `Error('setupPendingConnection failed: ...')` if `res.status !== 201` or `res.body.data?.id` is falsy, returns `{ userA, tokenA, userB, tokenB, connectionId }`.
  - Implement `setupAcceptedConnection()`: calls `setupPendingConnection()`, calls `POST /api/v1/connections/:connectionId/accept` as `userB`, throws `Error('setupAcceptedConnection failed: ...')` if `res.status !== 200` or `res.body.data?.chatId` is falsy, returns `{ userA, tokenA, userB, tokenB, connectionId, chatId }`.
  - Implement `setupChatWithMessages(n: number)`: calls `setupAcceptedConnection()`, sends `n` messages from `userA` via `POST /api/v1/messages` with `{ chatId, text: \`Message \${i}\`, type: 'text' }` for `i = 1..n`, asserts each returns `201`, returns `{ userA, tokenA, userB, tokenB, connectionId, chatId, messages }` where `messages` is the array of `res.body.data` objects.
  - Fill in the three `Infrastructure & Helpers` test stubs from Task 1: verify `mongoose.connection.readyState === 1`, verify `vi.isMockFunction(redisClient.get)` is true, verify all collections are empty at test start.
  - **References**: Requirements 2.1–2.6; Design §Helper Function Designs.

- [x] 3. Implement Flow 1 — Full Happy Path
  - Add `describe('Flow 1: Full Happy Path', ...)` inside the top-level describe.
  - Implement `it('connection accept → chat create → send message → get history → mark read', ...)` as a single sequential integration test:
    - Call `setupPendingConnection()` to get `{ userA, tokenA, userB, tokenB, connectionId }`.
    - Accept the connection as `userB` via `POST /api/v1/connections/:connectionId/accept`; assert `status 200`, `body.success true`, `body.data.status 'ACCEPTED'`, `body.data.chatId` non-null; capture `chatId`.
    - Assert `Chat.countDocuments({ participants: { $all: [userA._id, userB._id] } }) === 1`.
    - Assert `CONNECTION_ACCEPTED` socket event emitted to `user::${userA._id}` (Req 11.5).
    - Call `POST /api/v1/chats/:userB._id` as `userA`; assert `status 201` and `body.data._id === chatId` (idempotency, Req 3.3).
    - Call `POST /api/v1/chats/:userA._id` as `userB`; assert `status 201` and `body.data._id === chatId` (reverse idempotency, Req 3.4).
    - Call `GET /api/v1/chats` as `userA`; assert `status 200`, array length `1`, `body.data[0]._id === chatId`, `unreadCount === 0` (Req 3.5).
    - Call `GET /api/v1/chats` as `userB`; assert same (Req 3.6).
    - Send message `{ chatId, text: 'Hello from A', type: 'text' }` as `userA`; assert `status 201`, `body.data.text === 'Hello from A'`, `body.data.chatId === chatId` (Req 3.7).
    - Assert `io.to('chat::' + chatId)` called and `.emit('MESSAGE_SENT', ...)` with `text: 'Hello from A'` (Req 3.8, 11.1).
    - Assert `Chat.findById(chatId)` has `lastMessage.text === 'Hello from A'` and `lastMessage.sender.toString() === userA._id.toString()` (Req 3.9, 3.10).
    - Call `GET /api/v1/chats` as `userA`; assert `body.data[0].lastMessage.text === 'Hello from A'` (Req 3.10).
    - Override `redisClient.mget` with `mockResolvedValueOnce(['1'])`; call `GET /api/v1/chats` as `userB`; assert `body.data[0].unreadCount === 1` (Req 3.11).
    - Call `GET /api/v1/messages/chat/:chatId` as `userB`; assert `status 200`, array length `1`, `body.data[0].text === 'Hello from A'` (Req 3.12).
    - Call `POST /api/v1/messages/chat/:chatId/read` as `userB`; assert `status 200`, `modifiedCount === 1`, `updatedIds.length === 1` (Req 3.13).
    - Assert `io.to('chat::' + chatId)` called and `.emit('MESSAGES_READ', { chatId, userId: userB._id.toString(), updatedIds: ... })` (Req 3.14, 11.3).
    - Override `redisClient.mget` with `mockResolvedValueOnce(['0'])`; call `GET /api/v1/chats` as `userB`; assert `unreadCount === 0` (Req 3.15).
  - Use `logApi` for every HTTP call with tags following `FLOW1-STEP-DESCRIPTION` pattern.
  - **References**: Requirements 3.1–3.15, 10.1–10.3, 11.1, 11.3, 11.5; Design §Block 2, §Socket Assertion Pattern.

- [x] 4. Implement Flow 2 — Multi-Message Exchange and Cursor Pagination
  - Add `describe('Flow 2: Multi-Message Exchange and Cursor Pagination', ...)`.
  - Implement `it('5-message alternating exchange returns messages sorted ascending', ...)`:
    - Call `setupAcceptedConnection()`.
    - Send M1 (userA), M2 (userB), M3 (userA), M4 (userB), M5 (userA) via `POST /api/v1/messages`.
    - Call `GET /api/v1/messages/chat/:chatId` (no limit); assert `status 200`, array length `5`, `body.data[0].text === 'M1'`, `body.data[4].text === 'M5'`, ascending `createdAt` order (Req 4.1).
  - Implement `it('cursor pagination: page 1 of 3 returns correct meta', ...)`:
    - Use `setupChatWithMessages(5)`.
    - Call `GET /api/v1/messages/chat/:chatId?limit=2`; assert `status 200`, `body.data.length === 2`, `body.meta.total === 5`, `body.meta.limit === 2`, `body.meta.hasNextPage === true`, `body.meta.nextCursor` is a non-null non-empty string (Req 4.2).
  - Implement `it('cursor pagination: page 2 uses nextCursor from page 1', ...)`:
    - Use `setupChatWithMessages(5)`.
    - Fetch page 1 with `limit=2`, extract `cursor1 = body.meta.nextCursor`.
    - Fetch page 2 with `.query({ limit: 2, cursor: cursor1 })`; assert `body.data.length === 2`, no IDs overlap with page 1 (Req 4.3).
  - Implement `it('cursor pagination: page 3 is the last page', ...)`:
    - Use `setupChatWithMessages(5)`.
    - Paginate through pages 1 and 2 to get `cursor2`.
    - Fetch page 3 with `cursor2`; assert `body.data.length === 1`, `body.meta.hasNextPage === false`, `body.meta.nextCursor === null`.
    - Collect all IDs across 3 pages; assert `new Set(allIds).size === allIds.length === 5` (Req 4.4).
  - Implement `it('bulk mark-read: modifiedCount matches sender B message count', ...)`:
    - Use `setupAcceptedConnection()`, send M1 (A), M2 (B), M3 (A), M4 (B), M5 (A).
    - Call `POST /api/v1/messages/chat/:chatId/read` as `userA`; assert `modifiedCount === 2`, `updatedIds.length === 2` (Req 4.5).
  - Implement `it('mark-read excludes own messages from readBy', ...)`:
    - Same setup as above.
    - After `userA` marks read: query `Message.find({ chatId, sender: userB._id })`; assert all have `userA._id.toString()` in `readBy` (Req 4.6).
    - Query `Message.find({ chatId, sender: userA._id })`; assert none have `userA._id.toString()` in `readBy` (Req 4.7).
  - Use `logApi` for all HTTP calls with `FLOW2-*` tags.
  - **References**: Requirements 4.1–4.7; Design §Block 3, §Cursor Pagination Test Strategy.

- [x] 5. Implement Flow 3 — Notification Routing
  - Add `describe('Flow 3: Notification Routing', ...)`.
  - Implement `it('offline receiver: push sent, dedup key set', ...)`:
    - `setupAcceptedConnection()` (default `redisClient.get` returns `null` — receiver offline).
    - Send a message as `userA`.
    - Assert `redisClient.set` was called with first arg matching `notif:dedup:${chatId}:${userB._id}` (Req 5.1).
    - Assert `pushNotificationHelper.sendPushNotification` or `sendPushNotifications` was called at least once (Req 5.1).
    - Assert `io.emit` was NOT called with `'CHAT_UPDATED'` targeting `user::${userB._id}` (Req 5.4).
  - Implement `it('offline receiver: second message within dedup window skips push', ...)`:
    - `setupAcceptedConnection()`.
    - Send first message (default `set` returns `'OK'` — push fires).
    - Override `redisClient.set` with `mockResolvedValueOnce(null as any)` (NX fails).
    - Clear push helper mocks, then send second message.
    - Assert `pushNotificationHelper.sendPushNotification` and `sendPushNotifications` were NOT called (Req 5.2).
  - Implement `it('receiver in different chat: CHAT_UPDATED emitted, no push', ...)`:
    - `setupAcceptedConnection()`.
    - Override `redisClient.get` with `mockResolvedValueOnce('some-other-chat-id')`.
    - Send a message as `userA`.
    - Assert `io.to('user::' + userB._id)` called and `.emit('CHAT_UPDATED', expect.objectContaining({ lastMessage: expect.any(Object), unreadCount: expect.any(Number) }))` (Req 5.3, 11.2).
    - Assert push helpers were NOT called (Req 5.3).
  - Implement `it('receiver has chat open: no push, no CHAT_UPDATED, MESSAGE_SENT still fires', ...)`:
    - `setupAcceptedConnection()`.
    - Override `redisClient.get` with `mockResolvedValueOnce(chatId)`.
    - Send a message as `userA`.
    - Assert push helpers NOT called (Req 5.5).
    - Assert `CHAT_UPDATED` NOT emitted to `user::${userB._id}` (Req 5.5).
    - Assert `MESSAGE_SENT` still emitted to `chat::${chatId}` (Req 5.6, 11.1).
  - Use `logApi` for all HTTP calls with `FLOW3-*` tags.
  - **References**: Requirements 5.1–5.6, 11.1, 11.2; Design §Block 4, §Redis Mock Override Pattern.

- [x] 6. Implement Flow 4 — Connection Removal with Chat Persistence
  - Add `describe('Flow 4: Connection Removal with Chat Persistence', ...)`.
  - Implement `it('user A removes connection: Connection deleted, Chat persists, CONNECTION_REMOVED emitted', ...)`:
    - `setupChatWithMessages(3)` to get `{ userA, tokenA, userB, tokenB, connectionId, chatId }`.
    - Call `POST /api/v1/connections/:connectionId/remove` as `userA`; assert `status 200`, `body.success true`, `body.data.status 'NONE'` (Req 6.1).
    - Assert `Connection.findById(connectionId) === null` (Req 6.2).
    - Assert `Chat.findById(chatId)` is non-null (Req 6.3).
    - Assert `io.to('user::' + userB._id)` called and `.emit('CONNECTION_REMOVED', { connectionId: expect.anything(), chatId })` (Req 6.4, 11.4).
    - Call `GET /api/v1/chats` as `userA`; assert `status 200` and result contains entry with `_id === chatId` (Req 6.5).
    - Call `GET /api/v1/chats` as `userB`; assert same (Req 6.6).
    - Call `GET /api/v1/messages/chat/:chatId` as `userA`; assert `status 200` and `body.data.length === 3` (Req 6.7).
  - Implement `it('user B can also remove connection: CONNECTION_REMOVED emitted to user A', ...)`:
    - `setupAcceptedConnection()`.
    - Call `POST /api/v1/connections/:connectionId/remove` as `userB`; assert `status 200`, `body.data.status 'NONE'`.
    - Assert `io.to('user::' + userA._id)` called and `.emit('CONNECTION_REMOVED', expect.objectContaining({ connectionId: expect.anything(), chatId: expect.anything() }))` (Req 6.8, 11.4).
  - Implement `it('non-participant cannot remove connection: 403', ...)`:
    - `setupAcceptedConnection()`.
    - Create `userC` via `createAuthUser()`.
    - Call `POST /api/v1/connections/:connectionId/remove` as `userC`; assert `status 403`, `body.success false` (Req 6.9).
  - Implement `it('message history persists after connection removal', ...)`:
    - `setupChatWithMessages(3)`.
    - Remove connection as `userA`.
    - Call `GET /api/v1/messages/chat/:chatId` as `userA`; assert `body.data.length === 3` (Req 6.7 — explicit persistence check).
  - Use `logApi` for all HTTP calls with `FLOW4-*` tags.
  - **References**: Requirements 6.1–6.9, 11.4; Design §Block 5.

- [x] 7. Implement Flow 5 — Validation Guards
  - Add `describe('Flow 5: Validation Guards', ...)`.
  - Implement `it('unauthenticated requests return 401 for all chat/message endpoints', ...)`:
    - `setupAcceptedConnection()` to get a valid `chatId`.
    - Call `POST /api/v1/chats/:userB._id` without `Authorization`; assert `status 401`, `body.success false` (Req 7.1).
    - Call `GET /api/v1/chats` without `Authorization`; assert `status 401`, `body.success false` (Req 7.2).
    - Call `POST /api/v1/messages` without `Authorization`; assert `status 401`, `body.success false` (Req 7.3).
    - Call `GET /api/v1/messages/chat/:chatId` without `Authorization`; assert `status 401`, `body.success false` (Req 7.4).
    - Call `POST /api/v1/messages/chat/:chatId/read` without `Authorization`; assert `status 401`, `body.success false` (Req 7.5).
  - Implement `it('non-existent chatId returns 404 on send', ...)`:
    - `createAuthUser()` to get a token.
    - Call `POST /api/v1/messages` with a valid ObjectId that doesn't exist in DB; assert `status 404`, `body.success false` (Req 7.6).
  - Implement `it('non-participant returns 403 on send and get history', ...)`:
    - `setupAcceptedConnection()`.
    - `createAuthUser()` for `userC`.
    - Call `POST /api/v1/messages` as `userC` with the valid `chatId`; assert `status 403`, `body.success false`, `body.message` contains `'not a participant'` (Req 7.7).
    - Call `GET /api/v1/messages/chat/:chatId` as `userC`; assert `status 403`, `body.success false`, `body.message` contains `'not a participant'` (Req 7.8).
  - Implement `it('empty message body returns 400', ...)`:
    - `setupAcceptedConnection()`.
    - Call `POST /api/v1/messages` as `userA` with `{ chatId, type: 'text' }` (no `text`, no `attachments`); assert `status 400`, `body.success false`, `body.message` contains `'must contain text or at least one attachment'` (Req 7.9).
  - Implement `it('text exceeding 10000 chars returns 400', ...)`:
    - `setupAcceptedConnection()`.
    - Call `POST /api/v1/messages` as `userA` with `text` of length `10001`; assert `status 400`, `body.success false`, `body.message` contains `'exceeds maximum length'` (Req 7.10).
  - Use `logApi` for all HTTP calls with `FLOW5-*` tags.
  - **References**: Requirements 7.1–7.10; Design §Block 6.

- [x] 8. Implement Flow 6 & 7 — Chat List Ordering/Search and Mark-Read Edge Cases
  - Add `describe('Flow 6 & 7: Chat List and Mark-Read Edge Cases', ...)`.
  - Implement `it('chat list ordered by lastMessage.createdAt descending', ...)`:
    - Create `userA`, `userB` (name containing `'Ali'`), `userC` (name not containing `'Ali'`).
    - Set up two accepted connections: `userA↔userB` (chatAB) and `userA↔userC` (chatAC).
    - Send a message to `chatAC` first, then to `chatAB`.
    - Call `GET /api/v1/chats` as `userA`; assert `body.data[0]._id === chatAB` (most recent first) (Req 8.1).
  - Implement `it('searchTerm filters by other participant name (case-insensitive)', ...)`:
    - Same two-chat setup with `userB.name` containing `'Ali'`.
    - Call `GET /api/v1/chats?searchTerm=ali`; assert `status 200`, `body.data.length === 1`, result contains only chatAB (Req 8.2).
  - Implement `it('searchTerm with no match returns empty array', ...)`:
    - Same two-chat setup.
    - Call `GET /api/v1/chats?searchTerm=NONEXISTENT`; assert `status 200`, `body.data` is empty array (Req 8.3).
  - Implement `it('empty searchTerm returns all chats', ...)`:
    - Same two-chat setup.
    - Call `GET /api/v1/chats?searchTerm=`; assert `body.data.length === 2` (Req 8.4).
  - Implement `it('whitespace-only searchTerm returns all chats', ...)`:
    - Same two-chat setup.
    - Call `GET /api/v1/chats?searchTerm=   `; assert `body.data.length === 2` (Req 8.5).
  - Implement `it('mark-read on empty chat returns modifiedCount 0, no MESSAGES_READ event', ...)`:
    - `setupAcceptedConnection()` (no messages sent).
    - Call `POST /api/v1/messages/chat/:chatId/read` as `userB`; assert `status 200`, `modifiedCount === 0`, `updatedIds` is `[]` (Req 9.1).
    - Assert `MESSAGES_READ` NOT emitted to `chat::${chatId}` (Req 9.2).
  - Implement `it('mark-read with only own messages returns modifiedCount 0', ...)`:
    - `setupChatWithMessages(3)` (all messages from `userA`).
    - Call `POST /api/v1/messages/chat/:chatId/read` as `userA`; assert `modifiedCount === 0`, `updatedIds` is `[]` (Req 9.3).
  - Implement `it('mark-read is idempotent: second call returns modifiedCount 0', ...)`:
    - `setupChatWithMessages(3)`.
    - Call `POST /api/v1/messages/chat/:chatId/read` as `userB` (first call — marks 3 messages).
    - Call `POST /api/v1/messages/chat/:chatId/read` as `userB` again; assert `modifiedCount === 0`, `updatedIds` is `[]` (Req 9.5).
  - Implement `it('mark-read populates readBy for all messages from other sender', ...)`:
    - `setupChatWithMessages(3)`.
    - Call `POST /api/v1/messages/chat/:chatId/read` as `userB`.
    - Query `Message.find({ chatId, sender: userA._id })`; assert all 3 have `userB._id.toString()` in `readBy` (Req 9.4).
  - Implement `it('mark-read reflects in chat list unreadCount', ...)`:
    - `setupChatWithMessages(3)`.
    - Call `POST /api/v1/messages/chat/:chatId/read` as `userB`.
    - Override `redisClient.mget` with `mockResolvedValueOnce(['0'])`.
    - Call `GET /api/v1/chats` as `userB`; assert `body.data[0].unreadCount === 0` (Req 9.6).
  - Use `logApi` for all HTTP calls with `FLOW6-*` and `FLOW7-*` tags.
  - **References**: Requirements 8.1–8.5, 9.1–9.6; Design §Block 7.

- [x] 9. Verify all correctness properties are covered
  - Review the completed test file against the 16 correctness properties defined in `design.md §Correctness Properties`.
  - For each property, confirm at least one `it` block contains assertions that validate it:
    - P1 (Chat idempotency): covered by Flow 1 steps for Req 3.3, 3.4 and idempotency assertions.
    - P2 (MESSAGE_SENT always fires): covered by Flow 1 (Req 3.8) and Flow 3 same-chat case (Req 5.6).
    - P3 (lastMessage updated): covered by Flow 1 (Req 3.9, 3.10).
    - P4 (Message ordering ascending): covered by Flow 2 (Req 4.1).
    - P5 (Cursor pagination exhaustive): covered by Flow 2 three-page test (Req 4.2–4.4).
    - P6 (readBy populated for other sender): covered by Flow 2 (Req 4.6) and Flow 7 (Req 9.4).
    - P7 (Own messages excluded from readBy): covered by Flow 2 (Req 4.7) and Flow 7 (Req 9.3).
    - P8 (Mark-read idempotent): covered by Flow 7 (Req 9.5).
    - P9 (MESSAGES_READ iff modifiedCount > 0): covered by Flow 1 (Req 3.14) and Flow 7 (Req 9.2).
    - P10 (Notification routing by active state): covered by Flow 3 (Req 5.1–5.5).
    - P11 (Dedup prevents double push): covered by Flow 3 (Req 5.2).
    - P12 (Chat persists after removal): covered by Flow 4 (Req 6.2, 6.3, 6.5–6.7).
    - P13 (CONNECTION_REMOVED from either side): covered by Flow 4 (Req 6.4, 6.8).
    - P14 (Chat list ordering): covered by Flow 6 (Req 8.1).
    - P15 (Search filters by name): covered by Flow 6 (Req 8.2, 8.3, 8.4, 8.5).
    - P16 (CONNECTION_ACCEPTED emitted): covered by Flow 1 (Req 11.5).
  - If any property is not covered, add a targeted `it` block to the most appropriate describe block.
  - Run the full test suite with `npx vitest run src/app/modules/chat/__tests__/chat.e2e.spec.ts` and confirm all tests pass.
  - **References**: Design §Correctness Properties, §Testing Strategy (Property-to-test mapping table).

## Notes

- Tasks 4–8 are in the same wave and are independent of each other — they can be implemented in any order after Task 3 completes.
- The test file is a pure test artifact; no application code changes are required.
- All socket assertions use `(global as any).io.to` and `(global as any).io.emit` since both `global.io` and `SocketManager.getIO()` point to the same mock object after `beforeEach`.
- Use `.query({ limit, cursor })` (supertest method) rather than string interpolation for cursor pagination to avoid manual URL encoding of base64 cursor values.
- The `incrby` Redis method does not need to be mocked unless a test explicitly asserts on unread count increments — the default mock factory omits it intentionally.
- For the two-chat setup in Flow 6, create `userB` with a name containing `'Ali'` (e.g., `'Test Ali userB'`) and `userC` with a name that does not (e.g., `'Test BROTHER userC'`) to make search assertions deterministic.
