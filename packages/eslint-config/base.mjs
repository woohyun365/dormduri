// @ts-check

/** @type {import('eslint').Linter.Config[]} */
const base = [
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}'],
    rules: {
      /** @type {import('eslint').Linter.RuleEntry} */
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];

export default base;
