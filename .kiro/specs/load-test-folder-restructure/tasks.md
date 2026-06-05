# Implementation Plan: Load Test Folder Restructure

## Overview

Restructure the flat `load-tests/` folder into a module-based organization. The Groups module serves as the reference implementation. Work proceeds in layers: shared infrastructure first, then Groups migration, then backward-compatibility wiring, then documentation and tests.

## Tasks

- [x] 1. Create shared infrastructure
  - [x] 1.1 Create shared helpers directory and relocate helper files
    - Create `load-tests/shared/helpers/` directory
    - Copy `load-tests/helpers/auth.js` → `load-tests/shared/helpers/auth.js` (preserve function signatures: `getUser`, `getToken`, `getAuthHeaders`)
    - Copy `load-tests/helpers/scenario-utils.js` → `load-tests/shared/helpers/scenario-utils.js` (preserve function signatures: `getStressStages`, `getSoakStages`, `classifyPhase`, `resolveBaseUrl`)
    - Create `load-tests/shared/helpers/report.js` with `createHandleSummary(moduleName)` factory function that returns a k6 `handleSummary` function routing HTML reports to `load-tests/reports/{moduleName}/report.html` and stdout to text summary; falls back to `load-tests/reports/report.html` when moduleName is empty/undefined
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_

  - [x] 1.2 Create shared configuration files
    - Create `load-tests/shared/config/` directory
    - Create `load-tests/shared/config/thresholds.js` exporting `THRESHOLDS` object with scenario-tagged metric keys matching the current `load-tests/config/thresholds.js` values
    - Create `load-tests/shared/config/profiles.js` exporting `getStressProfile(profileValue)` and `getSoakProfile(profileValue)` functions that return k6-compatible stages arrays; default to local profile when value is not `"production"`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 1.3 Create shared fixtures directory and split fixture data
    - Create `load-tests/shared/fixtures/` directory
    - Create `load-tests/shared/fixtures/base-fixtures.json` containing shared user accounts and tokens (adminUser, brotherUsers, sisterUsers) extracted from the current `load-tests/fixtures.json`
    - _Requirements: 5.1, 5.4_

- [x] 2. Migrate Groups module
  - [x] 2.1 Create Groups module directory structure
    - Create `load-tests/modules/groups/scenarios/` directory
    - Create `load-tests/modules/groups/fixtures/` directory
    - Move all 9 scenario files (baseline.js, chaos.js, read-load.js, role-auth.js, soak.js, spike.js, stress.js, user-journey.js, write-load.js) from `load-tests/scenarios/` to `load-tests/modules/groups/scenarios/`
    - Create `load-tests/modules/groups/fixtures/group-fixtures.json` containing Groups-specific data (brotherGroups, sisterGroups, posts) extracted from the current `load-tests/fixtures.json`
    - _Requirements: 1.1, 1.2, 2.1, 5.2_

  - [x] 2.2 Update import paths in migrated scenario files
    - Update all scenario files under `load-tests/modules/groups/scenarios/` to import helpers from `../../../shared/helpers/auth.js` and `../../../shared/helpers/scenario-utils.js`
    - Update fixture loading to use `SharedArray` with `open('../../../shared/fixtures/base-fixtures.json')` for base fixtures and `open('../fixtures/group-fixtures.json')` for module fixtures
    - Merge fixtures using object spread: `{ ...baseFixtures, ...moduleFixtures }`
    - _Requirements: 2.3, 2.4, 3.4, 5.3_

  - [x] 2.3 Create Groups module entry point
    - Create `load-tests/modules/groups/groups.load.js` that:
      - Imports all 6 exec functions (runBaseline, runReadLoad, runWriteLoad, runUserJourney, runSpike, runRoleAuth) from `./scenarios/`
      - Re-exports all exec functions for k6 executor routing
      - Imports `THRESHOLDS` from `../../shared/config/thresholds.js`
      - Imports `createHandleSummary` from `../../shared/helpers/report.js`
      - Defines k6 `options` with identical scenario executors, VU counts, durations, stages, and startTime values as the current `group.load.js`
      - Declares same custom metrics (readCheckFailures, authBypassCount)
      - Exports `handleSummary` via `createHandleSummary('groups')`
      - Includes `SKIP_LOAD_TESTS` guard in default function
    - _Requirements: 1.3, 2.2, 2.3, 6.1, 6.3_

- [x] 3. Checkpoint - Verify Groups module migration
  - Ensure all scenario files are correctly placed and import paths resolve properly. Ask the user if questions arise.

- [x] 4. Create seed scripts
  - [x] 4.1 Relocate and adapt Groups seed script
    - Create `load-tests/scripts/` directory
    - Create `load-tests/scripts/seed-groups.js` by relocating logic from `load-tests/helpers/seed.js`
    - Update fixture output paths: base fixtures → `../shared/fixtures/base-fixtures.json`, module fixtures → `../modules/groups/fixtures/group-fixtures.json`
    - Ensure idempotent cleanup (delete loadtest-* users, load-testing groups) before creating new data
    - Exit with non-zero code and log error on database connection failure or data creation failure
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 4.2 Create seed script template
    - Create `load-tests/scripts/seed-template.js` with placeholder sections for: database connection, idempotent cleanup, data creation, module fixture file generation, and shared fixture merging
    - Include comments explaining each section and how to adapt for a new module
    - _Requirements: 8.5_

- [x] 5. Update NPM scripts and backward compatibility
  - [x] 5.1 Add module-prefixed npm scripts to package.json
    - Add `load:groups` → `k6 run --out web-dashboard load-tests/modules/groups/groups.load.js`
    - Add `load:groups:stress` → `k6 run --out web-dashboard load-tests/modules/groups/scenarios/stress.js`
    - Add `load:groups:soak` → `k6 run --out web-dashboard load-tests/modules/groups/scenarios/soak.js`
    - Add `load:groups:chaos` → `k6 run --out web-dashboard load-tests/modules/groups/scenarios/chaos.js`
    - Add `load:groups:baseline` → `k6 run load-tests/modules/groups/groups.load.js --env SCENARIO=baseline`
    - Add `load:seed:groups` → `node load-tests/scripts/seed-groups.js`
    - Add `load:ci` → `k6 run load-tests/modules/groups/groups.load.js --out json=load-tests/reports/groups/results.json`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 5.2 Update backward-compatible npm script aliases
    - Update `load:test` → `k6 run --out web-dashboard load-tests/modules/groups/groups.load.js`
    - Update `load:seed` → `node load-tests/scripts/seed-groups.js`
    - Update `load:stress` → `k6 run --out web-dashboard load-tests/modules/groups/scenarios/stress.js`
    - Update `load:soak` → `k6 run --out web-dashboard load-tests/modules/groups/scenarios/soak.js`
    - Update `load:chaos` → `k6 run --out web-dashboard load-tests/modules/groups/scenarios/chaos.js`
    - Update `load:report` → `k6 run load-tests/modules/groups/groups.load.js`
    - _Requirements: 7.4, 10.1, 10.5, 10.6_

  - [x] 5.3 Create module-wise reports directory structure
    - Create `load-tests/reports/groups/` directory with a `.gitkeep` file
    - Ensure `handleSummary` in the Groups entry point writes to `load-tests/reports/groups/report.html`
    - _Requirements: 6.1, 6.2, 6.4_

- [x] 6. Checkpoint - Verify backward compatibility
  - Ensure `npm run load:test`, `npm run load:seed`, `npm run load:stress`, `npm run load:soak`, and `npm run load:chaos` all point to the correct Groups module files. Ask the user if questions arise.

- [x] 7. Migrate and create tests
  - [x] 7.1 Relocate existing test file and update imports
    - Move `load-tests/__tests__/advanced-scenarios.test.js` → `load-tests/__tests__/groups/advanced-scenarios.test.js`
    - Update import paths in the test file from `'../helpers/scenario-utils.js'` to `'../../shared/helpers/scenario-utils.js'` (and similar for auth.js)
    - Verify all 4 existing property-based test suites pass without modifying expected values
    - _Requirements: 9.1, 10.3_

  - [x] 7.2 Write property test for report path construction
    - **Property 1: Report Path Construction**
    - Create `load-tests/__tests__/shared/report.test.js`
    - Generate random kebab-case strings and verify `createHandleSummary(name)` returns object with key `load-tests/reports/{name}/report.html` and `stdout` key
    - Test empty/undefined input falls back to `load-tests/reports/report.html`
    - **Validates: Requirements 3.3, 3.5, 6.1, 6.3**

  - [x] 7.3 Write property test for threshold merge semantics
    - **Property 2: Threshold Merge Semantics**
    - Create `load-tests/__tests__/shared/thresholds.test.js`
    - Generate random threshold objects and verify spread merge produces correct key precedence: module keys override base, non-overridden base keys preserved, no extra keys
    - **Validates: Requirements 4.3**

  - [x] 7.4 Write property test for fixture merge semantics
    - **Property 3: Fixture Merge Semantics**
    - Create `load-tests/__tests__/shared/fixtures.test.js`
    - Generate random fixture objects and verify spread merge produces correct key union with module precedence
    - **Validates: Requirements 5.3, 5.4**

  - [x] 7.5 Write property test for auth helper round-robin distribution
    - **Property 4: Auth Round-Robin Distribution**
    - Create `load-tests/__tests__/shared/auth.test.js`
    - Generate random vuIndex (0–999) and fixture pools of varying sizes, verify `getUser(fixtures, role, vuIndex)` returns user at `vuIndex % pool.length`
    - **Validates: Requirements 3.1, 10.3**

  - [x] 7.6 Write property test for profile selection defaults
    - **Property 5: Profile Selection Defaults to Local**
    - Create `load-tests/__tests__/shared/scenario-utils.test.js`
    - Generate random non-"production" strings and verify `getStressProfile`/`getSoakProfile` return local profile stages
    - **Validates: Requirements 4.2, 4.4**

- [x] 8. Checkpoint - Run all tests
  - Ensure all tests pass (existing property tests + new shared helper tests), ask the user if questions arise.

- [x] 9. Create documentation
  - [x] 9.1 Create load-tests README
    - Create `load-tests/README.md` documenting:
      - Directory tree showing all directories and key files to 2+ levels of depth with one-line descriptions
      - Step-by-step process for adding a new module (directory creation, fixture setup, scenario creation, entry point wiring, npm script registration)
      - All npm script patterns (`load:{module}:{scenario}`, `load:{module}`, `load:seed:{module}`, backward-compatible aliases) with command syntax and descriptions
      - Shared helper APIs (auth, report, scenario-utils) listing each exported function's name, parameters, return value, and at least 1 code usage example per helper
      - Prerequisites section documenting required tooling (k6, Node.js) and environment variables (MONGODB_URI/DATABASE_URL, JWT_SECRET)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 10. Final cleanup and wiring
  - [x] 10.1 Clean up legacy files
    - Remove or mark as deprecated the original flat files that have been relocated: `load-tests/scenarios/` contents, `load-tests/helpers/seed.js`, `load-tests/fixtures.json`, `load-tests/group.load.js`, `load-tests/config/thresholds.js`
    - Keep `load-tests/helpers/auth.js` and `load-tests/helpers/scenario-utils.js` as re-export shims (import from shared and re-export) for any external references, or remove if no external consumers exist
    - _Requirements: 1.4, 10.4_

  - [x] 10.2 Update vitest configuration for new test paths
    - Ensure vitest config discovers test files matching `load-tests/__tests__/**/*.test.js` so both `groups/` and `shared/` test directories are included
    - _Requirements: 9.4_

- [x] 11. Final checkpoint - Full verification
  - Ensure all tests pass, npm scripts resolve correctly, and no broken imports remain. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The Groups module serves as the reference implementation — all other modules follow the same pattern
- JavaScript (k6 ES modules + Node.js CommonJS) is used throughout as specified in the design

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "4.2"] },
    { "id": 3, "tasks": ["2.3", "4.1"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 7, "tasks": ["9.1", "10.1", "10.2"] }
  ]
}
```
