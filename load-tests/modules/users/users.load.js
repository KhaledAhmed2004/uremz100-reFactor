/**
 * users.load.js — Module entry point for Users API load testing
 *
 * Usage:
 *   npm run load:users           → k6 run --out web-dashboard (live dashboard at localhost:5665)
 *   npm run load:users:baseline  → baseline scenario only
 *   npm run load:users:stress    → stress scenario only
 *   npm run load:users:soak      → soak scenario only
 *
 * Prerequisites:
 *   1. npm run load:seed:groups  (creates base fixtures)
 *   2. npm run load:seed:users   (creates user-specific fixtures)
 *   3. npm run dev               (starts the Express server)
 */

import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

import { THRESHOLDS } from '../../shared/config/thresholds.js';

// Import exec functions from scenarios
import { runBaseline } from './scenarios/baseline.js';
import { runStress } from './scenarios/stress.js';
import { runSoak } from './scenarios/soak.js';
import { runReadLoad } from './scenarios/read-load.js';
import { runWriteLoad } from './scenarios/write-load.js';
import { runUserJourney } from './scenarios/user-journey.js';
import { runRoleAuth } from './scenarios/role-auth.js';

// Re-export exec functions so k6 can find them by name
export { runBaseline, runStress, runSoak, runReadLoad, runWriteLoad, runUserJourney, runRoleAuth };

// ── k6 options ────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    baseline: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      exec: 'runBaseline',
      startTime: '0s',
    },
    read_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      exec: 'runReadLoad',
      startTime: '5s',
    },
    write_load: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'runWriteLoad',
      startTime: '5s',
    },
    user_journey: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'runUserJourney',
      startTime: '5s',
    },
    role_auth: {
      executor: 'constant-vus',
      vus: 5,
      duration: '10s',
      exec: 'runRoleAuth',
      startTime: '5s',
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5 },
        { duration: '20s', target: 20 },
        { duration: '10s', target: 5 },
      ],
      exec: 'runStress',
      startTime: '40s',
    },
    soak: {
      executor: 'constant-vus',
      vus: 3,
      duration: '60s',
      exec: 'runSoak',
      startTime: '80s',
    },
  },
  thresholds: { ...THRESHOLDS },
};

// ── Default function ──────────────────────────────────────────────────────────
export default function () {
  if (__ENV.SKIP_LOAD_TESTS === 'true') {
    return;
  }
}

// ── Module-specific report generation ─────────────────────────────────────────
export function handleSummary(data) {
  return {
    'load-tests/reports/users/report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
