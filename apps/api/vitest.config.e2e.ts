import { defineApiVitestConfig } from './vitest.config.base.js';

export default defineApiVitestConfig({
  test: {
    include: ['test/e2e/**/*.e2e-spec.ts'],
    exclude: ['dist/**'],
    pool: 'forks',
    fileParallelism: false,
    setupFiles: ['./test/setup/vitest.integration.setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    teardownTimeout: 60_000,
  },
});
