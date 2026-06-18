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
  ]),
]);

export default eslintConfig;
