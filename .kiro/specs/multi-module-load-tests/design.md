# Design Document: Multi-Module Load Tests

## Overview

This design extends the existing k6-based load testing infrastructure to cover 5 additional API modules: Auth, Chat/Messages, Connections, Users, and Notifications. Each module receives a complete load testing suite following the structural and behavioral patterns established by the Groups module reference implementation.

The design prioritizes:
- **Consistency**: All modules follow the same directory structure, import patterns, and naming conventions as the Groups reference
- **Shared infrastructure reuse**: Authentication helpers, profiles, thresholds, and report generation are imported from `shared/` — no duplication
- **Idempotent seeding**: Each module's seed script can be re-run safely, cleaning up prior data before creating fresh fixtures
- **Property-based test coverage**: Each module includes fast-check property tests verifying configuration validity and fixture distribution logic

### Key Design Decisions

1. **Module-per-directory isolation**: Each module is self-contained under `load-tests/modules/{name}/` with its own scenarios, fixtures, and entry point. This allows independent execution and seeding.
2. **Shared base fixtures**: All modules read user accounts from `shared/fixtures/base-fixtures.json` (created by `seed-groups.js`). Module-specific seed scripts only create module-specific data (chats, connections, notifications, etc.).
3. **Rate-limit awareness for Auth**: The Auth module includes a dedicated rate-limit validation scenario and paces soak/stress scenarios to avoid 429 interference.
4. **Chat combines two API modules**: Chat and Message endpoints are tested together as a single "chat" load test module since they form a cohesive messaging workflow.

## Architecture

```mermaid
graph TD
    subgraph "load-tests/"
        subgraph "shared/"
            SH[helpers/auth.js<br/>helpers/scenario-utils.js<br/>helpers/report.js]
            SC[config/profiles.js<br/>config/thresholds.js]
            SF[fixtures/base-fixtures.json]
        end

        subgraph "modules/"
            AUTH[auth/<br/>auth.load.js<br/>scenarios/<br/>fixtures/]
            CHAT[chat/<br/>chat.load.js<br/>scenarios/<br/>fixtures/]
            CONN[connections/<br/>connections.load.js<br/>scenarios/<br/>fixtures/]
            USERS[users/<br/>users.load.js<br/>scenarios/<br/>fixtures/]
            NOTIF[notifications/<br/>notifications.load.js<br/>scenarios/<br/>fixtures/]
            GROUPS[groups/ (reference)]
        end

        subgraph "scripts/"
            SA[seed-auth.js]
            SCH[seed-chat.js]
            SCO[seed-connections.js]
            SU[seed-users.js]
            SN[seed-notifications.js]
        end

        subgraph "__tests__/"
            TA[auth/*.test.js]
            TC[chat/*.test.js]
            TCO[connections/*.test.js]
            TU[users/*.test.js]
            TN[notifications/*.test.js]
        end
    end

    AUTH --> SH
    AUTH --> SC
    AUTH --> SF
    CHAT --> SH
    CHAT --> SC
    CHAT --> SF
    CONN --> SH
    CONN --> SC
    CONN --> SF
    USERS --> SH
    USERS --> SC
    USERS --> SF
    NOTIF --> SH
    NOTIF --> SC
    NOTIF --> SF

    SA --> SF
    SCH --> SF
    SCO --> SF
    SU --> SF
    SN --> SF
```

### Scenario Types per Module

| Module | baseline | stress | soak | spike | read-load | write-load | user-journey | chaos | role-auth | rate-limit |
|--------|----------|--------|------|-------|-----------|------------|--------------|-------|-----------|------------|
| Auth | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | — | — | ✓ |
| Chat | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Connections | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | — | — |
| Users | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | — | ✓ | — |
| Notifications | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | — | — | — |

## Components and Interfaces

### 1. Module Entry Points

Each module has a `{module-name}.load.js` file that:
- Imports all scenario exec functions from `./scenarios/`
- Re-exports them for k6 scenario executor discovery
- Defines `options` with scenario configurations (executor type, VUs, duration, startTime)
- Spreads `THRESHOLDS` from shared config
- Uses `createHandleSummary(moduleName)` for HTML report generation
- Implements `SKIP_LOAD_TESTS` environment variable check in the default export

```javascript
// Example: auth.load.js structure
import { THRESHOLDS } from '../../shared/config/thresholds.js';
import { createHandleSummary } from '../../shared/helpers/report.js';
import { runBaseline } from './scenarios/baseline.js';
import { runStress } from './scenarios/stress.js';
// ... other scenario imports

export { runBaseline, runStress, /* ... */ };

export const options = {
  scenarios: {
    baseline: { executor: 'per-vu-iterations', vus: 1, iterations: 1, exec: 'runBaseline', startTime: '0s' },
    stress: { executor: 'ramping-vus', startVUs: 0, stages: [...], exec: 'runStress', startTime: '5s' },
    // ...
  },
  thresholds: { ...THRESHOLDS },
};

export default function () {
  if (__ENV.SKIP_LOAD_TESTS === 'true') return;
}

export const handleSummary = createHandleSummary('auth');
```

### 2. Scenario Files

Each scenario file exports:
- A named exec function (e.g., `runBaseline`, `runStress`)
- Loads fixtures via k6 `SharedArray`
- Uses `getAuthHeaders` for authenticated requests
- Uses `resolveBaseUrl` for URL construction
- Uses `check()` for response assertions

### 3. Seed Scripts

Each seed script follows `seed-template.js`:
1. Connect to MongoDB (using `LOAD_TEST_DB` / `DATABASE_URL` / `MONGODB_URI`)
2. Idempotent cleanup (delete data with `loadtest-` prefix)
3. Create module-specific test data
4. Write fixtures to `modules/{name}/fixtures/{name}-fixtures.json`
5. Disconnect and exit

### 4. Property-Based Tests

Each module has a test file under `__tests__/{module-name}/` that:
- Uses vitest as the test runner
- Uses fast-check for property generation
- Tests fixture distribution (getUser with arbitrary VU indices)
- Tests scenario configuration validity (executor types, VU counts, durations)
- Runs minimum 100 iterations per property

### Interface: Shared Helpers

| Helper | Import Path | Purpose |
|--------|-------------|---------|
| `getUser(fixtures, role, vuIndex)` | `shared/helpers/auth.js` | Round-robin user selection from fixture pool |
| `getToken(fixtures, role, vuIndex)` | `shared/helpers/auth.js` | Extract JWT token for a user |
| `getAuthHeaders(fixtures, role, vuIndex)` | `shared/helpers/auth.js` | Build Authorization header |
| `resolveBaseUrl(envValue)` | `shared/helpers/scenario-utils.js` | Resolve API base URL |
| `getStressProfile(profileValue)` | `shared/config/profiles.js` | Get stress stage array |
| `getSoakProfile(profileValue)` | `shared/config/profiles.js` | Get soak stage array |
| `createHandleSummary(moduleName)` | `shared/helpers/report.js` | Generate module-specific HTML report |
| `THRESHOLDS` | `shared/config/thresholds.js` | Base k6 performance thresholds |

## Data Models

### Fixture Structures

#### Base Fixtures (`shared/fixtures/base-fixtures.json`)
```json
{
  "adminUser": { "id": "string", "email": "string", "token": "string" },
  "brotherUsers": [{ "id": "string", "email": "string", "token": "string" }],
  "sisterUsers": [{ "id": "string", "email": "string", "token": "string" }]
}
```

#### Auth Fixtures (`modules/auth/fixtures/auth-fixtures.json`)
```json
{
  "testAccounts": [
    { "email": "string", "password": "string", "role": "string", "userId": "string" }
  ],
  "otpTestAccount": { "email": "string", "password": "string", "userId": "string" },
  "refreshTokens": ["string"]
}
```

#### Chat Fixtures (`modules/chat/fixtures/chat-fixtures.json`)
```json
{
  "chatRooms": [
    { "chatId": "string", "participants": ["string", "string"] }
  ],
  "messageIds": ["string"]
}
```

#### Connections Fixtures (`modules/connections/fixtures/connections-fixtures.json`)
```json
{
  "pendingRequests": [
    { "requestId": "string", "senderId": "string", "receiverId": "string" }
  ],
  "existingConnections": [
    { "userId1": "string", "userId2": "string" }
  ]
}
```

#### Users Fixtures (`modules/users/fixtures/users-fixtures.json`)
```json
{
  "adminUsers": [{ "id": "string", "email": "string", "token": "string" }],
  "regularUsers": [{ "id": "string", "email": "string", "token": "string", "role": "string" }],
  "profileData": [{ "userId": "string", "name": "string" }]
}
```

#### Notifications Fixtures (`modules/notifications/fixtures/notifications-fixtures.json`)
```json
{
  "notifications": [
    { "notificationId": "string", "userId": "string", "type": "string", "isRead": false }
  ],
  "broadcastIds": ["string"]
}
```

### Seed Data Conventions

- All seeded data uses the `loadtest-` prefix for emails and identifiable fields
- Seed scripts are idempotent: they delete all `loadtest-` prefixed data before creating new data
- Module seed scripts read shared users from `base-fixtures.json` rather than creating duplicates
- Each seed script writes its output to the module's `fixtures/` directory

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Fixture-Based User Selection Validity

*For any* non-negative VU index and any valid role ('admin', 'brother', 'sister'), calling `getUser(fixtures, role, vuIndex)` SHALL return a valid user object containing non-empty `id`, `email`, and `token` string fields, and the selection SHALL distribute across the pool via modulo arithmetic without ever producing an out-of-bounds index.

**Validates: Requirements 8.2, 11.1**

### Property 2: Scenario Configuration Validity

*For any* module entry point's scenario configuration object, every scenario SHALL have a valid k6 executor type (one of: 'per-vu-iterations', 'constant-vus', 'ramping-vus', 'shared-iterations', 'ramping-arrival-rate', 'constant-arrival-rate'), a positive VU count (or positive startVUs for ramping executors), and a non-empty exec function name referencing an exported function.

**Validates: Requirements 7.2, 8.3**

### Property 3: Seed Script Idempotence

*For any* module seed script, executing the script twice in succession against the same database SHALL produce identical fixture JSON output, demonstrating that the cleanup phase fully removes prior seeded data before re-creating it.

**Validates: Requirements 6.2**

### Property 4: Fixture Path Resolution

*For any* valid module name string (matching the pattern `[a-z][a-z0-9-]*`), the fixture output path SHALL resolve to `load-tests/modules/{module-name}/fixtures/{module-name}-fixtures.json` relative to the project root.

**Validates: Requirements 6.3**

### Property 5: SKIP_LOAD_TESTS Bypass

*For any* module entry point, when the `SKIP_LOAD_TESTS` environment variable is set to the string `"true"`, the default export function SHALL return immediately without executing any HTTP requests or scenario logic.

**Validates: Requirements 7.5**

## Error Handling

### Seed Script Errors

| Error Condition | Behavior |
|----------------|----------|
| No MongoDB URI in environment | Log error message, exit with code 1 |
| Database connection failure | Log connection error, exit with code 1 |
| Data creation failure | Disconnect from database, log error reason, exit with code 1 |
| Missing JWT_SECRET | Log error message, exit with code 1 |

### Scenario Runtime Errors

| Error Condition | Behavior |
|----------------|----------|
| Fixture file not found | k6 fails at startup with file-not-found error (scenario cannot run without fixtures) |
| API server unreachable | HTTP requests fail, k6 reports connection errors in summary |
| Rate limit exceeded (Auth) | Rate-limit scenario asserts 429; other scenarios distribute across users to avoid |
| Invalid auth token | Requests return 401; check assertions fail and are reported in summary |

### NPM Script Errors

| Error Condition | Behavior |
|----------------|----------|
| k6 not installed | NPM script fails with "command not found" |
| File path incorrect | k6 fails with "file not found" error |
| Threshold breach | k6 exits with non-zero code (threshold failure) |

## Testing Strategy

### Property-Based Tests (fast-check + vitest)

Each module gets a test file at `load-tests/__tests__/{module-name}/{module-name}.test.js` containing:

1. **User selection property**: Verify `getUser` returns valid users for all generated VU indices (0–999)
2. **Configuration validity property**: Verify the module's scenario options contain valid executors, positive VUs, and valid durations

Configuration:
- Library: `fast-check` (already in devDependencies)
- Runner: `vitest` with pattern `load-tests/__tests__/**/*.test.js`
- Minimum iterations: 100 per property (`{ numRuns: 100 }`)
- Tag format: `Feature: multi-module-load-tests, Property {N}: {description}`

### Integration Tests

Integration tests are run by executing the actual k6 scenarios against a running server with seeded data:
- `npm run load:seed:{module}` → seeds test data
- `npm run load:{module}:baseline` → verifies basic endpoint functionality
- Full suite: `npm run load:{module}` → runs all scenarios with thresholds

### Smoke Tests

Structural verification that all expected files exist and package.json scripts are registered:
- Verify directory structure matches reference implementation
- Verify all NPM scripts resolve to existing files
- Verify shared imports are present in scenario files

### Test Execution Order

1. Run `npm run load:seed:groups` first (creates base fixtures shared by all modules)
2. Run module-specific seeds: `npm run load:seed:{module}`
3. Run property tests: `npx vitest --run load-tests/__tests__/`
4. Run baseline scenarios: `npm run load:{module}:baseline`
5. Run full load tests: `npm run load:{module}`
