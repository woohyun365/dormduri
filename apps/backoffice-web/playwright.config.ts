import { defineConfig, devices } from '@playwright/test';

/**
 * Chromium e2e of the backoffice (plan Phase O2c): the production build on the fixed origin
 * `http://localhost:4300` (D-BF2) against the real backoffice API and PostgreSQL (e2e/global-setup.ts).
 * One worker, one ordered flow: each step builds on the operators the previous one registered.
 */
const apiPort = Number(process.env.BACKOFFICE_E2E_API_PORT ?? 4311);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:4300',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm exec next start -p 4300',
    url: 'http://localhost:4300/login',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      BACKOFFICE_API_URL: `http://127.0.0.1:${apiPort}`,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
