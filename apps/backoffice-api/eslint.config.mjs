// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

import prettier from 'eslint-config-prettier/flat';
import shared from '@repo/eslint-config/base';

// The backoffice API owns its platform wiring and never reaches into the user API (README §1):
// a shared server package is the way to reuse that code, not a path into apps/api.
const userApiImportPatterns = [
  {
    group: ['api', 'api/**', '**/apps/api/**', '../../api/**', '../../../api/**'],
    message:
      '백오피스 API는 사용자 API(apps/api) code를 import하지 않습니다. 공유가 필요하면 공유 server package를 둡니다(apps/backoffice-api/README.md).',
  },
  {
    group: ['../../../../api/**', '../../../../../api/**'],
    message:
      '백오피스 API는 사용자 API(apps/api) code를 import하지 않습니다. 공유가 필요하면 공유 server package를 둡니다(apps/backoffice-api/README.md).',
  },
];

export default defineConfig([
  globalIgnores(['**/eslint.config.*', 'dist/**', 'coverage/**']),

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...shared,
  prettier,

  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vitest.config.*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    rules: {
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      'no-restricted-imports': ['error', { patterns: userApiImportPatterns }],
    },
  },

  {
    // supertest types a response body as `any`; the integration specs read it field by field and
    // assert each value, so only the unsafe-any family is off there. Support helpers stay strict.
    files: ['test/integration/**/*.integration.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
]);
