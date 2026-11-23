import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const commonTestExcludes = ['e2e/**', 'node_modules/**', '.next/**', 'coverage/**'];

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    clearMocks: true,
    unstubGlobals: true,
    pool: 'threads',
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: commonTestExcludes,
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          include: ['src/**/*.test.tsx'],
          exclude: commonTestExcludes,
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './src/test/server-only.ts'),
    },
  },
});
