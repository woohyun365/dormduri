import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

import shared from '@repo/eslint-config/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // 공통 룰(override 최소)
  ...shared,

  // Prettier 충돌 룰 OFF
  prettier,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mjs', 'postcss.config.mjs'],
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
