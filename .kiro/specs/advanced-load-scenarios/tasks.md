# Implementation Plan: Advanced Load Scenarios

## Overview

Extend the existing k6 load testing suite with three new standalone scenarios (Stress, Soak, Chaos) that run independently via dedicated npm scripts. Each scenario reuses the existing fixture/auth infrastructure, defines its own inline k6 options, and produces HTML reports. Pure logic is extracted into testable helper modules for property-based testing with fast-check via vitest.

## Tasks

- [x] 1. Set up shared utilities and testing infrastructure
  - [x] 1.1 Create helper module for extractable pure logic
    - Create `load-tests/helpers/scenario-utils.js` exporting: `getStressStages(profileValue)`, `getSoakStages(profileValue)`, `classifyPhase(elapsedSeconds)`, `resolveBaseUrl(envValue)`
    - `getStressStages` returns local stages array when profileValue !== 'production', production stages otherwise
    - `getSoakStages` returns local stages array when profileValue !== 'production', production stages otherwise
    - `classifyPhase` returns 'early', 'late', or 'middle' based on elapsed seconds relative to soak sustained phase boundaries
    - `resolveBaseUrl` returns envValue if truthy, otherwise 'http://localhost:5002'
    - Use CommonJS module.exports to match existing helpers/auth.js pattern
    - _Requirements: 1.2, 1.3, 3.2, 3.3, 4.5, 8.5_

  - [x] 1.2 Install fast-check and create property test file
    - Run `npm install --save-dev fast-check`
    - Create `load-tests/__tests__/advanced-scenarios.test.js` with vitest + fast-check imports
    - Set up test fixtures mock data matching the structure of fixtures.json (brotherGroups, posts arrays)
    - _Requirements: Design Testing Strategy_

- [x] 2. Implement Stress Test scenario
  - [x] 2.1 Create `load-tests/scenarios/stress.js`
    - Import http, check, sleep from k6; SharedArray from k6/data; htmlReport and textSummary from remote libs; getAuthHeaders from helpers/auth.js; getStressStages and resolveBaseUrl from helpers/scenario-utils.js
    - Load fixtures via SharedArray from '../fixtures.json'
    - Resolve BASE_URL using resolveBaseUrl(__ENV.BASE_URL)
    - Define `export const options` with ramping-vus executor using `getStressStages(__ENV.STRESS_PROFILE)`
    - Define thresholds: http_req_duration p50<1000, p95<2000, p99<5000; http_req_failed rate<0.05
    - Implement default function: get auth headers for VU, distribute across fixture groups/posts using modulo, execute GET /groups, GET /groups/:id, GET /groups/:id/posts, GET /posts/:id/comments with tags and checks
    - Implement handleSummary producing HTML report at 'load-tests/reports/report.html' and stdout text summary
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 2.4, 8.1, 8.4, 8.5_

  - [x] 2.2 Write property test for environment-based profile selection (stress)
    - **Property 1: Environment-Based Profile Selection**
    - Test that any non-'production' string (including undefined, empty, random strings) selects local stages (first target = 10)
    - Test that 'production' selects production stages (first target = 50)
    - Use fc.string() arbitrary with fc.pre(profileValue !== 'production')
    - Minimum 100 iterations
    - **Validates: Requirements 1.2, 1.3**

  - [x] 2.3 Write property test for fixture-based request distribution (stress)
    - **Property 2: Fixture-Based Request Distribution**
    - Test that any VU index (0 to 999) produces valid indices into brotherGroups and posts arrays via modulo
    - Use fc.integer({ min: 0, max: 999 }) arbitrary
    - Verify groupIndex and postIndex are within bounds and produce defined objects
    - Minimum 100 iterations
    - **Validates: Requirements 1.6, 3.4**

- [x] 3. Implement Soak Test scenario
  - [x] 3.1 Create `load-tests/scenarios/soak.js`
    - Import http, check, sleep from k6; SharedArray from k6/data; Trend from k6/metrics; htmlReport and textSummary from remote libs; getAuthHeaders from helpers/auth.js; getSoakStages, classifyPhase, resolveBaseUrl from helpers/scenario-utils.js
    - Load fixtures via SharedArray from '../fixtures.json'
    - Resolve BASE_URL using resolveBaseUrl(__ENV.BASE_URL)
    - Define custom Trend metrics: earlyResponseTime, lateResponseTime
    - Define `export const options` with ramping-vus executor using `getSoakStages(__ENV.SOAK_PROFILE)`
    - Define thresholds: http_req_duration p95<5000; http_req_failed rate<0.01
    - Implement default function: get auth headers, distribute across fixtures, execute mix of read and write endpoints (GET /groups, GET /groups/:id/posts, POST comment), record response times into earlyResponseTime or lateResponseTime based on classifyPhase(elapsed), sleep between iterations
    - Implement handleSummary producing HTML report and stdout text summary
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 8.2, 8.4, 8.5_

  - [x] 3.2 Write property test for soak phase classification
    - **Property 3: Soak Phase Classification**
    - Test that any elapsed time value (0 to 34*60 seconds) maps to correct phase: 'early' for first 5 min of sustained phase, 'late' for last 5 min, 'middle' otherwise
    - Use fc.integer({ min: 0, max: 34 * 60 }) arbitrary
    - Verify phase boundaries: sustainStart=2*60, earlyEnd=sustainStart+5*60, lateStart=sustainEnd-5*60, sustainEnd=32*60
    - Minimum 100 iterations
    - **Validates: Requirements 4.5**

  - [x] 3.3 Write property test for BASE_URL resolution
    - **Property 6: BASE_URL Resolution**
    - Test that any truthy URL string is used as-is
    - Test that undefined/empty defaults to 'http://localhost:5002'
    - Use fc.webUrl() arbitrary for truthy values
    - Minimum 100 iterations
    - **Validates: Requirements 8.5**

- [x] 4. Checkpoint - Verify stress and soak scenarios
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Chaos Test scenario
  - [x] 5.1 Create `load-tests/scenarios/chaos.js`
    - Import http, check, sleep from k6; SharedArray from k6/data; htmlReport and textSummary from remote libs; getAuthHeaders from helpers/auth.js; resolveBaseUrl from helpers/scenario-utils.js
    - Load fixtures via SharedArray from '../fixtures.json'
    - Resolve BASE_URL using resolveBaseUrl(__ENV.BASE_URL)
    - Define `export const options` with constant-vus executor: 10 VUs, 1 minute duration
    - Define threshold: checks rate>0.95
    - Define INVALID_ID constant as '000000000000000000000000'
    - Implement default function: get auth headers, select valid group/post from fixtures via modulo, interleave valid and invalid requests:
      - Valid: GET /groups → check status 200, tag 'valid: GET /groups'
      - Invalid: GET /groups/INVALID_ID → check status 404, tag 'chaos: GET /groups/:invalidId'
      - Valid: GET /groups/:groupId/posts → check status 200, tag 'valid: GET /groups/:id/posts'
      - Invalid: GET /groups/posts/INVALID_ID/comments → check status 404, tag 'chaos: GET /posts/:invalidId/comments'
    - Implement handleSummary producing HTML report and stdout text summary
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 8.3, 8.4, 8.5_

  - [x] 5.2 Write property test for invalid resource check logic
    - **Property 4: Invalid Resource Returns 404**
    - Test that any 24-char hex string used as non-existent ObjectId triggers the 404 check assertion (not 500)
    - Use fc.hexaString({ minLength: 24, maxLength: 24 }) arbitrary
    - Verify check function returns true for status 404, false for status 500
    - Minimum 100 iterations
    - **Validates: Requirements 5.3, 5.4, 6.1**

- [x] 6. Add npm scripts to package.json
  - [x] 6.1 Add load:stress, load:soak, and load:chaos scripts
    - Add `"load:stress": "k6 run --out web-dashboard load-tests/scenarios/stress.js"` to package.json scripts
    - Add `"load:soak": "k6 run --out web-dashboard load-tests/scenarios/soak.js"` to package.json scripts
    - Add `"load:chaos": "k6 run --out web-dashboard load-tests/scenarios/chaos.js"` to package.json scripts
    - Verify scripts are independent of existing `load:test` script
    - Verify `group.load.js` is NOT modified
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The helper module `scenario-utils.js` extracts pure logic for testability while keeping k6 scenario files clean
- All scenarios use CommonJS-compatible imports matching the existing `helpers/auth.js` pattern
- fast-check needs to be installed as a dev dependency (not currently in package.json)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3"] },
    { "id": 3, "tasks": ["5.1", "6.1"] },
    { "id": 4, "tasks": ["5.2"] }
  ]
}
```
