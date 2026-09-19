import { test, expect } from '@playwright/test';
import { ApiClient } from '@utils/apiClient';
import { config } from '@config/env';

/**
 * Independent API-layer suite (Part 6 — coverage beyond the UI flow).
 * Runs faster than the E2E suite and is useful as a CI smoke check even
 * when the UI pipeline is skipped.
 */
test.describe('Employee API @api @regression', () => {
  test('Rejects an unauthenticated request @smoke', async () => {
    const { request } = await import('@playwright/test');
    const ctx = await request.newContext({ baseURL: config.baseUrl });
    const res = await ctx.get(`${config.apiBaseUrl}/pim/employees`);
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });

  test('Authenticated search returns a well-formed payload @smoke', async () => {
    const api = await ApiClient.create();
    await api.login(config.adminUsername, config.adminPassword);
    const { status, body } = await api.getEmployeeById('');
    expect(status).toBe(200);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    await api.dispose();
  });
});
