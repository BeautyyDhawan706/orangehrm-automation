import { ORANGE_HRM_CSRF_PATTERN } from '../../shared/csrf.js';

/** Extract OrangeHRM's CSRF token from the server-rendered Vue component prop. */
export function extractCsrfToken(html: string): string {
  const token = html.match(ORANGE_HRM_CSRF_PATTERN)?.[1];
  if (!token) {
    throw new Error('OrangeHRM login response did not contain a CSRF token.');
  }
  return token;
}
