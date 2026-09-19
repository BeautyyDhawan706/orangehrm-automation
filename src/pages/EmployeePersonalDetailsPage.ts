import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { pollUntil, waitForToast } from '@utils/waits';

export class EmployeePersonalDetailsPage extends BasePage {
  readonly firstNameInput: Locator;
  readonly middleNameInput: Locator;
  readonly saveButton: Locator;
  readonly employeeIdBadge: Locator;

  constructor(page: Page) {
    super(page);
    this.firstNameInput = page.locator('input[name="firstName"]');
    this.middleNameInput = page.locator('input[name="middleName"]');
    this.saveButton = page.locator('.orangehrm-edit-employee-content button[type="submit"]').first();
    this.employeeIdBadge = page.locator('.employee-name-title, .oxd-topbar-header-breadcrumb');
  }

  async updateMiddleName(newValue: string): Promise<string> {
    // The page navigates to this record then fetches its data asynchronously;
    // editing before that fetch resolves means the arriving response
    // silently overwrites our edit with the pre-edit server value. First
    // Name is always non-empty once the fetch has populated the form.
    await this.firstNameInput.waitFor({ state: 'visible' });
    await pollUntil(async () => (await this.firstNameInput.inputValue()) !== '', { timeout: 10000 });

    await this.middleNameInput.fill('');
    await this.middleNameInput.fill(newValue);
    await this.saveButton.click();
    const toastText = await waitForToast(this.page);
    await this.waitForReady();
    return toastText;
  }

  async getCurrentMiddleName(): Promise<string> {
    return this.middleNameInput.inputValue();
  }
}
