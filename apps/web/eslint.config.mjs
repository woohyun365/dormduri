import { defineConfig, globalIgnores } from 'eslint/config';

import next from '@repo/eslint-config/next';
import playwright from '@repo/eslint-config/playwright';
import vitest from '@repo/eslint-config/vitest';

const eslintConfig = defineConfig([
  ...next,
  ...vitest,
  ...playwright,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mjs', 'postcss.config.mjs', 'vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      next: {
        rootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**/*.{ts,tsx}', 'src/test-setup.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: [
      'playwright.config.ts',
      'playwright.fullstack.config.ts',
      'e2e/**/*.ts',
      'tests/e2e/**/*.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.e2e.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: [
      '.storybook/**/*.{ts,tsx}',
      'src/**/*.stories.{ts,tsx}',
      'src/**/__stories__/**/*.{ts,tsx}',
    ],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.storybook.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    // Test fixtures are dev-only data; exclude from lint
    'src/__fixtures__/**',
    // Playwright runtime artifacts are regenerated locally/CI.
    'playwright-report/**',
    'test-results/**',
    // Storybook static build output is generated locally/CI.
    'storybook-static/**',
  ]),
]);

export default eslintConfig;
