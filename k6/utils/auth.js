import http from 'k6/http';
import { ORANGE_HRM_CSRF_PATTERN } from '../../shared/csrf.js';

export function requiredEnvironmentVariable(name) {
  const value = __ENV[name];
  if (!value) {
    throw new Error(
      `${name} is required. Pass it with -e ${name}=... or through the CI environment.`
    );
  }
  return value;
}

export function authenticate(baseUrl, username, password) {
  const loginPageResponse = http.get(`${baseUrl}/web/index.php/auth/login`);
  const csrfToken = loginPageResponse.body.match(ORANGE_HRM_CSRF_PATTERN)?.[1];
  if (!csrfToken) {
    throw new Error('OrangeHRM login response did not contain a CSRF token.');
  }

  const loginResponse = http.post(`${baseUrl}/web/index.php/auth/validate`, {
    username,
    password,
    _token: csrfToken,
  });
  return { loginPageResponse, loginResponse };
}
