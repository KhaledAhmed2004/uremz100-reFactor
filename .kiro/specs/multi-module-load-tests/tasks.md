# Implementation Plan: Multi-Module Load Tests

## Overview

Implement load test suites for 5 API modules (Auth, Chat, Connections, Users, Notifications) following the Groups reference implementation pattern. Each module gets a complete directory structure with scenarios, fixtures, seed scripts, entry points, NPM scripts, and property-based tests. Implementation proceeds module-by-module, starting with shared seed infrastructure, then critical modules (Auth, Chat), then high-priority modules (Connections, Users, Notifications), and finally wiring everything together with NPM scripts and property tests.

## Tasks

- [x] 1. Create Auth module load test suite
  - [x] 1.1 Create Auth module directory structure and entry point
    - Create `load-tests/modules/auth/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `auth.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, soak, spike, user-journey, rate-limit)
    - Import `THRESHOLDS` from `../../shared/config/thresholds.js`
    - Use `createHandleSummary('auth')` for HTML report generation
    - Implement `SKIP_LOAD_TESTS` environment variable check in default export
    - _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4, 7.5, 10.5_

  - [x] 1.2 Implement Auth baseline scenario
    - Create `load-tests/modules/auth/scenarios/baseline.js`
    - Exercise login endpoint with valid credentials from fixtures
    - Verify successful token response with `check()` assertions
    - Use `getAuthHeaders` from shared helpers and `resolveBaseUrl` for URL construction
    - Load fixtures via k6 `SharedArray`
    - _Requirements: 1.2, 10.1, 10.2, 10.4_

  - [x] 1.3 Implement Auth stress scenario
    - Create `load-tests/modules/auth/scenarios/stress.js`
    - Ramp VUs against login, verify-otp, and refresh-token endpoints
    - Import stress profiles from `shared/config/profiles.js`
    - Distribute requests across multiple test user accounts to avoid per-IP rate limits
    - _Requirements: 1.3, 10.3, 11.1_

  - [x] 1.4 Implement Auth rate-limit scenario
    - Create `load-tests/modules/auth/scenarios/rate-limit.js`
    - Send requests exceeding configured rate limits (10 req/min login, 5 req/min password-reset)
    - Assert HTTP 429 responses are returned within the configured window
    - _Requirements: 1.4, 11.2_

  - [x] 1.5 Implement Auth user-journey scenario
    - Create `load-tests/modules/auth/scenarios/user-journey.js`
    - Simulate complete flow: login → receive token → refresh token → change password → logout
    - _Requirements: 1.5_

  - [x] 1.6 Implement Auth soak scenario
    - Create `load-tests/modules/auth/scenarios/soak.js`
    - Sustain moderate VU load against refresh-token and verify-otp endpoints
    - Import soak profiles from `shared/config/profiles.js`
    - Pace requests below rate limit thresholds (10 req/min login, 20 req/min refresh per IP)
    - _Requirements: 1.6, 10.3, 11.3_

  - [x] 1.7 Implement Auth spike scenario
    - Create `load-tests/modules/auth/scenarios/spike.js`
    - Simulate sudden bursts of login attempts
    - Verify system recovers gracefully after traffic surges
    - _Requirements: 1.7_

  - [x] 1.8 Create Auth seed script
    - Create `load-tests/scripts/seed-auth.js` following `seed-template.js` pattern
    - Connect to MongoDB using `LOAD_TEST_DB` / `DATABASE_URL` / `MONGODB_URI`
    - Perform idempotent cleanup (delete data with `loadtest-` prefix)
    - Create test user accounts with known credentials
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/auth/fixtures/auth-fixtures.json`
    - Handle errors: exit code 1 on connection failure or data creation failure
    - _Requirements: 1.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 2. Checkpoint - Auth module complete
  - Ensure all Auth module files are created and structurally correct, ask the user if questions arise.

- [x] 3. Create Chat module load test suite
  - [x] 3.1 Create Chat module directory structure and entry point
    - Create `load-tests/modules/chat/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `chat.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, spike, read-load, write-load, user-journey)
    - Import `THRESHOLDS`, use `createHandleSummary('chat')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 2.1, 7.1, 7.2, 7.3, 7.4, 7.5, 10.5_

  - [x] 3.2 Implement Chat baseline scenario
    - Create `load-tests/modules/chat/scenarios/baseline.js`
    - Create a chat between two users, send a text message, retrieve chat messages
    - Verify end-to-end message delivery with `check()` assertions
    - _Requirements: 2.2, 10.1, 10.2, 10.4_

  - [x] 3.3 Implement Chat write-load scenario
    - Create `load-tests/modules/chat/scenarios/write-load.js`
    - Simulate high-frequency message sending from multiple VUs to different chat rooms
    - _Requirements: 2.3_

  - [x] 3.4 Implement Chat read-load scenario
    - Create `load-tests/modules/chat/scenarios/read-load.js`
    - Simulate concurrent users fetching chat lists and message histories
    - _Requirements: 2.4_

  - [x] 3.5 Implement Chat user-journey scenario
    - Create `load-tests/modules/chat/scenarios/user-journey.js`
    - Simulate: create chat → send multiple messages → fetch messages → mark chat as read
    - _Requirements: 2.5_

  - [x] 3.6 Implement Chat stress scenario
    - Create `load-tests/modules/chat/scenarios/stress.js`
    - Ramp VUs sending and reading messages to identify throughput ceiling
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 2.6, 10.3_

  - [x] 3.7 Implement Chat spike scenario
    - Create `load-tests/modules/chat/scenarios/spike.js`
    - Simulate burst of simultaneous message sends (group activity spikes)
    - Verify message ordering and delivery under sudden load
    - _Requirements: 2.7_

  - [x] 3.8 Create Chat seed script
    - Create `load-tests/scripts/seed-chat.js` following `seed-template.js` pattern
    - Perform idempotent cleanup, create test chat rooms between fixture users
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/chat/fixtures/chat-fixtures.json`
    - Handle errors with proper exit codes and logging
    - _Requirements: 2.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 4. Checkpoint - Chat module complete
  - Ensure all Chat module files are created and structurally correct, ask the user if questions arise.

- [x] 5. Create Connections module load test suite
  - [x] 5.1 Create Connections module directory structure and entry point
    - Create `load-tests/modules/connections/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `connections.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, read-load, write-load, user-journey, chaos)
    - Import `THRESHOLDS`, use `createHandleSummary('connections')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 3.1, 7.1, 7.2, 7.3, 7.4, 7.5, 10.5_

  - [x] 5.2 Implement Connections baseline scenario
    - Create `load-tests/modules/connections/scenarios/baseline.js`
    - Send a connection request, accept it, verify both users appear in each other's connection lists
    - _Requirements: 3.2, 10.1, 10.2, 10.4_

  - [x] 5.3 Implement Connections write-load scenario
    - Create `load-tests/modules/connections/scenarios/write-load.js`
    - Simulate concurrent connection requests, accepts, and rejects from multiple VUs
    - Test state consistency under concurrent mutations
    - _Requirements: 3.3_

  - [x] 5.4 Implement Connections read-load scenario
    - Create `load-tests/modules/connections/scenarios/read-load.js`
    - Simulate concurrent users fetching connection lists and pending requests
    - _Requirements: 3.4_

  - [x] 5.5 Implement Connections chaos scenario
    - Create `load-tests/modules/connections/scenarios/chaos.js`
    - Simulate race conditions: multiple VUs attempting to accept/reject the same request concurrently
    - Verify only one operation succeeds and final state is consistent
    - _Requirements: 3.5_

  - [x] 5.6 Implement Connections user-journey scenario
    - Create `load-tests/modules/connections/scenarios/user-journey.js`
    - Simulate: send request → accept → list connections → remove connection
    - _Requirements: 3.6_

  - [x] 5.7 Implement Connections stress scenario
    - Create `load-tests/modules/connections/scenarios/stress.js`
    - Ramp VUs performing mixed operations (send, accept, reject, cancel, remove)
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 3.7, 10.3_

  - [x] 5.8 Create Connections seed script
    - Create `load-tests/scripts/seed-connections.js` following `seed-template.js` pattern
    - Perform idempotent cleanup, create pending connection requests between fixture users
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/connections/fixtures/connections-fixtures.json`
    - Handle errors with proper exit codes and logging
    - _Requirements: 3.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 6. Create Users module load test suite
  - [x] 6.1 Create Users module directory structure and entry point
    - Create `load-tests/modules/users/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `users.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, soak, read-load, write-load, user-journey, role-auth)
    - Import `THRESHOLDS`, use `createHandleSummary('users')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 4.1, 7.1, 7.2, 7.3, 7.4, 7.5, 10.5_

  - [x] 6.2 Implement Users baseline scenario
    - Create `load-tests/modules/users/scenarios/baseline.js`
    - Fetch own profile, view a public profile, list sessions
    - Verify basic endpoint functionality with `check()` assertions
    - _Requirements: 4.2, 10.1, 10.2, 10.4_

  - [x] 6.3 Implement Users read-load scenario
    - Create `load-tests/modules/users/scenarios/read-load.js`
    - Simulate concurrent profile views (GET /users/:userId/public) and community discovery (GET /users/profiles)
    - _Requirements: 4.3_

  - [x] 6.4 Implement Users write-load scenario
    - Create `load-tests/modules/users/scenarios/write-load.js`
    - Simulate concurrent profile updates, email change requests, and session revocations
    - _Requirements: 4.4_

  - [x] 6.5 Implement Users role-auth scenario
    - Create `load-tests/modules/users/scenarios/role-auth.js`
    - Verify admin-only endpoints reject non-admin tokens and accept admin tokens under concurrent load
    - Test: list users, get metrics, review user, update user, delete user
    - _Requirements: 4.5_

  - [x] 6.6 Implement Users user-journey scenario
    - Create `load-tests/modules/users/scenarios/user-journey.js`
    - Simulate: view profile → update profile → list sessions → revoke session → request data export
    - _Requirements: 4.6_

  - [x] 6.7 Implement Users stress scenario
    - Create `load-tests/modules/users/scenarios/stress.js`
    - Ramp VUs performing mixed read/write operations across self-management and admin endpoints
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 4.7, 10.3_

  - [x] 6.8 Implement Users soak scenario
    - Create `load-tests/modules/users/scenarios/soak.js`
    - Sustain moderate VU load against profile read endpoints for extended duration
    - Import soak profiles from `shared/config/profiles.js`
    - Detect memory leaks or connection pool exhaustion
    - _Requirements: 4.8, 10.3_

  - [x] 6.9 Create Users seed script
    - Create `load-tests/scripts/seed-users.js` following `seed-template.js` pattern
    - Perform idempotent cleanup, create test user accounts across all roles (admin, brother, sister)
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/users/fixtures/users-fixtures.json`
    - Handle errors with proper exit codes and logging
    - _Requirements: 4.9, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 7. Checkpoint - Connections and Users modules complete
  - Ensure all Connections and Users module files are created and structurally correct, ask the user if questions arise.

- [x] 8. Create Notifications module load test suite
  - [x] 8.1 Create Notifications module directory structure and entry point
    - Create `load-tests/modules/notifications/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `notifications.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, spike, read-load, write-load, user-journey)
    - Import `THRESHOLDS`, use `createHandleSummary('notifications')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 5.1, 7.1, 7.2, 7.3, 7.4, 7.5, 10.5_

  - [x] 8.2 Implement Notifications baseline scenario
    - Create `load-tests/modules/notifications/scenarios/baseline.js`
    - Fetch notifications for a user, mark one as read, mark all as read
    - Verify basic endpoint functionality with `check()` assertions
    - _Requirements: 5.2, 10.1, 10.2, 10.4_

  - [x] 8.3 Implement Notifications read-load scenario
    - Create `load-tests/modules/notifications/scenarios/read-load.js`
    - Simulate concurrent users fetching notification lists to test pagination and query performance
    - _Requirements: 5.3_

  - [x] 8.4 Implement Notifications write-load scenario
    - Create `load-tests/modules/notifications/scenarios/write-load.js`
    - Simulate admin broadcasting notifications followed by concurrent mark-as-read operations
    - _Requirements: 5.4_

  - [x] 8.5 Implement Notifications user-journey scenario
    - Create `load-tests/modules/notifications/scenarios/user-journey.js`
    - Simulate: admin sends broadcast → users fetch notifications → mark individual as read → mark all as read
    - _Requirements: 5.5_

  - [x] 8.6 Implement Notifications stress scenario
    - Create `load-tests/modules/notifications/scenarios/stress.js`
    - Ramp VUs performing concurrent notification fetches and mark-as-read operations
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 5.6, 10.3_

  - [x] 8.7 Implement Notifications spike scenario
    - Create `load-tests/modules/notifications/scenarios/spike.js`
    - Simulate broadcast event where all VUs simultaneously fetch notifications after broadcast
    - Test read amplification pattern
    - _Requirements: 5.7_

  - [x] 8.8 Create Notifications seed script
    - Create `load-tests/scripts/seed-notifications.js` following `seed-template.js` pattern
    - Perform idempotent cleanup, create test notifications for fixture users
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/notifications/fixtures/notifications-fixtures.json`
    - Handle errors with proper exit codes and logging
    - _Requirements: 5.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 9. Register NPM scripts in package.json
  - [x] 9.1 Register all module NPM scripts
    - Add `load:auth`, `load:auth:stress`, `load:auth:soak`, `load:auth:baseline`, `load:seed:auth`
    - Add `load:chat`, `load:chat:stress`, `load:chat:soak`, `load:chat:baseline`, `load:seed:chat`
    - Add `load:connections`, `load:connections:stress`, `load:connections:chaos`, `load:connections:baseline`, `load:seed:connections`
    - Add `load:users`, `load:users:stress`, `load:users:soak`, `load:users:baseline`, `load:seed:users`
    - Add `load:notifications`, `load:notifications:stress`, `load:notifications:spike`, `load:notifications:baseline`, `load:seed:notifications`
    - Each `load:{module}` script points to `k6 run --out web-dashboard load-tests/modules/{module}/{module}.load.js`
    - Each `load:seed:{module}` script points to `node load-tests/scripts/seed-{module}.js`
    - _Requirements: 1.9, 2.9, 3.9, 4.10, 5.9, 9.1, 9.2, 9.3, 9.4_

- [x] 10. Create property-based tests for all modules
  - [x] 10.1 Create Auth module property tests
    - Create `load-tests/__tests__/auth/auth.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices (0–999)
    - Property test: auth entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - Use vitest as test runner
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

  - [x] 10.2 Create Chat module property tests
    - Create `load-tests/__tests__/chat/chat.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: chat entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

  - [x] 10.3 Create Connections module property tests
    - Create `load-tests/__tests__/connections/connections.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: connections entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

  - [x] 10.4 Create Users module property tests
    - Create `load-tests/__tests__/users/users.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: users entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

  - [x] 10.5 Create Notifications module property tests
    - Create `load-tests/__tests__/notifications/notifications.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: notifications entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All modules follow the Groups reference implementation pattern at `load-tests/modules/groups/`
- Shared infrastructure (helpers, config, base fixtures) is reused — no code duplication
- Seed scripts are idempotent and use the `loadtest-` prefix convention for cleanup
- The Chat module combines Chat and Message API endpoints into a single test module
- Auth module scenarios include rate-limit awareness to produce meaningful results

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1", "5.1", "6.1", "8.1"] },
    { "id": 1, "tasks": ["1.2", "1.8", "3.2", "3.8", "5.2", "5.8", "6.2", "6.9", "8.2", "8.8"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "1.6", "1.7", "3.3", "3.4", "3.5", "3.6", "3.7", "5.3", "5.4", "5.5", "5.6", "5.7", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "8.3", "8.4", "8.5", "8.6", "8.7"] },
    { "id": 3, "tasks": ["9.1"] },
    { "id": 4, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5"] }
  ]
}
```
