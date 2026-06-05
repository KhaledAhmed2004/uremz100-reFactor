# Requirements Document

## Introduction

This feature adds a comprehensive, flow-based end-to-end (E2E) test suite for the Chat module at `src/app/modules/chat/__tests__/chat.e2e.spec.ts`. The suite covers the complete user journey from connection establishment through chat creation, message exchange, read receipts, notification routing, and connection removal — testing all APIs as a cohesive, realistic workflow rather than isolated unit-style checks.

The test file exercises the following API surface:
- **Connection API**: `POST /api/v1/connections`, `POST /api/v1/connections/:id/accept`, `POST /api/v1/connections/:id/remove`
- **Chat API**: `POST /api/v1/chats/:otherUserId`, `GET /api/v1/chats`
- **Message API**: `POST /api/v1/messages`, `GET /api/v1/messages/chat/:chatId`, `POST /api/v1/messages/chat/:chatId/read`

It follows the same infrastructure patterns established in `connection.e2e.spec.ts` and `message.e2e.spec.ts` (MongoMemoryReplSet, supertest, mocked Firebase/Redis/Socket.io).

---

## Glossary

- **Chat_E2E_Suite**: The Vitest test suite defined in `chat.e2e.spec.ts`.
- **Chat_API**: The HTTP endpoints `POST /api/v1/chats/:otherUserId` and `GET /api/v1/chats`.
- **Message_API**: The HTTP endpoints `POST /api/v1/messages`, `GET /api/v1/messages/chat/:chatId`, and `POST /api/v1/messages/chat/:chatId/read`.
- **Connection_API**: The HTTP endpoints `POST /api/v1/connections`, `POST /api/v1/connections/:id/accept`, and `POST /api/v1/connections/:id/remove`.
- **Chat_Document**: A MongoDB document in the `Chat` collection with exactly two `participants`, a nullable `lastMessage`, and timestamps.
- **Connection_Document**: A MongoDB document in the `Connection` collection tracking the relationship between two users with a `status` field.
- **Message_Document**: A MongoDB document in the `Message` collection with fields `chatId`, `sender`, `text`, `type`, `attachments`, `readBy`, and timestamps.
- **ReplSet**: A `MongoMemoryReplSet` instance with `replSet: { count: 1 }` used to support MongoDB transactions in tests.
- **Auth_Token**: A signed JWT produced by `jwtHelper.createToken`, used as a `Bearer` token in the `Authorization` header.
- **Socket_Mock**: The mock object `{ to: vi.fn().mockReturnThis(), emit: vi.fn() }` assigned to `(global as any).io` and passed to `SocketManager.init()` in `beforeEach`.
- **Redis_Mock**: The `redisClient` mock that returns safe defaults (`mget → []`, `get → null`, `set → 'OK'`, `del → 1`) to prevent real Redis connections.
- **Firebase_Mock**: The `pushNotificationHelper` mock that prevents real Firebase push calls.
- **createAuthUser**: A test helper that creates a verified, active `User` document and returns `{ user, token }`.
- **setupPendingConnection**: A test helper that creates two users and a pending connection between them via the API, returning `{ userA, tokenA, userB, tokenB, connectionId }`.
- **setupAcceptedConnection**: A test helper that builds on `setupPendingConnection`, accepts the connection via the API, and returns `{ userA, tokenA, userB, tokenB, connectionId, chatId }`.
- **setupChatWithMessages**: A test helper that calls `setupAcceptedConnection` and then sends `n` text messages from `userA` via the API, returning `{ userA, tokenA, userB, tokenB, connectionId, chatId, messages }`.
- **MESSAGE_SENT**: A Socket.io event emitted to the `chat::{chatId}` room when a message is saved.
- **CHAT_UPDATED**: A Socket.io event emitted to the `user::{receiverId}` room when the receiver is in a different chat.
- **MESSAGES_READ**: A Socket.io event emitted to the `chat::{chatId}` room when at least one message is marked as read.
- **CONNECTION_REMOVED**: A Socket.io event emitted to the `user::{otherUserId}` room when an accepted connection is removed.
- **CONNECTION_ACCEPTED**: A Socket.io event emitted to the `user::{senderId}` room when a connection request is accepted.
- **Dedup_Key**: The Redis key `notif:dedup:{chatId}:{receiverId}` used to suppress duplicate push notifications within a 60-second window.
- **Active_Key**: The Redis key `active:{userId}:chat` storing the `chatId` the user currently has open.
- **Unread_Key**: The Redis key `unread:{chatId}:{userId}` storing the unread message count for a user in a chat.

---

## Requirements

### Requirement 1: Test Infrastructure Setup

**User Story:** As a developer, I want the E2E test file to have a properly configured test environment, so that tests run in isolation with real MongoDB transactions and mocked external services.

#### Acceptance Criteria

1. WHEN `beforeAll` runs, THE Chat_E2E_Suite SHALL create a `MongoMemoryReplSet` instance with `replSet: { count: 1 }`, connect Mongoose to its URI via `mongoose.connect(replSet.getUri())`, and store the instance in a module-level `replSet` variable so that MongoDB transactions are supported throughout the suite.
2. THE Chat_E2E_Suite SHALL mock `pushNotificationHelper` (Firebase) via `vi.mock` at the top of the file — before any imports that use it — stubbing both `sendPushNotification` and `sendPushNotifications` to return `Promise.resolve(undefined)`, so that no real Firebase calls are made.
3. THE Chat_E2E_Suite SHALL mock `redisClient` via `vi.mock` at the top of the file with safe defaults: `mget` returns `[]`, `get` returns `null`, `set` returns `'OK'`, `del` returns `1`, and `on` is a no-op, so that no real Redis connections are attempted.
4. WHEN `beforeEach` runs, THE Chat_E2E_Suite SHALL (in order): (a) create a fresh Socket_Mock object `{ to: vi.fn().mockReturnThis(), emit: vi.fn() }`, (b) assign it to `(global as any).io`, and (c) call `SocketManager.init(mockIo as any)`, so that both the legacy `global.io` path and the `SocketManager.getIO()` path resolve to the same mock.
5. WHEN `beforeEach` runs, THE Chat_E2E_Suite SHALL call `deleteMany({})` on the `Connection`, `User`, `Chat`, `Message`, and `Notification` collections — in that order — to ensure each test starts with an empty database.
6. WHEN `beforeEach` runs, THE Chat_E2E_Suite SHALL call `vi.clearAllMocks()` after all `deleteMany` calls so that mock call counts and return-value overrides are reset between tests.
7. WHEN `afterAll` runs, THE Chat_E2E_Suite SHALL call `await mongoose.disconnect()` first, then `await replSet.stop()`, to release all resources in the correct teardown order.
8. IF `beforeAll` throws during ReplSet creation or Mongoose connection, THE Chat_E2E_Suite SHALL allow the error to propagate so that Vitest marks the entire suite as failed rather than silently skipping tests.

---

### Requirement 2: Test Helper Functions

**User Story:** As a developer, I want reusable helper functions in the test file, so that test setup is concise and consistent across all test cases.

#### Acceptance Criteria

1. THE Chat_E2E_Suite SHALL provide a `createAuthUser(role = USER_ROLES.BROTHER, nameSuffix = 'user')` helper that creates a `User` document with `name`, `role`, `email` (unique via `randomUUID()`), `password`, `isVerified: true`, `status: USER_STATUS.ACTIVE`, `revertDate`, `dateOfBirth`, `profileImage`, `verificationImage`, `verificationVideo`, and `tokenVersion: 0`, then returns `{ user, token }` where `token` is a valid JWT signed with `config.jwt.jwt_secret` and a `1h` expiry.
2. THE Chat_E2E_Suite SHALL provide a `setupPendingConnection()` helper that calls `createAuthUser` twice to produce `userA` and `userB`, then calls `POST /api/v1/connections` as `userA` with `{ receiverId: userB._id.toString() }`, asserts `res.status === 201`, and returns `{ userA, tokenA, userB, tokenB, connectionId }` where `connectionId` is extracted from `res.body.data.id`.
3. IF `setupPendingConnection()` receives a non-201 response or `res.body.data.id` is missing or falsy, THEN THE Chat_E2E_Suite SHALL throw an `Error` with a message like `'setupPendingConnection failed: ...'` rather than returning a default value.
4. THE Chat_E2E_Suite SHALL provide a `setupAcceptedConnection()` helper that calls `setupPendingConnection()`, then calls `POST /api/v1/connections/:connectionId/accept` as `userB`, asserts `res.status === 200`, extracts `chatId` from `res.body.data.chatId`, and returns `{ userA, tokenA, userB, tokenB, connectionId, chatId }`.
5. IF `setupAcceptedConnection()` receives a non-200 response or `res.body.data.chatId` is missing or falsy, THEN THE Chat_E2E_Suite SHALL throw an `Error` with a message like `'setupAcceptedConnection failed: ...'` rather than returning a default value.
6. THE Chat_E2E_Suite SHALL provide a `setupChatWithMessages(n: number)` helper where `n >= 1`, that calls `setupAcceptedConnection()`, then sends `n` text messages from `userA` via `POST /api/v1/messages` with `{ chatId, text: \`Message \${i}\`, type: 'text' }` for `i` from `1` to `n`, asserts each send returns status `201`, and returns `{ userA, tokenA, userB, tokenB, connectionId, chatId, messages }` where `messages` is the array of `res.body.data` objects from each send call.

---

### Requirement 3: Flow 1 — Full Happy Path (Connection → Chat → Messaging → Read Receipts)

**User Story:** As a user, I want to go from accepting a connection to sending messages and marking them read in a single cohesive flow, so that the entire chat lifecycle works end-to-end.

#### Acceptance Criteria

1. WHEN user B accepts user A's connection request via `POST /api/v1/connections/:connectionId/accept`, THE Connection_API SHALL return HTTP status `200`, `body.success: true`, `body.data.status: 'ACCEPTED'`, and a non-null `body.data.chatId` string.
2. WHEN a connection is accepted, THE Chat_E2E_Suite SHALL verify via `Chat.countDocuments({ participants: { $all: [userA._id, userB._id] } })` that exactly one `Chat_Document` exists in the database.
3. WHEN user A calls `POST /api/v1/chats/:otherUserId` with `otherUserId = userB._id.toString()` after the connection is accepted, THE Chat_API SHALL return HTTP status `201` and `body.data._id` equal to the `chatId` returned by the accept response.
4. WHEN user B calls `POST /api/v1/chats/:otherUserId` with `otherUserId = userA._id.toString()` after the connection is accepted, THE Chat_API SHALL return HTTP status `201` and `body.data._id` equal to the same `chatId`.
5. WHEN user A calls `GET /api/v1/chats` before any message is sent, THE Chat_API SHALL return HTTP status `200`, `body.success: true`, and `body.data` as an array of length `1` where `body.data[0]._id` equals `chatId` and `body.data[0].unreadCount` equals `0`.
6. WHEN user B calls `GET /api/v1/chats` before any message is sent, THE Chat_API SHALL return HTTP status `200` and `body.data` as an array of length `1` where `body.data[0]._id` equals `chatId` and `body.data[0].unreadCount` equals `0`.
7. WHEN user A sends a text message via `POST /api/v1/messages` with `{ chatId, text: 'Hello from A', type: 'text' }`, THE Message_API SHALL return HTTP status `201`, `body.success: true`, `body.data.text: 'Hello from A'`, and `body.data.chatId` equal to `chatId`.
8. WHEN user A sends a message, THE Socket_Mock SHALL have been called with `io.to(\`chat::${chatId}\`)` and then `.emit('MESSAGE_SENT', expect.objectContaining({ message: expect.objectContaining({ text: 'Hello from A' }) }))`.
9. WHEN user A sends a message, THE Chat_E2E_Suite SHALL verify via `Chat.findById(chatId)` that `chat.lastMessage.text` equals `'Hello from A'` and `chat.lastMessage.sender.toString()` equals `userA._id.toString()`.
10. WHEN user A calls `GET /api/v1/chats` after sending a message, THE Chat_API SHALL return `body.data[0].lastMessage.text` equal to `'Hello from A'`.
11. WHEN user B calls `GET /api/v1/chats` after user A sends a message and the Redis_Mock `mget` is configured to return `['1']` for the unread key, THE Chat_API SHALL return `body.data[0].unreadCount` equal to `1`.
12. WHEN user B calls `GET /api/v1/messages/chat/:chatId`, THE Message_API SHALL return HTTP status `200`, `body.success: true`, and `body.data` as an array of length `1` where `body.data[0].text` equals `'Hello from A'`.
13. WHEN user B calls `POST /api/v1/messages/chat/:chatId/read`, THE Message_API SHALL return HTTP status `200`, `body.success: true`, `body.data.modifiedCount` equal to `1`, and `body.data.updatedIds` as an array of length `1`.
14. WHEN user B marks the chat as read, THE Socket_Mock SHALL have been called with `io.to(\`chat::${chatId}\`)` and then `.emit('MESSAGES_READ', { chatId, userId: userB._id.toString(), updatedIds: expect.arrayContaining([expect.any(String)]) })` where `updatedIds` has length `1`.
15. WHEN user B calls `GET /api/v1/chats` after marking the chat as read, THE Chat_API SHALL return `body.data[0].unreadCount` equal to `0`.

---

### Requirement 4: Flow 2 — Multi-Message Exchange and Cursor Pagination

**User Story:** As a user, I want to exchange multiple messages and paginate through history, so that the message ordering and cursor-based pagination work correctly in a realistic conversation.

#### Acceptance Criteria

1. WHEN user A sends messages M1, M3, M5 and user B sends messages M2, M4 in the sequence A→B→A→B→A, THE Message_API SHALL return all 5 messages via `GET /api/v1/messages/chat/:chatId` (no limit param) sorted in ascending order by `createdAt`, with `body.data[0]` being M1 and `body.data[4]` being M5.
2. WHEN `GET /api/v1/messages/chat/:chatId?limit=2` is called on a chat with 5 messages, THE Message_API SHALL return HTTP status `200`, `body.data` as an array of length `2` (M1 and M2), `body.meta.total: 5`, `body.meta.limit: 2`, `body.meta.hasNextPage: true`, and `body.meta.nextCursor` as a non-null non-empty base64 string.
3. WHEN `GET /api/v1/messages/chat/:chatId?limit=2&cursor={nextCursor}` is called with the cursor from the first page, THE Message_API SHALL return `body.data` as an array of length `2` containing M3 and M4, with no IDs overlapping the first page.
4. WHEN `GET /api/v1/messages/chat/:chatId?limit=2&cursor={nextCursor}` is called with the cursor from the second page, THE Message_API SHALL return `body.data` as an array of length `1` containing M5, `body.meta.hasNextPage: false`, and `body.meta.nextCursor: null`.
5. WHEN user A calls `POST /api/v1/messages/chat/:chatId/read` after user B has sent M2 and M4, THE Message_API SHALL return `body.data.modifiedCount: 2` and `body.data.updatedIds` as an array of exactly 2 message ID strings corresponding to M2 and M4.
6. WHEN user A marks the chat as read, THE Chat_E2E_Suite SHALL verify via `Message.find({ chatId, sender: userB._id })` that all returned messages have `readBy` arrays containing `userA._id.toString()`.
7. WHEN user A marks the chat as read, THE Chat_E2E_Suite SHALL verify via `Message.find({ chatId, sender: userA._id })` that none of user A's own messages have `userA._id.toString()` present in their `readBy` arrays.

---

### Requirement 5: Flow 3 — Notification Routing Based on Receiver's Active Chat State

**User Story:** As a system, I want to route notifications correctly based on whether the receiver is offline, in a different chat, or actively viewing this chat, so that users receive the right notification type without duplicates.

#### Acceptance Criteria

1. WHEN user A sends a message and the Redis_Mock `get` is configured to return `null` for the Active_Key `active:{userB._id}:chat` (receiver offline), THE Chat_E2E_Suite SHALL verify that `redisClient.set` was called with a first argument matching `notif:dedup:{chatId}:{userB._id}` and that `pushNotificationHelper.sendPushNotifications` or `pushNotificationHelper.sendPushNotification` was called at least once.
2. WHEN user A sends a second message and the Redis_Mock `set` is configured to return `null` for the Dedup_Key (NX condition fails — key already exists), THE Chat_E2E_Suite SHALL verify that `pushNotificationHelper.sendPushNotifications` and `pushNotificationHelper.sendPushNotification` were NOT called for that second send.
3. WHEN user A sends a message and the Redis_Mock `get` is configured to return a string value different from `chatId` for `active:{userB._id}:chat` (receiver in a different chat), THE Socket_Mock SHALL have been called with `io.to(\`user::${userB._id}\`)` and then `.emit('CHAT_UPDATED', expect.objectContaining({ lastMessage: expect.any(Object), unreadCount: expect.any(Number) }))`.
4. WHEN user A sends a message and the Redis_Mock `get` returns `null` for `active:{userB._id}:chat` (receiver offline), THE Socket_Mock SHALL NOT have been called with `.emit('CHAT_UPDATED', ...)` targeting `user::${userB._id}`.
5. WHEN user A sends a message and the Redis_Mock `get` is configured to return the current `chatId` for `active:{userB._id}:chat` (receiver has this chat open), THE Chat_E2E_Suite SHALL verify that `pushNotificationHelper.sendPushNotifications` and `pushNotificationHelper.sendPushNotification` were NOT called, and that the Socket_Mock was NOT called with `.emit('CHAT_UPDATED', ...)` targeting `user::${userB._id}`.
6. WHEN user A sends a message and the Redis_Mock `get` returns the current `chatId` for `active:{userB._id}:chat`, THE Socket_Mock SHALL still have been called with `io.to(\`chat::${chatId}\`)` and `.emit('MESSAGE_SENT', ...)` regardless of the receiver's active state.

---

### Requirement 6: Flow 4 — Connection Removal with Chat Persistence

**User Story:** As a user, I want the chat history to persist after a connection is removed, so that previous conversations remain accessible even after the relationship ends.

#### Acceptance Criteria

1. WHEN user A calls `POST /api/v1/connections/:connectionId/remove` after the connection is accepted, THE Connection_API SHALL return HTTP status `200`, `body.success: true`, and `body.data.status: 'NONE'`.
2. WHEN a connection is removed, THE Chat_E2E_Suite SHALL verify via `Connection.findById(connectionId)` that the result is `null`, confirming the `Connection_Document` no longer exists.
3. WHEN a connection is removed, THE Chat_E2E_Suite SHALL verify via `Chat.findById(chatId)` that the result is non-null, confirming the `Chat_Document` still exists in the database.
4. WHEN a connection is removed, THE Socket_Mock SHALL have been called with `io.to(\`user::${userB._id}\`)` and then `.emit('CONNECTION_REMOVED', { connectionId: expect.anything(), chatId: chatId })` where `chatId` equals the known chat ID.
5. WHEN user A calls `GET /api/v1/chats` after the connection is removed, THE Chat_API SHALL return HTTP status `200`, `body.success: true`, and `body.data` as an array containing an entry whose `_id` equals `chatId`.
6. WHEN user B calls `GET /api/v1/chats` after the connection is removed, THE Chat_API SHALL return HTTP status `200`, `body.success: true`, and `body.data` as an array containing an entry whose `_id` equals `chatId`.
7. WHEN user A calls `GET /api/v1/messages/chat/:chatId` after the connection is removed and 3 messages were sent via `setupChatWithMessages(3)`, THE Message_API SHALL return HTTP status `200` and `body.data` as an array of length `3` (message history is unaffected by connection removal).
8. WHEN user B (instead of user A) calls `POST /api/v1/connections/:connectionId/remove` after the connection is accepted, THE Connection_API SHALL return HTTP status `200`, `body.success: true`, `body.data.status: 'NONE'`, and THE Socket_Mock SHALL have emitted `CONNECTION_REMOVED` to `user::${userA._id}` with non-null `connectionId` and `chatId` in the payload.
9. WHEN a user who is not a participant of the connection calls `POST /api/v1/connections/:connectionId/remove`, THE Connection_API SHALL return HTTP status `403` with `body.success: false`.

---

### Requirement 7: Flow 5 — Validation Guards

**User Story:** As a system operator, I want all chat and message endpoints to enforce authentication and input validation, so that only authorized participants can access and send messages.

#### Acceptance Criteria

1. WHEN `POST /api/v1/chats/:otherUserId` is called without an `Authorization` header, THE Chat_API SHALL return HTTP status `401` with `body.success: false`.
2. WHEN `GET /api/v1/chats` is called without an `Authorization` header, THE Chat_API SHALL return HTTP status `401` with `body.success: false`.
3. WHEN `POST /api/v1/messages` is called without an `Authorization` header, THE Message_API SHALL return HTTP status `401` with `body.success: false`.
4. WHEN `GET /api/v1/messages/chat/:chatId` is called without an `Authorization` header, THE Message_API SHALL return HTTP status `401` with `body.success: false`.
5. WHEN `POST /api/v1/messages/chat/:chatId/read` is called without an `Authorization` header, THE Message_API SHALL return HTTP status `401` with `body.success: false`.
6. WHEN `POST /api/v1/messages` is called with a valid token and a `chatId` that is a syntactically valid ObjectId but does not exist in the database, THE Message_API SHALL return HTTP status `404` with `body.success: false`.
7. WHEN `POST /api/v1/messages` is called by a third user (userC, created via `createAuthUser`) who is not a participant of the chat between userA and userB, THE Message_API SHALL return HTTP status `403` with `body.success: false` and `body.message` containing `'not a participant'`.
8. WHEN `GET /api/v1/messages/chat/:chatId` is called by a third user (userC) who is not a participant of the chat, THE Message_API SHALL return HTTP status `403` with `body.success: false` and `body.message` containing `'not a participant'`.
9. WHEN `POST /api/v1/messages` is called by a valid participant with `{ chatId, type: 'text' }` and no `text` field and no `attachments` field, THE Message_API SHALL return HTTP status `400` with `body.success: false` and `body.message` containing `'must contain text or at least one attachment'`.
10. WHEN `POST /api/v1/messages` is called by a valid participant with a `text` field whose `.length` is `10001` characters, THE Message_API SHALL return HTTP status `400` with `body.success: false` and `body.message` containing `'exceeds maximum length'`.

---

### Requirement 8: Flow 6 — Chat List Ordering and Search

**User Story:** As a user, I want my chat list sorted by most recent activity and filterable by participant name, so that I can quickly find the conversations I care about.

#### Acceptance Criteria

1. WHEN user A has two accepted connections (chatAB with userB and chatAC with userC) and sends a message to chatAC first and then to chatAB, THE Chat_API SHALL return `GET /api/v1/chats` with `body.data[0]._id` equal to `chatAB` (most recently active chat first, sorted by `lastMessage.createdAt` descending).
2. WHEN `GET /api/v1/chats?searchTerm=ali` is called and userB's name contains `'Ali'` while userC's name does not, THE Chat_API SHALL return HTTP status `200`, `body.success: true`, and `body.data` as an array of length `1` containing only the chat with userB.
3. WHEN `GET /api/v1/chats?searchTerm=NONEXISTENT` is called with a term that is not a substring of any other participant's name, THE Chat_API SHALL return HTTP status `200`, `body.success: true`, and `body.data` as an empty array.
4. WHEN `GET /api/v1/chats?searchTerm=` is called with an empty string, THE Chat_API SHALL return HTTP status `200` and `body.data` containing all chats for the user (the search filter is not applied).
5. WHEN `GET /api/v1/chats?searchTerm=   ` is called with a whitespace-only string, THE Chat_API SHALL return HTTP status `200` and `body.data` containing all chats for the user (whitespace-only search is treated as no filter).

---

### Requirement 9: Flow 7 — Mark Read Edge Cases

**User Story:** As a user, I want the mark-read operation to handle edge cases correctly, so that idempotent calls and self-message scenarios behave predictably.

#### Acceptance Criteria

1. WHEN `POST /api/v1/messages/chat/:chatId/read` is called on a chat that has no messages at all, THE Message_API SHALL return HTTP status `200`, `body.success: true`, `body.data.modifiedCount: 0`, and `body.data.updatedIds` as an empty array `[]`.
2. WHEN `POST /api/v1/messages/chat/:chatId/read` is called with no unread messages, THE Socket_Mock SHALL NOT have been called with `.emit('MESSAGES_READ', ...)` for the `chat::${chatId}` room.
3. WHEN user A calls `POST /api/v1/messages/chat/:chatId/read` and the chat contains only messages sent by user A (none from user B), THE Message_API SHALL return `body.data.modifiedCount: 0` and `body.data.updatedIds` as an empty array (a user's own messages are never added to their own `readBy`).
4. WHEN user B calls `POST /api/v1/messages/chat/:chatId/read` after user A has sent 3 messages, THE Chat_E2E_Suite SHALL verify via `Message.find({ chatId, sender: userA._id })` that all 3 returned messages have `readBy` arrays containing `userB._id.toString()`.
5. WHEN user B calls `POST /api/v1/messages/chat/:chatId/read` a second time after already marking all messages as read, THE Message_API SHALL return `body.data.modifiedCount: 0` and `body.data.updatedIds` as an empty array (idempotent — already-read messages are not re-processed).
6. WHEN user B marks the chat as read, THE Chat_E2E_Suite SHALL verify via `GET /api/v1/chats` (with Redis_Mock `mget` returning `['0']`) that `body.data[0].unreadCount` equals `0` for user B.

---

### Requirement 10: Chat Idempotency

**User Story:** As a user, I want calling the create-or-get chat endpoint multiple times to always return the same chat, so that duplicate chats are never created.

#### Acceptance Criteria

1. WHEN user A calls `POST /api/v1/chats/:otherUserId` with `otherUserId = userB._id.toString()` a second time for the same pair of users, THE Chat_API SHALL return HTTP status `201` and `body.data._id` equal to the same `chatId` as the first call.
2. WHEN `POST /api/v1/chats/:otherUserId` is called twice for the same pair of users, THE Chat_E2E_Suite SHALL verify via `Chat.countDocuments({ participants: { $all: [userA._id, userB._id] } })` that the count is `1` (no duplicate `Chat_Document` created).
3. WHEN user B calls `POST /api/v1/chats/:otherUserId` with `otherUserId = userA._id.toString()` (reverse direction), THE Chat_API SHALL return HTTP status `201` and `body.data._id` equal to the same `chatId` as when user A initiated the call.

---

### Requirement 11: Socket Event Correctness

**User Story:** As a developer, I want to verify that all socket events carry the correct payloads and target the correct rooms, so that real-time features work reliably.

#### Acceptance Criteria

1. WHEN a message is sent, THE Socket_Mock SHALL have been called with `io.to('chat::' + chatId)` using the exact double-colon room name format, before `.emit('MESSAGE_SENT', expect.objectContaining({ message: expect.any(Object) }))`.
2. WHEN the receiver is in a different chat (Redis `active:` key returns a different chatId), THE Socket_Mock SHALL have been called with `io.to('user::' + receiverId)` using the exact double-colon room name format, before `.emit('CHAT_UPDATED', expect.objectContaining({ lastMessage: expect.any(Object), unreadCount: expect.any(Number) }))`.
3. WHEN messages are marked as read and `modifiedCount > 0`, THE Socket_Mock SHALL have been called with `io.to('chat::' + chatId)` before `.emit('MESSAGES_READ', { chatId: expect.any(String), userId: expect.any(String), updatedIds: expect.arrayContaining([expect.any(String)]) })` where `updatedIds` is non-empty.
4. WHEN a connection is removed, THE Socket_Mock SHALL have been called with `io.to('user::' + otherUserId)` before `.emit('CONNECTION_REMOVED', expect.objectContaining({ connectionId: expect.anything(), chatId: expect.anything() }))`.
5. WHEN a connection is accepted, THE Socket_Mock SHALL have been called with `io.to('user::' + senderUserId)` before `.emit('CONNECTION_ACCEPTED', expect.objectContaining({ connectionId: expect.anything(), chatId: expect.anything() }))`.
