import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { EmployeeData } from '@utils/testData';
import { waitForToast } from '@utils/waits';

export class AddEmployeePage extends BasePage {
  readonly firstNameInput: Locator;
  readonly middleNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly employeeIdInput: Locator;
  readonly createLoginToggle: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly saveButton: Locator;
  readonly fieldErrors: Locator;

  constructor(page: Page) {
    super(page);
    this.firstNameInput = page.locator('input[name="firstName"]');
    this.middleNameInput = page.locator('input[name="middleName"]');
    this.lastNameInput = page.locator('input[name="lastName"]');
    this.employeeIdInput = page.locator('.oxd-grid-item:has(label:text("Employee Id")) input');
    this.createLoginToggle = page.locator('.oxd-switch-input');
    this.usernameInput = page.locator('input[autocomplete="off"]').first();
    this.passwordInput = page.locator('input[type="password"]').first();
    this.confirmPasswordInput = page.locator('input[type="password"]').last();
    this.saveButton = page.getByRole('button', { name: /save/i });
    this.fieldErrors = page.locator('.oxd-input-field-error-message');
  }

  async fillPersonalDetails(data: EmployeeData): Promise<void> {
    await this.firstNameInput.fill(data.firstName);
    if (data.middleName) await this.middleNameInput.fill(data.middleName);
    await this.lastNameInput.fill(data.lastName);
    // Employee ID field is pre-populated by the app; clear it before typing ours.
    await this.employeeIdInput.fill('');
    await this.employeeIdInput.fill(data.employeeId);
  }

  /** Enables login credential creation and fills them in — exercises role/account provisioning. */
  async enableLoginDetails(data: EmployeeData): Promise<void> {
    await this.createLoginToggle.click();
    await this.usernameInput.fill(data.loginUsername);
    await this.passwordInput.fill(data.loginPassword);
    await this.confirmPasswordInput.fill(data.loginPassword);
  }

  async save(): Promise<string> {
    await this.saveButton.click();
    const toastText = await waitForToast(this.page);
    await this.waitForReady();
    return toastText;
  }

  /** Attempts to save with missing required fields, to exercise role-based/required-field validation. */
  async submitEmpty(): Promise<void> {
    // Guard against the SPA still hydrating the form right after navigation,
    // which can otherwise swallow a click before the submit handler is wired up.
    await this.firstNameInput.waitFor({ state: 'visible' });
    await this.saveButton.click();
    await this.fieldErrors.first().waitFor({ state: 'visible' });
  }

  async getValidationErrors(): Promise<string[]> {
    return this.fieldErrors.allTextContents();
  }
}
