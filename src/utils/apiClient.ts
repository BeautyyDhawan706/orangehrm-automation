import { APIRequestContext, request } from '@playwright/test';
import { config } from '@config/env';

/**
 * Thin API client used for API-level verification (Part 1) and the
 * standalone API test suite (Part 6 - test data / independent checks).
 *
 * OrangeHRM's SPA calls an internal REST API (web/index.php/api/v2/*) that
 * is session/cookie authenticated rather than token authenticated. We log
 * in through the API context so requests carry the session cookie, which
 * lets us verify records the UI created without going through the UI again.
 */
export class ApiClient {
  private constructor(private ctx: APIRequestContext) {}

  static async create(): Promise<ApiClient> {
    const ctx = await request.newContext({ baseURL: config.baseUrl });
    return new ApiClient(ctx);
  }

  /** Authenticate via the login form endpoint to obtain a session cookie. */
  async login(username: string, password: string): Promise<void> {
    // The CSRF token isn't in a form field in the raw HTML (the login form is
    // client-rendered by Vue) — it's passed in as a prop on the <auth-login>
    // component: :token="&quot;<token>&quot;".
    const loginPage = await this.ctx.get('/web/index.php/auth/login');
    const html = await loginPage.text();
    const csrfMatch = html.match(/:token="&quot;([^&]+)&quot;"/);
    const csrfToken = csrfMatch?.[1] ?? '';

    await this.ctx.post('/web/index.php/auth/validate', {
      form: {
        username,
        password,
        _token: csrfToken,
      },
    });
  }

  async getEmployeeById(employeeId: string) {
    // The API rejects an empty-string nameOrId as an invalid parameter (422)
    // rather than treating it as "no filter" — omit it entirely in that case.
    const params: Record<string, string | number> = { limit: 10, offset: 0 };
    if (employeeId) params.nameOrId = employeeId;

    const res = await this.ctx.get(`${config.apiBaseUrl}/pim/employees`, { params });
    return { status: res.status(), body: res.ok() ? await res.json() : null };
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }
}
