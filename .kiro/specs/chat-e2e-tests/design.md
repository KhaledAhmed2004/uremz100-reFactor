# Design Document: chat-e2e-tests

## Overview

This document describes the technical design for `src/app/modules/chat/__tests__/chat.e2e.spec.ts` — a comprehensive, flow-based end-to-end test suite for the Chat module. The suite exercises the full chat lifecycle: connection establishment → chat creation → message exchange → read receipts → notification routing → connection removal.

The test file is a pure test artifact. It does not introduce new application code; it validates existing behaviour across the Connection, Chat, and Message APIs using real HTTP requests (supertest), a real in-memory MongoDB replica set (MongoMemoryReplSet), and carefully controlled mocks for Firebase, Redis, and Socket.io.

### Key Design Goals

- **Flow-based coverage**: Tests are organised as realistic user journeys, not isolated unit checks.
- **Infrastructure parity**: Uses the same mock patterns established in `connection.e2e.spec.ts` and `message.e2e.spec.ts`.
- **Deterministic isolation**: Every test starts with a clean database and fresh mocks via `beforeEach`.
- **Explicit socket assertions**: All Socket.io emissions are verified through the chained `.to().emit()` mock pattern.
- **Redis override pattern**: Notification routing tests override the default Redis mock per-test using `mockResolvedValueOnce`.

---

## Architecture

The test file sits at `src/app/modules/chat/__tests__/chat.e2e.spec.ts`. It imports from sibling modules using relative paths and exercises the full Express application via supertest.

```
src/app/modules/chat/__tests__/
  chat.e2e.spec.ts          ← new file (this spec)

Relative import paths from chat/__tests__/:
  ../message/message.model  → Message model
  ../chat/chat.model        → Chat model (../chat.model from __tests__)
  ../../connection/...      → Connection model
  ../../notification/...    → Notification model, pushNotificationHelper
  ../../../../app           → Express app
  ../../../../shared/...    → redisClient
  ../../../../helpers/...   → jwtHelper, SocketManager
```

### Infrastructure Stack

| Layer | Tool | Purpose |
|---|---|---|
| HTTP | supertest | Fire real HTTP requests against the Express app |
| Database | MongoMemoryReplSet (count: 1) | Real MongoDB with transaction support |
| Firebase | vi.mock (hoisted) | Prevent real push notification calls |
| Redis | vi.mock (hoisted) | Prevent real Redis connections; control routing logic |
| Socket.io | vi.fn() mock in beforeEach | Assert room targeting and event payloads |

---

## Components and Interfaces

### File Location and Module Structure

```
src/app/modules/chat/__tests__/chat.e2e.spec.ts
```

**Import list** (in declaration order):

```typescript
// Vitest + Node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

// Test infrastructure
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

// Application
import app from '../../../../app';
import { User } from '../../user/user.model';
import { Connection } from '../../connection/connection.model';
import { Chat } from '../../chat/chat.model';
import { Message } from '../message/message.model';
import { Notification } from '../../notification/notification.model';

// Helpers
import { jwtHelper } from '../../../../helpers/jwtHelper';
import config from '../../../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../../../enums/user';
import { logApi } from '../../../../helpers/__tests__/testLogger';
import { SocketManager } from '../../../../helpers/socketManager';

// Mocked modules (imported for vi.mocked() access)
import { pushNotificationHelper } from '../../notification/pushNotificationHelper';
import { redisClient } from '../../../../shared/redisClient';
```

> **Note on Message import path**: From `chat/__tests__/`, the Message model lives at `../message/message.model` (up one level to `modules/`, then into `message/`).

---

### Mock Strategy

`vi.mock` calls are **hoisted** by Vitest to the top of the module before any imports are evaluated. This is critical because `pushNotificationHelper` and `redisClient` are imported transitively by `message.service.ts` and `chat.service.ts`. If the mocks were not hoisted, the real modules would be loaded first and the mocks would have no effect.

```typescript
// ── Mocks (hoisted — must appear before imports) ──────────────────────────

vi.mock('../../notification/pushNotificationHelper', () => ({
  pushNotificationHelper: {
    sendPushNotifications: vi.fn().mockResolvedValue(undefined),
    sendPushNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../../shared/redisClient', () => ({
  redisClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    mget: vi.fn().mockResolvedValue([]),
    on: vi.fn(),
  },
}));
```

**What each mock covers:**

| Mock | Default return | Why |
|---|---|---|
| `pushNotificationHelper.sendPushNotification` | `Promise.resolve(undefined)` | Prevents real Firebase FCM calls |
| `pushNotificationHelper.sendPushNotifications` | `Promise.resolve(undefined)` | Same — bulk variant |
| `redisClient.get` | `null` | Simulates receiver offline (no active chat key) |
| `redisClient.set` | `'OK'` | Simulates successful dedup key acquisition (NX succeeds) |
| `redisClient.del` | `1` | Simulates successful key deletion |
| `redisClient.mget` | `[]` | Simulates all unread counts as 0 in chat list |
| `redisClient.on` | no-op | Prevents Redis event listener registration |

The `incrby` method used by `incrementUnreadCount` is not mocked because it is called as a side-effect and its return value is not asserted in these tests. If needed, add `incrby: vi.fn().mockResolvedValue(1)` to the mock factory.

---

### Test Infrastructure

#### ReplSet Lifecycle

```typescript
let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});
```

A replica set (not a standalone) is required because `MessageService.send` and `ConnectionService` use MongoDB transactions internally. A standalone `MongoMemoryServer` does not support transactions.

Teardown order matters: `mongoose.disconnect()` must precede `replSet.stop()` to avoid connection errors during shutdown.

#### beforeEach Pattern

```typescript
beforeEach(async () => {
  // 1. Clear collections in dependency order
  await Connection.deleteMany({});
  await Notification.deleteMany({});
  await Message.deleteMany({});
  await Chat.deleteMany({});
  await User.deleteMany({});

  // 2. Reset all mock call counts and one-time overrides
  vi.clearAllMocks();

  // 3. Fresh Socket.io mock — covers both global.io and SocketManager paths
  const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
  (global as any).io = mockIo;
  SocketManager.init(mockIo as any);
});
```

**Collection deletion order**: `Connection` and `Notification` first (they reference `User` and `Chat`), then `Message` (references `Chat`), then `Chat`, then `User`. This avoids any potential referential issues during cleanup.

**Dual Socket.io assignment**: `SocketManager.getIO()` is used by `MessageService` and `ConnectionService`. `(global as any).io` is used by legacy code paths. Both must point to the same mock object so assertions on `(global as any).io.to` capture all emissions.

---

## Data Models

### Helper Function Designs

#### `createAuthUser`

```typescript
async function createAuthUser(
  role: string = USER_ROLES.BROTHER,
  nameSuffix = 'user'
): Promise<{ user: IUser; token: string }>
```

Creates a fully verified, active user document and returns a signed JWT. Uses `randomUUID()` for the email to guarantee uniqueness across parallel test runs. The `tokenVersion: 0` field is required for JWT validation middleware.

**Return shape**: `{ user: HydratedDocument<IUser>, token: string }`

#### `setupPendingConnection`

```typescript
async function setupPendingConnection(): Promise<{
  userA: IUser; tokenA: string;
  userB: IUser; tokenB: string;
  connectionId: string;
}>
```

Creates two users and sends a connection request from A to B via `POST /api/v1/connections`. Throws `Error('setupPendingConnection failed: ...')` if the response is not 201 or `res.body.data.id` is falsy. This fail-fast behaviour surfaces setup problems immediately rather than producing confusing assertion failures downstream.

```typescript
async function setupPendingConnection() {
  const { user: userA, token: tokenA } = await createAuthUser(USER_ROLES.BROTHER, 'userA');
  const { user: userB, token: tokenB } = await createAuthUser(USER_ROLES.BROTHER, 'userB');
  const res = await request(app)
    .post('/api/v1/connections')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ receiverId: userB._id.toString() });
  if (res.status !== 201 || !res.body.data?.id) {
    throw new Error(`setupPendingConnection failed: status=${res.status} body=${JSON.stringify(res.body)}`);
  }
  return { userA, tokenA, userB, tokenB, connectionId: res.body.data.id as string };
}
```

#### `setupAcceptedConnection`

```typescript
async function setupAcceptedConnection(): Promise<{
  userA: IUser; tokenA: string;
  userB: IUser; tokenB: string;
  connectionId: string;
  chatId: string;
}>
```

Calls `setupPendingConnection()` then accepts via `POST /api/v1/connections/:connectionId/accept` as userB. Throws `Error('setupAcceptedConnection failed: ...')` if the response is not 200 or `res.body.data.chatId` is falsy. The `chatId` is the canonical chat ID for all subsequent assertions.

#### `setupChatWithMessages`

```typescript
async function setupChatWithMessages(n: number): Promise<{
  userA: IUser; tokenA: string;
  userB: IUser; tokenB: string;
  connectionId: string;
  chatId: string;
  messages: any[];  // res.body.data from each POST /api/v1/messages
}>
```

Calls `setupAcceptedConnection()` then sends `n` messages from userA with text `Message ${i}` (i = 1..n). Each send is asserted to return 201. The `messages` array contains the raw `res.body.data` objects, giving tests access to message IDs, timestamps, and text without additional DB queries.

---

## Test Suite Organization

The file contains one top-level `describe('Chat E2E Tests', ...)` block with 7 nested describe blocks:

### Block 1: Infrastructure & Helpers

```
describe('Infrastructure & Helpers')
  it('mongoose is connected after beforeAll')
  it('mocks are in place')
  it('beforeEach clears all collections')
```

Verifies the test environment itself. Checks `mongoose.connection.readyState === 1`, confirms `vi.isMockFunction(redisClient.get)` is true, and verifies collections are empty at the start of each test.

### Block 2: Flow 1 — Full Happy Path

```
describe('Flow 1: Full Happy Path')
  it('connection accept → chat create → send message → get history → mark read')
```

A single long-form integration test covering the complete lifecycle. Uses `setupPendingConnection()` as the starting point and walks through every step sequentially, asserting HTTP responses, DB state, and socket emissions at each stage.

**Test naming convention**: Flow tests use descriptive names that read as a sequence: `'connection accept → chat create → send message → get history → mark read'`.

### Block 3: Flow 2 — Multi-Message & Pagination

```
describe('Flow 2: Multi-Message Exchange and Cursor Pagination')
  it('5-message alternating exchange returns messages sorted ascending')
  it('cursor pagination: page 1 of 3 returns correct meta')
  it('cursor pagination: page 2 uses nextCursor from page 1')
  it('cursor pagination: page 3 is the last page')
  it('bulk mark-read: modifiedCount matches sender B message count')
  it('mark-read excludes own messages from readBy')
```

### Block 4: Flow 3 — Notification Routing

```
describe('Flow 3: Notification Routing')
  it('offline receiver: push sent, dedup key set')
  it('offline receiver: second message within dedup window skips push')
  it('receiver in different chat: CHAT_UPDATED emitted, no push')
  it('receiver has chat open: no push, no CHAT_UPDATED, MESSAGE_SENT still fires')
```

### Block 5: Flow 4 — Connection Removal

```
describe('Flow 4: Connection Removal with Chat Persistence')
  it('user A removes connection: Connection deleted, Chat persists, CONNECTION_REMOVED emitted')
  it('user B can also remove connection: CONNECTION_REMOVED emitted to user A')
  it('non-participant cannot remove connection: 403')
  it('message history persists after connection removal')
```

### Block 6: Flow 5 — Validation Guards

```
describe('Flow 5: Validation Guards')
  it('unauthenticated requests return 401 for all chat/message endpoints')
  it('non-existent chatId returns 404 on send')
  it('non-participant returns 403 on send and get history')
  it('empty message body returns 400')
  it('text exceeding 10000 chars returns 400')
```

### Block 7: Flow 6 & 7 — Chat List + Mark-Read Edge Cases

```
describe('Flow 6 & 7: Chat List and Mark-Read Edge Cases')
  it('chat list ordered by lastMessage.createdAt descending')
  it('searchTerm filters by other participant name (case-insensitive)')
  it('empty searchTerm returns all chats')
  it('whitespace-only searchTerm returns all chats')
  it('mark-read on empty chat returns modifiedCount 0, no MESSAGES_READ event')
  it('mark-read with only own messages returns modifiedCount 0')
  it('mark-read is idempotent: second call returns modifiedCount 0')
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Chat creation is idempotent and direction-independent

*For any* two connected users A and B, calling `POST /api/v1/chats/:otherUserId` any number of times — from either direction — always returns the same `chatId`, and `Chat.countDocuments({ participants: { $all: [A, B] } })` always equals `1`.

**Validates: Requirements 3.2, 3.3, 3.4, 10.1, 10.2, 10.3**

### Property 2: MESSAGE_SENT is always emitted to the correct room

*For any* message sent to any chat, `io.to('chat::' + chatId)` is called and `.emit('MESSAGE_SENT', { message: ... })` follows, regardless of the receiver's active chat state.

**Validates: Requirements 3.8, 5.6, 11.1**

### Property 3: Chat lastMessage reflects the most recently sent message

*For any* message sent to a chat, `Chat.findById(chatId).lastMessage.text` equals the sent message's text and `lastMessage.sender` equals the sender's ID.

**Validates: Requirements 3.9, 3.10**

### Property 4: Message history is ordered ascending by createdAt

*For any* sequence of messages sent to a chat, `GET /api/v1/messages/chat/:chatId` returns them sorted in ascending `createdAt` order with no gaps.

**Validates: Requirements 4.1**

### Property 5: Cursor pagination is non-overlapping and exhaustive

*For any* chat with N messages and page size L, paginating through all pages using `nextCursor` produces exactly N unique messages with no duplicates across pages, and the final page has `hasNextPage: false` and `nextCursor: null`.

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 6: Mark-read adds the reader to readBy for all messages from the other sender

*For any* mark-read operation by user U in chat C, every message in C where `sender !== U` and `U ∉ readBy` before the call will have `U ∈ readBy` after the call.

**Validates: Requirements 4.6, 9.4**

### Property 7: Mark-read never adds a user to their own messages' readBy

*For any* mark-read operation by user U in chat C, no message where `sender === U` will have U added to its `readBy` array.

**Validates: Requirements 4.7, 9.3**

### Property 8: Mark-read is idempotent

*For any* mark-read operation called twice in succession, the second call returns `modifiedCount: 0` and `updatedIds: []`.

**Validates: Requirements 9.5**

### Property 9: MESSAGES_READ is emitted if and only if modifiedCount > 0

*For any* mark-read operation, `io.to('chat::' + chatId).emit('MESSAGES_READ', ...)` is called when `modifiedCount > 0`, and is NOT called when `modifiedCount === 0`.

**Validates: Requirements 3.14, 9.2, 11.3**

### Property 10: Notification routing is determined by receiver's active chat state

*For any* message sent where the receiver's `active:{receiverId}:chat` key is:
- `null` → push notification is sent (if dedup key not set), no `CHAT_UPDATED`
- `chatId` (same chat) → no push, no `CHAT_UPDATED`
- any other value → `CHAT_UPDATED` emitted to `user::receiverId`, no push

**Validates: Requirements 5.1, 5.3, 5.4, 5.5, 11.2**

### Property 11: Dedup key prevents duplicate push notifications

*For any* second message sent to an offline receiver within the dedup window (Redis `set` returns `null` for NX), no push notification is sent.

**Validates: Requirements 5.2**

### Property 12: Connection removal deletes the Connection document but preserves the Chat document

*For any* accepted connection that is removed, `Connection.findById(connectionId)` returns `null` and `Chat.findById(chatId)` returns a non-null document.

**Validates: Requirements 6.2, 6.3, 6.5, 6.6, 6.7**

### Property 13: CONNECTION_REMOVED is emitted to the other participant from either side

*For any* connection removal by either participant, `io.to('user::' + otherUserId).emit('CONNECTION_REMOVED', { connectionId, chatId })` is called.

**Validates: Requirements 6.4, 6.8, 11.4**

### Property 14: Chat list is ordered by lastMessage.createdAt descending

*For any* set of chats belonging to a user, `GET /api/v1/chats` returns them sorted so that the chat with the most recent `lastMessage.createdAt` appears first.

**Validates: Requirements 8.1**

### Property 15: Chat list search filters by other participant's name (case-insensitive)

*For any* non-empty, non-whitespace `searchTerm`, `GET /api/v1/chats?searchTerm=X` returns only chats where the other participant's name contains X (case-insensitive), and returns an empty array when no names match.

**Validates: Requirements 8.2, 8.3**

### Property 16: CONNECTION_ACCEPTED is emitted to the connection sender

*For any* accepted connection, `io.to('user::' + senderUserId).emit('CONNECTION_ACCEPTED', { connectionId, chatId })` is called.

**Validates: Requirements 11.5**

---

## Error Handling

### Helper Fail-Fast Pattern

All setup helpers (`setupPendingConnection`, `setupAcceptedConnection`, `setupChatWithMessages`) throw descriptive errors on unexpected API responses rather than returning partial data. This surfaces infrastructure problems immediately:

```typescript
if (res.status !== 201 || !res.body.data?.id) {
  throw new Error(
    `setupPendingConnection failed: status=${res.status} body=${JSON.stringify(res.body)}`
  );
}
```

### Redis Mock Override Pattern

Individual tests that need to control notification routing override the default `redisClient.get` mock using `mockResolvedValueOnce`. This is scoped to a single call and automatically reverts to the default after consumption:

```typescript
// Simulate receiver offline (default — no override needed, get returns null)

// Simulate receiver in a different chat
vi.mocked(redisClient.get).mockResolvedValueOnce('some-other-chat-id');

// Simulate receiver has this chat open
vi.mocked(redisClient.get).mockResolvedValueOnce(chatId);
```

For the dedup key test (NX fails — key already exists), override `redisClient.set`:

```typescript
// First message: set returns 'OK' (default) → push fires
// Second message: set returns null → NX failed → push suppressed
vi.mocked(redisClient.set).mockResolvedValueOnce(null as any);
```

For unread count tests, override `redisClient.mget`:

```typescript
// Simulate unreadCount = 1 for the chat
vi.mocked(redisClient.mget).mockResolvedValueOnce(['1']);
```

### Socket Assertion Pattern

The Socket.io mock uses `mockReturnThis()` on `.to()` so that chained calls work:

```typescript
const mockIo = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
```

Asserting a chained `.to().emit()` call:

```typescript
// Assert room targeting
expect((global as any).io.to).toHaveBeenCalledWith(`chat::${chatId}`);

// Assert event emission
expect((global as any).io.emit).toHaveBeenCalledWith(
  'MESSAGE_SENT',
  expect.objectContaining({ message: expect.objectContaining({ text: 'Hello from A' }) })
);
```

For negative assertions (event should NOT have been emitted):

```typescript
// Assert CHAT_UPDATED was NOT emitted to the user room
const chatUpdatedCalls = (global as any).io.emit.mock.calls.filter(
  ([event]: [string]) => event === 'CHAT_UPDATED'
);
expect(chatUpdatedCalls).toHaveLength(0);
```

### Cursor Pagination Test Strategy

Extract `nextCursor` from the response and pass it as a query parameter to the next request:

```typescript
// Page 1
const page1 = await request(app)
  .get(`/api/v1/messages/chat/${chatId}?limit=2`)
  .set('Authorization', `Bearer ${tokenA}`);
expect(page1.body.meta.hasNextPage).toBe(true);
const cursor1 = page1.body.meta.nextCursor;
expect(cursor1).toBeTruthy();

// Page 2 — pass cursor as query param (supertest encodes it automatically)
const page2 = await request(app)
  .get(`/api/v1/messages/chat/${chatId}`)
  .query({ limit: 2, cursor: cursor1 })
  .set('Authorization', `Bearer ${tokenA}`);
expect(page2.body.meta.hasNextPage).toBe(true);
const cursor2 = page2.body.meta.nextCursor;

// Page 3 — last page
const page3 = await request(app)
  .get(`/api/v1/messages/chat/${chatId}`)
  .query({ limit: 2, cursor: cursor2 })
  .set('Authorization', `Bearer ${tokenA}`);
expect(page3.body.meta.hasNextPage).toBe(false);
expect(page3.body.meta.nextCursor).toBeNull();
```

Use `.query()` rather than string interpolation to avoid manual URL encoding of the base64 cursor.

To verify non-overlapping pages, collect all message IDs across pages and assert uniqueness:

```typescript
const allIds = [...page1.body.data, ...page2.body.data, ...page3.body.data]
  .map((m: any) => m._id);
const uniqueIds = new Set(allIds);
expect(uniqueIds.size).toBe(allIds.length); // no duplicates
expect(allIds.length).toBe(5);              // all messages covered
```

---

## Testing Strategy

### Dual Testing Approach

The suite uses example-based integration tests exclusively. Property-based testing (PBT) is not applied here because:

1. The test file is itself the test artifact — it is not a library with pure functions to fuzz.
2. All correctness properties are verified through concrete, realistic scenarios that exercise the full HTTP → service → DB → socket stack.
3. The properties identified in the Correctness Properties section above are each validated by one or more specific test cases with concrete inputs.

Each correctness property maps to specific assertions within the test suite:

| Property | Validated by |
|---|---|
| P1: Chat idempotency | Flow 1 (3.3, 3.4), Req 10 block (10.1, 10.2, 10.3) |
| P2: MESSAGE_SENT always fires | Flow 1 (3.8), Flow 3 same-chat case (5.6) |
| P3: lastMessage updated | Flow 1 (3.9, 3.10) |
| P4: Message ordering | Flow 2 (4.1) |
| P5: Cursor pagination exhaustive | Flow 2 (4.2, 4.3, 4.4) |
| P6: readBy populated for other sender | Flow 2 (4.6), Flow 7 (9.4) |
| P7: Own messages excluded from readBy | Flow 2 (4.7), Flow 7 (9.3) |
| P8: Mark-read idempotent | Flow 7 (9.5) |
| P9: MESSAGES_READ iff modifiedCount > 0 | Flow 1 (3.14), Flow 7 (9.2) |
| P10: Notification routing by active state | Flow 3 (5.1–5.5) |
| P11: Dedup prevents double push | Flow 3 (5.2) |
| P12: Chat persists after removal | Flow 4 (6.2, 6.3, 6.5–6.7) |
| P13: CONNECTION_REMOVED from either side | Flow 4 (6.4, 6.8) |
| P14: Chat list ordering | Flow 6 (8.1) |
| P15: Search filters by name | Flow 6 (8.2, 8.3, 8.4, 8.5) |
| P16: CONNECTION_ACCEPTED emitted | Flow 1 (11.5) |

### Unit Test Balance

The suite avoids redundant assertions. Each property is verified once in the most natural flow context. Validation guards (401, 403, 404, 400) are grouped into a single describe block to keep them concise.

### Test Naming Convention

- Flow tests: `'<step1> → <step2> → <step3>'` (arrow-separated sequence)
- Guard tests: `'<endpoint> returns <status> when <condition>'`
- Edge case tests: `'<operation> with <condition> returns <expected>'`

### logApi Usage

Every HTTP call uses `logApi(method, path, input, output, tag, description)` for structured test output. Tags follow the pattern `FLOW1-STEP2-DESCRIPTION` (e.g., `FLOW1-ACCEPT-CONNECTION`, `FLOW3-OFFLINE-PUSH`).
