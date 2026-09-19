import * as dotenv from 'dotenv';
import * as path from 'path';

// Environment-based configuration (Part 2 requirement).
// Usage: ENV=qa npm test  -> loads .env.qa, falls back to .env
const envName = process.env.ENV || 'qa';
const envFile = path.resolve(__dirname, `../../.env.${envName}`);
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

export const config: AppConfig = {
  baseUrl: process.env.BASE_URL || 'https://opensource-demo.orangehrmlive.com',
  apiBaseUrl: process.env.API_BASE_URL || 'https://opensource-demo.orangehrmlive.com/web/index.php/api/v2',
  adminUsername: process.env.ADMIN_USERNAME || 'Admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  defaultTimeoutMs: Number(process.env.DEFAULT_TIMEOUT_MS) || 15000,
  retries: Number(process.env.RETRIES) || 2,
  env: envName,
};
