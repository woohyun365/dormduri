import { defineApiVitestConfig } from './vitest.config.base.js';

export default defineApiVitestConfig({
  test: {
    include: ['test/integration/**/*.integration.spec.ts'],
    exclude: ['dist/**'],
    pool: 'forks',
    fileParallelism: true,
    // Creates DB group roles and LOGIN users once, then workers run the separated role mode.
    globalSetup: ['./test/setup/vitest.integration.global-setup.ts'],
    setupFiles: ['./test/setup/vitest.integration.setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    teardownTimeout: 60_000,
  },
});
