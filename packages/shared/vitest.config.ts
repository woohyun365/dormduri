import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    pool: 'forks',
  },
});
