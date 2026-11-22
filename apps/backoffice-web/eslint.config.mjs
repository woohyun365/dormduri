import { defineConfig, globalIgnores } from 'eslint/config';

import next from '@repo/eslint-config/next';
import playwright from '@repo/eslint-config/playwright';
import vitest from '@repo/eslint-config/vitest';

const readme = 'apps/backoffice-web/README.md';

// The backoffice Web reaches the backoffice API only through its BFF (README §1). It never imports
// another app: shared code goes to a package (@repo/shared for contracts).
const otherAppImportPatterns = [
  {
    group: [
      'web',
      'web/**',
      'api',
      'api/**',
      'backoffice-api',
      'backoffice-api/**',
      '**/apps/web/**',
      '**/apps/api/**',
      '**/apps/backoffice-api/**',
    ],
    message: `백오피스 Web은 다른 앱(apps/web·apps/api·apps/backoffice-api) code를 import하지 않습니다. 계약은 @repo/shared/backoffice입니다. ${readme}`,
  },
];

// D-BF1: state changes go through route handlers (src/app/api/**), never server actions.
const serverActionDirective = {
  selector: "ExpressionStatement[directive='use server']",
  message: `server action('use server')은 쓰지 않습니다. 상태 변경은 src/app/api/**의 BFF route handler가 받습니다. ${readme}`,
};

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
    rules: {
      'no-restricted-imports': ['error', { patterns: otherAppImportPatterns }],
      'no-restricted-syntax': ['error', serverActionDirective],
    },
  },

  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ['playwright.config.ts', 'e2e/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.e2e.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
  ]),
]);

export default eslintConfig;
