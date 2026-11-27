import { defineConfig, devices } from '@playwright/test';

// Story check of the Storybook static build (pnpm ci:storybook:build first, design guide ⑨). Only
// e2e/storybook/*.storybook.ts is collected here, and the default playwright.config.ts does not match that suffix.
// Output stays under the ignored test-results/ and playwright-report/.
const port = 6107;
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
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/storybook' }]],
  outputDir: 'test-results/storybook',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Node runs the TypeScript file with type stripping and detects its ES module syntax.
    command: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/storybook/static-server.ts storybook-static ${port}`,
    url: `${baseURL}/index.json`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
