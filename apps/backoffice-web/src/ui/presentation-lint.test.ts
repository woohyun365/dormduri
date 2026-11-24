import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint, type Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

// The token-only rule (design guide ①) and the server action ban (README §1) share one `no-restricted-syntax` list,
// because a later config block's options replace an earlier block's. These tests lint fixtures through the app's
// ESLint config and read its effective config, so dropping either half of the list fails here.
const appRoot = fileURLToPath(new URL('../..', import.meta.url));
const designGuide = 'apps/backoffice-web/src/ui/README.md';
const appReadme = 'apps/backoffice-web/README.md';
const serverActionSelector = "ExpressionStatement[directive='use server']";

// Fixture paths do not exist on disk, so the TypeScript projects cannot parse them. No enabled rule needs type
// information (asserted below), so linting without it keeps the rule set.
const untypedParse: Linter.Config = {
  files: ['**/*.{ts,tsx}'],
  languageOptions: { parserOptions: { projectService: false, project: null } },
};
const eslint = new ESLint({ cwd: appRoot });
const fixtureLinter = new ESLint({ cwd: appRoot, overrideConfig: [untypedParse] });

async function lint(filePath: string, lines: readonly string[]) {
  const [result] = await fixtureLinter.lintText(`${lines.join('\n')}\n`, {
    filePath: path.join(appRoot, filePath),
  });
  if (!result) throw new Error(`no lint result for ${filePath}`);
  return result.messages.filter(
    (message) => message.ruleId === 'no-restricted-syntax' && message.severity === 2,
  );
}

// Each class is written as a JSX attribute, a plain string and a template literal chunk.
function classFixture(classNames: readonly string[]) {
  return [
    'const suffix = String(Date.now());',
    ...classNames.flatMap((className, index) => [
      `export const Jsx${index} = () => <div className="${className}" />;`,
      `export const plain${index} = 'flex ${className}';`,
      `export const template${index} = \`${className} \${suffix}\`;`,
    ]),
  ];
}

const forbiddenClasses: ReadonlyArray<readonly [string, string]> = [
  ['default palette', 'bg-slate-100'],
  ['default palette with variant and opacity', 'hover:text-emerald-800/80'],
  ['white', 'bg-white'],
  ['black', 'text-black'],
  ['default font size', 'text-sm'],
  ['default font size with variant', 'md:text-xl'],
  ['bare radius', 'rounded'],
  ['default radius', 'rounded-md'],
  ['default radius with side', 'rounded-t-lg'],
  ['bare shadow', 'shadow'],
  ['default shadow', 'shadow-sm'],
  ['arbitrary value', 'w-[13px]'],
  ['arbitrary property', '[mask-type:luminance]'],
  ['variable shorthand', 'bg-(--color-slate-50)'],
  ['theme color name', 'bg-primary'],
  ['font family', 'font-mono'],
  ['container width', 'max-w-md'],
  ['named line height', 'leading-tight'],
  ['named easing', 'ease-in-out'],
];

const allowedClasses = [
  'bg-layer-basement text-fg-neutral border-stroke-subtle',
  'hover:bg-brand-solid-hover text-fg-on-brand disabled:bg-brand-solid-disabled',
  'bg-success-weak text-fg-success bg-warning-weak text-fg-warning bg-danger-weak text-fg-danger',
  'text-caption text-body text-title-1 font-semibold font-code',
  'rounded-control rounded-box rounded-card rounded-full rounded-none',
  'max-w-page max-w-narrow grid-cols-label-value aria-current-page:font-semibold',
  'p-4 gap-2 -mt-1 divide-y divide-stroke-row',
];

describe('backoffice presentation lint', { timeout: 60_000 }, () => {
  it('enables no type-aware rule, so untyped fixtures exercise the full rule set', async () => {
    for (const file of [
      'src/screens/login/LoginScreen.tsx',
      'src/screens/login/LoginScreen.test.tsx',
    ]) {
      const config = await eslint.calculateConfigForFile(path.join(appRoot, file));
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

      expect(messages.map((message) => message.line)).toEqual([2, 3, 4]);
      expect(messages[0]?.message).toContain(designGuide);
    },
  );

  it('rejects raw color values', async () => {
    const messages = await lint('src/screens/__fixtures__/RawColor.tsx', [
      "export const Inline = () => <div style={{ color: '#fff' }} />;",
      'export const shadowValue = `0 1px 2px rgb(0 0 0)`;',
    ]);

    expect(messages.map((message) => message.line)).toEqual([1, 2]);
  });

  it('allows the token utilities, Tailwind spacing and plain text', async () => {
    const messages = await lint('src/screens/__fixtures__/Allowed.tsx', [
      ...classFixture(allowedClasses),
      "export const anchor = '#main';",
      "export const copy = '흰 바탕 위 그림자 없는 카드';",
    ]);

    expect(messages).toEqual([]);
  });

  it('keeps the server action ban in the app code, the stories and the tests', async () => {
    for (const file of [
      'src/screens/__fixtures__/action.ts',
      'src/ui/__stories__/action.stories.tsx',
      'src/screens/__fixtures__/action.test.ts',
    ]) {
      const messages = await lint(file, ["'use server';", 'export const value = 1;']);

      expect([file, messages.map((message) => message.line)]).toEqual([file, [1]]);
      expect(messages[0]?.message).toContain(appReadme);
    }
  });

  it('applies the token rule to the app code and the stories, not to the tests', async () => {
    const palette = ['export const Row = () => <div className="bg-slate-100" />;'];

    expect(await lint('.storybook/fixture-preview.tsx', palette)).toHaveLength(1);
    expect(await lint('src/ui/__stories__/Fixture.stories.tsx', palette)).toHaveLength(1);
    expect(await lint('src/screens/__fixtures__/Row.test.tsx', palette)).toEqual([]);
    expect(await lint('src/test/fixture.tsx', palette)).toEqual([]);
  });

  it('lists the server action selector in the effective rule of the app code', async () => {
    for (const file of ['src/screens/login/LoginScreen.tsx', 'src/app/layout.tsx']) {
      const config = await eslint.calculateConfigForFile(path.join(appRoot, file));
      const entry = config.rules?.['no-restricted-syntax'];
      const selectors = (Array.isArray(entry) ? entry.slice(1) : []).map((option) =>
        typeof option === 'object' && option !== null && 'selector' in option
          ? String(option.selector)
          : String(option),
      );

      expect([file, selectors.filter((selector) => selector === serverActionSelector)]).toEqual([
        file,
        [serverActionSelector],
      ]);
      expect(selectors.length).toBeGreaterThan(1);
    }
  });
});
