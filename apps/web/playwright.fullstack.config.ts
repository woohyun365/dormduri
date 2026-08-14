import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const apiBaseURL = process.env.API_URL ?? 'http://127.0.0.1:4000';
const localDatabaseUrl =
  process.env.HOME_E2E_DATABASE_URL ??
  'postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public';
const authStatePath = 'playwright/.auth/main-home.json';

function withLocalDatabase(command: string) {
  return `DATABASE_URL="${localDatabaseUrl}" DIRECT_URL="${localDatabaseUrl}" ${command}`;
}

const apiServerCommand = [
  'pnpm --dir ../.. db:up',
  withLocalDatabase('pnpm --dir ../.. db:push'),
  withLocalDatabase('pnpm --dir ../.. db:seed'),
  withLocalDatabase('PORT=4000 pnpm --dir ../api dev'),
].join(' && ');

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/fullstack' }]],
  outputDir: 'test-results/fullstack',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'desktop-chromium',
      dependencies: ['setup'],
      testMatch: /.*\.fullstack\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: authStatePath },
    },
    {
      name: 'mobile-chromium',
      dependencies: ['setup'],
      testMatch: /.*\.fullstack\.spec\.ts/,
      use: { ...devices['Pixel 5'], storageState: authStatePath },
    },
  ],
  webServer: [
    {
      command: apiServerCommand,
      url: `${apiBaseURL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `API_URL=${apiBaseURL} pnpm dev --hostname 127.0.0.1 --port 3000`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
