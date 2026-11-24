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

// README §1: state changes go through route handlers (src/app/api/**), never server actions.
const serverActionDirective = {
  selector: "ExpressionStatement[directive='use server']",
  message: `server action('use server')은 쓰지 않습니다. 상태 변경은 src/app/api/**의 BFF route handler가 받습니다. ${readme}`,
};

// Style values come from the semantic tokens of src/app/globals.css (design guide ②), so string literals of the app
// code and stories may not name the Tailwind default theme or raw values. A copy of the user Web screen layer rule
// (apps/web/eslint.config.mjs) with the backoffice token names. Patterns avoid "/" (esquery regex delimiter) and use
// \x2F for a slash.
const designGuide = 'apps/backoffice-web/src/ui/README.md';
const classStart = String.raw`(?:^|\s)(?:\S*:)?!?-?`;
const classEnd = String.raw`(?=[\s!\x2F]|$)`;
const tailwindPalettes =
  'slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const colorUtilities =
  'bg|text|border(?:-[xytrblse])?|outline|ring(?:-offset)?|inset-ring|divide|fill|stroke|decoration|accent|caret|shadow|inset-shadow|drop-shadow|text-shadow|placeholder|from|via|to';
const themeColorNames =
  'background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring';
const tokenOnlyPatterns = [
  {
    pattern: String.raw`${classStart}[\w-]+-(?:${tailwindPalettes})-(?:50|[1-9]00|950)${classEnd}|${classStart}[\w-]+-(?:black|white)${classEnd}`,
    message:
      'Tailwind 기본 색 팔레트 대신 색 역할 token(bg-layer-*, text-fg-*, border-stroke-*, bg-brand-*, bg-<상태>-weak·text-fg-<상태>)을 쓰세요.',
  },
  {
    pattern: String.raw`${classStart}text-(?:xs|sm|base|lg|xl|[2-9]xl)${classEnd}`,
    message:
      'Tailwind 기본 글자 크기 대신 글자 단계 token(text-caption, text-body, text-title-1~3)을 쓰세요.',
  },
  {
    pattern: String.raw`${classStart}rounded(?:-(?:s|e|t|r|b|l|ss|se|es|ee|tl|tr|br|bl))?(?:-(?:xs|sm|md|lg|xl|[234]xl))?${classEnd}`,
    message:
      'Tailwind 기본 radius 대신 역할 token(rounded-control·box·card)이나 rounded-full·rounded-none을 쓰세요.',
  },
  {
    pattern: String.raw`${classStart}(?:shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|inner))?|inset-shadow-(?:2xs|xs|sm)|drop-shadow(?:-(?:xs|sm|md|lg|xl|2xl))?|text-shadow-(?:2xs|xs|sm|md|lg))${classEnd}`,
    message:
      'Tailwind 기본 shadow 이름은 쓰지 않습니다. 층은 bg-layer-*와 border-stroke-*로 나누고, 그림자 token은 처음 쓰는 화면이 globals.css에 더합니다.',
  },
  {
    pattern: String.raw`(?:^|\s)\S*-\[|(?:^|\s)(?:\S*:)?!?\[[\w-]+:`,
    message:
      '임의 값(-[…])과 임의 속성([prop:value]) 대신 token utility나 globals.css의 이름 붙은 utility·variant를 쓰세요.',
  },
  {
    pattern: String.raw`(?:^|\s)\S*-\(--`,
    message: 'CSS 변수 축약(-(--…)) 대신 token utility를 쓰세요.',
  },
  {
    pattern: String.raw`(?<![\w&])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])|(?<![\w-])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(`,
    message: 'raw 색 값 대신 색 역할 token을 쓰세요.',
  },
  {
    pattern: String.raw`${classStart}(?:${colorUtilities})-(?:${themeColorNames})(?:-foreground)?${classEnd}`,
    message:
      '백오피스에는 theme 색 이름(primary·muted·border 등)이 없습니다. 색 역할 token(bg-layer-*, text-fg-*, border-stroke-*, bg-brand-*)을 쓰세요.',
  },
  {
    pattern: String.raw`${classStart}font-(?:sans|serif|mono)${classEnd}`,
    message: '글꼴은 기본 글꼴을 쓰고, code·비밀 값처럼 고정폭이 필요한 글자만 font-code를 씁니다.',
  },
  {
    pattern: String.raw`${classStart}(?:w|min-w|max-w|inline|min-inline|max-inline|basis|columns)-(?:3xs|2xs|xs|sm|md|lg|xl|[2-7]xl)${classEnd}`,
    message: 'Tailwind 기본 container 폭 대신 폭 token(max-w-page, max-w-narrow)을 쓰세요.',
  },
  {
    pattern: String.raw`${classStart}leading-(?:tight|snug|normal|relaxed|loose)${classEnd}|${classStart}text-[\w-]+\x2F(?:tight|snug|normal|relaxed|loose)(?=[\s!]|$)|${classStart}ease-(?:in-out|in|out)${classEnd}`,
    message:
      '이름 붙은 줄 간격·easing 대신 글자 단계 token에 짝지은 줄 간격(text-body 등)을 쓰세요. easing token은 처음 쓰는 화면이 globals.css에 더합니다.',
  },
].map(({ pattern, message }) => ({
  selector: `:matches(Literal[value=/${pattern}/], TemplateElement[value.raw=/${pattern}/])`,
  message: `${message} ${designGuide}`,
}));

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
    files: ['playwright.config.ts', 'playwright.storybook.config.ts', 'e2e/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.e2e.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ['.storybook/**/*.{ts,tsx}', 'src/**/__stories__/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.storybook.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Token-only style values in the app code and the stories (tests excluded). A later block's options replace an
  // earlier block's for the same rule, so this list keeps the server action ban of the block above.
  {
    files: ['src/**/*.{ts,tsx}', '.storybook/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts', 'src/test/**'],
    rules: {
      'no-restricted-syntax': ['error', serverActionDirective, ...tokenOnlyPatterns],
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
    'storybook-static/**',
  ]),
]);

export default eslintConfig;
