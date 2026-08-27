import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const commonTestExcludes = ['e2e/**', 'tests/e2e/**', 'node_modules/**', '.next/**', 'coverage/**'];
const domTypeScriptTests = ['src/**/*.dom.test.ts', 'src/**/*.dom.spec.ts'];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    pool: 'threads',
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          setupFiles: [],
          include: ['src/**/*.{test,spec}.ts'],
          exclude: [...commonTestExcludes, ...domTypeScriptTests],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          include: ['src/**/*.{test,spec}.tsx', ...domTypeScriptTests],
          exclude: commonTestExcludes,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/__tests__/**',
        'src/test/**',
        'src/test-setup.ts',
        'src/__fixtures__/**',
        'src/**/*.d.ts',
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/app/**/not-found.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
