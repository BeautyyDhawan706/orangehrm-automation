import { request } from '@playwright/test';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { config } from '@config/env';
import { extractCsrfToken } from '@utils/csrf';
import { logger } from '@utils/logger';
import type { EmployeeData } from '@utils/testData';

export interface EmployeeApiRecord {
  empNumber: number;
  employeeId: string;
  firstName: string;
  middleName: string;
  lastName: string;
}

interface EmployeeListResponse {
  data: EmployeeApiRecord[];
  meta: Record<string, unknown>;
}

interface EmployeeCreateResponse {
  data: EmployeeApiRecord;
}

export class ApiRequestError extends Error {
  constructor(method: string, response: APIResponse, responseBody: string) {
    super(
      `${method} ${response.url()} failed with ${response.status()} ${response.statusText()}: ${responseBody.slice(0, 500)}`
    );
    this.name = 'ApiRequestError';
  }
}

/** Session-authenticated client for OrangeHRM's internal employee API. */
export class ApiClient {
  private credentials?: Readonly<{ username: string; password: string }>;

  private constructor(private readonly ctx: APIRequestContext) {}

  static async create(): Promise<ApiClient> {
    const ctx = await request.newContext({
      baseURL: config.baseUrl,
      timeout: config.defaultTimeoutMs,
    });
    return new ApiClient(ctx);
  }

  async login(username: string, password: string): Promise<void> {
    const loginPage = await this.ctx.get('/web/index.php/auth/login');
    await this.ensureOk('GET', loginPage);
    const csrfToken = extractCsrfToken(await loginPage.text());

    const response = await this.ctx.post('/web/index.php/auth/validate', {
      form: { username, password, _token: csrfToken },
      timeout: Math.max(config.defaultTimeoutMs, 30000),
    });
    await this.ensureOk('POST', response);

    if (!response.url().includes('/dashboard/')) {
      throw new Error(
        `OrangeHRM API login did not reach the dashboard; final URL: ${response.url()}`
      );
    }
    this.credentials = { username, password };
    logger.info('Authenticated API session established');
  }

  async getEmployeeById(
    employeeId: string
  ): Promise<{ status: number; body: EmployeeListResponse }> {
    const params: Record<string, string | number> = { limit: 10, offset: 0 };
    if (employeeId) params.nameOrId = employeeId;

    const response = await this.sendWithRetry('GET', () =>
      this.ctx.get(`${config.apiBaseUrl}/pim/employees`, { params })
    );
    const body = await this.jsonOrThrow<EmployeeListResponse>('GET', response);
    return { status: response.status(), body };
  }

  async createEmployee(data: EmployeeData): Promise<EmployeeApiRecord> {
    const response = await this.sendWithRetry('POST', () =>
      this.ctx.post(`${config.apiBaseUrl}/pim/employees`, {
        data: {
          firstName: data.firstName,
          middleName: data.middleName ?? '',
          lastName: data.lastName,
          employeeId: data.employeeId,
        },
      })
    );
    const body = await this.jsonOrThrow<EmployeeCreateResponse>('POST', response);
    logger.info('Created employee through API fixture', { employeeId: data.employeeId });
    return body.data;
  }

  async deleteEmployee(empNumber: number): Promise<void> {
    const response = await this.sendWithRetry('DELETE', () =>
      this.ctx.delete(`${config.apiBaseUrl}/pim/employees`, {
        data: { ids: [empNumber] },
      })
    );
    await this.ensureOk('DELETE', response);
    logger.info('Deleted employee during fixture cleanup', { empNumber });
  }

  async deleteEmployeeByEmployeeId(employeeId: string): Promise<void> {
    const { body } = await this.getEmployeeById(employeeId);
    const matches = body.data.filter((employee) => employee.employeeId === employeeId);
    for (const employee of matches) {
      await this.deleteEmployee(employee.empNumber);
    }
    if (matches.length === 0) {
      logger.info('Fixture cleanup found no employee to delete', { employeeId });
    }
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }

  async storageState(): Promise<Awaited<ReturnType<APIRequestContext['storageState']>>> {
    return this.ctx.storageState();
  }

  private async sendWithRetry(
    method: string,
    operation: () => Promise<APIResponse>
  ): Promise<APIResponse> {
    const maxAttempts = 3;
    let reauthenticated = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await operation();
      const status = response.status();
      const sessionExpired = status === 401 && this.credentials && !reauthenticated;
      const transientFailure = status === 429 || status >= 500;

      if (attempt === maxAttempts || (!sessionExpired && !transientFailure)) {
        return response;
      }

      logger.warn('Retrying OrangeHRM API request', { attempt, method, status });
      if (sessionExpired && this.credentials) {
        reauthenticated = true;
        await this.login(this.credentials.username, this.credentials.password);
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
      }
    }

    throw new Error('Unreachable API retry state.');
  }

  private async jsonOrThrow<T>(method: string, response: APIResponse): Promise<T> {
    await this.ensureOk(method, response);
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new Error(
        `${method} ${response.url()} returned a non-JSON success response: ${String(error)}`,
        { cause: error }
      );
    }
  }

  private async ensureOk(method: string, response: APIResponse): Promise<void> {
    if (response.ok()) return;

    const responseBody = await response.text().catch(() => '<response body unavailable>');
    logger.error('OrangeHRM API request failed', {
      method,
      status: response.status(),
      url: response.url(),
    });
    throw new ApiRequestError(method, response, responseBody);
  }
}
