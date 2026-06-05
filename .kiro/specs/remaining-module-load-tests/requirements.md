# Requirements Document

## Introduction

Extend the existing k6-based load testing infrastructure to cover the remaining 11 API modules that do not yet have load tests. The project already has complete load test suites for 6 modules (Groups, Auth, Chat, Connections, Users, Notifications) following a well-established pattern. This spec covers: Prayer-Time, Mosque, Dua, Ask-Question, Subscription, Support-Ticket, Learning-Content, Khutbah, Admin, Legal, and Pending-Email.

Modules are prioritized by traffic impact:
- **High priority** (user-facing, frequent traffic): Prayer-Time, Mosque, Dua, Ask-Question
- **Medium priority** (user-facing, moderate traffic): Subscription, Support-Ticket, Learning-Content, Khutbah
- **Low priority** (admin/internal): Admin, Legal, Pending-Email

## Glossary

- **Load_Test_System**: The k6-based load testing infrastructure located in the `load-tests/` directory, organized by API module
- **Module_Entry_Point**: The `{module-name}.load.js` file that serves as the k6 main script for a module, importing all scenario exec functions and defining k6 options
- **Scenario**: A k6 test script exercising a specific load pattern (baseline, stress, read-load, write-load, user-journey, spike, content-retrieval, geo-query, rate-limit)
- **Fixture**: A JSON file containing pre-seeded test data required by scenarios at runtime
- **Seed_Script**: A Node.js script that populates the database with test fixture data for a specific module, following the `seed-template.js` pattern
- **Reference_Implementation**: The Groups module load test at `load-tests/modules/groups/` serving as the structural and pattern template for all new modules
- **VU**: Virtual User — a simulated concurrent user in k6 load tests
- **Prayer_Time_Module**: The prayer time API module with 1 endpoint: GET prayer times by latitude, longitude, date, and calculation method
- **Mosque_Module**: The mosque finder API module with 5 endpoints: list all mosques, get single mosque, create mosque (admin), update mosque (admin), delete mosque (admin)
- **Dua_Module**: The dua/supplication content API module with 5 endpoints: list all duas, get single dua, create dua (admin), update dua (admin), delete dua (admin)
- **Ask_Question_Module**: The question submission API module with 5 endpoints: submit question (user), get my questions (user), get all questions (admin), get question metrics (admin), answer question (admin)
- **Subscription_Module**: The in-app purchase/subscription API module with 12 endpoints: get my subscription (user), verify Apple purchase (user), Apple webhook, verify Google purchase (user), Google webhook, choose free plan (user), list all subscriptions (admin), get analytics (admin), get pending webhooks (admin), get subscription by ID (admin), get subscription events (admin), grant plan (admin), reset plan (admin)
- **Support_Ticket_Module**: The user support ticket API module with 9 endpoints: create ticket (user), list my tickets (user), reply to ticket (user/admin), get ticket messages (user/admin), get ticket by ID (user/admin), list all tickets (admin), get ticket stats (admin), update ticket status (admin), update ticket priority (admin), assign ticket (admin)
- **Learning_Content_Module**: The educational content API module with 9 endpoints: list all content (authenticated), get single content (authenticated), create content (admin), update content (admin), delete content (admin), toggle like (user), add comment (user), get comments (authenticated), delete comment (authenticated)
- **Khutbah_Module**: The khutbah content API module with 5 endpoints: list all khutbahs (public), get single khutbah (public), create khutbah (admin), update khutbah (admin), delete khutbah (admin)
- **Admin_Module**: The admin dashboard API module with 2 endpoints: get growth metrics (admin), get recent activities (admin)
- **Legal_Module**: The legal pages API module with 5 endpoints: get all legal pages (public), get legal page by slug (public), create legal page (admin), update legal page (admin), delete legal page (admin)
- **Pending_Email_Module**: The email queue management API module with 3 endpoints: get pending email stats (admin), list pending emails (admin), requeue pending email (admin)
- **Rate_Limiting**: Server-side request throttling applied to subscription verification endpoints (30 req/min for Apple/Google verify)

## Requirements

### Requirement 1: Prayer-Time Module Load Tests (🔴 High Priority)

**User Story:** As a developer, I want load tests for the Prayer-Time module, so that I can verify the prayer time calculation endpoint handles high-frequency concurrent requests with varying geographic coordinates and calculation methods without degradation.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/prayer-time/` containing `scenarios/`, `fixtures/`, and `prayer-time.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that requests prayer times with valid latitude, longitude, date, and calculation method parameters and verifies a successful response containing prayer time data
3. THE Load_Test_System SHALL provide a stress scenario that ramps VUs requesting prayer times with randomized geographic coordinates and calculation methods to identify throughput ceiling
4. THE Load_Test_System SHALL provide a geo-query scenario that simulates concurrent requests from diverse geographic locations (varying latitude/longitude pairs) to test calculation performance across different coordinate ranges
5. THE Load_Test_System SHALL provide a spike scenario simulating sudden bursts of prayer time requests (simulating app-open events at prayer time) to verify the system handles traffic surges gracefully
6. WHEN the prayer-time seed script is executed, THE Load_Test_System SHALL create fixture data containing diverse geographic coordinate sets and calculation method configurations and write them to `load-tests/modules/prayer-time/fixtures/prayer-time-fixtures.json`
7. THE Load_Test_System SHALL register NPM scripts `load:prayer-time`, `load:prayer-time:stress`, `load:prayer-time:baseline`, and `load:seed:prayer-time` in package.json following the established naming pattern

### Requirement 2: Mosque Module Load Tests (🔴 High Priority)

**User Story:** As a developer, I want load tests for the Mosque module, so that I can verify mosque listing and detail endpoints perform reliably under concurrent read load from mobile users browsing nearby mosques.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/mosque/` containing `scenarios/`, `fixtures/`, and `mosque.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that lists all mosques and retrieves a single mosque by ID, verifying successful responses with correct data structure
3. THE Load_Test_System SHALL provide a read-load scenario simulating concurrent users browsing the mosque list and viewing individual mosque details simultaneously
4. THE Load_Test_System SHALL provide a stress scenario that ramps VUs performing mixed read operations (list and detail) to identify throughput ceiling and response time degradation
5. THE Load_Test_System SHALL provide a user-journey scenario simulating a realistic mosque discovery flow: list mosques → view mosque detail → list mosques with different pagination
6. WHEN the mosque seed script is executed, THE Load_Test_System SHALL create test mosque records and write mosque-specific fixtures (mosque IDs, location data) to `load-tests/modules/mosque/fixtures/mosque-fixtures.json`
7. THE Load_Test_System SHALL register NPM scripts `load:mosque`, `load:mosque:stress`, `load:mosque:baseline`, and `load:seed:mosque` in package.json following the established naming pattern

### Requirement 3: Dua Module Load Tests (🔴 High Priority)

**User Story:** As a developer, I want load tests for the Dua module, so that I can verify dua content listing and retrieval endpoints handle concurrent read traffic from users browsing supplications without performance degradation.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/dua/` containing `scenarios/`, `fixtures/`, and `dua.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that lists all duas and retrieves a single dua by ID, verifying successful responses with correct data structure
3. THE Load_Test_System SHALL provide a read-load scenario simulating concurrent users browsing the dua list and viewing individual dua content simultaneously
4. THE Load_Test_System SHALL provide a stress scenario that ramps VUs performing mixed read operations (list and detail) to identify throughput ceiling and response time degradation
5. THE Load_Test_System SHALL provide a user-journey scenario simulating a realistic dua browsing flow: list duas → view dua detail → list duas with different pagination
6. WHEN the dua seed script is executed, THE Load_Test_System SHALL create test dua records and write dua-specific fixtures (dua IDs) to `load-tests/modules/dua/fixtures/dua-fixtures.json`
7. THE Load_Test_System SHALL register NPM scripts `load:dua`, `load:dua:stress`, `load:dua:baseline`, and `load:seed:dua` in package.json following the established naming pattern

### Requirement 4: Ask-Question Module Load Tests (🔴 High Priority)

**User Story:** As a developer, I want load tests for the Ask-Question module, so that I can verify question submission, retrieval, and admin answer workflows handle concurrent operations from both users and administrators reliably.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/ask-question/` containing `scenarios/`, `fixtures/`, and `ask-question.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that submits a question as a user, retrieves the user's questions, and verifies successful responses
3. THE Load_Test_System SHALL provide a write-load scenario simulating concurrent question submissions from multiple VUs to test write throughput
4. THE Load_Test_System SHALL provide a read-load scenario simulating concurrent users fetching their questions and admins listing all questions simultaneously
5. THE Load_Test_System SHALL provide a user-journey scenario simulating a complete question lifecycle: submit question → view my questions → admin views all questions → admin answers question → user views updated question
6. THE Load_Test_System SHALL provide a stress scenario that ramps VUs performing mixed read and write operations across user and admin endpoints
7. WHEN the ask-question seed script is executed, THE Load_Test_System SHALL create test questions with known user associations and write ask-question-specific fixtures (question IDs, user mappings) to `load-tests/modules/ask-question/fixtures/ask-question-fixtures.json`
8. THE Load_Test_System SHALL register NPM scripts `load:ask-question`, `load:ask-question:stress`, `load:ask-question:baseline`, and `load:seed:ask-question` in package.json following the established naming pattern

### Requirement 5: Subscription Module Load Tests (🟡 Medium Priority)

**User Story:** As a developer, I want load tests for the Subscription module, so that I can verify purchase verification endpoints handle concurrent requests under rate limiting, and admin analytics endpoints perform reliably under load.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/subscription/` containing `scenarios/`, `fixtures/`, and `subscription.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that retrieves the current user's subscription status and verifies a successful response
3. THE Load_Test_System SHALL provide a read-load scenario simulating concurrent users checking their subscription status and admins querying analytics simultaneously
4. THE Load_Test_System SHALL provide a write-load scenario simulating concurrent free plan selections and subscription status checks from multiple VUs
5. THE Load_Test_System SHALL provide a rate-limit scenario that sends requests exceeding the configured rate limits (30 req/min for Apple/Google verify) and verifies the server returns HTTP 429 responses
6. THE Load_Test_System SHALL provide a user-journey scenario simulating a subscription lifecycle: check subscription status → choose free plan → check updated status
7. THE Load_Test_System SHALL provide a stress scenario that ramps VUs performing mixed operations across user and admin subscription endpoints
8. WHEN the subscription seed script is executed, THE Load_Test_System SHALL create test subscription records and write subscription-specific fixtures (subscription IDs, user mappings, plan types) to `load-tests/modules/subscription/fixtures/subscription-fixtures.json`
9. THE Load_Test_System SHALL register NPM scripts `load:subscription`, `load:subscription:stress`, `load:subscription:baseline`, and `load:seed:subscription` in package.json following the established naming pattern

### Requirement 6: Support-Ticket Module Load Tests (🟡 Medium Priority)

**User Story:** As a developer, I want load tests for the Support-Ticket module, so that I can verify ticket creation, reply workflows, and admin management operations handle concurrent access from both users and support staff reliably.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/support-ticket/` containing `scenarios/`, `fixtures/`, and `support-ticket.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that creates a support ticket, retrieves the user's tickets, and views a single ticket to verify basic endpoint functionality
3. THE Load_Test_System SHALL provide a write-load scenario simulating concurrent ticket creation and reply operations from multiple VUs
4. THE Load_Test_System SHALL provide a read-load scenario simulating concurrent users fetching their tickets and admins listing all tickets with stats simultaneously
5. THE Load_Test_System SHALL provide a user-journey scenario simulating a complete support flow: create ticket → view my tickets → reply to ticket → view ticket messages → admin updates status → admin assigns ticket
6. THE Load_Test_System SHALL provide a stress scenario that ramps VUs performing mixed read and write operations across user and admin ticket endpoints
7. WHEN the support-ticket seed script is executed, THE Load_Test_System SHALL create test tickets with replies and write support-ticket-specific fixtures (ticket IDs, message IDs, user mappings) to `load-tests/modules/support-ticket/fixtures/support-ticket-fixtures.json`
8. THE Load_Test_System SHALL register NPM scripts `load:support-ticket`, `load:support-ticket:stress`, `load:support-ticket:baseline`, and `load:seed:support-ticket` in package.json following the established naming pattern

### Requirement 7: Learning-Content Module Load Tests (🟡 Medium Priority)

**User Story:** As a developer, I want load tests for the Learning-Content module, so that I can verify content listing, engagement features (likes, comments), and admin CRUD operations handle concurrent access reliably.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/learning-content/` containing `scenarios/`, `fixtures/`, and `learning-content.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that lists learning content, retrieves a single content item, and fetches comments to verify basic endpoint functionality
3. THE Load_Test_System SHALL provide a read-load scenario simulating concurrent users browsing content listings, viewing individual content, and reading comments simultaneously
4. THE Load_Test_System SHALL provide a write-load scenario simulating concurrent like toggles and comment submissions from multiple VUs
5. THE Load_Test_System SHALL provide a user-journey scenario simulating a realistic learning flow: list content → view content detail → toggle like → add comment → view comments
6. THE Load_Test_System SHALL provide a stress scenario that ramps VUs performing mixed read and write operations across content browsing and engagement endpoints
7. WHEN the learning-content seed script is executed, THE Load_Test_System SHALL create test content records with comments and write learning-content-specific fixtures (content IDs, comment IDs) to `load-tests/modules/learning-content/fixtures/learning-content-fixtures.json`
8. THE Load_Test_System SHALL register NPM scripts `load:learning-content`, `load:learning-content:stress`, `load:learning-content:baseline`, and `load:seed:learning-content` in package.json following the established naming pattern

### Requirement 8: Khutbah Module Load Tests (🟡 Medium Priority)

**User Story:** As a developer, I want load tests for the Khutbah module, so that I can verify khutbah content listing and retrieval endpoints handle concurrent read traffic from users browsing sermons without performance degradation.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/khutbah/` containing `scenarios/`, `fixtures/`, and `khutbah.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that lists all khutbahs and retrieves a single khutbah by ID, verifying successful responses with correct data structure
3. THE Load_Test_System SHALL provide a read-load scenario simulating concurrent users browsing the khutbah list and viewing individual khutbah content simultaneously
4. THE Load_Test_System SHALL provide a stress scenario that ramps VUs performing mixed read operations (list and detail) to identify throughput ceiling and response time degradation
5. THE Load_Test_System SHALL provide a user-journey scenario simulating a realistic khutbah browsing flow: list khutbahs → view khutbah detail → list khutbahs with different pagination
6. WHEN the khutbah seed script is executed, THE Load_Test_System SHALL create test khutbah records and write khutbah-specific fixtures (khutbah IDs) to `load-tests/modules/khutbah/fixtures/khutbah-fixtures.json`
7. THE Load_Test_System SHALL register NPM scripts `load:khutbah`, `load:khutbah:stress`, `load:khutbah:baseline`, and `load:seed:khutbah` in package.json following the established naming pattern

### Requirement 9: Admin Module Load Tests (🟢 Low Priority)

**User Story:** As a developer, I want load tests for the Admin module, so that I can verify dashboard metrics and recent activities endpoints respond within acceptable time under concurrent admin access.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/admin/` containing `scenarios/`, `fixtures/`, and `admin.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that fetches growth metrics and recent activities with admin authentication, verifying successful responses
3. THE Load_Test_System SHALL provide a stress scenario that ramps VUs requesting dashboard metrics and recent activities concurrently to identify response time degradation under load
4. THE Load_Test_System SHALL provide a read-load scenario simulating multiple admin users refreshing the dashboard simultaneously
5. WHEN the admin seed script is executed, THE Load_Test_System SHALL ensure admin user fixtures are available and write admin-specific fixtures to `load-tests/modules/admin/fixtures/admin-fixtures.json`
6. THE Load_Test_System SHALL register NPM scripts `load:admin`, `load:admin:stress`, `load:admin:baseline`, and `load:seed:admin` in package.json following the established naming pattern

### Requirement 10: Legal Module Load Tests (🟢 Low Priority)

**User Story:** As a developer, I want load tests for the Legal module, so that I can verify legal page retrieval endpoints handle concurrent read traffic from users viewing terms and privacy policies without degradation.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/legal/` containing `scenarios/`, `fixtures/`, and `legal.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that lists all legal pages and retrieves a single legal page by slug, verifying successful responses
3. THE Load_Test_System SHALL provide a read-load scenario simulating concurrent users fetching legal pages (terms of service, privacy policy) simultaneously
4. THE Load_Test_System SHALL provide a stress scenario that ramps VUs performing read operations against legal page endpoints to identify throughput ceiling
5. WHEN the legal seed script is executed, THE Load_Test_System SHALL create test legal page records with known slugs and write legal-specific fixtures (page slugs) to `load-tests/modules/legal/fixtures/legal-fixtures.json`
6. THE Load_Test_System SHALL register NPM scripts `load:legal`, `load:legal:stress`, `load:legal:baseline`, and `load:seed:legal` in package.json following the established naming pattern

### Requirement 11: Pending-Email Module Load Tests (🟢 Low Priority)

**User Story:** As a developer, I want load tests for the Pending-Email module, so that I can verify email queue management endpoints respond reliably when admins monitor and manage the email queue under load.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide a complete module directory at `load-tests/modules/pending-email/` containing `scenarios/`, `fixtures/`, and `pending-email.load.js` following the Reference_Implementation structure
2. THE Load_Test_System SHALL provide a baseline scenario that fetches pending email stats and lists pending emails with admin authentication, verifying successful responses
3. THE Load_Test_System SHALL provide a stress scenario that ramps VUs requesting email stats and listing pending emails concurrently to identify response time degradation
4. THE Load_Test_System SHALL provide a write-load scenario simulating concurrent requeue operations from admin users
5. WHEN the pending-email seed script is executed, THE Load_Test_System SHALL create test pending email records and write pending-email-specific fixtures (email IDs) to `load-tests/modules/pending-email/fixtures/pending-email-fixtures.json`
6. THE Load_Test_System SHALL register NPM scripts `load:pending-email`, `load:pending-email:stress`, `load:pending-email:baseline`, and `load:seed:pending-email` in package.json following the established naming pattern

### Requirement 12: Seed Script Implementation

**User Story:** As a developer, I want seed scripts for each new module following the seed-template.js pattern, so that I can independently seed test data for any module without affecting other modules' fixtures.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide seed scripts at `load-tests/scripts/seed-prayer-time.js`, `load-tests/scripts/seed-mosque.js`, `load-tests/scripts/seed-dua.js`, `load-tests/scripts/seed-ask-question.js`, `load-tests/scripts/seed-subscription.js`, `load-tests/scripts/seed-support-ticket.js`, `load-tests/scripts/seed-learning-content.js`, `load-tests/scripts/seed-khutbah.js`, `load-tests/scripts/seed-admin.js`, `load-tests/scripts/seed-legal.js`, and `load-tests/scripts/seed-pending-email.js` following the structure defined in `seed-template.js`
2. WHEN a seed script is executed, THE Load_Test_System SHALL perform idempotent cleanup by deleting previously seeded data (identified by the `loadtest-` prefix convention) before creating new data
3. WHEN a seed script is executed, THE Load_Test_System SHALL write module-specific fixtures to the corresponding `modules/{module-name}/fixtures/{module-name}-fixtures.json` path
4. WHEN a seed script requires shared user accounts, THE Load_Test_System SHALL read existing users from `shared/fixtures/base-fixtures.json` rather than creating duplicate user accounts
5. IF a seed script fails to connect to the database, THEN THE Load_Test_System SHALL exit with code 1 and log an error message indicating the connection failure
6. IF a seed script fails during data creation, THEN THE Load_Test_System SHALL disconnect from the database, exit with code 1, and log the error reason

### Requirement 13: Module Entry Points

**User Story:** As a developer, I want each module to have a properly configured entry point file, so that running `npm run load:{module}` executes all scenarios with correct thresholds and generates module-specific reports.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide entry point files for all 11 modules that import all scenario exec functions from their respective `scenarios/` directories
2. THE Load_Test_System SHALL configure each entry point with k6 scenario executors specifying appropriate VU counts, durations, and start times for each scenario function
3. THE Load_Test_System SHALL import base thresholds from `../../shared/config/thresholds.js` in each entry point and apply them via object spread in the k6 options
4. THE Load_Test_System SHALL use the `createHandleSummary` function from `../../shared/helpers/report.js` in each entry point to generate module-specific HTML reports
5. WHEN `SKIP_LOAD_TESTS` environment variable is set to `"true"`, THE Load_Test_System SHALL skip scenario execution in the default export function of each entry point

### Requirement 14: Property-Based Tests

**User Story:** As a developer, I want property-based tests for each module's scenario logic, so that I can verify scenario behavior holds across a wide range of generated inputs rather than just hand-picked examples.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide test files under `load-tests/__tests__/{module-name}/` for each of the 11 new modules
2. THE Load_Test_System SHALL include at least one property-based test per module verifying that fixture loading and user selection via `getUser` produces valid users for all generated VU indices
3. THE Load_Test_System SHALL include at least one property-based test per module verifying that the module entry point's scenario configuration contains valid executor types, positive VU counts, and non-empty duration strings
4. THE Load_Test_System SHALL use fast-check as the property-based testing library with a minimum of 100 iterations per property test
5. THE Load_Test_System SHALL use vitest as the test runner, with test files discoverable via the pattern `load-tests/__tests__/**/*.test.js`

### Requirement 15: NPM Script Registration

**User Story:** As a developer, I want all new module NPM scripts registered in package.json, so that I can run any module's load tests or seed scripts using consistent, discoverable commands.

#### Acceptance Criteria

1. THE Load_Test_System SHALL register scripts following the pattern `load:{module-name}` pointing to `k6 run --out web-dashboard load-tests/modules/{module-name}/{module-name}.load.js` for each of the 11 new modules
2. THE Load_Test_System SHALL register scripts following the pattern `load:{module-name}:{scenario}` for key scenarios (at minimum: stress, baseline) for each of the 11 new modules
3. THE Load_Test_System SHALL register scripts following the pattern `load:seed:{module-name}` pointing to `node load-tests/scripts/seed-{module-name}.js` for each of the 11 new modules
4. WHEN a registered NPM script is executed, THE Load_Test_System SHALL resolve the file path correctly relative to the project root without requiring additional configuration

### Requirement 16: Shared Infrastructure Reuse

**User Story:** As a developer, I want all new modules to reuse the existing shared helpers, configuration, and base fixtures, so that there is no code duplication and all modules benefit from centralized improvements.

#### Acceptance Criteria

1. THE Load_Test_System SHALL import authentication helpers (`getUser`, `getToken`, `getAuthHeaders`) from `shared/helpers/auth.js` in all scenario files that require authenticated requests
2. THE Load_Test_System SHALL import `resolveBaseUrl` from `shared/helpers/scenario-utils.js` in all scenario files to resolve the API base URL consistently
3. THE Load_Test_System SHALL import stress and soak stage profiles from `shared/config/profiles.js` in all stress and soak scenarios rather than defining inline stage arrays
4. THE Load_Test_System SHALL load base fixtures from `shared/fixtures/base-fixtures.json` using k6 SharedArray in all scenario files, merging with module-specific fixtures via object spread
5. THE Load_Test_System SHALL import base thresholds from `shared/config/thresholds.js` in all module entry points

### Requirement 17: Subscription Rate-Limit Awareness

**User Story:** As a developer, I want subscription load test scenarios to account for server-side rate limiting on verification endpoints, so that tests produce meaningful results rather than being dominated by 429 responses.

#### Acceptance Criteria

1. WHEN the subscription stress scenario executes, THE Load_Test_System SHALL distribute requests across multiple test user accounts to avoid triggering per-user rate limits during normal load testing
2. THE Load_Test_System SHALL provide a dedicated rate-limit validation scenario that intentionally exceeds rate limits (30 req/min for Apple/Google verify) from a single source and asserts HTTP 429 responses are returned within the configured window
3. WHEN the subscription soak-like operations execute within the stress scenario, THE Load_Test_System SHALL pace verification requests below the rate limit thresholds to measure sustained performance without rate-limit interference
