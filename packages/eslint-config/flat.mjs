// @ts-check

/**
 * 공유 ESLint Flat Config
 * JS(.mjs) 환경에서 타입 정보가 넓어지는 문제를 방지하기 위해
 * JSDoc으로 정확한 타입을 지정합니다.
 * - Rule 튜플(['warn', { ... }])이 단순 (string|object)[]로
 *   추론되는 문제를 막아, 소비 측(tseslint.config) 타입 오류를 해소합니다.
 */
const shared = [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      /** @type {import('eslint').Linter.RuleEntry} */
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];

export default shared;
