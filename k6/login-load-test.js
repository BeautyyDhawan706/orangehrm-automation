import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { authenticate, requiredEnvironmentVariable } from './utils/auth.js';

const BASE_URL = __ENV.BASE_URL || 'https://opensource-demo.orangehrmlive.com';
const USERNAME = requiredEnvironmentVariable('ADMIN_USERNAME');
const PASSWORD = requiredEnvironmentVariable('ADMIN_PASSWORD');

export const options = {
  scenarios: {
    login_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 }, // ramp up
        { duration: '1m', target: 10 }, // sustain
        { duration: '20s', target: 0 }, // ramp down
      ],
    },
  },
  // Threshold definitions (Part 5 requirement) — the run fails CI if these are breached.
  thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const { loginPageResponse, loginResponse } = authenticate(BASE_URL, USERNAME, PASSWORD);
  check(loginPageResponse, { 'login page loaded': (response) => response.status === 200 });

  check(loginResponse, {
    'login responded': (response) => response.status === 200 || response.status === 302,
  });

  sleep(1);
}

// Performance reporting (Part 5 requirement) — writes an HTML + JSON summary.
export function handleSummary(data) {
  return {
    'k6-reports/login-load-report.html': htmlReport(data),
    'k6-reports/login-load-summary.json': JSON.stringify(data, null, 2),
    stdout: '',
  };
}
