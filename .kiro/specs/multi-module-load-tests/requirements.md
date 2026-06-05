# Requirements Document

## Introduction

Implement load test modules for 5 API modules following the existing Groups module reference implementation pattern established in the `load-test-folder-restructure` spec. Each module receives a complete load testing suite with scenarios, fixtures, seed scripts, entry points, NPM scripts, and property-based tests. The 5 modules are prioritized by criticality: Auth and Chat/Messages (Critical), Connections, Users, and Notifications (High).

## Glossary

- **Load_Test_System**: The k6-based load testing infrastructure located in the `load-tests/` directory, organized by API module
- **Module_Entry_Point**: The `{module-name}.load.js` file that serves as the k6 main script for a module, importing all scenario exec functions and defining k6 options
- **Scenario**: A k6 test script exercising a specific load pattern (baseline, stress, soak, spike, chaos, read-load, write-load, user-journey, role-auth)
- **Fixture**: A JSON file containing pre-seeded test data required by scenarios at runtime
- **Seed_Script**: A Node.js script that populates the database with test fixture data for a specific module, following the `seed-template.js` pattern
- **Auth_Module**: The authentication API module with 10 endpoints: login, social-login, logout, forgot-password, verify-otp, reset-password, change-password, resend-otp, refresh-token, restore-account
- **Chat_Module**: The chat/messaging API module combining Chat (2 endpoints: create-or-get-chat, list-my-chats) and Message (3 endpoints: send-message, get-chat-messages, mark-chat-as-read) functionality
- **Connection_Module**: The social connections API module with 7 endpoints: send-request, accept-request, reject-request, cancel-request, remove-connection, list-connections, list-pending-requests
- **Users_Module**: The user management API module with 20 endpoints spanning public registration, self-management (profile, sessions, email-change, data-export, deletion), and admin operations (list, metrics, review, update, delete)
- **Notification_Module**: The notifications API module with 5 endpoints: get-my-notifications, mark-as-read, mark-all-as-read, send-broadcast (admin), get-sent-history (admin)
- **Reference_Implementation**: The Groups module load test at `load-tests/modules/groups/` serving as the structural and pattern template for all new modules
- **VU**: Virtual User — a simulated concurrent user in k6 load tests
- **Rate_Limiting**: Server-side request throttling applied to auth endpoints (10 req/min for login, 5 req/min for password reset, 20 req/min for refresh)

## Requirements

### Requirement 1: Auth Module Load Tests (🔴 Critical)

**User Story:** As a developer, I want load tests for the Auth module, so that I can verify authentication endpoints (login, OTP, token refresh) perform reliably under concurrent load and rate-limiting pressure.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/auth/` containing `scenarios/`, `fixtures/`, and `auth.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that exercises the login endpoint with valid credentials and verifies a successful token response
3. THE Load_Test_System SHALL provide a stress scenario that ramps VUs against login, verify-otp, and refresh-token endpoints using shared stress profiles from `shared/config/profiles.js`
4. THE Load_Test_System SHALL provide a rate-limit scenario that sends requests exceeding the configured rate limits (10 req/min for login, 5 req/min for password-reset) and verifies the server returns HTTP 429 responses
5. THE Load_Test_System SHALL provide a user-journey scenario simulating a complete authentication flow: login → receive token → refresh token → change password → logout
6. THE Load_Test_System SHALL provide a soak scenario that sustains moderate VU load against refresh-token and verify-otp endpoints for extended duration using shared soak profiles
7. THE Load_Test_System SHALL provide a spike scenario simulating sudden bursts of login attempts to verify the system recovers gracefully after traffic surges
8. WHEN the auth seed script is executed, THE Load_Test_System SHALL create test user accounts with known credentials and write auth-specific fixtures (test accounts with emails and passwords) to `load-tests/modules/auth/fixtures/auth-fixtures.json`
9. THE Load_Test_System SHALL register NPM scripts `load:auth`, `load:auth:stress`, `load:auth:soak`, `load:auth:baseline`, and `load:seed:auth` in package.json following the established naming pattern

### Requirement 2: Chat/Messages Module Load Tests (🔴 Critical)

**User Story:** As a developer, I want load tests for the Chat/Messages module, so that I can verify real-time messaging endpoints handle high-frequency concurrent operations without data loss or degradation.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/chat/` containing `scenarios/`, `fixtures/`, and `chat.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that creates a chat between two users, sends a text message, and retrieves chat messages to verify end-to-end message delivery
3. THE Load_Test_System SHALL provide a write-load scenario simulating high-frequency message sending from multiple VUs to different chat rooms concurrently
4. THE Load_Test_System SHALL provide a read-load scenario simulating concurrent users fetching their chat lists and message histories simultaneously
5. THE Load_Test_System SHALL provide a user-journey scenario simulating a realistic chat flow: create chat → send multiple messages → fetch messages → mark chat as read
6. THE Load_Test_System SHALL provide a stress scenario that ramps VUs sending and reading messages to identify the throughput ceiling and response time degradation point
7. THE Load_Test_System SHALL provide a spike scenario simulating a burst of simultaneous message sends (simulating group activity spikes) to verify message ordering and delivery under sudden load
8. WHEN the chat seed script is executed, THE Load_Test_System SHALL create test chat rooms between fixture users and write chat-specific fixtures (chat IDs, participant mappings) to `load-tests/modules/chat/fixtures/chat-fixtures.json`
9. THE Load_Test_System SHALL register NPM scripts `load:chat`, `load:chat:stress`, `load:chat:soak`, `load:chat:baseline`, and `load:seed:chat` in package.json following the established naming pattern

### Requirement 3: Connections Module Load Tests (🟡 High)

**User Story:** As a developer, I want load tests for the Connections module, so that I can verify concurrent accept/reject operations handle race conditions correctly and connection state transitions remain consistent under load.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/connections/` containing `scenarios/`, `fixtures/`, and `connections.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that sends a connection request, accepts it, and verifies both users appear in each other's connection lists
3. THE Load_Test_System SHALL provide a write-load scenario simulating concurrent connection requests, accepts, and rejects from multiple VUs to test state consistency under concurrent mutations
4. THE Load_Test_System SHALL provide a read-load scenario simulating concurrent users fetching their connection lists and pending requests simultaneously
5. THE Load_Test_System SHALL provide a chaos scenario that simulates race conditions: multiple VUs attempting to accept and reject the same connection request concurrently, verifying only one operation succeeds and the final state is consistent
6. THE Load_Test_System SHALL provide a user-journey scenario simulating a complete connection lifecycle: send request → accept → list connections → remove connection
7. THE Load_Test_System SHALL provide a stress scenario that ramps VUs performing mixed connection operations (send, accept, reject, cancel, remove) to identify throughput limits
8. WHEN the connections seed script is executed, THE Load_Test_System SHALL create pending connection requests between fixture users and write connection-specific fixtures (request IDs, user pair mappings) to `load-tests/modules/connections/fixtures/connections-fixtures.json`
9. THE Load_Test_System SHALL register NPM scripts `load:connections`, `load:connections:stress`, `load:connections:chaos`, `load:connections:baseline`, and `load:seed:connections` in package.json following the established naming pattern

### Requirement 4: Users Module Load Tests (🟡 High)

**User Story:** As a developer, I want load tests for the Users module, so that I can verify profile views, admin queries, and session management endpoints scale under concurrent access from both regular users and administrators.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/users/` containing `scenarios/`, `fixtures/`, and `users.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that fetches own profile, views a public profile, and lists sessions to verify basic endpoint functionality
3. THE Load_Test_System SHALL provide a read-load scenario simulating concurrent profile views (GET /users/:userId/public) and community discovery (GET /users/profiles) from multiple VUs
4. THE Load_Test_System SHALL provide a write-load scenario simulating concurrent profile updates, email change requests, and session revocations from multiple VUs
5. THE Load_Test_System SHALL provide a role-auth scenario verifying that admin-only endpoints (list users, get metrics, review user, update user, delete user) reject non-admin tokens and accept admin tokens under concurrent load
6. THE Load_Test_System SHALL provide a user-journey scenario simulating a complete user lifecycle: view profile → update profile → list sessions → revoke a session → request data export
7. THE Load_Test_System SHALL provide a stress scenario that ramps VUs performing mixed read and write operations across self-management and admin endpoints
8. THE Load_Test_System SHALL provide a soak scenario sustaining moderate VU load against profile read endpoints for extended duration to detect memory leaks or connection pool exhaustion
9. WHEN the users seed script is executed, THE Load_Test_System SHALL create test user accounts across all roles (admin, brother, sister) and write user-specific fixtures (user IDs, profile data references) to `load-tests/modules/users/fixtures/users-fixtures.json`
10. THE Load_Test_System SHALL register NPM scripts `load:users`, `load:users:stress`, `load:users:soak`, `load:users:baseline`, and `load:seed:users` in package.json following the established naming pattern

### Requirement 5: Notifications Module Load Tests (🟡 High)

**User Story:** As a developer, I want load tests for the Notifications module, so that I can verify push notification delivery, broadcast operations, and read-marking perform reliably when many users receive notifications simultaneously.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/notifications/` containing `scenarios/`, `fixtures/`, and `notifications.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that fetches notifications for a user, marks one as read, and marks all as read to verify basic endpoint functionality
3. THE Load_Test_System SHALL provide a read-load scenario simulating concurrent users fetching their notification lists simultaneously to test pagination and query performance under load
4. THE Load_Test_System SHALL provide a write-load scenario simulating an admin broadcasting notifications to all users followed by concurrent mark-as-read operations from multiple VUs
5. THE Load_Test_System SHALL provide a user-journey scenario simulating a notification lifecycle: admin sends broadcast → users fetch notifications → users mark individual notifications as read → users mark all as read
6. THE Load_Test_System SHALL provide a stress scenario that ramps VUs performing concurrent notification fetches and mark-as-read operations to identify throughput limits
7. THE Load_Test_System SHALL provide a spike scenario simulating a broadcast event where all VUs simultaneously fetch their notifications after a broadcast is sent, testing the read amplification pattern
8. WHEN the notifications seed script is executed, THE Load_Test_System SHALL create test notifications for fixture users and write notification-specific fixtures (notification IDs, broadcast references) to `load-tests/modules/notifications/fixtures/notifications-fixtures.json`
9. THE Load_Test_System SHALL register NPM scripts `load:notifications`, `load:notifications:stress`, `load:notifications:spike`, `load:notifications:baseline`, and `load:seed:notifications` in package.json following the established naming pattern

### Requirement 6: Seed Script Implementation

**User Story:** As a developer, I want seed scripts for each new module following the seed-template.js pattern, so that I can independently seed test data for any module without affecting other modules' fixtures.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide seed scripts at `load-tests/scripts/seed-auth.js`, `load-tests/scripts/seed-chat.js`, `load-tests/scripts/seed-connections.js`, `load-tests/scripts/seed-users.js`, and `load-tests/scripts/seed-notifications.js` following the structure defined in `seed-template.js`
2. WHEN a seed script is executed, THE Load_Test_System SHALL perform idempotent cleanup by deleting previously seeded data (identified by the `loadtest-` prefix convention) before creating new data
3. WHEN a seed script is executed, THE Load_Test_System SHALL write module-specific fixtures to the corresponding `modules/{module-name}/fixtures/{module-name}-fixtures.json` path
4. WHEN a seed script requires shared user accounts, THE Load_Test_System SHALL read existing users from `shared/fixtures/base-fixtures.json` rather than creating duplicate user accounts
5. IF a seed script fails to connect to the database, THEN THE Load_Test_System SHALL exit with code 1 and log an error message indicating the connection failure
6. IF a seed script fails during data creation, THEN THE Load_Test_System SHALL disconnect from the database, exit with code 1, and log the error reason

### Requirement 7: Module Entry Points

**User Story:** As a developer, I want each module to have a properly configured entry point file, so that running `npm run load:{module}` executes all scenarios with correct thresholds and generates module-specific reports.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide entry point files (`auth.load.js`, `chat.load.js`, `connections.load.js`, `users.load.js`, `notifications.load.js`) that import all scenario exec functions from their respective `scenarios/` directories
2. THE Load_Test_System SHALL configure each entry point with k6 scenario executors specifying appropriate VU counts, durations, and start times for each scenario function
3. THE Load_Test_System SHALL import base thresholds from `../../shared/config/thresholds.js` in each entry point and apply them via object spread in the k6 options
4. THE Load_Test_System SHALL use the `createHandleSummary` function from `../../shared/helpers/report.js` in each entry point to generate module-specific HTML reports
5. WHEN `SKIP_LOAD_TESTS` environment variable is set to `"true"`, THE Load_Test_System SHALL skip scenario execution in the default export function of each entry point

### Requirement 8: Property-Based Tests

**User Story:** As a developer, I want property-based tests for each module's scenario logic, so that I can verify scenario behavior holds across a wide range of generated inputs rather than just hand-picked examples.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide test files under `load-tests/__tests__/{module-name}/` for each of the 5 new modules
2. THE Load_Test_System SHALL include at least one property-based test per module verifying that fixture loading and user selection via `getUser` produces valid users for all generated VU indices
3. THE Load_Test_System SHALL include at least one property-based test per module verifying that the module entry point's scenario configuration contains valid executor types, positive VU counts, and non-empty duration strings
4. THE Load_Test_System SHALL use fast-check as the property-based testing library with a minimum of 100 iterations per property test
5. THE Load_Test_System SHALL use vitest as the test runner, with test files discoverable via the pattern `load-tests/__tests__/**/*.test.js`

### Requirement 9: NPM Script Registration

**User Story:** As a developer, I want all new module NPM scripts registered in package.json, so that I can run any module's load tests or seed scripts using consistent, discoverable commands.

#### Acceptance Criteria

1. THE Load_Test_System SHALL register scripts following the pattern `load:{module-name}` pointing to `k6 run --out web-dashboard load-tests/modules/{module-name}/{module-name}.load.js` for each of the 5 new modules
2. THE Load_Test_System SHALL register scripts following the pattern `load:{module-name}:{scenario}` for key scenarios (at minimum: stress, baseline) for each of the 5 new modules
3. THE Load_Test_System SHALL register scripts following the pattern `load:seed:{module-name}` pointing to `node load-tests/scripts/seed-{module-name}.js` for each of the 5 new modules
4. WHEN a registered NPM script is executed, THE Load_Test_System SHALL resolve the file path correctly relative to the project root without requiring additional configuration

### Requirement 10: Shared Infrastructure Reuse

**User Story:** As a developer, I want all new modules to reuse the existing shared helpers, configuration, and base fixtures, so that there is no code duplication and all modules benefit from centralized improvements.

#### Acceptance Criteria

1. THE Load_Test_System SHALL import authentication helpers (`getUser`, `getToken`, `getAuthHeaders`) from `shared/helpers/auth.js` in all scenario files that require authenticated requests
2. THE Load_Test_System SHALL import `resolveBaseUrl` from `shared/helpers/scenario-utils.js` in all scenario files to resolve the API base URL consistently
3. THE Load_Test_System SHALL import stress and soak stage profiles from `shared/config/profiles.js` in all stress and soak scenarios rather than defining inline stage arrays
4. THE Load_Test_System SHALL load base fixtures from `shared/fixtures/base-fixtures.json` using k6 SharedArray in all scenario files, merging with module-specific fixtures via object spread
5. THE Load_Test_System SHALL import base thresholds from `shared/config/thresholds.js` in all module entry points

### Requirement 11: Auth Module Rate-Limit Awareness

**User Story:** As a developer, I want auth load test scenarios to account for server-side rate limiting, so that tests produce meaningful results rather than being dominated by 429 responses.

#### Acceptance Criteria

1. WHEN the auth stress scenario executes, THE Load_Test_System SHALL distribute requests across multiple test user accounts to avoid triggering per-IP rate limits during normal load testing
2. THE Load_Test_System SHALL provide a dedicated rate-limit validation scenario that intentionally exceeds rate limits from a single source and asserts HTTP 429 responses are returned within the configured window
3. WHEN the auth soak scenario executes, THE Load_Test_System SHALL pace requests below the rate limit thresholds (10 req/min for login, 20 req/min for refresh per IP) to measure sustained performance without rate-limit interference

