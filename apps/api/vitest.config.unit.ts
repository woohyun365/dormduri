import { defineApiVitestConfig } from './vitest.config.base.js';

export default defineApiVitestConfig({
  test: {
    include: ['src/**/*.spec.ts', 'test/release/**/*.spec.ts'],
    exclude: ['test/integration/**', 'test/e2e/**', 'dist/**'],
    pool: 'forks',
    setupFiles: ['./test/setup/vitest.setup.ts'],
  },
});
