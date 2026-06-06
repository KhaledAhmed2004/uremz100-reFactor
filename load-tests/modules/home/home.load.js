import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 users
    { duration: '1m', target: 200 }, // Ramp up to 200 users to test Redis caching
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    // 95% of requests must complete below 100ms
    http_req_duration: ['p(95)<100'], 
    // Error rate should be less than 1%
    http_req_failed: ['rate<0.01'], 
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5000/api/v1';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      // Simulating a guest user hit to bypass auth but test the guest extraction logic
      'x-guest-id': `perf-guest-${__VU}-${__ITER}`,
    },
  };

  const res = http.get(`${BASE_URL}/home`, params);

  check(res, {
    'is status 200': (r) => r.status === 200,
    'has sections array': (r) => {
      try {
        const body = r.json();
        return body.success === true && Array.isArray(body.data.sections);
      } catch (e) {
        return false;
      }
    },
  });

  // Short sleep to simulate real user wait time before refreshing/navigating
  sleep(1);
}
