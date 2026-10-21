import { createRequire } from 'node:module';
import { defineConfig } from 'eslint/config';
import shared from '../eslint-config/base.mjs';

const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier/flat');

// Renderer-neutral source (portable-now, like apps/web src/screens/*/model/**): src/**/*.ts, tests
// excluded. Imports are an allowlist; browser and Node globals, dynamic import(), import('…') types
// and require() are errors. rootDir ./src already rejects relative imports that leave src, so there
// is no depth rule. Limits: globals outside the list (matchMedia …) and paths built from strings.
const screensReadme = 'apps/web/src/screens/README.md';
const allowlist = `package 안 상대 경로와 zod만 import합니다. ${screensReadme}`;
const rendererGlobals = [
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'globalThis',
  'self',
  'process',
];

export default defineConfig([
  {
    ignores: ['dist/**', 'eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...shared,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/__tests__/**', 'src/**/*.{test,spec}.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: String.raw`^(?!\.{1,2}/|zod$)`,
              message: `packages/shared/src는 Next.js·React·React Native·Expo·Node builtin·Web alias·그 밖 package를 import하지 않고 ${allowlist}`,
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...rendererGlobals.map((name) => ({
          name,
          message: `packages/shared/src는 browser·Node 전역을 쓰지 않습니다(${name}). 필요한 값은 호출하는 쪽이 인자로 넘깁니다. ${screensReadme}`,
        })),
      ],
      'no-restricted-syntax': [
        'error',
        ...[
          ['ImportExpression', '동적 import()'],
          ['TSImportType', "import('…') type 표현"],
          ["CallExpression[callee.name='require']", 'require()'],
        ].map(([selector, name]) => ({
          selector,
          message: `packages/shared/src에서 쓰지 않는 문법입니다(${name}). ${allowlist}`,
        })),
      ],
    },
  },
]);
