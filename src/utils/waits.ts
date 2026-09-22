import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { config } from '@config/env';

/**
 * Smart waiting helpers.
 * Playwright auto-waits for actionability on most actions, but OrangeHRM's
 * SPA has a loading spinner overlay and toast notifications that need
 * explicit, condition-based waits rather than fixed sleeps.
 */

/** Wait for the app's loading spinner to fully disappear before interacting. */
export async function waitForSpinnerGone(page: Page): Promise<void> {
  const spinner = page.locator('.oxd-loading-spinner, .oxd-form-loader');
  await spinner.first().waitFor({ state: 'hidden', timeout: config.defaultTimeoutMs });
}

/** Wait for a toast/success message and return its text. */
export async function waitForToast(page: Page, timeout = config.defaultTimeoutMs): Promise<string> {
  const toast = page.locator('.oxd-toast-content, .oxd-toast');
  await toast.first().waitFor({ state: 'visible', timeout });
  return (await toast.first().textContent())?.trim() ?? '';
}

/** Poll a condition until it becomes true or the timeout elapses (for values not backed by a Locator). */
export async function pollUntil(
  conditionFn: () => Promise<boolean>,
  {
    timeout = config.defaultTimeoutMs,
    interval = 250,
  }: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await conditionFn()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`pollUntil: condition not met within ${timeout}ms`);
}

/** Assert an element is visible with a descriptive failure message, retried by Playwright's expect. */
export async function expectVisible(locator: Locator, message: string): Promise<void> {
  await expect(locator, message).toBeVisible({ timeout: config.defaultTimeoutMs });
}
