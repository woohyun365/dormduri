import { defineApiVitestConfig } from './vitest.config.base.js';

export default defineApiVitestConfig({
  test: {
    include: ['test/vitest-smoke/**/*.vitest-smoke.spec.ts'],
    exclude: ['test/integration/**', 'test/e2e/**', 'dist/**'],
    pool: 'forks',
    setupFiles: ['./test/setup/vitest.setup.ts'],
  },
});
