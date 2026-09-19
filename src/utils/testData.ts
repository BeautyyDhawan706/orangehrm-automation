/**
 * Test data management (Part 4 requirement).
 * Generates unique, isolated data per run so parallel workers never collide
 * on the same employee record, and reruns don't fail on "duplicate" errors.
 */

function randomSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

export interface EmployeeData {
  firstName: string;
  lastName: string;
  middleName?: string;
  employeeId: string;
  loginUsername: string;
  loginPassword: string;
}

export function buildEmployee(overrides: Partial<EmployeeData> = {}): EmployeeData {
  const suffix = randomSuffix();
  return {
    firstName: `AutoQA`,
    lastName: `Candidate${suffix}`,
    middleName: 'T',
    employeeId: suffix.slice(-6),
    loginUsername: `autoqa_${suffix}`,
    loginPassword: `P@ssw0rd_${suffix}`,
    ...overrides,
  };
}

export function updatedFields() {
  return {
    middleName: `Updated${randomSuffix().slice(-4)}`,
  };
}
