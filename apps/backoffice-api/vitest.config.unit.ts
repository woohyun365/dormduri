import { defineBackofficeVitestConfig } from './vitest.config.base.js';

export default defineBackofficeVitestConfig({
  test: {
    include: ['src/**/*.spec.ts', 'test/architecture/**/*.spec.ts'],
    exclude: ['test/integration/**', 'dist/**'],
    pool: 'forks',
    setupFiles: ['./test/setup/vitest.setup.ts'],
  },
});
