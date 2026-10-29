import { defineConfig, globalIgnores } from 'eslint/config';

import next from '@repo/eslint-config/next';
import playwright from '@repo/eslint-config/playwright';
import vitest from '@repo/eslint-config/vitest';

const sentryImportPath = {
  name: '@sentry/nextjs',
  message: 'Sentry SDK는 observability/sentry owner와 Next instrumentation 경계에서만 사용하세요.',
};

// New screen layer (src/screens). Style values come from the DTCG tokens in src/styles/tokens, so
// string literals may not name the Tailwind default theme, the legacy globals.css theme or raw
// values. Patterns avoid "/" (esquery regex delimiter) and use \x2F for a slash.
const tokensReadme = 'apps/web/src/styles/tokens/README.md';
const screensReadme = 'apps/web/src/screens/README.md';
const classStart = String.raw`(?:^|\s)(?:\S*:)?!?-?`;
const classEnd = String.raw`(?=[\s!\x2F]|$)`;
const tailwindPalettes =
  'slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const colorUtilities =
  'bg|text|border(?:-[xytrblse])?|outline|ring(?:-offset)?|inset-ring|divide|fill|stroke|decoration|accent|caret|shadow|inset-shadow|drop-shadow|text-shadow|placeholder|from|via|to';
const legacyThemeColors =
  'background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring';
const rawValuePatterns = [
  {
    pattern: String.raw`${classStart}[\w-]+-(?:${tailwindPalettes})-(?:50|[1-9]00|950)${classEnd}|${classStart}[\w-]+-(?:black|white)${classEnd}`,
    message:
      'Tailwind 기본 색 팔레트 대신 색 역할 token(bg-layer-*, text-fg-*, border-stroke-*, bg-brand-*, bg-<상태>-solid·weak)을 쓰세요.',
  },
  {
    pattern: String.raw`${classStart}text-(?:xs|sm|base|lg|xl|[2-9]xl)${classEnd}`,
    message:
      'Tailwind 기본 글자 크기 대신 type scale token(text-caption … text-display-1)을 쓰세요.',
  },
  {
    pattern: String.raw`${classStart}rounded(?:-(?:s|e|t|r|b|l|ss|se|es|ee|tl|tr|br|bl))?(?:-(?:xs|sm|md|lg|xl|[234]xl))?${classEnd}`,
    message:
      'Tailwind 기본 radius 대신 역할 token(rounded-input·control·card·panel·sheet)이나 rounded-full·rounded-none을 쓰세요.',
  },
  {
    pattern: String.raw`${classStart}(?:shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|inner))?|inset-shadow-(?:2xs|xs|sm)|drop-shadow(?:-(?:xs|sm|md|lg|xl|2xl))?|text-shadow-(?:2xs|xs|sm|md|lg))${classEnd}`,
    message:
      'Tailwind 기본 shadow 이름은 쓰지 않습니다. 층은 bg-layer-*와 border-stroke-*로 나누고, 그림자 token은 처음 쓰는 화면이 semantic 층에 더합니다.',
  },
  {
    pattern: String.raw`(?:^|\s)\S*-\[|(?:^|\s)(?:\S*:)?!?\[[\w-]+:`,
    message: '임의 값(-[…])과 임의 속성([prop:value]) 대신 token utility를 쓰세요.',
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
    pattern: String.raw`${classStart}(?:${colorUtilities})-(?:${legacyThemeColors})(?:-foreground)?${classEnd}`,
    message:
      '기존 globals.css theme 색(primary·muted·border 등) 대신 새 색 역할 token(bg-layer-*, text-fg-*, border-stroke-*, bg-brand-*)을 쓰세요.',
  },
  {
    pattern: String.raw`${classStart}font-(?:sans|serif|mono)${classEnd}`,
    message: '글꼴은 font-body만 씁니다.',
  },
  {
    pattern: String.raw`${classStart}(?:w|min-w|max-w|inline|min-inline|max-inline|basis|columns)-(?:3xs|2xs|xs|sm|md|lg|xl|[2-7]xl)${classEnd}`,
    message: 'Tailwind 기본 container 폭 대신 container token(max-w-page, max-w-reading)을 쓰세요.',
  },
  {
    pattern: String.raw`${classStart}leading-(?:tight|snug|normal|relaxed|loose)${classEnd}|${classStart}text-[\w-]+\x2F(?:tight|snug|normal|relaxed|loose)(?=[\s!]|$)|${classStart}ease-(?:in-out|in|out)${classEnd}`,
    message:
      '이름 붙은 줄 간격·easing 대신 type scale에 짝지은 줄 간격(text-body 등)과 ease-standard를 쓰세요.',
  },
].map(({ pattern, message }) => ({
  selector: `:matches(Literal[value=/${pattern}/], TemplateElement[value.raw=/${pattern}/])`,
  message: `${message} ${tokensReadme}`,
}));

// eslint-plugin-jsx-a11y 6.10.2 recommended rules (the plugin is registered by eslint-config-next).
const jsxA11yRecommended = {
  // eslint-config-next narrows alt-text to img, and a bare severity would keep that option. Restore
  // the recommended elements and keep next/image checked.
  'jsx-a11y/alt-text': [
    'error',
    { elements: ['img', 'object', 'area', 'input[type="image"]'], img: ['Image'] },
  ],
  'jsx-a11y/anchor-has-content': 'error',
  'jsx-a11y/anchor-is-valid': 'error',
  'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
  'jsx-a11y/aria-props': 'error',
  'jsx-a11y/aria-proptypes': 'error',
  'jsx-a11y/aria-role': 'error',
  'jsx-a11y/aria-unsupported-elements': 'error',
  'jsx-a11y/autocomplete-valid': 'error',
  'jsx-a11y/click-events-have-key-events': 'error',
  'jsx-a11y/heading-has-content': 'error',
  'jsx-a11y/html-has-lang': 'error',
  'jsx-a11y/iframe-has-title': 'error',
  'jsx-a11y/img-redundant-alt': 'error',
  'jsx-a11y/interactive-supports-focus': [
    'error',
    { tabbable: ['button', 'checkbox', 'link', 'searchbox', 'spinbutton', 'switch', 'textbox'] },
  ],
  'jsx-a11y/label-has-associated-control': 'error',
  'jsx-a11y/media-has-caption': 'error',
  'jsx-a11y/mouse-events-have-key-events': 'error',
  'jsx-a11y/no-access-key': 'error',
  'jsx-a11y/no-autofocus': 'error',
  'jsx-a11y/no-distracting-elements': 'error',
  'jsx-a11y/no-interactive-element-to-noninteractive-role': [
    'error',
    { tr: ['none', 'presentation'], canvas: ['img'] },
  ],
  'jsx-a11y/no-noninteractive-element-interactions': [
    'error',
    {
      handlers: [
        'onClick',
        'onError',
        'onLoad',
        'onMouseDown',
        'onMouseUp',
        'onKeyPress',
        'onKeyDown',
        'onKeyUp',
      ],
      alert: ['onKeyUp', 'onKeyDown', 'onKeyPress'],
      body: ['onError', 'onLoad'],
      dialog: ['onKeyUp', 'onKeyDown', 'onKeyPress'],
      iframe: ['onError', 'onLoad'],
      img: ['onError', 'onLoad'],
    },
  ],
  'jsx-a11y/no-noninteractive-element-to-interactive-role': [
    'error',
    {
      ul: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
      ol: ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'],
      li: ['menuitem', 'menuitemradio', 'menuitemcheckbox', 'option', 'row', 'tab', 'treeitem'],
      table: ['grid'],
      td: ['gridcell'],
      fieldset: ['radiogroup', 'presentation'],
    },
  ],
  'jsx-a11y/no-noninteractive-tabindex': [
    'error',
    { tags: [], roles: ['tabpanel'], allowExpressionValues: true },
  ],
  'jsx-a11y/no-redundant-roles': 'error',
  'jsx-a11y/no-static-element-interactions': [
    'error',
    {
      allowExpressionValues: true,
      handlers: ['onClick', 'onMouseDown', 'onMouseUp', 'onKeyPress', 'onKeyDown', 'onKeyUp'],
    },
  ],
  'jsx-a11y/role-has-required-aria-props': 'error',
  'jsx-a11y/role-supports-aria-props': 'error',
  'jsx-a11y/scope': 'error',
  'jsx-a11y/tabindex-no-positive': 'error',
};

// Outside a feature, import its public entry (@/screens/<feature>) or @/screens/ui/**.
const screensFeatureEntryPattern = {
  group: ['@/screens/*/**', '!@/screens/ui/**'],
  message: `다른 기능의 내부 파일 대신 공개 entry(@/screens/<기능>)나 @/screens/ui/**를 import하세요. ${screensReadme}`,
};

// Relative imports stay inside the feature root. A file `depth` directories below src/screens
// (depth 1 = feature root) may climb `depth - 1` levels; files at the src/screens root may not
// climb. Files deeper than the last block keep the alias rule only.
const screensRelativeDepthBlocks = [0, 1, 2, 3, 4, 5, 6].map((depth) => ({
  files: [`src/screens/${'*/'.repeat(depth)}*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [sentryImportPath],
        patterns: [
          screensFeatureEntryPattern,
          {
            regex: String.raw`^(?:\./)?(?:\.\./){${Math.max(depth, 1)}}`,
            message: `기능 root 밖의 파일은 상대 경로 대신 공개 entry(@/screens/<기능>)나 @/screens/ui/**로 import하세요. ${screensReadme}`,
          },
        ],
      },
    ],
  },
}));

// Renderer-neutral model (portable-now): src/screens/*/model/**, tests excluded. The rest of
// src/screens and apps/web/src (BFF, navigation, storage, routes) is web-only, and the old screen
// layer model (src/main/model) is not-worth-sharing and unchecked. Imports are an allowlist;
// browser and Node globals, dynamic import(), import('…') types, require() and JSX are errors.
// These blocks come after the raw value block and replace its options, so they repeat the Sentry
// path, the feature entry pattern and the raw value patterns. Model depth blocks keep relative
// paths inside model/ down to the last screens depth block. The allowlist rejects bare '.' and
// '..', so directory indexes are imported as './index'; model files are .ts/.tsx (a .js file is
// outside the type-aware project and fails to parse). Limits: globals outside the list
// (matchMedia …), DOM references in type positions (HTMLElement, typeof window), paths built from
// strings, a `..` in the middle of a relative path, files deeper than the last depth block
// (allowlist only), import.meta, /// <reference> directives, aliased require and require.resolve.
const modelRoot = 'src/screens/*/model';
const modelTestIgnores = ['src/screens/**/__tests__/**', 'src/screens/**/*.{test,spec}.{ts,tsx}'];
const modelAllowlist = `같은 model/ 안 상대 경로, @repo/shared/**, zod만 import합니다. ${screensReadme}`;
const modelAllowlistPattern = {
  regex: String.raw`^(?!\.{1,2}/|@repo/shared/|zod$)`,
  message: `model/은 Next.js·React·React Native·Expo·Node builtin·@/ Web alias·그 밖 package를 import하지 않고 ${modelAllowlist}`,
};
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
const modelSyntax = [
  ['ImportExpression', '동적 import()'],
  ['TSImportType', "import('…') type 표현"],
  ["CallExpression[callee.name='require']", 'require()'],
  ['JSXElement', 'JSX'],
  ['JSXFragment', 'JSX'],
].map(([selector, name]) => ({
  selector,
  message: `model/에서 쓰지 않는 문법입니다(${name}). 화면 표현은 model 밖 component가 맡고 model은 ${modelAllowlist}`,
}));

function modelImports(patterns) {
  return [
    'error',
    {
      paths: [sentryImportPath],
      patterns: [screensFeatureEntryPattern, modelAllowlistPattern, ...patterns],
    },
  ];
}

const screensModelBlocks = [
  {
    files: [`${modelRoot}/**`],
    ignores: modelTestIgnores,
    rules: {
      'no-restricted-imports': modelImports([]),
      'no-restricted-globals': [
        'error',
        ...rendererGlobals.map((name) => ({
          name,
          message: `model/은 browser·Node 전역을 쓰지 않습니다(${name}). 필요한 값은 model 밖 Web 표현이 인자로 넘깁니다. ${screensReadme}`,
        })),
      ],
      'no-restricted-syntax': ['error', ...rawValuePatterns, ...modelSyntax],
    },
  },
  // A file `depth` directories below model/ may climb `depth` levels. A trailing `..` counts as a
  // level: '../..' from model/sub/ points at the feature root, which exports the React screen.
  ...[0, 1, 2, 3, 4].map((depth) => ({
    files: [`${modelRoot}/${'*/'.repeat(depth)}*.{ts,tsx}`],
    ignores: modelTestIgnores,
    rules: {
      'no-restricted-imports': modelImports([
        {
          regex: String.raw`^(?:\./)?(?:\.\.(?:/|$)){${depth + 1}}`,
          message: `model/ 밖의 파일은 상대 경로로 import하지 않습니다. model은 ${modelAllowlist}`,
        },
      ]),
    },
  })),
];

const eslintConfig = defineConfig([
  ...next,
  ...vitest,
  ...playwright,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'eslint.config.mjs',
            'postcss.config.mjs',
            'vitest.config.ts',
            'src/styles/tokens/build-tokens.mjs',
          ],
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
      'no-restricted-imports': ['error', { paths: [sentryImportPath] }],
    },
  },

  {
    files: [
      'src/observability/sentry/**/*.{ts,tsx}',
      'src/instrumentation.ts',
      'src/instrumentation-client.ts',
      'next.config.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  {
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**/*.{ts,tsx}', 'src/test-setup.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: [
      'playwright.config.ts',
      'playwright.fullstack.config.ts',
      'playwright.storybook.config.ts',
      'e2e/**/*.ts',
      'tests/e2e/**/*.ts',
    ],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.e2e.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: [
      '.storybook/**/*.{ts,tsx}',
      'src/**/*.stories.{ts,tsx}',
      'src/**/__stories__/**/*.{ts,tsx}',
    ],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: './tsconfig.storybook.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Screen layer sensors, tests included. Blocks that redefine no-restricted-imports replace the
  // global options, so each one repeats the Sentry path.
  {
    files: ['src/screens/**/*.{ts,tsx}'],
    rules: {
      ...jsxA11yRecommended,
      'no-empty': 'error',
      'no-restricted-imports': [
        'error',
        { paths: [sentryImportPath], patterns: [screensFeatureEntryPattern] },
      ],
    },
  },
  ...screensRelativeDepthBlocks,

  // Raw style values: screens without tests, plus the token sample stories.
  {
    files: ['src/screens/**/*.{ts,tsx}', 'src/styles/tokens/**/*.stories.tsx'],
    ignores: ['src/screens/**/__tests__/**', 'src/screens/**/*.{test,spec}.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...rawValuePatterns],
    },
  },
  ...screensModelBlocks,

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
    // Playwright runtime artifacts are regenerated locally/CI.
    'playwright-report/**',
    'test-results/**',
    // Storybook static build output is generated locally/CI.
    'storybook-static/**',
  ]),
]);

export default eslintConfig;
