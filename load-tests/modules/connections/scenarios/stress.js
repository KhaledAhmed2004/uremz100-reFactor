/**
 * stress.js — Stress test scenario for Connections API
 *
 * Executor: ramping-vus, progressive VU increase to find throughput limits.
 * Ramps VUs performing mixed connection operations (send, accept, reject,
 * cancel, remove) to identify the point where response times degrade
 * and error rates increase.
 * Uses pre-seeded fixture data for pending requests and existing connections.
 *
 * Run: k6 run --out web-dashboard load-tests/modules/connections/scenarios/stress.js
 * Production profile: STRESS_PROFILE=production k6 run load-tests/modules/connections/scenarios/stress.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { getAuthHeaders } from '../../../shared/helpers/auth.js';
import { getStressStages, resolveBaseUrl } from '../../../shared/helpers/scenario-utils.js';

const baseFixtures = new SharedArray('base-fixtures', function () {
  return [JSON.parse(open('../../../shared/fixtures/base-fixtures.json'))];
})[0];

const moduleFixtures = new SharedArray('connections-fixtures', function () {
  return [JSON.parse(open('../fixtures/connections-fixtures.json'))];
})[0];

const fixtures = { ...baseFixtures, ...moduleFixtures };

const BASE_URL = resolveBaseUrl(__ENV.BASE_URL);

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: getStressStages(__ENV.STRESS_PROFILE),
      exec: 'runStress',
    },
  },
  thresholds: {
    http_req_duration: [
      { threshold: 'p(50)<1000', abortOnFail: false },
      { threshold: 'p(95)<2000', abortOnFail: false },
      { threshold: 'p(99)<5000', abortOnFail: false },
    ],
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
  },
};

export const stressScenario = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: getStressStages(__ENV.STRESS_PROFILE),
  exec: 'runStress',
};

export function runStress() {
  const vuIndex = __VU - 1;
  const headers = {
    ...getAuthHeaders(fixtures, 'brother', vuIndex),
    'Content-Type': 'application/json',
  };

  // Distribute across available users and fixture data to avoid hotspotting
  const targetUser = fixtures.brotherUsers[(vuIndex + 1) % fixtures.brotherUsers.length];
  const pendingRequest = fixtures.pendingRequests[vuIndex % fixtures.pendingRequests.length];
  const existingConnection = fixtures.existingConnections[vuIndex % fixtures.existingConnections.length];

  // ── Operation 1: Send a connection request ──────────────────────────────────
  const sendRes = http.post(
    `${BASE_URL}/api/v1/connections`,
    JSON.stringify({ receiverId: targetUser.id }),
    { headers, tags: { name: 'POST /connections (send)' } },
  );
  check(sendRes, {
    'POST /connections (send) 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  // Extract connection ID for subsequent operations
  let connectionId;
  try {
    const body = sendRes.json();
    connectionId = body.data && (body.data._id || body.data.id || body.data.connectionId);
  } catch (e) {
    // Use a pending request ID as fallback
    connectionId = pendingRequest.requestId;
  }

  // ── Operation 2: Accept a connection request ────────────────────────────────
  const acceptRes = http.post(
    `${BASE_URL}/api/v1/connections/${pendingRequest.requestId}/accept`,
    null,
    { headers, tags: { name: 'POST /connections/:id/accept' } },
  );
  check(acceptRes, {
    'POST /connections/:id/accept 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  // ── Operation 3: Reject a connection request ────────────────────────────────
  // Use a different pending request to simulate reject
  const rejectIndex = (vuIndex + 1) % fixtures.pendingRequests.length;
  const rejectRequest = fixtures.pendingRequests[rejectIndex];

  const rejectRes = http.post(
    `${BASE_URL}/api/v1/connections/${rejectRequest.requestId}/reject`,
    null,
    { headers, tags: { name: 'POST /connections/:id/reject' } },
  );
  check(rejectRes, {
    'POST /connections/:id/reject 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  // ── Operation 4: Cancel a sent connection request ───────────────────────────
  if (connectionId) {
    const cancelRes = http.post(
      `${BASE_URL}/api/v1/connections/${connectionId}/cancel`,
      null,
      { headers, tags: { name: 'POST /connections/:id/cancel' } },
    );
    check(cancelRes, {
      'POST /connections/:id/cancel 2xx': (r) => r.status >= 200 && r.status < 300,
    });
  }

  // ── Operation 5: Remove an existing connection ──────────────────────────────
  const removeUserId = existingConnection.userId2;
  const removeRes = http.del(
    `${BASE_URL}/api/v1/connections/${removeUserId}`,
    null,
    { headers, tags: { name: 'DELETE /connections/:userId (remove)' } },
  );
  check(removeRes, {
    'DELETE /connections/:userId (remove) 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(1);
}

export default runStress;

export function handleSummary(data) {
  return {
    'load-tests/reports/report.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
