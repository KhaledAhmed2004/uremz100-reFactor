# Requirements Document

## Introduction

This document covers the refactor of the existing chat and message modules in the Node.js/Express/MongoDB/Socket.io application. The goal is to replace the current implementation with a clean, industry-standard 1-on-1 messaging system modeled after how Messenger handles real-time delivery and notifications. The refactor eliminates N+1 query patterns, removes unused fields, introduces Redis-backed unread counts, and replaces ad-hoc socket usage with a typed singleton. No new user-facing features are added beyond what is described here.

---

## Glossary

- **Chat_Service**: The service layer responsible for creating and listing chat conversations.
- **Message_Service**: The service layer responsible for sending messages, retrieving history, and marking messages as read.
- **Socket_Manager**: The typed singleton that wraps the Socket.io server instance, replacing `global.io`.
- **Notification_Service**: The helper responsible for dispatching push notifications to offline users.
- **Redis**: The in-memory store used for unread counts, active-chat tracking, and notification deduplication.
- **Chat**: A MongoDB document representing a 1-on-1 conversation between exactly two participants.
- **Message**: A MongoDB document representing a single message within a Chat.
- **Participant**: A user who is a member of a given Chat.
- **Receiver**: The Participant whose ID is not the `senderId` — i.e., the other person in the conversation.
- **Active Chat**: A chat that a user currently has open, tracked in Redis as `active:{userId}:chat`.
- **User Room**: A persistent Socket.io room keyed `user::{userId}` that a client joins on connection.
- **Chat Room**: A Socket.io room keyed `chat::{chatId}` that a client joins when opening a conversation.
- **Unread Count**: The number of unread messages for a given user in a given Chat, stored in Redis.
- **lastMessage**: A denormalized sub-document on the Chat document containing `{ text, sender, createdAt }` of the most recent Message.
- **Cursor**: An ISO 8601 timestamp string used as a pagination token to fetch the next page of message history.
- **QueryBuilder**: The existing utility class used to apply search, filter, sort, and pagination to Mongoose queries.

---

## Requirements

### Requirement 1: Chat Data Model

**User Story:** As a backend engineer, I want a clean Chat schema with no unused fields and a denormalized `lastMessage`, so that the chat list can be served in a single query without N+1 lookups.

#### Acceptance Criteria

1. THE Chat_Service SHALL store each Chat document with the fields: `participants` (array of exactly 2 User ObjectIds), `lastMessage` (nullable sub-document with `text` capped at 2000 characters, `sender` ObjectId, and `createdAt` Date), and `createdAt`/`updatedAt` timestamps.
2. THE Chat_Service SHALL NOT include a `status` boolean field on the Chat document.
3. WHEN a new Message is saved, THE Chat_Service SHALL atomically update `Chat.lastMessage` — IF the Message save succeeds but the `lastMessage` update fails, THEN neither write SHALL be visible to subsequent reads (the operation SHALL be retried or surfaced as an error; partial state SHALL NOT persist).
4. THE Chat_Service SHALL maintain a compound index on `{ participants: 1 }` to support efficient participant-based lookups.
5. WHEN `Chat.lastMessage` is null (no messages yet), THE Chat_Service SHALL treat that chat as having the oldest possible sort position when ordering by `lastMessage.createdAt`.

---

### Requirement 2: Message Data Model

**User Story:** As a backend engineer, I want a clean Message schema that tracks reads without the overhead of delivery tracking, so that the model stays simple and correct.

#### Acceptance Criteria

1. THE Message_Service SHALL store each Message document with the fields: `chatId` (required ObjectId), `sender` (required ObjectId), `text` (optional string, max 4000 characters), `type` (required enum: `text | image | media | doc | mixed`), `attachments` (array, max 10 elements), `readBy` (array of User ObjectIds, max 1000 elements), `createdAt`, and `updatedAt`.
2. THE Message_Service SHALL NOT include a `deliveredTo` field on the Message document.
3. THE Message_Service SHALL NOT include a `status` field (`sent | delivered | seen`) on the Message document.
4. THE Message_Service SHALL NOT include an `editedAt` field on the Message document.
5. THE Message_Service SHALL maintain a compound index on `{ chatId: 1, createdAt: -1 }`.
6. THE Message_Service SHALL NOT register `pre('find')` or `pre('findOne')` auto-populate hooks on the Message model; all population SHALL be performed explicitly at the call site.
7. WHEN `type` is `text`, THE Message_Service SHALL require `text` to be present and non-empty; IF `text` is absent or empty and `type` is `text`, THEN THE Message_Service SHALL reject the document.

---

### Requirement 3: Chat Service — createOrGet

**User Story:** As a user, I want to open a conversation with another user, so that I can start messaging them without creating duplicate chats.

#### Acceptance Criteria

1. WHEN `createOrGet(userId, otherUserId)` is called, THE Chat_Service SHALL return the existing Chat document if one already exists with exactly those two participants, regardless of the order in which the participant IDs are stored in the array.
2. WHEN no existing Chat is found, THE Chat_Service SHALL create and return a new Chat document with `participants` set to `[userId, otherUserId]`.
3. IF `userId` equals `otherUserId`, THEN THE Chat_Service SHALL throw a 400 Bad Request error indicating a user cannot chat with themselves.
4. IF `otherUserId` does not correspond to an existing User document, THEN THE Chat_Service SHALL throw a 404 Not Found error indicating the target user does not exist.
5. IF either `userId` or `otherUserId` is null, undefined, or not a valid MongoDB ObjectId format, THEN THE Chat_Service SHALL throw a 400 Bad Request error before executing any database query.

---

### Requirement 4: Chat Service — getList

**User Story:** As a user, I want to see my list of conversations with the most recent message preview and unread count, so that I can quickly identify which chats need my attention.

#### Acceptance Criteria

1. WHEN `getList(userId, search?)` is called with a valid `userId`, THE Chat_Service SHALL return all Chat documents where `participants` contains `userId`, sorted by `lastMessage.createdAt` descending; chats where `lastMessage` is null SHALL appear last.
2. THE Chat_Service SHALL include the denormalized `lastMessage` field from the Chat document directly, without issuing a separate query per chat.
3. THE Chat_Service SHALL retrieve all unread counts for the returned chats in a single batched Redis read using keys of the form `unread:{chatId}:{userId}`; chats with no prior unread count key SHALL return `0`.
4. IF Redis is unavailable (connection error, timeout, or any exception) during `getList`, THEN THE Chat_Service SHALL return `0` for all unread counts and SHALL NOT throw an error.
5. WHERE a `search` term between 1 and 100 characters is provided, THE Chat_Service SHALL filter results to chats whose other participant's `name` matches the search term case-insensitively.
6. THE Chat_Service SHALL populate the other participant's `_id`, `name`, `image`, and `role` fields for each chat in the list.
7. IF `userId` is not a valid MongoDB ObjectId, THEN THE Chat_Service SHALL throw a 400 Bad Request error before executing any database query.
8. WHEN `getList` is called and no matching chats exist, THE Chat_Service SHALL return an empty array without throwing an error.

---

### Requirement 5: Message Service — send

**User Story:** As a user, I want to send a text or media message in a conversation, so that the other participant receives it in real time.

#### Acceptance Criteria

1. WHEN `send(chatId, senderId, payload)` is called with a `chatId` that does not exist in the database, THE Message_Service SHALL throw a 404 Not Found error.
2. WHEN `send(chatId, senderId, payload)` is called and `senderId` is not in the `participants` array of the Chat, THE Message_Service SHALL throw a 403 Forbidden error.
3. IF `payload` contains neither a non-empty `text` string nor at least one entry in `attachments`, THEN THE Message_Service SHALL throw a 400 Bad Request error with a message indicating content is required.
4. IF `payload.text` exceeds 10,000 characters, THEN THE Message_Service SHALL throw a 400 Bad Request error.
5. IF `payload.attachments` contains more than 10 entries, THEN THE Message_Service SHALL throw a 400 Bad Request error.
6. WHEN a Message is saved successfully, THE Message_Service SHALL emit a `MESSAGE_SENT` event to the Chat Room (`chat::{chatId}`) containing the Message with the sender's `_id`, `name`, and `profilePicture` resolved.
7. THE Receiver is defined as the Participant whose ID is not `senderId`.
8. WHEN a Message is saved successfully and the Receiver has an active socket connection AND their currently open chat is `chatId`, THE Message_Service SHALL NOT send a push notification and SHALL NOT emit a `CHAT_UPDATED` event to the Receiver's User Room.
9. WHEN a Message is saved successfully and the Receiver has an active socket connection AND their currently open chat is NOT `chatId`, THE Message_Service SHALL emit a `CHAT_UPDATED` event to the Receiver's User Room (`user::{receiverId}`) containing the updated `lastMessage` and unread count.
10. WHEN a Message is saved successfully and the Receiver does not have an active socket connection, THE Message_Service SHALL send at most one push notification per Chat per Receiver within a 60-second window.
11. WHEN a Message is saved successfully, THE Message_Service SHALL update the Chat's `lastMessage` field and increment the Receiver's unread count.
12. IF any of the following fail after a Message is saved — socket emission, Redis unread increment, push notification dispatch — THEN THE Message_Service SHALL log the error using the application logger and SHALL NOT propagate the error to the caller; the saved Message SHALL still be returned.

---

### Requirement 6: Message Service — getHistory

**User Story:** As a user, I want to load the message history of a conversation in pages, so that I can scroll back through older messages without loading everything at once.

#### Acceptance Criteria

1. WHEN `getHistory(chatId, userId, cursor?, limit?)` is called, THE Message_Service SHALL return messages for the given `chatId` sorted by `createdAt` ascending, applied in the database query.
2. THE Message_Service SHALL return at most `limit` messages per call; `limit` SHALL default to 20 when not provided and SHALL be clamped to the range 1–100.
3. WHERE a `cursor` (ISO 8601 timestamp) is provided, THE Message_Service SHALL return only messages with `createdAt` strictly greater than the cursor value.
4. THE Message_Service SHALL populate the `sender` field with `_id`, `name`, and `profilePicture` explicitly on the query.
5. THE Message_Service SHALL return pagination metadata including `total` (total matching messages), `limit`, `hasNextPage` (boolean), and `nextCursor` (ISO 8601 timestamp of the last returned message, or `null` when no further pages exist).
6. IF `chatId` is not a valid MongoDB ObjectId, THEN THE Message_Service SHALL throw a 400 Bad Request error.
7. IF `userId` is not a valid MongoDB ObjectId, THEN THE Message_Service SHALL throw a 400 Bad Request error.

---

### Requirement 7: Message Service — markRead

**User Story:** As a user, I want all unread messages in a conversation to be marked as read when I open the chat, so that the sender knows I have seen their messages.

#### Acceptance Criteria

1. WHEN `markRead(chatId, userId)` is called, THE Message_Service SHALL first query for all Message IDs in `chatId` where `sender` is not `userId` and `readBy` does not contain `userId`, then perform a single `updateMany` using those IDs to add `userId` to `readBy`.
2. THE Message_Service SHALL verify that `userId` is a participant of the Chat identified by `chatId`; IF NOT, THEN THE Message_Service SHALL throw a 403 Forbidden error.
3. WHEN the bulk update completes and at least one message was updated, THE Message_Service SHALL emit a single `MESSAGES_READ` event to the Chat Room (`chat::{chatId}`) containing `{ chatId, userId, updatedIds: string[] }`.
4. WHEN `markRead` completes successfully, THE Message_Service SHALL set the Receiver's unread count for this chat to `0` in Redis.
5. IF no unread messages exist for `userId` in `chatId`, THEN THE Message_Service SHALL return `{ modifiedCount: 0, updatedIds: [] }` without emitting a socket event.
6. IF `chatId` is not a valid MongoDB ObjectId, THEN THE Message_Service SHALL throw a 400 Bad Request error.
7. IF `userId` is not a valid MongoDB ObjectId, THEN THE Message_Service SHALL throw a 400 Bad Request error.
8. WHEN `markRead` completes successfully with at least one update, THE Message_Service SHALL return `{ modifiedCount: number, updatedIds: string[] }`.

---

### Requirement 8: Socket Active-Chat Tracking

**User Story:** As the system, I want to know which chat each online user currently has open, so that I can decide whether to send a notification or just a socket event.

#### Acceptance Criteria

1. WHEN a client emits a `JOIN_CHAT` event with a valid non-empty `chatId` string, THE Socket_Manager SHALL record that user's active chat in Redis with a 3600-second TTL; IF a previous active chat was already recorded for that user, it SHALL be overwritten with the new `chatId`.
2. IF a client emits a `JOIN_CHAT` event with an absent or empty `chatId`, THE Socket_Manager SHALL ignore the event and SHALL NOT update Redis.
3. WHEN a client emits a `LEAVE_CHAT` event, THE Socket_Manager SHALL delete that user's active chat record from Redis.
4. WHEN a client disconnects, THE Socket_Manager SHALL delete that user's active chat record from Redis.
5. THE Socket_Manager SHALL expose a typed `getIO()` function that returns the initialized Socket.io server instance.
6. IF `getIO()` is called before the Socket.io server has been initialized, THEN THE Socket_Manager SHALL throw an error indicating the server is not yet ready.

---

### Requirement 9: Redis Unread Count Management

**User Story:** As a user, I want my unread message counts to be accurate and fast to retrieve, so that the chat list always reflects the correct badge numbers.

#### Acceptance Criteria

1. WHEN a Message is successfully persisted to the database, THE Message_Service SHALL increment the Receiver's unread count for that chat by 1.
2. WHEN all unread messages in a chat are marked as read for a user, THE Message_Service SHALL set that user's unread count for that chat to 0.
3. WHEN a user's chat list is retrieved, THE Chat_Service SHALL fetch all unread counts for the returned chats in a single batched read; chats with no recorded unread count SHALL return 0.
4. IF a Redis operation for unread count increment or reset fails, THEN THE calling service SHALL log the error and return a safe fallback value of `0` to the caller without propagating the exception.
5. IF a Redis operation for batch unread count retrieval fails, THEN THE Chat_Service SHALL return `0` for all affected chats without propagating the exception.

---

### Requirement 10: Error Handling and Logging

**User Story:** As a backend engineer, I want all errors to be logged and propagated correctly, so that silent failures do not hide bugs in production.

#### Acceptance Criteria

1. WHEN an error is caught in a non-critical path within Message_Service (specifically: unread-count cache writes and push notification dispatch), THE Message_Service SHALL log the error using `errorLogger` before continuing; it SHALL NOT use an empty `catch {}` block.
2. WHEN an error is caught in a non-critical path within Chat_Service (specifically: Redis unread-count reads), THE Chat_Service SHALL log the error using `errorLogger` before continuing; it SHALL NOT use an empty `catch {}` block.
3. WHEN any of the following critical operations fail — saving a Message to the database, updating `Chat.lastMessage`, or querying Chat participants — THE Message_Service SHALL re-throw the error to the caller without modification.
4. WHEN `send(chatId, senderId, payload)` is called, THE Message_Service SHALL validate `chatId` as a MongoDB ObjectId before executing any database query; IF invalid, THE Message_Service SHALL throw a 400 Bad Request error.
5. WHEN `markRead(chatId, userId)` is called, THE Message_Service SHALL validate both `chatId` and `userId` as MongoDB ObjectIds before executing any database query; IF either is invalid, THE Message_Service SHALL throw a 400 Bad Request error.

---

### Requirement 11: Auto-Populate Hook Removal

**User Story:** As a backend engineer, I want all Mongoose population to be explicit at the call site, so that queries are predictable and do not carry hidden performance costs.

#### Acceptance Criteria

1. THE Message model SHALL NOT register `pre('find')` or `pre('findOne')` hooks that auto-populate the `sender` field.
2. WHEN `sendMessageToDB` queries for the saved Message to return a populated payload, THE Message_Service SHALL call `.populate('sender', '_id name profilePicture')` explicitly on that query.
3. WHEN `getMessageFromDB` queries for messages to return to the client, THE Message_Service SHALL call `.populate('sender', '_id name profilePicture')` explicitly on that query.
4. WHEN Chat_Service queries Chat documents and participant data is required in the response, THE Chat_Service SHALL call `.populate('participants', '_id name image role')` explicitly on the query rather than relying on any model-level hook.
