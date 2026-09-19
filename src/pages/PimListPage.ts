import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { config } from '@config/env';
import { waitForToast } from '@utils/waits';

export class PimListPage extends BasePage {
  readonly addButton: Locator;
  readonly employeeNameSearch: Locator;
  readonly employeeIdSearch: Locator;
  readonly searchButton: Locator;
  readonly resultRows: Locator;
  readonly recordsFoundText: Locator;

  constructor(page: Page) {
    super(page);
    this.addButton = page.getByRole('button', { name: /add/i });
    this.employeeNameSearch = page.locator('.oxd-autocomplete-wrapper input').first();
    this.employeeIdSearch = page.locator('.oxd-grid-item:has(label:text("Employee Id")) input');
    this.searchButton = page.getByRole('button', { name: /search/i });
    this.resultRows = page.locator('.oxd-table-card');
    this.recordsFoundText = page.locator('.orangehrm-horizontal-padding span').first();
  }

  async goto(): Promise<void> {
    await this.page.goto(`${config.baseUrl}/web/index.php/pim/viewEmployeeList`);
    await this.waitForReady();
  }

  async openAddEmployee(): Promise<void> {
    await this.addButton.click();
    await this.waitForReady();
  }

  /**
   * Waits for the specific filtered search API call triggered by clicking
   * Search, rather than just the spinner or "any employees response". The
   * list page fires an unfiltered request on load that can still be
   * in-flight when Search is clicked; matching on the endpoint alone risks
   * resolving on that stale request and reading the page before the actual
   * filtered response has rendered. Must be called before the triggering click.
   */
  private waitForEmployeesResponse(queryFragment: string) {
    return this.page.waitForResponse(
      (res) => res.url().includes('/api/v2/pim/employees') && res.url().includes(queryFragment)
    );
  }

  async searchByName(name: string): Promise<void> {
    await this.employeeNameSearch.fill(name);
    // The name field only actually filters once a suggestion is selected —
    // typed free text without a selection is silently ignored by the search,
    // so require the suggestion rather than falling through to an unfiltered list.
    const option = this.page.getByRole('option').first();
    await option.waitFor({ state: 'visible' });
    await option.click();
    const response = this.waitForEmployeesResponse('nameOrId=');
    await this.searchButton.click();
    await response;
    await this.waitForReady();
  }

  /**
   * Filters by the plain Employee Id text field rather than the Employee
   * Name autocomplete — unlike the name field, this reliably supports
   * asserting zero results (e.g. confirming a deleted employee is gone),
   * since it doesn't require selecting a matching suggestion first.
   */
  async searchByEmployeeId(employeeId: string): Promise<void> {
    await this.employeeIdSearch.fill(employeeId);
    const response = this.waitForEmployeesResponse(`employeeId=${employeeId}`);
    await this.searchButton.click();
    await response;
    await this.waitForReady();
  }

  async rowCount(): Promise<number> {
    return this.resultRows.count();
  }

  async openFirstResult(): Promise<void> {
    await this.resultRows.first().click();
    await this.waitForReady();
  }

  async deleteFirstResult(): Promise<string> {
    await this.resultRows.first().locator('button:has(i.bi-trash), .oxd-icon-button').last().click();
    // Confirm deletion in the modal dialog.
    await this.page.getByRole('button', { name: /yes, delete/i }).click();
    return waitForToast(this.page);
  }
}
