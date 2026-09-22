import { request } from '@playwright/test';
import { test, expect } from '@fixtures/test';
import { config } from '@config/env';

/**
 * Independent API-layer suite (Part 6 — coverage beyond the UI flow).
 * Runs faster than the E2E suite and is useful as a CI smoke check even
 * when the UI pipeline is skipped.
 */
test.describe('Employee API', { tag: ['@api', '@regression'] }, () => {
  test('Rejects an unauthenticated request', { tag: ['@smoke'] }, async () => {
    const ctx = await request.newContext({ baseURL: config.baseUrl });
    const res = await ctx.get(`${config.apiBaseUrl}/pim/employees`);
    expect([401, 403]).toContain(res.status());
    await ctx.dispose();
  });

  test(
    'Authenticated search returns a well-formed payload',
    { tag: ['@smoke'] },
    async ({ apiClient }) => {
      const { status, body } = await apiClient.getEmployeeById('');
      expect(status).toBe(200);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
    }
  );
});
