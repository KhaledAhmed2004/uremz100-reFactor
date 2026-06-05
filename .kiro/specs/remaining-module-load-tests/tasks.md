# Implementation Plan: Remaining Module Load Tests

## Overview

Implement load test suites for the remaining 11 API modules (Prayer-Time, Mosque, Dua, Ask-Question, Subscription, Support-Ticket, Learning-Content, Khutbah, Admin, Legal, Pending-Email) following the Groups reference implementation pattern. Each module gets a complete directory structure with scenarios, fixtures, seed scripts, entry points, NPM scripts, and property-based tests. Implementation proceeds by priority: high-priority user-facing modules first, then medium-priority modules, then low-priority admin/internal modules.

## Tasks

- [x] 1. Create Prayer-Time module load test suite (🔴 High Priority)
  - [x] 1.1 Create Prayer-Time module directory structure and entry point
    - Create `load-tests/modules/prayer-time/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `prayer-time.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, geo-query, spike)
    - Import `THRESHOLDS` from `../../shared/config/thresholds.js`
    - Use `createHandleSummary('prayer-time')` for HTML report generation
    - Implement `SKIP_LOAD_TESTS` environment variable check in default export
    - _Requirements: 1.1, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 1.2 Implement Prayer-Time baseline scenario
    - Create `load-tests/modules/prayer-time/scenarios/baseline.js`
    - Request prayer times with valid latitude, longitude, date, and calculation method
    - Verify successful response containing prayer time data with `check()` assertions
    - Use `resolveBaseUrl` from shared helpers for URL construction
    - Load fixtures via k6 `SharedArray`
    - _Requirements: 1.2, 16.2, 16.4_

  - [x] 1.3 Implement Prayer-Time stress scenario
    - Create `load-tests/modules/prayer-time/scenarios/stress.js`
    - Ramp VUs requesting prayer times with randomized geographic coordinates and calculation methods
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 1.3, 16.3_

  - [x] 1.4 Implement Prayer-Time geo-query scenario
    - Create `load-tests/modules/prayer-time/scenarios/geo-query.js`
    - Simulate concurrent requests from diverse geographic locations (varying lat/lng pairs)
    - Test calculation performance across different coordinate ranges
    - 10 VUs, 30s duration with diverse coordinate fixtures
    - _Requirements: 1.4, 16.2_

  - [x] 1.5 Implement Prayer-Time spike scenario
    - Create `load-tests/modules/prayer-time/scenarios/spike.js`
    - Simulate sudden bursts of prayer time requests (app-open events at prayer time)
    - Verify system handles traffic surges gracefully
    - _Requirements: 1.5_

  - [x] 1.6 Create Prayer-Time seed script
    - Create `load-tests/scripts/seed-prayer-time.js` following `seed-template.js` pattern
    - Create fixture data containing diverse geographic coordinate sets and calculation methods
    - Write fixtures to `load-tests/modules/prayer-time/fixtures/prayer-time-fixtures.json`
    - No database records needed — prayer time is a calculation endpoint
    - _Requirements: 1.6, 12.1, 12.3_

- [x] 2. Create Mosque module load test suite (🔴 High Priority)
  - [x] 2.1 Create Mosque module directory structure and entry point
    - Create `load-tests/modules/mosque/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `mosque.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, read-load, user-journey)
    - Import `THRESHOLDS`, use `createHandleSummary('mosque')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 2.1, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 2.2 Implement Mosque baseline scenario
    - Create `load-tests/modules/mosque/scenarios/baseline.js`
    - List all mosques and retrieve a single mosque by ID
    - Verify successful responses with correct data structure using `check()` assertions
    - _Requirements: 2.2, 16.1, 16.2, 16.4_

  - [x] 2.3 Implement Mosque read-load scenario
    - Create `load-tests/modules/mosque/scenarios/read-load.js`
    - Simulate concurrent users browsing mosque list and viewing individual mosque details
    - 10 VUs, 30s duration
    - _Requirements: 2.3, 16.1, 16.4_

  - [x] 2.4 Implement Mosque stress scenario
    - Create `load-tests/modules/mosque/scenarios/stress.js`
    - Ramp VUs performing mixed read operations (list and detail) to identify throughput ceiling
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 2.4, 16.3_

  - [x] 2.5 Implement Mosque user-journey scenario
    - Create `load-tests/modules/mosque/scenarios/user-journey.js`
    - Simulate realistic mosque discovery flow: list mosques → view detail → list with different pagination
    - 5 VUs, 30s duration with think-time sleeps
    - _Requirements: 2.5_

  - [x] 2.6 Create Mosque seed script
    - Create `load-tests/scripts/seed-mosque.js` following `seed-template.js` pattern
    - Connect to MongoDB, perform idempotent cleanup (delete `loadtest-` prefixed data)
    - Create 10 mosque records with locations
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/mosque/fixtures/mosque-fixtures.json`
    - Handle errors: exit code 1 on connection/creation failure
    - _Requirements: 2.6, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 3. Create Dua module load test suite (🔴 High Priority)
  - [x] 3.1 Create Dua module directory structure and entry point
    - Create `load-tests/modules/dua/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `dua.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, read-load, user-journey)
    - Import `THRESHOLDS`, use `createHandleSummary('dua')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 3.1, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 3.2 Implement Dua baseline scenario
    - Create `load-tests/modules/dua/scenarios/baseline.js`
    - List all duas and retrieve a single dua by ID
    - Verify successful responses with correct data structure using `check()` assertions
    - _Requirements: 3.2, 16.1, 16.2, 16.4_

  - [x] 3.3 Implement Dua read-load scenario
    - Create `load-tests/modules/dua/scenarios/read-load.js`
    - Simulate concurrent users browsing dua list and viewing individual dua content
    - 10 VUs, 30s duration
    - _Requirements: 3.3, 16.1, 16.4_

  - [x] 3.4 Implement Dua stress scenario
    - Create `load-tests/modules/dua/scenarios/stress.js`
    - Ramp VUs performing mixed read operations (list and detail) to identify throughput ceiling
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 3.4, 16.3_

  - [x] 3.5 Implement Dua user-journey scenario
    - Create `load-tests/modules/dua/scenarios/user-journey.js`
    - Simulate realistic dua browsing flow: list duas → view detail → list with different pagination
    - 5 VUs, 30s duration with think-time sleeps
    - _Requirements: 3.5_

  - [x] 3.6 Create Dua seed script
    - Create `load-tests/scripts/seed-dua.js` following `seed-template.js` pattern
    - Connect to MongoDB, perform idempotent cleanup (delete `loadtest-` prefixed data)
    - Create 10 dua records with categories
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/dua/fixtures/dua-fixtures.json`
    - Handle errors: exit code 1 on connection/creation failure
    - _Requirements: 3.6, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 4. Create Ask-Question module load test suite (🔴 High Priority)
  - [x] 4.1 Create Ask-Question module directory structure and entry point
    - Create `load-tests/modules/ask-question/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `ask-question.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, read-load, write-load, user-journey)
    - Import `THRESHOLDS`, use `createHandleSummary('ask-question')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 4.1, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 4.2 Implement Ask-Question baseline scenario
    - Create `load-tests/modules/ask-question/scenarios/baseline.js`
    - Submit a question as a user, retrieve the user's questions, verify successful responses
    - Use `getAuthHeaders` from shared helpers for authenticated requests
    - _Requirements: 4.2, 16.1, 16.2, 16.4_

  - [x] 4.3 Implement Ask-Question write-load scenario
    - Create `load-tests/modules/ask-question/scenarios/write-load.js`
    - Simulate concurrent question submissions from multiple VUs
    - 5 VUs, 30s duration testing write throughput
    - _Requirements: 4.3, 16.1_

  - [x] 4.4 Implement Ask-Question read-load scenario
    - Create `load-tests/modules/ask-question/scenarios/read-load.js`
    - Simulate concurrent users fetching their questions and admins listing all questions
    - 10 VUs, 30s duration
    - _Requirements: 4.4, 16.1, 16.4_

  - [x] 4.5 Implement Ask-Question user-journey scenario
    - Create `load-tests/modules/ask-question/scenarios/user-journey.js`
    - Simulate complete lifecycle: submit question → view my questions → admin views all → admin answers → user views updated
    - 5 VUs, 30s duration with think-time sleeps
    - _Requirements: 4.5_

  - [x] 4.6 Implement Ask-Question stress scenario
    - Create `load-tests/modules/ask-question/scenarios/stress.js`
    - Ramp VUs performing mixed read and write operations across user and admin endpoints
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 4.6, 16.3_

  - [x] 4.7 Create Ask-Question seed script
    - Create `load-tests/scripts/seed-ask-question.js` following `seed-template.js` pattern
    - Connect to MongoDB, perform idempotent cleanup (delete `loadtest-` prefixed data)
    - Create 10 questions with known user associations
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/ask-question/fixtures/ask-question-fixtures.json`
    - Handle errors: exit code 1 on connection/creation failure
    - _Requirements: 4.7, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 5. Checkpoint - High priority modules complete
  - Ensure all Prayer-Time, Mosque, Dua, and Ask-Question module files are created and structurally correct, ask the user if questions arise.

- [x] 6. Create Subscription module load test suite (🟡 Medium Priority)
  - [x] 6.1 Create Subscription module directory structure and entry point
    - Create `load-tests/modules/subscription/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `subscription.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, read-load, write-load, user-journey, rate-limit)
    - Import `THRESHOLDS`, use `createHandleSummary('subscription')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 5.1, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 6.2 Implement Subscription baseline scenario
    - Create `load-tests/modules/subscription/scenarios/baseline.js`
    - Retrieve current user's subscription status, verify successful response
    - Use `getAuthHeaders` from shared helpers for authenticated requests
    - _Requirements: 5.2, 16.1, 16.4_

  - [x] 6.3 Implement Subscription read-load scenario
    - Create `load-tests/modules/subscription/scenarios/read-load.js`
    - Simulate concurrent users checking subscription status and admins querying analytics
    - 10 VUs, 30s duration
    - _Requirements: 5.3, 16.1, 16.4_

  - [x] 6.4 Implement Subscription write-load scenario
    - Create `load-tests/modules/subscription/scenarios/write-load.js`
    - Simulate concurrent free plan selections (uses `choose/free` endpoint, not rate-limited)
    - 5 VUs, 30s duration
    - _Requirements: 5.4, 16.1_

  - [x] 6.5 Implement Subscription rate-limit scenario
    - Create `load-tests/modules/subscription/scenarios/rate-limit.js`
    - Send requests exceeding 30 req/min for Apple/Google verify from single user
    - Assert HTTP 429 responses are returned within the configured window
    - 1 VU, 15 iterations
    - _Requirements: 5.5, 17.2_

  - [x] 6.6 Implement Subscription user-journey scenario
    - Create `load-tests/modules/subscription/scenarios/user-journey.js`
    - Simulate subscription lifecycle: check status → choose free plan → check updated status
    - 5 VUs, 30s duration with think-time sleeps
    - _Requirements: 5.6_

  - [x] 6.7 Implement Subscription stress scenario
    - Create `load-tests/modules/subscription/scenarios/stress.js`
    - Ramp VUs performing mixed operations across user and admin subscription endpoints
    - Distribute requests across multiple test user accounts to avoid per-user rate limits
    - Import stress profiles from `shared/config/profiles.js`, add pacing with `sleep()`
    - _Requirements: 5.7, 16.3, 17.1, 17.3_

  - [x] 6.8 Create Subscription seed script
    - Create `load-tests/scripts/seed-subscription.js` following `seed-template.js` pattern
    - Connect to MongoDB, perform idempotent cleanup (delete `loadtest-` prefixed data)
    - Create 5 subscription records with plan types
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/subscription/fixtures/subscription-fixtures.json`
    - Handle errors: exit code 1 on connection/creation failure
    - _Requirements: 5.8, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 7. Create Support-Ticket module load test suite (🟡 Medium Priority)
  - [x] 7.1 Create Support-Ticket module directory structure and entry point
    - Create `load-tests/modules/support-ticket/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `support-ticket.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, read-load, write-load, user-journey)
    - Import `THRESHOLDS`, use `createHandleSummary('support-ticket')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 6.1, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 7.2 Implement Support-Ticket baseline scenario
    - Create `load-tests/modules/support-ticket/scenarios/baseline.js`
    - Create a support ticket, retrieve user's tickets, view a single ticket
    - Verify basic endpoint functionality with `check()` assertions
    - _Requirements: 6.2, 16.1, 16.2, 16.4_

  - [x] 7.3 Implement Support-Ticket write-load scenario
    - Create `load-tests/modules/support-ticket/scenarios/write-load.js`
    - Simulate concurrent ticket creation and reply operations from multiple VUs
    - 5 VUs, 30s duration
    - _Requirements: 6.3, 16.1_

  - [x] 7.4 Implement Support-Ticket read-load scenario
    - Create `load-tests/modules/support-ticket/scenarios/read-load.js`
    - Simulate concurrent users fetching their tickets and admins listing all tickets with stats
    - 10 VUs, 30s duration
    - _Requirements: 6.4, 16.1, 16.4_

  - [x] 7.5 Implement Support-Ticket user-journey scenario
    - Create `load-tests/modules/support-ticket/scenarios/user-journey.js`
    - Simulate complete support flow: create ticket → view my tickets → reply → view messages → admin updates status → admin assigns
    - 5 VUs, 30s duration with think-time sleeps
    - _Requirements: 6.5_

  - [x] 7.6 Implement Support-Ticket stress scenario
    - Create `load-tests/modules/support-ticket/scenarios/stress.js`
    - Ramp VUs performing mixed read and write operations across user and admin ticket endpoints
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 6.6, 16.3_

  - [x] 7.7 Create Support-Ticket seed script
    - Create `load-tests/scripts/seed-support-ticket.js` following `seed-template.js` pattern
    - Connect to MongoDB, perform idempotent cleanup (delete `loadtest-` prefixed data)
    - Create 5 tickets with replies
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/support-ticket/fixtures/support-ticket-fixtures.json`
    - Handle errors: exit code 1 on connection/creation failure
    - _Requirements: 6.7, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 8. Create Learning-Content module load test suite (🟡 Medium Priority)
  - [x] 8.1 Create Learning-Content module directory structure and entry point
    - Create `load-tests/modules/learning-content/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `learning-content.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, read-load, write-load, user-journey)
    - Import `THRESHOLDS`, use `createHandleSummary('learning-content')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 7.1, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 8.2 Implement Learning-Content baseline scenario
    - Create `load-tests/modules/learning-content/scenarios/baseline.js`
    - List learning content, retrieve a single content item, fetch comments
    - Verify basic endpoint functionality with `check()` assertions
    - _Requirements: 7.2, 16.1, 16.2, 16.4_

  - [x] 8.3 Implement Learning-Content read-load scenario
    - Create `load-tests/modules/learning-content/scenarios/read-load.js`
    - Simulate concurrent users browsing content listings, viewing individual content, reading comments
    - 10 VUs, 30s duration
    - _Requirements: 7.3, 16.1, 16.4_

  - [x] 8.4 Implement Learning-Content write-load scenario
    - Create `load-tests/modules/learning-content/scenarios/write-load.js`
    - Simulate concurrent like toggles and comment submissions from multiple VUs
    - 5 VUs, 30s duration
    - _Requirements: 7.4, 16.1_

  - [x] 8.5 Implement Learning-Content user-journey scenario
    - Create `load-tests/modules/learning-content/scenarios/user-journey.js`
    - Simulate realistic learning flow: list content → view detail → toggle like → add comment → view comments
    - 5 VUs, 30s duration with think-time sleeps
    - _Requirements: 7.5_

  - [x] 8.6 Implement Learning-Content stress scenario
    - Create `load-tests/modules/learning-content/scenarios/stress.js`
    - Ramp VUs performing mixed read and write operations across content browsing and engagement endpoints
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 7.6, 16.3_

  - [x] 8.7 Create Learning-Content seed script
    - Create `load-tests/scripts/seed-learning-content.js` following `seed-template.js` pattern
    - Connect to MongoDB, perform idempotent cleanup (delete `loadtest-` prefixed data)
    - Create 10 content items with comments
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/learning-content/fixtures/learning-content-fixtures.json`
    - Handle errors: exit code 1 on connection/creation failure
    - _Requirements: 7.7, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 9. Create Khutbah module load test suite (🟡 Medium Priority)
  - [x] 9.1 Create Khutbah module directory structure and entry point
    - Create `load-tests/modules/khutbah/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `khutbah.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, read-load, user-journey)
    - Import `THRESHOLDS`, use `createHandleSummary('khutbah')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 8.1, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 9.2 Implement Khutbah baseline scenario
    - Create `load-tests/modules/khutbah/scenarios/baseline.js`
    - List all khutbahs and retrieve a single khutbah by ID (public endpoints, no auth headers)
    - Verify successful responses with correct data structure using `check()` assertions
    - _Requirements: 8.2, 16.2, 16.4_

  - [x] 9.3 Implement Khutbah read-load scenario
    - Create `load-tests/modules/khutbah/scenarios/read-load.js`
    - Simulate concurrent users browsing khutbah list and viewing individual khutbah content
    - 10 VUs, 30s duration (public endpoints)
    - _Requirements: 8.3, 16.4_

  - [x] 9.4 Implement Khutbah stress scenario
    - Create `load-tests/modules/khutbah/scenarios/stress.js`
    - Ramp VUs performing mixed read operations (list and detail) to identify throughput ceiling
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 8.4, 16.3_

  - [x] 9.5 Implement Khutbah user-journey scenario
    - Create `load-tests/modules/khutbah/scenarios/user-journey.js`
    - Simulate realistic khutbah browsing flow: list khutbahs → view detail → list with different pagination
    - 5 VUs, 30s duration with think-time sleeps
    - _Requirements: 8.5_

  - [x] 9.6 Create Khutbah seed script
    - Create `load-tests/scripts/seed-khutbah.js` following `seed-template.js` pattern
    - Connect to MongoDB, perform idempotent cleanup (delete `loadtest-` prefixed data)
    - Create 10 khutbah records
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/khutbah/fixtures/khutbah-fixtures.json`
    - Handle errors: exit code 1 on connection/creation failure
    - _Requirements: 8.6, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 10. Checkpoint - Medium priority modules complete
  - Ensure all Subscription, Support-Ticket, Learning-Content, and Khutbah module files are created and structurally correct, ask the user if questions arise.

- [x] 11. Create Admin module load test suite (🟢 Low Priority)
  - [x] 11.1 Create Admin module directory structure and entry point
    - Create `load-tests/modules/admin/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `admin.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, read-load)
    - Import `THRESHOLDS`, use `createHandleSummary('admin')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 9.1, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 11.2 Implement Admin baseline scenario
    - Create `load-tests/modules/admin/scenarios/baseline.js`
    - Fetch growth metrics and recent activities with admin authentication
    - Verify successful responses with `check()` assertions
    - _Requirements: 9.2, 16.1, 16.4_

  - [x] 11.3 Implement Admin stress scenario
    - Create `load-tests/modules/admin/scenarios/stress.js`
    - Ramp VUs requesting dashboard metrics and recent activities concurrently
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 9.3, 16.3_

  - [x] 11.4 Implement Admin read-load scenario
    - Create `load-tests/modules/admin/scenarios/read-load.js`
    - Simulate multiple admin users refreshing the dashboard simultaneously
    - 10 VUs, 30s duration
    - _Requirements: 9.4, 16.1, 16.4_

  - [x] 11.5 Create Admin seed script
    - Create `load-tests/scripts/seed-admin.js` following `seed-template.js` pattern
    - Ensure admin user fixtures are available from `shared/fixtures/base-fixtures.json`
    - Write admin-specific fixtures to `load-tests/modules/admin/fixtures/admin-fixtures.json`
    - Handle errors: exit code 1 on failure
    - _Requirements: 9.5, 12.1, 12.3, 12.4_

- [x] 12. Create Legal module load test suite (🟢 Low Priority)
  - [x] 12.1 Create Legal module directory structure and entry point
    - Create `load-tests/modules/legal/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `legal.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, read-load)
    - Import `THRESHOLDS`, use `createHandleSummary('legal')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 10.1, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 12.2 Implement Legal baseline scenario
    - Create `load-tests/modules/legal/scenarios/baseline.js`
    - List all legal pages and retrieve a single legal page by slug (public endpoints)
    - Verify successful responses with `check()` assertions
    - _Requirements: 10.2, 16.2, 16.4_

  - [x] 12.3 Implement Legal read-load scenario
    - Create `load-tests/modules/legal/scenarios/read-load.js`
    - Simulate concurrent users fetching legal pages (terms of service, privacy policy)
    - 10 VUs, 30s duration (public endpoints)
    - _Requirements: 10.3, 16.4_

  - [x] 12.4 Implement Legal stress scenario
    - Create `load-tests/modules/legal/scenarios/stress.js`
    - Ramp VUs performing read operations against legal page endpoints
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 10.4, 16.3_

  - [x] 12.5 Create Legal seed script
    - Create `load-tests/scripts/seed-legal.js` following `seed-template.js` pattern
    - Connect to MongoDB, perform idempotent cleanup (delete `loadtest-` prefixed data)
    - Create 5 legal page records with known slugs
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/legal/fixtures/legal-fixtures.json`
    - Handle errors: exit code 1 on connection/creation failure
    - _Requirements: 10.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 13. Create Pending-Email module load test suite (🟢 Low Priority)
  - [x] 13.1 Create Pending-Email module directory structure and entry point
    - Create `load-tests/modules/pending-email/` directory with `scenarios/` and `fixtures/` subdirectories
    - Create `pending-email.load.js` entry point importing all scenario exec functions
    - Configure k6 options with scenario executors (baseline, stress, write-load)
    - Import `THRESHOLDS`, use `createHandleSummary('pending-email')`, implement `SKIP_LOAD_TESTS` check
    - _Requirements: 11.1, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 13.2 Implement Pending-Email baseline scenario
    - Create `load-tests/modules/pending-email/scenarios/baseline.js`
    - Fetch pending email stats and list pending emails with admin authentication
    - Verify successful responses with `check()` assertions
    - _Requirements: 11.2, 16.1, 16.4_

  - [x] 13.3 Implement Pending-Email stress scenario
    - Create `load-tests/modules/pending-email/scenarios/stress.js`
    - Ramp VUs requesting email stats and listing pending emails concurrently
    - Import stress profiles from `shared/config/profiles.js`
    - _Requirements: 11.3, 16.3_

  - [x] 13.4 Implement Pending-Email write-load scenario
    - Create `load-tests/modules/pending-email/scenarios/write-load.js`
    - Simulate concurrent requeue operations from admin users
    - 5 VUs, 30s duration
    - _Requirements: 11.4, 16.1_

  - [x] 13.5 Create Pending-Email seed script
    - Create `load-tests/scripts/seed-pending-email.js` following `seed-template.js` pattern
    - Connect to MongoDB, perform idempotent cleanup (delete `loadtest-` prefixed data)
    - Create 5 pending email records
    - Read shared users from `shared/fixtures/base-fixtures.json`
    - Write fixtures to `load-tests/modules/pending-email/fixtures/pending-email-fixtures.json`
    - Handle errors: exit code 1 on connection/creation failure
    - _Requirements: 11.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 14. Checkpoint - Low priority modules complete
  - Ensure all Admin, Legal, and Pending-Email module files are created and structurally correct, ask the user if questions arise.

- [x] 15. Register NPM scripts in package.json
  - [x] 15.1 Register all module NPM scripts
    - Add `load:prayer-time`, `load:prayer-time:stress`, `load:prayer-time:baseline`, `load:seed:prayer-time`
    - Add `load:mosque`, `load:mosque:stress`, `load:mosque:baseline`, `load:seed:mosque`
    - Add `load:dua`, `load:dua:stress`, `load:dua:baseline`, `load:seed:dua`
    - Add `load:ask-question`, `load:ask-question:stress`, `load:ask-question:baseline`, `load:seed:ask-question`
    - Add `load:subscription`, `load:subscription:stress`, `load:subscription:baseline`, `load:seed:subscription`
    - Add `load:support-ticket`, `load:support-ticket:stress`, `load:support-ticket:baseline`, `load:seed:support-ticket`
    - Add `load:learning-content`, `load:learning-content:stress`, `load:learning-content:baseline`, `load:seed:learning-content`
    - Add `load:khutbah`, `load:khutbah:stress`, `load:khutbah:baseline`, `load:seed:khutbah`
    - Add `load:admin`, `load:admin:stress`, `load:admin:baseline`, `load:seed:admin`
    - Add `load:legal`, `load:legal:stress`, `load:legal:baseline`, `load:seed:legal`
    - Add `load:pending-email`, `load:pending-email:stress`, `load:pending-email:baseline`, `load:seed:pending-email`
    - Each `load:{module}` script points to `k6 run --out web-dashboard load-tests/modules/{module}/{module}.load.js`
    - Each `load:seed:{module}` script points to `node load-tests/scripts/seed-{module}.js`
    - _Requirements: 1.7, 2.7, 3.7, 4.8, 5.9, 6.8, 7.8, 8.7, 9.6, 10.6, 11.6, 15.1, 15.2, 15.3, 15.4_

- [x] 16. Create property-based tests for all modules
  - [x] 16.1 Create Prayer-Time module property tests
    - Create `load-tests/__tests__/prayer-time/prayer-time.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices (0–999)
    - Property test: prayer-time entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - Use vitest as test runner
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

  - [x] 16.2 Create Mosque module property tests
    - Create `load-tests/__tests__/mosque/mosque.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: mosque entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

  - [x] 16.3 Create Dua module property tests
    - Create `load-tests/__tests__/dua/dua.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: dua entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

  - [x] 16.4 Create Ask-Question module property tests
    - Create `load-tests/__tests__/ask-question/ask-question.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: ask-question entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

  - [x] 16.5 Create Subscription module property tests
    - Create `load-tests/__tests__/subscription/subscription.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: subscription entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

  - [x] 16.6 Create Support-Ticket module property tests
    - Create `load-tests/__tests__/support-ticket/support-ticket.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: support-ticket entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

  - [x] 16.7 Create Learning-Content module property tests
    - Create `load-tests/__tests__/learning-content/learning-content.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: learning-content entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

  - [x] 16.8 Create Khutbah module property tests
    - Create `load-tests/__tests__/khutbah/khutbah.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: khutbah entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

  - [x] 16.9 Create Admin module property tests
    - Create `load-tests/__tests__/admin/admin.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: admin entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

  - [x] 16.10 Create Legal module property tests
    - Create `load-tests/__tests__/legal/legal.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: legal entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

  - [x] 16.11 Create Pending-Email module property tests
    - Create `load-tests/__tests__/pending-email/pending-email.test.js`
    - Property test: fixture loading and `getUser` produces valid users for all generated VU indices
    - Property test: pending-email entry point scenario configuration contains valid executor types, positive VU counts, non-empty exec names
    - Use fast-check with minimum 100 iterations per property
    - **Property 1: Fixture-Based User Selection Validity**
    - **Property 2: Scenario Configuration Validity**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5**

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All modules follow the Groups reference implementation pattern at `load-tests/modules/groups/`
- Shared infrastructure (helpers, config, base fixtures) is reused — no code duplication
- Seed scripts are idempotent and use the `loadtest-` prefix convention for cleanup
- Prayer-Time module has no database records — seed script creates coordinate/method fixture data only
- Khutbah and Legal modules have public endpoints — scenarios skip auth headers for public reads
- Subscription module includes rate-limit awareness with pacing and dedicated rate-limit validation scenario
- Implementation proceeds by priority: High (Prayer-Time, Mosque, Dua, Ask-Question) → Medium (Subscription, Support-Ticket, Learning-Content, Khutbah) → Low (Admin, Legal, Pending-Email)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.1", "6.1", "7.1", "8.1", "9.1", "11.1", "12.1", "13.1"] },
    { "id": 1, "tasks": ["1.2", "1.6", "2.2", "2.6", "3.2", "3.6", "4.2", "4.7", "6.2", "6.8", "7.2", "7.7", "8.2", "8.7", "9.2", "9.6", "11.2", "11.5", "12.2", "12.5", "13.2", "13.5"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "2.3", "2.4", "2.5", "3.3", "3.4", "3.5", "4.3", "4.4", "4.5", "4.6", "6.3", "6.4", "6.5", "6.6", "6.7", "7.3", "7.4", "7.5", "7.6", "8.3", "8.4", "8.5", "8.6", "9.3", "9.4", "9.5", "11.3", "11.4", "12.3", "12.4", "13.3", "13.4"] },
    { "id": 3, "tasks": ["15.1"] },
    { "id": 4, "tasks": ["16.1", "16.2", "16.3", "16.4", "16.5", "16.6", "16.7", "16.8", "16.9", "16.10", "16.11"] }
  ]
}
```
