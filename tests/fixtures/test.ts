import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { config } from '@config/env';
import { ApiClient } from '@utils/apiClient';
import { logger } from '@utils/logger';
import { buildEmployee } from '@utils/testData';
import type { EmployeeData } from '@utils/testData';

interface ProvisionedEmployee {
  data: EmployeeData;
  empNumber: number;
}

interface EmployeeManager {
  create(overrides?: Partial<EmployeeData>): Promise<ProvisionedEmployee>;
  track(employeeId: string): void;
}

interface TestFixtures {
  adminPage: Page;
  apiClient: ApiClient;
  employeeManager: EmployeeManager;
}

export const test = base.extend<TestFixtures>({
  adminPage: async ({ page }, use) => {
    // Authenticate once through the API and transfer only the session
    // cookie to the browser. UI login behavior remains covered independently,
    // while employee tests avoid repeatedly stressing the shared demo login.
    // This session is intentionally separate from the cleanup API session:
    // the role test logs the browser out, which invalidates its server session.
    const browserSession = await ApiClient.create();
    try {
      await browserSession.login(config.adminUsername, config.adminPassword);
      const storageState = await browserSession.storageState();
      await page.context().addCookies(storageState.cookies);
    } finally {
      await browserSession.dispose();
    }
    await page.goto(`${config.baseUrl}/web/index.php/dashboard/index`);
    await expect(page).toHaveURL(/dashboard/);
    await use(page);
  },

  apiClient: async ({}, use) => {
    const client = await ApiClient.create();
    try {
      await client.login(config.adminUsername, config.adminPassword);
      await use(client);
    } finally {
      await client.dispose();
    }
  },

  employeeManager: async ({ apiClient }, use) => {
    const employeeIds = new Set<string>();
    const manager: EmployeeManager = {
      async create(overrides = {}) {
        const data = buildEmployee(overrides);
        const created = await apiClient.createEmployee(data);
        employeeIds.add(data.employeeId);
        return { data, empNumber: created.empNumber };
      },
      track(employeeId) {
        employeeIds.add(employeeId);
      },
    };

    const cleanupErrors: Error[] = [];
    try {
      await use(manager);
    } finally {
      for (const employeeId of employeeIds) {
        try {
          await apiClient.deleteEmployeeByEmployeeId(employeeId);
        } catch (error) {
          const cleanupError = error instanceof Error ? error : new Error(String(error));
          cleanupErrors.push(cleanupError);
          logger.error('Employee fixture cleanup failed', {
            employeeId,
            error: cleanupError.message,
          });
        }
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, 'One or more employee fixture cleanups failed.');
    }
  },
});

export { expect };
