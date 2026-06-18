import { defineApiVitestConfig } from './vitest.config.base.js';

export default defineApiVitestConfig({
  test: {
    include: ['test/stress/**/*.spec.ts'],
    exclude: ['dist/**'],
    pool: 'forks',
    setupFiles: ['./test/setup/vitest.setup.ts'],
  },
});
