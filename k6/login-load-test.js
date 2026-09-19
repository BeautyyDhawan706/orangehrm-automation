import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

const BASE_URL = __ENV.BASE_URL || 'https://opensource-demo.orangehrmlive.com';
const USERNAME = __ENV.ADMIN_USERNAME || 'Admin';
const PASSWORD = __ENV.ADMIN_PASSWORD || 'admin123';

export const options = {
  scenarios: {
    login_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 }, // ramp up
        { duration: '1m', target: 10 },  // sustain
        { duration: '20s', target: 0 },  // ramp down
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
  // 1. Load the login page to obtain the CSRF token. The login form is
  // client-rendered by Vue, so the token isn't in a form field in the raw
  // HTML — it's passed as a prop on the <auth-login> component:
  // :token="&quot;<token>&quot;".
  const loginPageRes = http.get(`${BASE_URL}/web/index.php/auth/login`);
  check(loginPageRes, { 'login page loaded': (r) => r.status === 200 });

  const tokenMatch = loginPageRes.body.match(/:token="&quot;([^&]+)&quot;"/);
  const csrfToken = tokenMatch ? tokenMatch[1] : '';

  // 2. Submit credentials to the form's actual action endpoint.
  const loginRes = http.post(`${BASE_URL}/web/index.php/auth/validate`, {
    username: USERNAME,
    password: PASSWORD,
    _token: csrfToken,
  });

  check(loginRes, {
    'login responded': (r) => r.status === 200 || r.status === 302,
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
