// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

import prettier from 'eslint-config-prettier/flat';
import shared from '@repo/eslint-config/base';

export default defineConfig([
  globalIgnores(['**/eslint.config.*', 'src/generated/**', 'dist/**', 'coverage/**']),

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
        projectService: {
          allowDefaultProject: ['prisma.config.ts', 'vitest.config.*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    rules: {
      // Keep this explicit even though recommendedTypeChecked already enables it so
      // no-op type assertions remain lint errors in product and test code.
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
    },
  },
  {
    files: [
      'prisma/seed.js',
      'prisma/seed-data/reference/*.js',
      'prisma/seed-data/fixtures/*.js',
      'prisma/seeds/**/*.js',
    ],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['test/**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['src/**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'node:fs',
              message:
                '제품 unit spec은 구현 source를 읽지 않습니다. Architecture 또는 operations lane에서 artifact 경계를 검증하세요.',
            },
            {
              name: 'node:fs/promises',
              message:
                '제품 unit spec은 구현 source를 읽지 않습니다. Architecture 또는 operations lane에서 artifact 경계를 검증하세요.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'test/stress/http/k6/**/*.js',
      'test/stress/http/k6/**/*.mjs',
      'test/stress/realtime/artillery/**/*.mjs',
      'test/stress/docker/**/*.mjs',
      'test/stress/decisions/**/*.mjs',
      'test/stress/evidence/**/*.mjs',
    ],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: {
        ...globals.node,
        __ENV: 'readonly',
        __VU: 'readonly',
        __ITER: 'readonly',
        open: 'readonly',
      },
      parserOptions: {
        project: false,
        projectService: false,
      },
    },
  },
  {
    files: [
      'test/operations/reference-data/reference-seed-scripts.spec.ts',
      'test/integration/support/integration-db.ts',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
]);
