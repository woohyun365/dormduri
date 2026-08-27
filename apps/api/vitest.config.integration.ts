import { defineApiVitestConfig } from './vitest.config.base.js';

export default defineApiVitestConfig({
  test: {
    include: ['test/integration/**/*.integration.spec.ts'],
    exclude: ['dist/**'],
    pool: 'forks',
    fileParallelism: true,
    setupFiles: ['./test/setup/vitest.integration.setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    teardownTimeout: 60_000,
  },
});
