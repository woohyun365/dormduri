import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint, type Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

const webRoot = fileURLToPath(new URL('../../..', import.meta.url));
const tokensReadme = 'apps/web/src/styles/tokens/README.md';

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

async function severityOf(filePath: string, ruleId: string) {
  const config = await eslint.calculateConfigForFile(path.join(webRoot, filePath));
  const entry = config.rules?.[ruleId];
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
  'hover:bg-brand-solid text-fg-inverted',
  'text-body text-display-1 font-body font-display font-bold',
  'max-w-page lg:max-w-reading',
  'rounded-card rounded-t-sheet',
  'px-gutter py-section lg:py-section-desktop',
  'min-h-target-min size-target-primary',
  'ease-standard transition-colors',
  'focus-visible:focus-ring',
  'break-keep wrap-anywhere text-balance text-pretty',
];

describe('screens raw value rules', { timeout: 60_000 }, () => {
  it('enables no type-aware rule, so untyped fixtures exercise the full rule set', async () => {
    const config = await eslint.calculateConfigForFile(
      path.join(webRoot, 'src/screens/landing/LandingScreen.tsx'),
    );
    const typeAware = Object.entries(config.rules ?? {}).filter(([ruleId, entry]) => {
      const severity = Array.isArray(entry) ? entry[0] : entry;
      if (severity === 0 || severity === 'off') return false;
      const slash = ruleId.lastIndexOf('/');
      const plugin = slash === -1 ? undefined : config.plugins?.[ruleId.slice(0, slash)];
      const rule = plugin?.rules?.[ruleId.slice(slash + 1)] as
        { meta?: { docs?: { requiresTypeChecking?: boolean } } } | undefined;
      return rule?.meta?.docs?.requiresTypeChecking === true;
    });

    expect(typeAware).toEqual([]);
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
});
