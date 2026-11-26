import { defineConfig, devices } from '@playwright/test';
import { WEB_E2E_LEGAL_LAST_SUCCESS_DIR } from './e2e/support/legal-last-success-fixture';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const usePrebuiltStandalone = process.env.PLAYWRIGHT_PREBUILT === '1';
// No API: the legal pages answer from the last success files the global setup writes.
const smokeRuntimeEnv = `API_URL=http://127.0.0.1:9 NEXT_PUBLIC_APP_URL=https://ci.dormduri.invalid DORMDURI_LEGAL_LAST_SUCCESS_DIR=${WEB_E2E_LEGAL_LAST_SUCCESS_DIR}`;
const standaloneServerCommand = `pnpm run ci:standalone:prepare && ${smokeRuntimeEnv} HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/apps/web/server.js`;

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/*.fullstack.spec.ts', '**/*.setup.ts'],
  globalSetup: './e2e/support/legal-last-success-fixture.ts',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: usePrebuiltStandalone
      ? standaloneServerCommand
      : `${smokeRuntimeEnv} pnpm run ci:build && ${standaloneServerCommand}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
