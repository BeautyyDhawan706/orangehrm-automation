import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  readonly mainMenuItems: Locator;

  constructor(page: Page) {
    super(page);
    this.mainMenuItems = page.locator('.oxd-main-menu-item');
  }

  /** Labels of the top-level nav items the logged-in role can actually see. */
  async getVisibleMenuLabels(): Promise<string[]> {
    return this.mainMenuItems.allTextContents();
  }
}
