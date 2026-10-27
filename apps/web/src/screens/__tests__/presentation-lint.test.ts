import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint, type Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

const webRoot = fileURLToPath(new URL('../../..', import.meta.url));
const tokensReadme = 'apps/web/src/styles/tokens/README.md';
const screensReadme = 'apps/web/src/screens/README.md';

// Fixture paths do not exist on disk, so the TypeScript projects cannot parse them. Every enabled
// rule is syntactic (asserted below), so linting without type information keeps the rule set.
const untypedParse: Linter.Config = {
  files: ['**/*.{ts,tsx}'],
  languageOptions: { parserOptions: { projectService: false, project: null } },
};
const eslint = new ESLint({ cwd: webRoot });
const fixtureLinter = new ESLint({ cwd: webRoot, overrideConfig: [untypedParse] });

async function lint(filePath: string, lines: string[]) {
  const [result] = await fixtureLinter.lintText(`${lines.join('\n')}\n`, {
    filePath: path.join(webRoot, filePath),
  });
  if (!result) throw new Error(`no lint result for ${filePath}`);
  return result.messages;
}

function errorLines(messages: Linter.LintMessage[], ruleId: string) {
  return messages
    .filter((message) => message.ruleId === ruleId && message.severity === 2)
    .map((message) => message.line);
}

// no-restricted-imports reports each matching path and pattern, so one import can report twice.
function importErrorLines(messages: Linter.LintMessage[]) {
  return [...new Set(errorLines(messages, 'no-restricted-imports'))];
}

async function ruleEntry(filePath: string, ruleId: string) {
  const config = await eslint.calculateConfigForFile(path.join(webRoot, filePath));
  return config.rules?.[ruleId];
}

async function severityOf(filePath: string, ruleId: string) {
  const entry = await ruleEntry(filePath, ruleId);
  return Array.isArray(entry) ? entry[0] : entry;
}

// Each class is written as a JSX attribute, a plain string and a template literal chunk.
function classFixture(classNames: string[]) {
  return [
    'const suffix = String(Date.now());',
    ...classNames.flatMap((className) => [
      `export const Jsx${classNames.indexOf(className)} = () => <div className="${className}" />;`,
      `export const plain${classNames.indexOf(className)} = 'flex ${className}';`,
      `export const template${classNames.indexOf(className)} = \`${className} \${suffix}\`;`,
    ]),
  ];
}

const forbiddenClasses: Array<[string, string]> = [
  ['(1) default palette', 'bg-slate-100'],
  ['(1) default palette with variant and opacity', 'hover:text-blue-600/80'],
  ['(1) palette added in Tailwind 4.2', 'border-mauve-200'],
  ['(1) black', 'text-black'],
  ['(1) white', 'bg-white'],
  ['(2) default font size', 'text-sm'],
  ['(2) default font size with variant', 'md:text-2xl'],
  ['(3) bare radius', 'rounded'],
  ['(3) default radius', 'rounded-lg'],
  ['(3) default radius with side', 'rounded-t-xl'],
  ['(4) bare shadow', 'shadow'],
  ['(4) default shadow', 'shadow-md'],
  ['(4) inner shadow', 'shadow-inner'],
  ['(4) inset shadow', 'inset-shadow-sm'],
  ['(4) drop shadow', 'drop-shadow-lg'],
  ['(4) text shadow', 'text-shadow-xs'],
  ['(5) arbitrary value', 'w-[13px]'],
  ['(5) arbitrary property', '[mask-type:luminance]'],
  ['(6) variable shorthand', 'bg-(--knu-primary)'],
  ['(8) existing theme color', 'bg-primary'],
  ['(8) existing theme foreground', 'text-muted-foreground'],
  ['(8) existing theme border', 'border-border'],
  ['(8) existing theme ring', 'focus-visible:ring-ring'],
  ['(9) sans family', 'font-sans'],
  ['(9) serif family', 'font-serif'],
  ['(9) mono family', 'font-mono'],
  ['(10) default container width', 'max-w-3xl'],
  ['(10) default container on w', 'w-md'],
  ['(10) default container on basis', 'basis-xs'],
  ['(11) default leading', 'leading-tight'],
  ['(11) named line-height modifier', 'text-body/tight'],
  ['(11) default easing', 'ease-in-out'],
];

const forbiddenColors: Array<[string, string]> = [
  ['(7) hex', '#1e40af'],
  ['(7) short hex', '#fff'],
  ['(7) rgb', 'rgb(0 0 0)'],
  ['(7) rgba', 'rgba(0, 0, 0, 0.1)'],
  ['(7) hsl', 'hsl(0 0% 0%)'],
  ['(7) hsla', 'hsla(0, 0%, 0%, 0.5)'],
  ['(7) oklch', 'oklch(0.5 0.1 200)'],
  ['(7) oklab', 'oklab(0.5 0.1 0.1)'],
  ['(7) lab', 'lab(50% 40 59)'],
  ['(7) lch', 'lch(50% 40 59)'],
  ['(7) hwb', 'hwb(0 0% 0%)'],
  ['(7) color()', 'color(srgb 1 0 0)'],
];

const allowedClasses = [
  'rounded-full',
  'rounded-none',
  'rounded-t-none',
  'bg-transparent',
  'bg-current',
  'shadow-none',
  'p-4 gap-0.5 -mt-2',
  'inline-flex whitespace-nowrap',
  'bg-layer-basement text-fg-neutral border-stroke-subtle',
  'hover:bg-brand-solid text-fg-on-brand',
  'text-body text-display-1 font-body font-bold',
  'max-w-page lg:max-w-reading',
  'rounded-panel rounded-t-sheet',
  'px-gutter py-section lg:py-section-desktop',
  'min-h-target-min size-target-primary',
  'ease-standard transition-colors',
  'focus-visible:focus-ring',
  'break-keep wrap-anywhere text-balance text-pretty',
];

describe('screens raw value rules', { timeout: 60_000 }, () => {
  it('enables no type-aware rule, so untyped fixtures exercise the full rule set', async () => {
    for (const file of [
      'src/screens/landing/LandingScreen.tsx',
      'src/screens/landing/model/rules.ts',
    ]) {
      const config = await eslint.calculateConfigForFile(path.join(webRoot, file));
      const typeAware = Object.entries(config.rules ?? {}).filter(([ruleId, entry]) => {
        const severity = Array.isArray(entry) ? entry[0] : entry;
        if (severity === 0 || severity === 'off') return false;
        const slash = ruleId.lastIndexOf('/');
        const plugin = slash === -1 ? undefined : config.plugins?.[ruleId.slice(0, slash)];
        const rule = plugin?.rules?.[ruleId.slice(slash + 1)] as
          { meta?: { docs?: { requiresTypeChecking?: boolean } } } | undefined;
        return rule?.meta?.docs?.requiresTypeChecking === true;
      });

      expect([file, typeAware]).toEqual([file, []]);
    }
  });

  it.each(forbiddenClasses)(
    'rejects %s (%s) in JSX, strings and templates',
    async (_, className) => {
      const messages = await lint(
        'src/screens/__fixtures__/RawValue.tsx',
        classFixture([className]),
      );

      expect(errorLines(messages, 'no-restricted-syntax')).toEqual([2, 3, 4]);
      expect(
        messages.find((message) => message.ruleId === 'no-restricted-syntax')?.message,
      ).toContain(tokensReadme);
    },
  );

  it.each(forbiddenColors)('rejects %s color %s', async (_, color) => {
    const messages = await lint('src/screens/__fixtures__/RawColor.tsx', [
      `export const Inline = () => <div style={{ color: '${color}' }} />;`,
      `export const shadowValue = \`0 1px 2px ${color}\`;`,
    ]);

    expect(errorLines(messages, 'no-restricted-syntax')).toEqual([1, 2]);
  });

  it('allows token utilities, static utilities and spacing multiples', async () => {
    const messages = await lint('src/screens/__fixtures__/Allowed.tsx', [
      ...classFixture(allowedClasses),
      "export const anchor = '#main';",
      "export const copy = '흰 배경 위 그림자 없는 카드';",
    ]);

    expect(messages.filter((message) => message.ruleId === 'no-restricted-syntax')).toEqual([]);
  });

  it('applies the raw value rules to token stories and not to tests or other features', async () => {
    const rule = 'no-restricted-syntax';

    expect(await severityOf('src/styles/tokens/__stories__/Tokens.stories.tsx', rule)).toBe(2);
    expect(await severityOf('src/screens/landing/LandingScreen.tsx', rule)).toBe(2);
    expect(await severityOf('src/screens/landing/__tests__/LandingScreen.test.tsx', rule)).toBe(
      undefined,
    );
    expect(await severityOf('src/screens/landing/LandingScreen.test.tsx', rule)).toBe(undefined);
    expect(await severityOf('src/main/MainPage.tsx', rule)).toBe(undefined);
  });

  it('keeps CSS files out of the screens tree', () => {
    const screensDir = path.join(webRoot, 'src/screens');
    const cssFiles = readdirSync(screensDir, { recursive: true, encoding: 'utf8' }).filter((file) =>
      file.endsWith('.css'),
    );

    expect(cssFiles).toEqual([]);
  });
});

describe('screens sensor rules', { timeout: 60_000 }, () => {
  it('allows public entries and ui imports but rejects feature internals', async () => {
    const messages = await lint('src/screens/landing/LandingScreen.tsx', [
      "import { Button } from '@/screens/ui/Button';",
      "import { ProfileScreen } from '@/screens/profile';",
      "import { ProfileCard } from '@/screens/profile/components/ProfileCard';",
      "import { landingModel } from './model/landing';",
      "import { profileModel } from '../profile/model/profile';",
      "import * as Sentry from '@sentry/nextjs';",
      'export const used = [Button, ProfileScreen, ProfileCard, landingModel, profileModel, Sentry];',
    ]);

    expect(errorLines(messages, 'no-restricted-imports')).toEqual([3, 5, 6]);
  });

  it('rejects relative imports that leave the feature root at each depth', async () => {
    const depthOne = await lint('src/screens/landing/components/Hero.tsx', [
      "import { heroModel } from '../model/hero';",
      "import { profileModel } from '../../profile/model/profile';",
      "import { MainPage } from '../../../main/MainPage';",
      "import * as Sentry from '@sentry/nextjs';",
      'export const used = [heroModel, profileModel, MainPage, Sentry];',
    ]);
    const depthTwo = await lint('src/screens/landing/desktop/components/Nav.tsx', [
      "import { navModel } from '../../model/nav';",
      "import { Button } from '../../../ui/Button';",
      "import { ProfileCard } from '@/screens/profile/components/ProfileCard';",
      'export const used = [navModel, Button, ProfileCard];',
    ]);

    expect(errorLines(depthOne, 'no-restricted-imports')).toEqual([2, 3, 4]);
    expect(errorLines(depthTwo, 'no-restricted-imports')).toEqual([2, 3]);
  });

  it('reports jsx-a11y recommended rules and empty blocks as errors, tests included', async () => {
    const config = await eslint.calculateConfigForFile(
      path.join(webRoot, 'src/screens/landing/LandingScreen.tsx'),
    );
    const plugin = config.plugins?.['jsx-a11y'] as
      { configs: { recommended: { rules: Record<string, Linter.RuleEntry> } } } | undefined;
    const recommended = Object.entries(plugin?.configs.recommended.rules ?? {})
      .filter(([, entry]) => (Array.isArray(entry) ? entry[0] : entry) !== 'off')
      .map(([ruleId]) => ruleId);

    expect(recommended.length).toBeGreaterThan(0);
    for (const file of [
      'src/screens/landing/LandingScreen.tsx',
      'src/screens/landing/__tests__/LandingScreen.test.tsx',
    ]) {
      for (const ruleId of [...recommended, 'no-empty']) {
        expect([file, ruleId, await severityOf(file, ruleId)]).toEqual([file, ruleId, 2]);
      }
    }
    expect(await severityOf('src/main/MainPage.tsx', 'jsx-a11y/alt-text')).toBe(1);

    const messages = await lint('src/screens/landing/__tests__/LandingScreen.test.tsx', [
      "export const raw = 'bg-slate-100';",
      'export const Image = () => <img src="/a.png" />;',
      'try { void raw; } catch {}',
    ]);

    expect(errorLines(messages, 'no-restricted-syntax')).toEqual([]);
    expect(errorLines(messages, 'jsx-a11y/alt-text')).toEqual([2]);
    expect(errorLines(messages, 'no-empty')).toEqual([3]);
  });

  it('keeps the recommended options instead of options inherited from eslint-config-next', async () => {
    const file = 'src/screens/landing/LandingScreen.tsx';
    const config = await eslint.calculateConfigForFile(path.join(webRoot, file));
    const plugin = config.plugins?.['jsx-a11y'] as
      { configs: { recommended: { rules: Record<string, Linter.RuleEntry> } } } | undefined;
    const recommended = Object.entries(plugin?.configs.recommended.rules ?? {}).filter(
      ([, entry]) => (Array.isArray(entry) ? entry[0] : entry) !== 'off',
    );
    const altText = { elements: ['img', 'object', 'area', 'input[type="image"]'], img: ['Image'] };

    for (const [ruleId, entry] of recommended) {
      const expected =
        ruleId === 'jsx-a11y/alt-text' ? [altText] : Array.isArray(entry) ? entry.slice(1) : [];
      const actual = await ruleEntry(file, ruleId);
      expect([ruleId, Array.isArray(actual) ? actual.slice(1) : []]).toEqual([ruleId, expected]);
    }

    const messages = await lint('src/screens/__fixtures__/Media.tsx', [
      "import Image from 'next/image';",
      'export const ImageInput = () => <input type="image" src="/a.png" />;',
      'export const Area = () => <area href="/a" />;',
      'export const Embed = () => <object data="/a.svg" />;',
      'export const Picture = () => <Image src="/a.png" width={1} height={1} />;',
    ]);

    expect(errorLines(messages, 'jsx-a11y/alt-text')).toEqual([2, 3, 4, 5]);
  });
});

// Renderer-neutral model (src/screens/*/model/**, tests excluded). Each forbidden case is one line
// that the rule under test must report.
const modelFile = 'src/screens/landing/model/Case.ts';
const modelRuleIds = ['no-restricted-imports', 'no-restricted-globals', 'no-restricted-syntax'];

function modelRuleErrors(messages: Linter.LintMessage[]) {
  return messages.filter(
    (message) => modelRuleIds.includes(message.ruleId ?? '') && message.severity === 2,
  );
}

const forbiddenModelImports: Array<[string, string]> = [
  // One value import per family.
  ['next', "import next from 'next';"],
  ['a next subpath', "import { useRouter } from 'next/navigation';"],
  ['react', "import { useState } from 'react';"],
  ['react-dom', "import { createPortal } from 'react-dom';"],
  ['react-native', "import { Platform } from 'react-native';"],
  ['expo', "import { router } from 'expo-router';"],
  ['a node: builtin', "import { readFileSync } from 'node:fs';"],
  ['a bare node builtin', "import { readFileSync } from 'fs';"],
  ['the Web alias to a feature entry', "import { ProfileScreen } from '@/screens/profile';"],
  ['the Web alias outside screens', "import { mainRoutes } from '@/main/model/mainRoutes';"],
  ['a package outside the allowlist', "import { format } from 'date-fns';"],
  // One representative family per import syntax.
  ['a type-only import', "import type { FC } from 'react';"],
  ['an inline type specifier', "import { type FC } from 'react';"],
  ['a re-export', "export { useState } from 'react';"],
  ['export *', "export * from 'react';"],
  ['import = require', "import React = require('react');"],
];

const forbiddenModelSyntax: Array<[string, string, string]> = [
  ['a dynamic import', modelFile, "export const load = () => import('react');"],
  ['a dynamic import of a model file', modelFile, "export const load = () => import('./rules');"],
  ['an import type expression', modelFile, "export type Component = import('react').FC;"],
  ['a require call', modelFile, "export const react: unknown = require('react');"],
  ['a JSX element', 'src/screens/landing/model/Case.tsx', 'export const view = <div />;'],
  ['a JSX fragment', 'src/screens/landing/model/Case.tsx', 'export const view = <></>;'],
];

const forbiddenModelGlobals: Array<[string, string]> = [
  ['window', 'export const width = () => window.innerWidth;'],
  ['document', 'export const title = () => document.title;'],
  ['navigator', 'export const language = () => navigator.language;'],
  ['location', 'export const pathname = () => location.pathname;'],
  ['history', 'export const back = () => history.back();'],
  ['localStorage', "export const saved = () => localStorage.getItem('draft');"],
  ['sessionStorage', "export const draft = () => sessionStorage.getItem('draft');"],
  ['indexedDB', "export const open = () => indexedDB.open('cache');"],
  ['globalThis', 'export const host = () => globalThis.window;'],
  ['self', 'export const origin = () => self.origin;'],
  ['process.env', 'export const mode = () => process.env.NODE_ENV;'],
];

describe('screens model renderer-neutral rules', { timeout: 60_000 }, () => {
  it.each(forbiddenModelImports)('rejects %s', async (_, source) => {
    const messages = await lint(modelFile, [source]);

    expect(importErrorLines(messages)).toEqual([1]);
    expect(
      messages.find((message) => message.ruleId === 'no-restricted-imports')?.message,
    ).toContain(screensReadme);
  });

  it.each([0, 1, 2, 3, 4])(
    'rejects relative imports that leave model/ at model depth %i',
    async (depth) => {
      const messages = await lint(`src/screens/landing/model/${'sub/'.repeat(depth)}Case.ts`, [
        `import { inside } from '${depth === 0 ? './' : '../'.repeat(depth)}inside';`,
        `import { outside } from '${'../'.repeat(depth + 1)}components/outside';`,
      ]);

      expect(importErrorLines(messages)).toEqual([2]);
    },
  );

  it.each([0, 1, 2, 3, 4])(
    'rejects a trailing .. that leaves model/ at model depth %i',
    async (depth) => {
      const messages = await lint(`src/screens/landing/model/${'sub/'.repeat(depth)}Case.ts`, [
        `import { inside } from '${depth === 0 ? './' : '../'.repeat(depth)}index';`,
        `import { LandingScreen } from '${depth === 0 ? './' : '../'.repeat(depth)}..';`,
      ]);

      expect(importErrorLines(messages)).toEqual([2]);
    },
  );

  it.each(forbiddenModelSyntax)('rejects %s', async (_, file, source) => {
    const messages = await lint(file, [source]);

    expect(errorLines(messages, 'no-restricted-syntax')).toEqual([1]);
    expect(
      messages.find((message) => message.ruleId === 'no-restricted-syntax')?.message,
    ).toContain(screensReadme);
  });

  it.each(forbiddenModelGlobals)('rejects the %s global', async (_, source) => {
    const messages = await lint(modelFile, [source]);

    expect(errorLines(messages, 'no-restricted-globals')).toEqual([1]);
    expect(
      messages.find((message) => message.ruleId === 'no-restricted-globals')?.message,
    ).toContain(screensReadme);
  });

  it('keeps the allowlist, globals and syntax rules below the last depth block', async () => {
    const messages = await lint('src/screens/landing/model/a/b/c/d/e/Case.ts', [
      "import { useState } from 'react';",
      'export const width = () => window.innerWidth;',
      "export const load = () => import('./rules');",
    ]);

    expect(importErrorLines(messages)).toEqual([1]);
    expect(errorLines(messages, 'no-restricted-globals')).toEqual([2]);
    expect(errorLines(messages, 'no-restricted-syntax')).toEqual([3]);
  });

  it('allows model-relative paths, @repo/shared subpaths, zod and local names', async () => {
    const root = await lint(modelFile, [
      "import { z } from 'zod';",
      "import type { CollegeCode } from '@repo/shared/college';",
      "import { isoDateSchema } from '@repo/shared/date';",
      "import { rules } from './rules';",
      "import type { RuleSet } from './rules/types';",
      'export const titleOf = (document: { title: string }) => document.title;',
      "export const query = new URLSearchParams('page=1');",
      'export const used = [z, isoDateSchema, rules] as const;',
      'export type Used = [CollegeCode, RuleSet];',
    ]);
    const nested = await lint('src/screens/landing/model/rules/Case.ts', [
      "import { base } from '../base';",
      "import { local } from './local';",
      'export const used = [base, local];',
    ]);

    expect(modelRuleErrors(root)).toEqual([]);
    expect(modelRuleErrors(nested)).toEqual([]);
  });

  it('leaves files outside model/ and model tests to the screens rules', async () => {
    for (const file of [
      'src/screens/landing/LandingScreen.tsx',
      'src/screens/landing/components/Hero.tsx',
      'src/screens/landing/model/__tests__/rules.test.ts',
      'src/screens/landing/model/rules.test.ts',
    ]) {
      const messages = await lint(file, [
        "import { useState } from 'react';",
        "import { describe } from 'vitest';",
        'export const width = () => window.innerWidth;',
        "export const load = () => import('next/navigation');",
        'export const used = [useState, describe];',
      ]);

      expect([file, modelRuleErrors(messages)]).toEqual([file, []]);
    }
  });

  it('keeps the Sentry path, the feature entry pattern and the raw value rules', async () => {
    const model = 'src/screens/landing/model/rules.ts';
    const [, modelImports] = (await ruleEntry(model, 'no-restricted-imports')) as [
      unknown,
      { paths: unknown[]; patterns: unknown[] },
    ];
    const [, featureImports] = (await ruleEntry(
      'src/screens/landing/components/Hero.tsx',
      'no-restricted-imports',
    )) as [unknown, { paths: unknown[]; patterns: unknown[] }];
    const modelSyntax = (await ruleEntry(model, 'no-restricted-syntax')) as unknown[];
    const screenSyntax = (await ruleEntry(
      'src/screens/landing/LandingScreen.tsx',
      'no-restricted-syntax',
    )) as unknown[];

    expect(modelImports.paths).toEqual(featureImports.paths);
    expect(modelImports.patterns).toContainEqual(featureImports.patterns[0]);
    expect(modelSyntax.slice(1)).toEqual(expect.arrayContaining(screenSyntax.slice(1)));

    const messages = await lint(modelFile, [
      "import * as Sentry from '@sentry/nextjs';",
      "import { ProfileCard } from '@/screens/profile/components/ProfileCard';",
      "export const card = 'flex bg-slate-100';",
    ]);
    const importMessages = messages
      .filter((message) => message.ruleId === 'no-restricted-imports')
      .map((message) => [message.line, message.message]);

    expect(importMessages).toEqual(
      expect.arrayContaining([
        [1, expect.stringContaining('Sentry SDK')],
        [2, expect.stringContaining('공개 entry')],
      ]),
    );
    expect(errorLines(messages, 'no-restricted-syntax')).toEqual([3]);
  });
});
