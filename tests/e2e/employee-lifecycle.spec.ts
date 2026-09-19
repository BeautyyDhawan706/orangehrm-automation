import { test, expect } from '@playwright/test';
import { LoginPage } from '@pages/LoginPage';
import { PimListPage } from '@pages/PimListPage';
import { AddEmployeePage } from '@pages/AddEmployeePage';
import { EmployeePersonalDetailsPage } from '@pages/EmployeePersonalDetailsPage';
import { buildEmployee, updatedFields } from '@utils/testData';
import { ApiClient } from '@utils/apiClient';
import { config } from '@config/env';

/**
 * Employee lifecycle suite (Part 1).
 * Tags in the title (@smoke / @regression) support the tagging strategy
 * (Part 6) — run a subset with: npx playwright test --grep @smoke
 */
test.describe('Employee lifecycle @regression', () => {
  test('Admin can create, validate, update, verify via API, and delete an employee @smoke', async ({ page }) => {
    const employee = buildEmployee();

    // 1. Authentication
    await test.step('Log in as Admin', async () => {
      const login = new LoginPage(page);
      await login.goto();
      await login.loginAsAdmin();
      await expect(page).toHaveURL(/dashboard/);
    });

    // 2. Employee creation
    await test.step('Create a new employee', async () => {
      const pimList = new PimListPage(page);
      await pimList.goto();
      await pimList.openAddEmployee();

      const addEmployee = new AddEmployeePage(page);
      await addEmployee.fillPersonalDetails(employee);
      await addEmployee.enableLoginDetails(employee);
      const toast = await addEmployee.save();
      expect(toast.toLowerCase()).toContain('success');
    });

    // 3. Role-based / required-field validation, on a second record
    await test.step('Required-field validation is enforced', async () => {
      const pimList = new PimListPage(page);
      await pimList.goto();
      await pimList.openAddEmployee();

      const addEmployee = new AddEmployeePage(page);
      await addEmployee.submitEmpty();
      const errors = await addEmployee.getValidationErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ').toLowerCase()).toContain('required');

      // Navigate away from the half-filled form rather than saving it.
      await pimList.goto();
    });

    // 4. Employee update
    await test.step('Update the created employee', async () => {
      const pimList = new PimListPage(page);
      await pimList.goto();
      await pimList.searchByName(`${employee.firstName} ${employee.lastName}`);
      await pimList.openFirstResult();

      const details = new EmployeePersonalDetailsPage(page);
      const { middleName } = updatedFields();
      const toast = await details.updateMiddleName(middleName);
      expect(toast.toLowerCase()).toContain('success');
      // Poll rather than a one-shot read: the form briefly re-renders with the
      // pre-save value while the page refetches the record after the PUT.
      await expect(details.middleNameInput).toHaveValue(middleName);
    });

    // 5. API-level verification — confirm the UI-created record exists via the underlying API
    await test.step('Verify the employee exists via API', async () => {
      const api = await ApiClient.create();
      await api.login(config.adminUsername, config.adminPassword);
      const { status, body } = await api.getEmployeeById(employee.employeeId);
      expect(status).toBe(200);
      expect(body?.data?.length ?? 0).toBeGreaterThan(0);
      await api.dispose();
    });

    // 6. Employee deletion
    await test.step('Delete the employee', async () => {
      const pimList = new PimListPage(page);
      await pimList.goto();
      await pimList.searchByName(`${employee.firstName} ${employee.lastName}`);
      const toast = await pimList.deleteFirstResult();
      expect(toast.toLowerCase()).toContain('success');

      // Confirm it's gone. Search by Id, not name — the name field is an
      // autocomplete that requires selecting a matching suggestion, which by
      // definition can't happen once the record no longer exists.
      await pimList.goto();
      await pimList.searchByEmployeeId(employee.employeeId);
      expect(await pimList.rowCount()).toBe(0);
    });
  });
});
