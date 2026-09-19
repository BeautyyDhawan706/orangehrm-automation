import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

const BASE_URL = __ENV.BASE_URL || 'https://opensource-demo.orangehrmlive.com';
const USERNAME = __ENV.ADMIN_USERNAME || 'Admin';
const PASSWORD = __ENV.ADMIN_PASSWORD || 'admin123';

export const options = {
  scenarios: {
    employee_creation_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 5 },
        { duration: '40s', target: 5 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  // Employee creation is a heavier write path than login, so thresholds are more lenient.
  thresholds: {
    http_req_duration: ['p(95)<2500'],
    http_req_failed: ['rate<0.02'],
    checks: ['rate>0.98'],
  },
};

function authenticate() {
  // See login-load-test.js: the CSRF token is a Vue component prop, not a
  // form field, and the form posts to /auth/validate, not /auth/login.
  const loginPageRes = http.get(`${BASE_URL}/web/index.php/auth/login`);
  const tokenMatch = loginPageRes.body.match(/:token="&quot;([^&]+)&quot;"/);
  const csrfToken = tokenMatch ? tokenMatch[1] : '';

  http.post(`${BASE_URL}/web/index.php/auth/validate`, {
    username: USERNAME,
    password: PASSWORD,
    _token: csrfToken,
  });
}

export default function () {
  authenticate();

  const uniqueSuffix = `${Date.now()}${__VU}${__ITER}`;
  const payload = JSON.stringify({
    firstName: 'LoadTest',
    lastName: `Employee${uniqueSuffix}`,
    middleName: 'K6',
    employeeId: uniqueSuffix.slice(-6),
  });

  const res = http.post(`${BASE_URL}/web/index.php/api/v2/pim/employees`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'employee creation responded 2xx/success shape': (r) =>
      r.status === 200 || r.status === 201,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'k6-reports/employee-creation-load-report.html': htmlReport(data),
    'k6-reports/employee-creation-load-summary.json': JSON.stringify(data, null, 2),
    stdout: '',
  };
}
