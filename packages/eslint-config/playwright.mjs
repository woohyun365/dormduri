// @ts-check

/** @type {import('eslint').Linter.Config[]} */
const playwright = [
  {
    files: [
      'playwright.config.{js,mjs,ts}',
      'e2e/**/*.{js,jsx,ts,tsx}',
      'tests/e2e/**/*.{js,jsx,ts,tsx}',
    ],
    languageOptions: {
      globals: {
        browser: 'readonly',
        context: 'readonly',
        page: 'readonly',
      },
    },
  },
];

export default playwright;
