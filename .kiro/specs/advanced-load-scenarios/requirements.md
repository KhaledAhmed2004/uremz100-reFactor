# Requirements Document

## Introduction

This feature extends the existing k6 load testing suite at `load-tests/` with three new standalone scenarios: Stress Test (find the breaking point), Soak Test (detect memory leaks), and Chaos Test (test failure resilience). Each scenario runs independently via dedicated npm scripts and produces its own metrics and reports. The scenarios target the Group API endpoints and reuse the existing fixture/auth infrastructure.

## Glossary

- **Stress_Test_Scenario**: A k6 load test that progressively increases virtual users in stepped stages to discover the maximum concurrent load the Group API can handle before performance degrades beyond acceptable thresholds.
- **Soak_Test_Scenario**: A k6 load test that applies moderate, sustained load over an extended duration to detect gradual performance degradation such as memory leaks or connection pool exhaustion.
- **Chaos_Test_Scenario**: A k6 load test that sends requests to invalid or non-existent resources under moderate load to verify the API returns proper error responses and continues serving valid requests normally.
- **Group_API**: The Express.js REST API serving group, post, comment, and membership endpoints at `/api/v1/groups`.
- **VU**: Virtual User — a simulated concurrent user in k6.
- **Breaking_Point**: The VU count at which p95 response time exceeds 2000ms or error rate exceeds 5%.
- **Degradation_Indicator**: A condition where response time at the end of a soak test is more than 2x the response time measured at the start.
- **Fixtures**: Pre-seeded test data (users, groups, posts) stored in `load-tests/fixtures.json` and loaded via SharedArray.
- **Stage**: A k6 ramping configuration defining a duration and target VU count.

## Requirements

### Requirement 1: Stress Test Scenario File

**User Story:** As a performance engineer, I want a stress test scenario that progressively increases VUs in stepped stages, so that I can identify the maximum concurrent load the Group API handles before breaking.

#### Acceptance Criteria

1. THE Stress_Test_Scenario SHALL be located at `load-tests/scenarios/stress.js` and SHALL export a default function executable by k6.
2. WHEN executed in local mode (default), THE Stress_Test_Scenario SHALL use ramping stages: 10→25→50→75→100 VUs with 1-minute ramp and 2-minute hold at each level, followed by a 2-minute ramp-down to 0.
3. WHEN the environment variable `STRESS_PROFILE` is set to `production`, THE Stress_Test_Scenario SHALL use ramping stages: 50→100→200→300 VUs with 2-minute ramp and 5-minute hold at each level, followed by a 10-minute ramp-down to 0.
4. THE Stress_Test_Scenario SHALL define k6 thresholds for `http_req_duration` at p50, p95, and p99 percentiles.
5. THE Stress_Test_Scenario SHALL define a k6 threshold for `http_req_failed` rate.
6. THE Stress_Test_Scenario SHALL exercise a mix of Group API read endpoints (GET /groups, GET /groups/:groupId, GET /groups/:groupId/posts, GET /posts/:postId/comments) distributed across available fixture data.
7. THE Stress_Test_Scenario SHALL use the existing `helpers/auth.js` module to obtain authentication headers from fixture data.
8. THE Stress_Test_Scenario SHALL use the existing `fixtures.json` via k6 SharedArray for test data.
9. THE Stress_Test_Scenario SHALL tag each HTTP request with a descriptive name for per-endpoint metric analysis.

### Requirement 2: Stress Test Breaking Point Detection

**User Story:** As a performance engineer, I want the stress test to clearly indicate when the API reaches its breaking point, so that I can determine capacity limits.

#### Acceptance Criteria

1. THE Stress_Test_Scenario SHALL define a threshold that fails when p95 response time exceeds 2000ms.
2. THE Stress_Test_Scenario SHALL define a threshold that fails when the HTTP error rate exceeds 5%.
3. WHEN the test completes, THE Stress_Test_Scenario SHALL produce an HTML report at `load-tests/reports/report.html` using the k6-reporter library.
4. WHEN the test completes, THE Stress_Test_Scenario SHALL output a text summary to stdout including per-stage metrics.

### Requirement 3: Soak Test Scenario File

**User Story:** As a performance engineer, I want a soak test that runs moderate load for an extended period, so that I can detect memory leaks, connection pool exhaustion, or gradual performance degradation.

#### Acceptance Criteria

1. THE Soak_Test_Scenario SHALL be located at `load-tests/scenarios/soak.js` and SHALL export a default function executable by k6.
2. WHEN executed in local mode (default), THE Soak_Test_Scenario SHALL ramp up to 20 VUs over 2 minutes, sustain 20 VUs for 30 minutes, then ramp down to 0 over 2 minutes.
3. WHEN the environment variable `SOAK_PROFILE` is set to `production`, THE Soak_Test_Scenario SHALL ramp up to 20 VUs over 2 minutes, sustain 20 VUs for 4 hours, then ramp down to 0 over 2 minutes.
4. THE Soak_Test_Scenario SHALL exercise a mix of read and write Group API endpoints to simulate realistic sustained usage.
5. THE Soak_Test_Scenario SHALL use the existing `helpers/auth.js` module and `fixtures.json` via SharedArray.
6. THE Soak_Test_Scenario SHALL tag each HTTP request with a descriptive name for per-endpoint metric analysis.

### Requirement 4: Soak Test Degradation Detection

**User Story:** As a performance engineer, I want the soak test to detect gradual performance degradation over time, so that I can identify memory leaks or resource exhaustion.

#### Acceptance Criteria

1. THE Soak_Test_Scenario SHALL define a threshold that fails when p95 response time exceeds 5000ms.
2. THE Soak_Test_Scenario SHALL define a threshold that fails when the HTTP error rate exceeds 1%.
3. WHEN the test completes, THE Soak_Test_Scenario SHALL produce an HTML report at `load-tests/reports/report.html`.
4. WHEN the test completes, THE Soak_Test_Scenario SHALL output a text summary to stdout.
5. THE Soak_Test_Scenario SHALL use k6 Trend metrics to track response times, enabling comparison of early-test vs late-test performance in the report.

### Requirement 5: Chaos Test Scenario File

**User Story:** As a performance engineer, I want a chaos test that sends requests to invalid resources under load, so that I can verify the API degrades gracefully and returns proper error responses.

#### Acceptance Criteria

1. THE Chaos_Test_Scenario SHALL be located at `load-tests/scenarios/chaos.js` and SHALL export a default function executable by k6.
2. THE Chaos_Test_Scenario SHALL run with 10 VUs for 1 minute of sustained load.
3. THE Chaos_Test_Scenario SHALL send requests to non-existent group IDs (e.g., `000000000000000000000000`) and verify the API returns HTTP 404 status.
4. THE Chaos_Test_Scenario SHALL send requests to non-existent post IDs and verify the API returns HTTP 404 status.
5. THE Chaos_Test_Scenario SHALL interleave valid requests (to existing fixture resources) with invalid requests to verify the API continues serving valid requests with HTTP 200 status during error conditions.
6. THE Chaos_Test_Scenario SHALL use the existing `helpers/auth.js` module and `fixtures.json` via SharedArray.
7. THE Chaos_Test_Scenario SHALL tag requests with descriptive names distinguishing valid from invalid requests (e.g., `valid: GET /groups`, `chaos: GET /groups/:invalidId`).

### Requirement 6: Chaos Test Resilience Verification

**User Story:** As a performance engineer, I want the chaos test to confirm the API handles errors without cascading failures, so that I can trust the system under partial failure conditions.

#### Acceptance Criteria

1. THE Chaos_Test_Scenario SHALL define k6 checks verifying that requests to non-existent resources return HTTP 404 (not HTTP 500).
2. THE Chaos_Test_Scenario SHALL define k6 checks verifying that valid requests continue returning HTTP 200 during the test.
3. THE Chaos_Test_Scenario SHALL define a threshold requiring the overall checks pass rate to exceed 95%.
4. WHEN the test completes, THE Chaos_Test_Scenario SHALL produce an HTML report at `load-tests/reports/report.html`.
5. WHEN the test completes, THE Chaos_Test_Scenario SHALL output a text summary to stdout.

### Requirement 7: npm Script Integration

**User Story:** As a developer, I want dedicated npm scripts for each new scenario, so that I can run them independently with a simple command.

#### Acceptance Criteria

1. THE package.json SHALL include a script `load:stress` that executes `k6 run --out web-dashboard load-tests/scenarios/stress.js`.
2. THE package.json SHALL include a script `load:soak` that executes `k6 run --out web-dashboard load-tests/scenarios/soak.js`.
3. THE package.json SHALL include a script `load:chaos` that executes `k6 run --out web-dashboard load-tests/scenarios/chaos.js`.
4. THE npm scripts SHALL be independent of the existing `load:test` script and SHALL NOT modify the `group.load.js` main entry point.

### Requirement 8: Scenario Independence

**User Story:** As a developer, I want each new scenario to be fully self-contained, so that I can run any scenario without dependencies on other scenarios or the main test suite.

#### Acceptance Criteria

1. THE Stress_Test_Scenario SHALL define its own k6 `options` object with scenarios, thresholds, and stages inline (not imported from `config/thresholds.js`).
2. THE Soak_Test_Scenario SHALL define its own k6 `options` object with scenarios, thresholds, and stages inline.
3. THE Chaos_Test_Scenario SHALL define its own k6 `options` object with scenarios, thresholds, and stages inline.
4. WHEN any scenario is executed via `k6 run`, THE scenario SHALL load fixtures from `../fixtures.json` relative to its file location.
5. WHEN any scenario is executed via `k6 run`, THE scenario SHALL read the base URL from the `BASE_URL` environment variable, defaulting to `http://localhost:5002`.
