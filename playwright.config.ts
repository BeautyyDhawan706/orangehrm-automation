import { defineConfig, devices } from '@playwright/test';
import { config } from '@config/env';

/**
 * Central Playwright configuration.
 *
 * Design decisions (see README for full rationale):
 * - retries: N          -> automatic retry logic for flaky tests (Part 4)
 * - screenshot: 'only-on-failure' + video 'retain-on-failure' + trace 'on-first-retry'
 *                          -> failure artifacts for debugging (Part 4 / Part 6)
 * - fullyParallel + workers -> parallelization (Part 3)
 * - reporter: html + junit + list -> CI-consumable reports (Part 6)
 * - projects split e2e vs api so each can be run/tagged independently (Part 6 tagging)
 */
export default defineConfig({
  testDir: './tests',
  // Whole-test timeout: generous enough for a multi-step lifecycle test against
  // a live remote instance. DEFAULT_TIMEOUT_MS is a per-action wait budget
  // (see waits.ts), not the right scale for the overall test.
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? config.retries : 1,
  workers: process.env.CI ? 4 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit-results.xml' }],
  ],

  use: {
    baseURL: config.baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 20000,
  },

  projects: [
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testDir: './tests/api',
      use: {},
    },
  ],

  outputDir: 'test-results/artifacts',
});
