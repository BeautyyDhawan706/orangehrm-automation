import { Page } from '@playwright/test';
import { waitForSpinnerGone } from '@utils/waits';

export abstract class BasePage {
  constructor(protected page: Page) {}

  async waitForReady(): Promise<void> {
    await waitForSpinnerGone(this.page);
  }

  async screenshotOnDemand(name: string): Promise<Buffer> {
    return this.page.screenshot({ path: `test-results/manual/${name}.png`, fullPage: true });
  }
}
