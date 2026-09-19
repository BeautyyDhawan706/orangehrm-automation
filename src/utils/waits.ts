import { Page, Locator, expect } from '@playwright/test';

/**
 * Smart waiting helpers.
 * Playwright auto-waits for actionability on most actions, but OrangeHRM's
 * SPA has a loading spinner overlay and toast notifications that need
 * explicit, condition-based waits rather than fixed sleeps.
 */

/** Wait for the app's loading spinner to fully disappear before interacting. */
export async function waitForSpinnerGone(page: Page): Promise<void> {
  const spinner = page.locator('.oxd-loading-spinner, .oxd-form-loader');
  const count = await spinner.count();
  if (count > 0) {
    await spinner.first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {
      // Some spinners are removed from DOM immediately; ignore if already gone.
    });
  }
}

/** Wait for a toast/success message and return its text. */
export async function waitForToast(page: Page, timeout = 10000): Promise<string> {
  const toast = page.locator('.oxd-toast-content, .oxd-toast');
  await toast.first().waitFor({ state: 'visible', timeout });
  return (await toast.first().textContent())?.trim() ?? '';
}

/** Poll a condition until it becomes true or the timeout elapses (for values not backed by a Locator). */
export async function pollUntil(
  conditionFn: () => Promise<boolean>,
  { timeout = 10000, interval = 250 }: { timeout?: number; interval?: number } = {}
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
  await expect(locator, message).toBeVisible({ timeout: 15000 });
}
