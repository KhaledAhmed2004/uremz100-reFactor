/**
 * auth.load.js — Module entry point for Auth API load testing
 *
 * Usage:
 *   npm run load:auth          → k6 run --out web-dashboard (live dashboard at localhost:5665)
 *   npm run load:auth:stress   → stress scenario only
 *   npm run load:auth:soak     → soak scenario only
 *   npm run load:auth:baseline → baseline scenario only
 *
 * Prerequisites:
 *   1. npm run load:seed:groups  (creates base fixtures)
 *   2. npm run load:seed:auth    (creates auth-specific fixtures)
 *   3. npm run dev               (starts the Express server)
 */

import { THRESHOLDS } from '../../shared/config/thresholds.js';
import { createHandleSummary } from '../../shared/helpers/report.js';

// Import exec functions from scenarios
import { runBaseline } from './scenarios/baseline.js';
import { runStress } from './scenarios/stress.js';
import { runSoak } from './scenarios/soak.js';
import { runSpike } from './scenarios/spike.js';
import { runUserJourney } from './scenarios/user-journey.js';
import { runRateLimit } from './scenarios/rate-limit.js';

// Re-export exec functions so k6 can find them by name
export { runBaseline, runStress, runSoak, runSpike, runUserJourney, runRateLimit };

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
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '2m', target: 10 },
        { duration: '1m', target: 25 },
        { duration: '2m', target: 25 },
        { duration: '1m', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      exec: 'runStress',
      startTime: '5s',
    },
    soak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '30m', target: 20 },
        { duration: '2m', target: 0 },
      ],
      exec: 'runSoak',
      startTime: '10s',
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 3 },
        { duration: '10s', target: 30 },
        { duration: '5s', target: 3 },
      ],
      exec: 'runSpike',
      startTime: '15s',
    },
    user_journey: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'runUserJourney',
      startTime: '5s',
    },
    rate_limit: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 15,
      exec: 'runRateLimit',
      startTime: '0s',
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
export const handleSummary = createHandleSummary('auth');
