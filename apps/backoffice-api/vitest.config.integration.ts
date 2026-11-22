import { defineBackofficeVitestConfig } from './vitest.config.base.js';

export default defineBackofficeVitestConfig({
  test: {
    include: ['test/integration/**/*.integration.spec.ts'],
    exclude: ['dist/**'],
    pool: 'forks',
    fileParallelism: true,
    // Creates the DB group roles and LOGIN users once; suites then connect as dormduri_backoffice and
    // dormduri_backoffice_retention so every query runs under the grant table.
    globalSetup: ['./test/setup/vitest.integration.global-setup.ts'],
    setupFiles: ['./test/setup/vitest.setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
