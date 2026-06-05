# Requirements Document

## Introduction

Restructure the flat `load-tests/` folder into a production-level, module-based organization that scales across all 18 API modules. The current structure has all scenarios in a single `scenarios/` folder, all helpers in `helpers/`, and a single `fixtures.json`. This restructure introduces a `modules/` directory with per-module scenarios and fixtures, a `shared/` directory for cross-cutting helpers and configuration, module-wise reports, and updated npm scripts with module prefixes. Backward compatibility is maintained — existing Group module tests must continue to pass after the restructure.

## Glossary

- **Load_Test_System**: The k6-based load testing infrastructure located in the `load-tests/` directory
- **Module**: A logical grouping of API endpoints corresponding to one of the 18 API modules (Auth, Users, Groups, Ask Question, Khutbah, Mosque, Notification, Legal, Admin, Learning Content, Dua, Support Ticket, Pending Email, Connection, Chat, Message, Subscription, Prayer Time)
- **Scenario**: A k6 test script that exercises a specific load pattern (stress, soak, spike, baseline, chaos, read-load, write-load, user-journey, role-auth)
- **Fixture**: A JSON file containing pre-seeded test data (user tokens, group IDs, post IDs) required by scenarios
- **Shared_Helper**: A reusable JavaScript module providing cross-cutting functionality (authentication, HTTP client, report generation, scenario utilities) used by multiple module scenarios
- **handleSummary**: The k6 lifecycle function that generates HTML reports and stdout summaries after a test run
- **Seed_Script**: A Node.js script that populates the database with test fixture data for a specific module

## Requirements

### Requirement 1: Module-Based Directory Structure

**User Story:** As a developer, I want load test files organized by API module, so that I can locate and maintain tests for each module independently without navigating a flat folder of 30-40+ files.

#### Acceptance Criteria

1. THE Load_Test_System SHALL organize scenario files under `load-tests/modules/{module-name}/scenarios/` where `{module-name}` corresponds to one of the 18 API modules in kebab-case format (auth, users, groups, ask-question, khutbah, mosque, notification, legal, admin, learning-content, dua, support-ticket, pending-email, connection, chat, message, subscription, prayer-time)
2. THE Load_Test_System SHALL organize module-specific fixture files under `load-tests/modules/{module-name}/fixtures/`
3. THE Load_Test_System SHALL provide a module entry point file at `load-tests/modules/{module-name}/{module-name}.load.js` that imports all scenario exec functions from the module's `scenarios/` directory, defines k6 `options` with scenario configurations and thresholds, and exports a `handleSummary` function that routes reports to the module's report directory
4. WHEN a new module is added, THE Load_Test_System SHALL require only creating a new directory under `modules/` with the standard `scenarios/`, `fixtures/` subdirectories and an entry point file, without modifications to existing shared helpers, configuration files, or other module directories
5. THE Load_Test_System SHALL ensure each module directory contains at minimum one scenario file in `scenarios/` and the module entry point file before the module is considered complete

### Requirement 2: Existing Group Scenarios Migration

**User Story:** As a developer, I want the existing 9 Group scenario files moved into the new module structure, so that the Groups module serves as the reference implementation for all other modules.

#### Acceptance Criteria

1. WHEN the restructure is complete, THE Load_Test_System SHALL contain all 9 existing scenario files (baseline, chaos, read-load, role-auth, soak, spike, stress, user-journey, write-load) under `load-tests/modules/groups/scenarios/`, each preserving its original file name
2. WHEN the restructure is complete, THE Load_Test_System SHALL contain the Groups entry point at `load-tests/modules/groups/groups.load.js` that re-exports the same 6 exec functions (runBaseline, runReadLoad, runWriteLoad, runUserJourney, runSpike, runRoleAuth), defines identical k6 scenario executors with the same VU counts, durations, stages, and startTime values, and applies the same thresholds as the current `group.load.js`
3. THE Load_Test_System SHALL preserve all existing scenario logic, thresholds, and k6 options after migration, where "preserve" means the exported functions, executor configurations, VU counts, durations, ramp stages, threshold definitions, and custom metric declarations remain identical, while import paths are updated to reference the new shared helper and fixture locations
4. IF a migrated scenario file references a shared helper or fixture, THEN THE Load_Test_System SHALL update the import path to resolve from the new `shared/helpers/` or `shared/fixtures/` location without altering the imported function signatures or fixture data structure

### Requirement 3: Shared Helpers Extraction

**User Story:** As a developer, I want shared helpers (auth, scenario-utils, HTTP client, report generation) extracted into a `shared/helpers/` directory, so that all modules can reuse them without duplication.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide `load-tests/shared/helpers/auth.js` exporting the `getUser`, `getToken`, and `getAuthHeaders` functions with the same parameter signatures and return types as the original `load-tests/helpers/auth.js`
2. THE Load_Test_System SHALL provide `load-tests/shared/helpers/scenario-utils.js` exporting the `getStressStages`, `getSoakStages`, `classifyPhase`, and `resolveBaseUrl` functions with the same parameter signatures and return types as the original `load-tests/helpers/scenario-utils.js`
3. THE Load_Test_System SHALL provide `load-tests/shared/helpers/report.js` containing a reusable `handleSummary` function that accepts a module name parameter and returns an object mapping `load-tests/reports/{module-name}/report.html` to the generated HTML report and `stdout` to a text summary
4. WHEN a scenario imports a shared helper, THE Load_Test_System SHALL use relative file path imports from the scenario file to the target helper under `load-tests/shared/helpers/` (e.g., `../../shared/helpers/auth.js` from a module scenario)
5. IF an empty or undefined module name is passed to the `handleSummary` function in `report.js`, THEN THE Load_Test_System SHALL fall back to writing the HTML report to `load-tests/reports/report.html`
6. THE Load_Test_System SHALL ensure all shared helper files are compatible with both the k6 ES module runtime (for scenario execution) and Node.js CommonJS (for seed scripts and vitest tests)

### Requirement 4: Shared Configuration

**User Story:** As a developer, I want shared configuration (thresholds, load profiles) centralized in `shared/config/`, so that all modules use consistent performance criteria.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide `load-tests/shared/config/thresholds.js` exporting a base threshold object containing scenario-tagged k6 metric keys (e.g., `http_req_duration{scenario:"baseline"}`) that module entry points can import directly into their k6 `options.thresholds`
2. THE Load_Test_System SHALL provide `load-tests/shared/config/profiles.js` exporting profile functions for at least stress and soak scenarios, where each function accepts an environment variable value (e.g., `"local"` or `"production"`) and returns a k6-compatible stages array with VU counts, durations, and ramp patterns for that environment
3. WHEN a module entry point merges custom thresholds with the base thresholds, THE Load_Test_System SHALL apply object spread semantics such that module-specific keys override matching base keys while all non-overridden base keys are preserved unchanged
4. IF the profile selection environment variable is not set or is unrecognized, THEN THE Load_Test_System SHALL default to the local profile (lower VU counts and shorter durations)

### Requirement 5: Fixture Splitting

**User Story:** As a developer, I want fixtures split into shared base data and module-specific data, so that each module only loads the fixture data it needs and new modules can define their own test data.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide `load-tests/shared/fixtures/base-fixtures.json` containing shared user accounts and tokens (adminUser, brotherUsers, sisterUsers) used across all modules
2. THE Load_Test_System SHALL provide `load-tests/modules/groups/fixtures/group-fixtures.json` containing Groups-specific data (brotherGroups, sisterGroups, posts)
3. WHEN a scenario requires both shared and module-specific fixture data, THE Load_Test_System SHALL produce a single merged object by combining all top-level keys from base-fixtures.json with all top-level keys from the module fixture file, where module-specific keys take precedence over base keys in case of a naming collision
4. IF a module does not have a module-specific fixture file, THEN THE Load_Test_System SHALL load only the base-fixtures.json and make its contents available to the scenario without error

### Requirement 6: Module-Wise Reports

**User Story:** As a developer, I want reports generated per module in a structured reports directory, so that I can compare performance across modules and track regressions independently.

#### Acceptance Criteria

1. WHEN a module test run completes, THE Load_Test_System SHALL generate an HTML report to `load-tests/reports/{module-name}/report.html` containing the k6 test summary data for that run
2. WHEN a module test run is executed with the `--out json=load-tests/reports/{module-name}/results.json` flag, THE Load_Test_System SHALL generate a JSON results file to `load-tests/reports/{module-name}/results.json` containing the raw k6 metrics output
3. WHEN the shared `handleSummary` helper is invoked with a module name parameter, THE Load_Test_System SHALL construct the report output path as `load-tests/reports/{module-name}/report.html` using the provided module name in kebab-case format
4. IF the `load-tests/reports/{module-name}/` directory does not exist when report generation is triggered, THEN THE Load_Test_System SHALL create the directory before writing the report files

### Requirement 7: Updated NPM Scripts

**User Story:** As a developer, I want npm scripts with module prefixes (load:groups:stress, load:auth:baseline), so that I can run specific module scenarios from the command line without remembering file paths.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide npm scripts following the pattern `load:{module}:{scenario}` for running individual scenarios (e.g., `load:groups:stress`, `load:groups:soak`)
2. THE Load_Test_System SHALL provide npm scripts following the pattern `load:{module}` for running all scenarios in a module (e.g., `load:groups`)
3. THE Load_Test_System SHALL provide a `load:seed:{module}` script pattern for running module-specific seed scripts (e.g., `load:seed:groups`)
4. THE Load_Test_System SHALL retain the existing `load:test`, `load:stress`, `load:soak`, and `load:chaos` scripts as aliases pointing to the Groups module for backward compatibility

### Requirement 8: Seed Scripts Per Module

**User Story:** As a developer, I want seed scripts organized per module under `load-tests/scripts/`, so that I can seed test data for specific modules independently.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide `load-tests/scripts/seed-groups.js` containing the existing Groups seed logic relocated from `load-tests/helpers/seed.js`, including user creation, group creation, group membership assignment, and post creation
2. WHEN a seed script is executed, THE Load_Test_System SHALL write module-specific fixtures (group IDs, post IDs, membership data) to the corresponding `modules/{module-name}/fixtures/` directory and shared fixtures (admin user credentials, brother user credentials, sister user credentials) to `shared/fixtures/base-fixtures.json`
3. WHEN a seed script is executed, THE Load_Test_System SHALL perform idempotent cleanup of previously seeded data for that module before creating new data
4. IF a seed script fails to connect to the database or fails during data creation, THEN THE Load_Test_System SHALL exit with a non-zero exit code and log an error message indicating the failure reason
5. THE Load_Test_System SHALL provide a seed script template at `load-tests/scripts/seed-template.js` containing placeholder sections for database connection, idempotent cleanup, data creation, fixture file generation, and shared fixture merging that new modules can copy and adapt

### Requirement 9: Unit Test Organization

**User Story:** As a developer, I want unit tests organized by module under `load-tests/__tests__/`, so that test files mirror the module structure and are easy to locate.

#### Acceptance Criteria

1. THE Load_Test_System SHALL organize existing test files under `load-tests/__tests__/groups/` using the naming convention `{scenario-name}.test.js` (e.g., `advanced-scenarios.test.js`)
2. THE Load_Test_System SHALL provide a `load-tests/__tests__/shared/` directory containing test files for shared helpers defined in `load-tests/shared/helpers/` (auth, scenario-utils, report)
3. WHEN a new module adds scenarios, THE Load_Test_System SHALL require at least one test file under `load-tests/__tests__/{module-name}/` covering the module's scenario logic
4. THE Load_Test_System SHALL configure the test runner to discover test files matching `load-tests/__tests__/**/*.test.js` so that all module and shared test directories are included in test execution

### Requirement 10: Backward Compatibility

**User Story:** As a developer, I want existing tests and scripts to continue working after the restructure, so that the migration does not break CI pipelines or developer workflows.

#### Acceptance Criteria

1. WHEN the existing `npm run load:test` command is executed, THE Load_Test_System SHALL run the Groups module load test executing the same 6 scenarios (baseline, read_load, write_load, user_journey, role_auth, spike) with the same executor types, VU counts, durations, and thresholds as defined in the pre-restructure `group.load.js`
2. WHEN the existing `npm run load:seed` command is executed, THE Load_Test_System SHALL seed Groups fixture data and write shared fixtures to `load-tests/shared/fixtures/base-fixtures.json` and Groups-specific fixtures to `load-tests/modules/groups/fixtures/group-fixtures.json`
3. WHEN the existing vitest test suite is executed, THE Load_Test_System SHALL pass all 4 existing property-based test suites (BASE_URL Resolution, Environment-Based Profile Selection, Fixture-Based Request Distribution, Soak Phase Classification) with zero assertion failures and no modifications to test expected values
4. WHEN a scenario file imports a helper module, THE Load_Test_System SHALL resolve the import to the corresponding file under `load-tests/shared/helpers/` so that all scenario-to-helper dependencies remain functional after relocation
5. WHEN the existing `npm run load:stress`, `npm run load:soak`, or `npm run load:chaos` commands are executed, THE Load_Test_System SHALL run the corresponding Groups module scenario with the same behavior and exit codes as the pre-restructure execution
6. WHEN any backward-compatible npm script completes execution, THE Load_Test_System SHALL return the same exit code (0 for success, non-zero for threshold breach) as the pre-restructure execution to preserve CI pipeline pass/fail detection

### Requirement 11: Documentation

**User Story:** As a developer, I want a README documenting the folder structure, conventions, and how to add new modules, so that team members can onboard and contribute load tests independently.

#### Acceptance Criteria

1. THE Load_Test_System SHALL provide `load-tests/README.md` documenting the folder structure as a directory tree showing all directories and key files within `load-tests/` to at least 2 levels of depth, with a one-line description for each directory and entry point file
2. THE Load_Test_System SHALL document the step-by-step process for adding a new module, including at minimum: directory creation under `modules/`, fixture file setup, scenario file creation, entry point wiring, and npm script registration in `package.json`
3. THE Load_Test_System SHALL document all npm script patterns (`load:{module}:{scenario}`, `load:{module}`, `load:seed:{module}`, and backward-compatible aliases) with the command syntax and a description of what each pattern executes
4. THE Load_Test_System SHALL document the shared helper APIs (auth, report, scenario-utils) listing each exported function's name, parameters, and return value, with at least 1 code usage example per helper module
5. THE Load_Test_System SHALL include a prerequisites section documenting required tooling (k6, Node.js) and environment variables (database connection, JWT secret) needed to run the load test suite
