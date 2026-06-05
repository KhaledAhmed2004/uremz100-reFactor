# Implementation Plan: group-load-testing

## Overview

Implement a k6-based load testing suite for the Group API. The work splits into three phases: (1) infrastructure — directory layout, thresholds config, auth helper, npm scripts, and `.gitignore` update; (2) seed script — Node.js + mongoose + faker fixture generator; (3) k6 scenario files and the main entry point. Property-based tests for the seed helper and auth helper run via vitest + fast-check.

---

## Tasks

- [ ] 1. Scaffold project structure and central threshold config
  - [ ] 1.1 Create `load-tests/` directory tree and `config/thresholds.js`
    - Create directories: `load-tests/config/`, `load-tests/helpers/`, `load-tests/scenarios/`, `load-tests/reports/` (empty placeholder)
    - Implement `load-tests/config/thresholds.js` exporting the `THRESHOLDS` object with all nine threshold entries (baseline p95<500, read_load p95<1000 + rate<0.01, write_load p95<2000 + rate<0.05, user_journey p95<3000, spike rate<0.05, role_auth rate<0.001, checks rate==1.0)
    - _Requirements: 1.1, 1.2, 7.1, 7.2_

  - [ ] 1.2 Update `package.json` with load test npm scripts
    - Add `"load:seed": "node load-tests/helpers/seed.js"`
    - Add `"load:test": "k6 run --out web-dashboard load-tests/group.load.js"`
    - Add `"load:report": "k6 run load-tests/group.load.js"`
    - Add `"load:ci": "k6 run load-tests/group.load.js --out json=load-tests/reports/results.json"`
    - _Requirements: 1.10_

  - [ ] 1.3 Update `.gitignore` with `load-tests/reports/`
    - Append `load-tests/reports/` to `.gitignore`
    - _Requirements: 1.11, 9.7_

- [ ] 2. Implement `load-tests/helpers/auth.js`
  - [ ] 2.1 Write `auth.js` token helper module
    - Implement `getUser(fixtures, role, vuIndex)` — selects from `adminUser`, `brotherUsers`, or `sisterUsers` pool using `vuIndex % pool.length`
    - Implement `getToken(fixtures, role, vuIndex)` — delegates to `getUser`, returns `.token`
    - Implement `getAuthHeaders(fixtures, role, vuIndex)` — returns `{ Authorization: "Bearer <token>" }`
    - Pure JS module; no k6 imports; works in both k6 and Node contexts
    - _Requirements: 1.3_

  - [ ]* 2.2 Write property test for `auth.js` — Property 1 & 2: auth enforcement invariants
    - Create `load-tests/__tests__/auth.test.js`
    - Install `fast-check` if not present (check `package.json` first)
    - **Property 1: BROTHER JWT → 403 on admin endpoints** — for any `vuIndex` in [0,9] and any admin endpoint, `getAuthHeaders` returns a header with a BROTHER token; assert token role field decodes to `BROTHER`
    - **Property 2: SISTER JWT → 403 on BROTHER-typed group endpoints** — for any `vuIndex`, `getUser(fixtures, 'sister', vuIndex)` always returns an entry from `sisterUsers`; assert round-robin wraps correctly for all indices
    - Use `fc.integer({ min: 0, max: 99 })` as the VU index generator; run 100 iterations
    - **Validates: Requirements 10.2, 10.3, 10.6**

- [ ] 3. Implement `load-tests/helpers/seed.js`
  - [ ] 3.1 Write seed script skeleton — env loading, DB connection, and cleanup
    - `require` dotenv (load from project root), mongoose, bcrypt, jsonwebtoken, fs, path, `@faker-js/faker`
    - Validate `MONGODB_URI` / `DATABASE_URL` env var; exit 1 with descriptive message if missing
    - Validate `JWT_SECRET`; exit 1 if missing
    - Import existing Mongoose models: `User`, `Group`, `GroupPost`, `GroupMember` (locate model paths in `src/`)
    - Implement idempotent cleanup: `User.deleteMany({ email: /^loadtest-/ })`, `Group.deleteMany({ category: 'load-testing' })`, `GroupPost.deleteMany({ content: /load-test-seed/ })`, `GroupMember.deleteMany({})`
    - _Requirements: 1.4, 1.7, 1.8_

  - [ ] 3.2 Write fixture creation logic in `seed.js`
    - Implement `signToken(user)` using `jwt.sign({ id, role, email, tokenVersion: 0 }, JWT_SECRET, { expiresIn: JWT_EXPIRE || '30d' })`
    - Create 1 SUPER_ADMIN user with email `loadtest-admin@test.com`
    - Create 10 BROTHER users with emails `loadtest-brother-{0..9}@test.com`; password `bcrypt.hashSync('LoadTest123!', 10)`; `status: 'ACTIVE'`, `isVerified: true`
    - Create 10 SISTER users with emails `loadtest-sister-{0..9}@test.com`; same password hash and status
    - Create 2 BROTHER groups (`category: 'load-testing'`, `userType: 'BROTHER'`)
    - Create 2 SISTER groups (`category: 'load-testing'`, `userType: 'SISTER'`)
    - Create 5 posts per group (20 total) with `content: 'load-test-seed ' + faker.lorem.sentence()`
    - _Requirements: 1.5_

  - [ ] 3.3 Write `fixtures.json` output and teardown in `seed.js`
    - Build the `fixtures` object: `{ adminUser: {id, email, token}, brotherUsers: [{id, email, token}×10], sisterUsers: [{id, email, token}×10], brotherGroups: [{id, name}×2], sisterGroups: [{id, name}×2], posts: [{id, groupId}×20] }`
    - Write to `load-tests/fixtures.json` via `fs.writeFileSync`
    - Wrap entire seed function in `try/catch/finally`; `finally` calls `mongoose.disconnect()`; catch logs error and calls `process.exit(1)`; success calls `process.exit(0)`
    - _Requirements: 1.5, 1.6, 1.8_

  - [ ]* 3.4 Write property test for `seed.js` — Property 4: fixture completeness invariant
    - Create `load-tests/__tests__/seed.test.js`
    - **Property 4: Fixture Completeness Invariant** — after running seed, `fixtures.json` must contain all six required top-level keys with correct types and minimum cardinality
    - Assert `adminUser` has `{ id: String, email: String, token: String }`
    - Assert `brotherUsers.length >= 10`, `sisterUsers.length >= 10`
    - Assert `brotherGroups.length >= 2`, `sisterGroups.length >= 2`
    - Assert `posts.length >= 10`
    - Assert every user entry has `{ id: String, token: String }`
    - This is a structural invariant test (not randomized); run as a standard `it` after executing seed against a test DB
    - **Validates: Requirements 1.5, 1.6**

- [ ] 4. Checkpoint — verify seed and auth helper
  - Ensure `node load-tests/helpers/seed.js` runs without errors against a local MongoDB instance
  - Ensure `fixtures.json` is written with correct structure
  - Ensure all tests in `load-tests/__tests__/` pass (`npm run test:run -- load-tests/__tests__`)
  - Ask the user if questions arise before proceeding to k6 scenario files.

- [ ] 5. Implement k6 scenario files
  - [ ] 5.1 Write `load-tests/scenarios/baseline.js`
    - Export `baselineScenario` config: `{ executor: 'per-vu-iterations', vus: 1, iterations: 1, exec: 'runBaseline' }`
    - Load `fixtures` via `SharedArray` reading `../fixtures.json`
    - Implement `runBaseline()`: send 7 sequential requests (GET /groups, GET /groups/:id, POST /groups/:id/join, GET /groups/:id/posts, POST /groups/:id/posts, POST /posts/:id/like, POST /posts/:id/comments) using BROTHER user index 0
    - Tag each request with `{ name: '<endpoint pattern>' }`
    - `check` each response for 2xx status
    - Log duration per endpoint via `console.log`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 5.2 Write `load-tests/scenarios/read-load.js`
    - Export `readLoadScenario` config: `{ executor: 'constant-vus', vus: 50, duration: '30s', exec: 'runReadLoad' }`
    - Load `fixtures` via `SharedArray`
    - Import `readCheckFailures` counter from `../group.load.js`
    - Implement `runReadLoad()`: 4 read requests (GET /groups, GET /groups/:id, GET /groups/:id/posts, GET /posts/:id/comments) using `__VU - 1` for round-robin selection across groups and posts
    - `check` each response for status 200; increment `readCheckFailures` on failure
    - Add `sleep(1)` between iterations
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7_

  - [ ] 5.3 Write `load-tests/scenarios/write-load.js`
    - Export `writeLoadScenario` config: `{ executor: 'constant-vus', vus: 20, duration: '30s', exec: 'runWriteLoad' }`
    - Load `fixtures` via `SharedArray`
    - Implement `runWriteLoad()`: 4 sequential write operations (join → create post → like → comment) using `__VU - 1` for user/group selection
    - Handle join 400 (already member) as non-fatal for flow control; abort iteration on other non-2xx join responses
    - Capture `postId` from create-post response body; fall back to fixture post if extraction fails
    - `check` each response; add `sleep(1)` between iterations
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.7, 4.8, 4.9, 4.10_

  - [ ] 5.4 Write `load-tests/scenarios/user-journey.js`
    - Export `userJourneyScenario` config: `{ executor: 'constant-vus', vus: 10, duration: '30s', exec: 'runUserJourney' }`
    - Load `fixtures` via `SharedArray`
    - Implement `runUserJourney()`: 7 ordered steps (browse → view group → join → read feed → create post → like → comment) with `sleep(1)` between each step
    - Capture `postId` from Step 5 response; use it in Steps 6 and 7; fall back to fixture post if Step 5 fails
    - Implement `step(name, res)` helper that calls `check` and logs step name, status, and body on failure
    - Tag each request with journey step name (e.g., `journey:browse`, `journey:join`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.8_

  - [ ]* 5.5 Write property test for user-journey — Property 3: postId capture and reuse
    - Create `load-tests/__tests__/journey.test.js`
    - **Property 3: Journey postId Capture and Reuse** — for any mock Step 5 response with a 2xx status and a valid `_id` in `data`, the extracted `postId` must equal `data._id`, must not be null/undefined, and must appear verbatim in the constructed like URL and comment URL
    - Use `fc.record({ _id: fc.hexaString({ minLength: 24, maxLength: 24 }) })` as the response data generator
    - Run 100 iterations
    - **Validates: Requirements 5.3**

  - [ ] 5.6 Write `load-tests/scenarios/spike.js`
    - Export `spikeScenario` config: `{ executor: 'ramping-vus', stages: [{ duration: '5s', target: 5 }, { duration: '10s', target: 50 }, { duration: '5s', target: 5 }], exec: 'runSpike' }`
    - Load `fixtures` via `SharedArray`
    - Implement `runSpike()`: 3 requests per iteration (GET /groups, GET /groups/:id/posts, POST /posts/:id/like) using `__VU - 1` for selection
    - Implement `getStageTag(elapsed)` helper returning `'ramp_up'` / `'peak'` / `'recovery'` based on `__ITER`
    - Tag each request with `{ name: '<endpoint>', stage: <stageTag> }`
    - `check` each response for 2xx
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [ ] 5.7 Write `load-tests/scenarios/role-auth.js`
    - Export `roleAuthScenario` config: `{ executor: 'constant-vus', vus: 20, duration: '10s', exec: 'runRoleAuth' }`
    - Load `fixtures` via `SharedArray`
    - Import `authBypassCount` counter from `../group.load.js`
    - Implement `runRoleAuth()`: send 5 SUPER_ADMIN-only requests using BROTHER JWT (POST /groups, PATCH /groups/:id, DELETE /groups/:id, DELETE /groups/:id/members/:userId, PATCH /posts/:id/pin)
    - `check` each response for status exactly 403; increment `authBypassCount` and log endpoint + status + body on any non-403
    - Send 1 SISTER-on-BROTHER-group request; `check` for 403
    - Add `sleep(0.5)` between iterations
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 6. Implement `load-tests/group.load.js` main entry point
  - [ ] 6.1 Write `group.load.js` with options, SharedArray, custom metrics, and handleSummary
    - Import `SharedArray` from `k6/data`; load `./fixtures.json` once shared across all VUs
    - Import `htmlReport` from `https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js`
    - Import `textSummary` from `https://jslib.k6.io/k6-summary/0.0.1/index.js`
    - Import `Counter` from `k6/metrics`; export `readCheckFailures` and `authBypassCount` counters
    - Import all six scenario config objects (`baselineScenario`, `readLoadScenario`, `writeLoadScenario`, `userJourneyScenario`, `spikeScenario`, `roleAuthScenario`)
    - Import `THRESHOLDS` from `./config/thresholds.js`
    - Export `options` object: `{ scenarios: { baseline: {...baselineScenario, startTime:'0s'}, read_load: {...readLoadScenario, startTime:'5s'}, write_load: {...writeLoadScenario, startTime:'5s'}, user_journey: {...userJourneyScenario, startTime:'5s'}, spike: {...spikeScenario, startTime:'40s'}, role_auth: {...roleAuthScenario, startTime:'5s'} }, thresholds: {...THRESHOLDS} }`
    - Export `default` function with `SKIP_LOAD_TESTS` guard: `if (__ENV.SKIP_LOAD_TESTS === 'true') return;`
    - Export `handleSummary(data)` returning `{ 'load-tests/reports/report.html': htmlReport(data), stdout: textSummary(data, { indent: ' ', enableColors: true }) }`
    - _Requirements: 1.9, 1.12, 7.4, 8.1, 9.1, 9.2, 9.3, 9.4, 11.1_

- [ ] 7. Final checkpoint — wire everything together and verify
  - Ensure all property tests pass: `npm run test:run -- load-tests/__tests__`
  - Verify `load:seed` script runs successfully and `fixtures.json` is written
  - Verify `load:ci` script can be invoked with `SKIP_LOAD_TESTS=true` and exits 0 without errors
  - Verify `load:test` and `load:report` scripts are syntactically valid in `package.json`
  - Verify `.gitignore` contains `load-tests/reports/`
  - Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 4 and 7) ensure incremental validation before moving to the next phase
- Property tests use `fast-check` via `vitest`; they live in `load-tests/__tests__/` and run with `npm run test:run -- load-tests/__tests__`
- The seed script imports existing Mongoose models from `src/` — locate the correct model paths before implementing task 3.1
- k6 scenario files use ES module syntax (`import`/`export`) as required by k6's runtime; seed.js uses CommonJS (`require`) as it runs in Node.js
- `readCheckFailures` and `authBypassCount` are exported from `group.load.js` and imported by the scenarios that need them — this creates a circular-style dependency that k6 handles correctly at runtime

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2"] },
    { "id": 3, "tasks": ["3.3"] },
    { "id": 4, "tasks": ["3.4", "5.1", "5.2", "5.3", "5.4", "5.6", "5.7"] },
    { "id": 5, "tasks": ["5.5", "6.1"] }
  ]
}
```
