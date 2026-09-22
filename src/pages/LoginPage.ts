import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { config } from '@config/env';

export class LoginPage extends BasePage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.loginButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.oxd-alert-content-text');
  }

  async goto(): Promise<void> {
    await this.page.goto(`${config.baseUrl}/web/index.php/auth/login`);
    await this.waitForReady();
  }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);

    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'POST' && candidate.url().includes('/auth/validate'),
        { timeout: config.defaultTimeoutMs }
      ),
      this.loginButton.click({ noWaitAfter: true }),
    ]);

    const redirectLocation = response.headers().location ?? '';
    if (redirectLocation.includes('/auth/login')) {
      await this.errorMessage.waitFor({ state: 'visible', timeout: config.defaultTimeoutMs });
    } else {
      await this.page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
        timeout: config.defaultTimeoutMs,
      });
    }
    await this.waitForReady();
  }

  async loginAsAdmin(): Promise<void> {
    await this.login(config.adminUsername, config.adminPassword);
  }

  async logout(): Promise<void> {
    // A direct page.goto('/auth/logout') gets aborted: the SPA's router
    // intercepts the navigation client-side, which Playwright sees as the
    // original request being cancelled. Going through the actual UI avoids
    // that entirely.
    await this.page.locator('.oxd-userdropdown-tab').click();
    await this.page.getByRole('menuitem', { name: 'Logout' }).click();
    await this.page.waitForURL(/auth\/login/);
    await this.waitForReady();
  }
}
