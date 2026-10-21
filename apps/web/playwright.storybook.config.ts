import { defineConfig, devices } from '@playwright/test';

// Story checks for the Storybook static build (pnpm ci:storybook:build first). Only
// e2e/storybook/*.storybook.ts is collected here, and the default playwright.config.ts does not
// match that suffix.
const port = 6106;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e/storybook',
  testMatch: '**/*.storybook.ts',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results/storybook',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
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
    // Node runs the TypeScript file with type stripping and detects its ES module syntax.
    command: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/storybook/static-server.ts storybook-static ${port}`,
    url: `${baseURL}/index.json`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
