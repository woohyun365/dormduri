import { createRequire } from 'node:module';
import { defineConfig } from 'eslint/config';
import shared from '../eslint-config/base.mjs';

// Lint plugins resolve from the API package, as in packages/shared.
const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier/flat');

export default defineConfig([
  {
    ignores: ['dist/**', 'src/generated/**', 'eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...shared,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['prisma.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
