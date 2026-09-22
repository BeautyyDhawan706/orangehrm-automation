/** Shared selectors used by more than one page object. */
export const employeeFormSelectors = {
  firstName: 'input[name="firstName"]',
  middleName: 'input[name="middleName"]',
  employeeId: '.oxd-grid-item:has(label:text("Employee Id")) input',
} as const;
