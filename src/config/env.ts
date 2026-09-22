import * as dotenv from 'dotenv';
import * as path from 'path';

// Environment-based configuration (Part 2 requirement).
// Usage: ENV=qa npm test  -> loads .env.qa, falls back to .env
const envName = process.env.ENV || 'qa';
const envFile = path.resolve(__dirname, `../../.env.${envName}`);
const localEnvFile = path.resolve(__dirname, `../../.env.${envName}.local`);
dotenv.config({ path: localEnvFile });
dotenv.config({ path: envFile });
dotenv.config(); // fallback to base .env for anything not overridden

export interface AppConfig {
  baseUrl: string;
  apiBaseUrl: string;
  adminUsername: string;
  adminPassword: string;
  defaultTimeoutMs: number;
  retries: number;
  env: string;
}

function requiredEnvironmentVariable(name: 'ADMIN_USERNAME' | 'ADMIN_PASSWORD'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.qa and provide it locally, or configure the matching CI secret.`
    );
  }
  return value;
}

function numericEnvironmentVariable(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (rawValue === undefined) return fallback;

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new Error(`${name} must be a non-negative number; received "${rawValue}".`);
  }
  return parsedValue;
}

export const config: AppConfig = {
  baseUrl: process.env.BASE_URL || 'https://opensource-demo.orangehrmlive.com',
  apiBaseUrl:
    process.env.API_BASE_URL || 'https://opensource-demo.orangehrmlive.com/web/index.php/api/v2',
  get adminUsername() {
    return requiredEnvironmentVariable('ADMIN_USERNAME');
  },
  get adminPassword() {
    return requiredEnvironmentVariable('ADMIN_PASSWORD');
  },
  defaultTimeoutMs: numericEnvironmentVariable('DEFAULT_TIMEOUT_MS', 30000),
  retries: numericEnvironmentVariable('RETRIES', 2),
  env: envName,
};
