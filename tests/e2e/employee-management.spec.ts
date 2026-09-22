import { test, expect } from '@fixtures/test';
import { AddEmployeePage } from '@pages/AddEmployeePage';
import { DashboardPage } from '@pages/DashboardPage';
import { EmployeePersonalDetailsPage } from '@pages/EmployeePersonalDetailsPage';
import { LoginPage } from '@pages/LoginPage';
import { PimListPage } from '@pages/PimListPage';
import { buildEmployee, updatedFields } from '@utils/testData';

test.describe('Authentication', { tag: ['@regression'] }, () => {
  test('Admin can log in', { tag: ['@smoke'] }, async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsAdmin();
    await expect(page).toHaveURL(/dashboard/);
  });

  test('Invalid credentials show an error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(`invalid_${Date.now()}`, 'definitely-not-a-valid-password');

    await expect(page).toHaveURL(/auth\/login/);
    await expect(loginPage.errorMessage).toContainText(/invalid credentials/i);
  });
});

test.describe('Employee management', { tag: ['@regression'] }, () => {
  test(
    'Admin can create an employee through the UI and verify persistence through the API',
    { tag: ['@smoke'] },
    async ({ adminPage, apiClient, employeeManager }) => {
      const employee = buildEmployee();
      employeeManager.track(employee.employeeId);

      const pimList = new PimListPage(adminPage);
      await pimList.goto();
      await pimList.openAddEmployee();

      const addEmployee = new AddEmployeePage(adminPage);
      await addEmployee.fillPersonalDetails(employee);
      const toast = await addEmployee.save();
      expect(toast.toLowerCase()).toContain('success');

      const { status, body } = await apiClient.getEmployeeById(employee.employeeId);
      expect(status).toBe(200);
      expect(body.data.some((record) => record.employeeId === employee.employeeId)).toBe(true);
    }
  );

  test('Created ESS account cannot access Admin or PIM navigation', async ({
    adminPage,
    employeeManager,
  }) => {
    const employee = buildEmployee();
    employeeManager.track(employee.employeeId);

    const pimList = new PimListPage(adminPage);
    await pimList.goto();
    await pimList.openAddEmployee();

    const addEmployee = new AddEmployeePage(adminPage);
    await addEmployee.fillPersonalDetails(employee);
    await addEmployee.enableLoginDetails(employee);
    expect((await addEmployee.save()).toLowerCase()).toContain('success');

    const loginPage = new LoginPage(adminPage);
    await loginPage.logout();
    await loginPage.login(employee.loginUsername, employee.loginPassword);
    await expect(adminPage).not.toHaveURL(/auth\/login/);

    const visibleMenus = await new DashboardPage(adminPage).getVisibleMenuLabels();
    expect(visibleMenus).not.toContain('Admin');
    expect(visibleMenus).not.toContain('PIM');
  });

  test('Required employee fields are validated', async ({ adminPage }) => {
    const pimList = new PimListPage(adminPage);
    await pimList.goto();
    await pimList.openAddEmployee();

    const addEmployee = new AddEmployeePage(adminPage);
    await addEmployee.submitEmpty();
    const errors = await addEmployee.getValidationErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ').toLowerCase()).toContain('required');
  });

  test('Admin can update an independently provisioned employee', async ({
    adminPage,
    employeeManager,
  }) => {
    const { data: employee } = await employeeManager.create();
    const pimList = new PimListPage(adminPage);
    await pimList.goto();
    await pimList.searchByEmployeeId(employee.employeeId);
    await pimList.openFirstResult();

    const details = new EmployeePersonalDetailsPage(adminPage);
    const { middleName } = updatedFields();
    expect((await details.updateMiddleName(middleName)).toLowerCase()).toContain('success');
    await expect(details.middleNameInput).toHaveValue(middleName);
  });

  test('Admin can delete an independently provisioned employee', async ({
    adminPage,
    employeeManager,
  }) => {
    const { data: employee } = await employeeManager.create();
    const pimList = new PimListPage(adminPage);
    await pimList.goto();
    await pimList.searchByEmployeeId(employee.employeeId);
    expect((await pimList.deleteFirstResult()).toLowerCase()).toContain('success');

    await pimList.goto();
    await pimList.searchByEmployeeId(employee.employeeId);
    expect(await pimList.rowCount()).toBe(0);
  });
});
