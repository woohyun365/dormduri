// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

import prettier from 'eslint-config-prettier/flat';
import shared from '@repo/eslint-config/flat';

export default defineConfig([
  {
    ignores: ['**/eslint.config.*'],
  },

  // 기본 ESLint 추천
  eslint.configs.recommended,

  // TS(타입체크 포함) 추천
  ...tseslint.configs.recommendedTypeChecked,

  // 레포 공통 룰(override 최소)
  ...shared,

  // Prettier와 충돌하는 ESLint 룰 끄기
  prettier,

  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
    },
  },
]);
