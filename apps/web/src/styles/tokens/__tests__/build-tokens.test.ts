import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildTokenCss,
  collectResolverSources,
  contrastRatio,
  GENERATED_CSS_FILE,
  loadTokens,
  resolveTokenSources,
  type ColorValue,
} from '../build-tokens.mjs';

const tokensDir = fileURLToPath(new URL('..', import.meta.url));

function srgb(hex: string, components: number[], alpha = 1) {
  return { $type: 'color', $value: { colorSpace: 'srgb', components, alpha, hex } };
}

function colorOf(tokens: ReturnType<typeof loadTokens>, name: string): ColorValue {
  const token = tokens.get(`color.${name}`);
  if (!token || token.type !== 'color') throw new Error(`missing color token ${name}`);
  return token.value as ColorValue;
}

describe('token source and generated CSS', () => {
  it('keeps the committed CSS equal to a fresh build of the token source', () => {
    const committed = readFileSync(path.join(tokensDir, GENERATED_CSS_FILE), 'utf8');

    expect(committed).toBe(buildTokenCss(tokensDir));
  });

  it('exports semantic and component tokens without primitives', () => {
    const css = buildTokenCss(tokensDir);

    expect(css).not.toContain('--primitive');
    expect(css).toMatch(/@theme \{\n[^}]*--color-layer-basement: #[0-9a-f]{6};/);
    expect(css).toMatch(/@theme \{\n[^}]*--text-body: 1rem;\n {2}--text-body--line-height: 1\.6;/);
    expect(css).toMatch(/@theme inline \{\n[^}]*--font-body: var\(--font-noto-sans-kr\), /);
    expect(css).toMatch(/:root \{\n[^}]*--focus-ring-width: 2px;/);
  });

  it('emits the reduced motion context as a prefers-reduced-motion override', () => {
    const css = buildTokenCss(tokensDir);

    expect(css).toContain(
      [
        '@media (prefers-reduced-motion: reduce) {',
        '  :root {',
        '    --duration-slow: 0ms;',
        '    --duration-reveal: 0ms;',
        '    --duration-band: 0ms;',
        '    --duration-stagger: 0ms;',
        '    --duration-settle: 0ms;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('emits the light and dark palette contexts as data-palette overrides', () => {
    const css = buildTokenCss(tokensDir);

    expect([...css.matchAll(/^\[data-palette='([\w-]+)'\] \{/gm)].map((match) => match[1])).toEqual(
      ['dark', 'light'],
    );
    expect(css).toMatch(/\[data-palette='dark'\] \{\n[^}]*--color-layer-basement: #[0-9a-f]{6};/);
  });
});

type JsonObject = Record<string, unknown>;

function child(object: JsonObject, ...keys: string[]): JsonObject {
  return keys.reduce((node, key) => node[key] as JsonObject, object);
}

// Builds CSS from a copy of the token JSON after `edit` changes the parsed files (keyed by file name).
function buildEditedCopy(edit: (files: Record<string, JsonObject>) => void) {
  const files: Record<string, JsonObject> = {};
  for (const name of readdirSync(tokensDir).filter((file) => file.endsWith('.json'))) {
    files[name] = JSON.parse(readFileSync(path.join(tokensDir, name), 'utf8'));
  }
  edit(files);
  const dir = mkdtempSync(path.join(tmpdir(), 'knu-tokens-'));
  try {
    for (const [name, json] of Object.entries(files)) {
      writeFileSync(path.join(dir, name), JSON.stringify(json));
    }
    return buildTokenCss(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('CSS generation failures', () => {
  const vendor = (files: Record<string, JsonObject>) =>
    child(files, 'semantic.tokens.json', 'font', 'body', '$extensions', 'knu-roommate');

  const invalidEdits: Array<[string, (files: Record<string, JsonObject>) => void, RegExp]> = [
    [
      'two tokens with one CSS name',
      (files) => {
        child(files, 'component.tokens.json').color = {
          $type: 'color',
          fg: { muted: srgb('#475569', [0.2784, 0.3333, 0.4118]) },
        };
      },
      /both map to --color-fg-muted/,
    ],
    [
      'a context without a cssContexts entry',
      (files) => {
        delete child(files, 'knu.resolver.json', 'modifiers', 'motion').$extensions;
      },
      /context "reduced" needs a \{ media \} or \{ selector \} cssContexts entry/,
    ],
    [
      'a context selector that is not one data attribute value',
      (files) => {
        child(
          files,
          'knu.resolver.json',
          'modifiers',
          'palette',
          '$extensions',
          'knu-roommate',
          'cssContexts',
        ).dark = { selector: 'body > *' };
      },
      /context "dark" selector must look like \[data-name='value'\]/,
    ],
    [
      'a context condition with an unknown key',
      (files) => {
        child(
          files,
          'knu.resolver.json',
          'modifiers',
          'palette',
          '$extensions',
          'knu-roommate',
          'cssContexts',
        ).dark = [{ selector: "[data-palette='dark']" }, { supports: '(display: grid)' }];
      },
      /context "dark" needs a \{ media \} or \{ selector \} cssContexts entry/,
    ],
    [
      'a nestable condition under a media query',
      (files) => {
        child(
          files,
          'knu.resolver.json',
          'modifiers',
          'palette',
          '$extensions',
          'knu-roommate',
          'cssContexts',
        ).dark = [
          { selector: "[data-palette='dark']", media: '(min-width: 1px)', nestable: 'true' },
        ];
      },
      /context "dark" nestable condition needs a selector and no media/,
    ],
    [
      'a nestable condition that is not "true"',
      (files) => {
        child(
          files,
          'knu.resolver.json',
          'modifiers',
          'palette',
          '$extensions',
          'knu-roommate',
          'cssContexts',
        ).dark = [{ selector: "[data-palette='dark']", nestable: 'yes' }];
      },
      /context "dark" nestable must be "true"/,
    ],
    [
      'a default context selector that is not nestable',
      (files) => {
        child(
          files,
          'knu.resolver.json',
          'modifiers',
          'palette',
          '$extensions',
          'knu-roommate',
          'cssContexts',
        ).light = { selector: "[data-palette='light']" };
      },
      /default context "light" can only have nestable selectors/,
    ],
    [
      'a context that adds a token',
      (files) => {
        child(files, 'motion-reduced.tokens.json', 'duration').instant = {
          $value: { value: 0, unit: 'ms' },
        };
      },
      /adds duration\.instant/,
    ],
    [
      'a context that overrides an inline theme token',
      (files) => {
        child(files, 'motion-reduced.tokens.json').font = {
          $type: 'fontFamily',
          body: { $value: ['sans-serif'] },
        };
      },
      /cannot override inline theme token font\.body/,
    ],
    [
      'an unknown knu-roommate extension key',
      (files) => {
        vendor(files).weight = 400;
      },
      /unsupported \$extensions\["knu-roommate"\]\.weight at font\.body/,
    ],
    [
      'a cssVariables family the token does not list',
      (files) => {
        vendor(files).cssVariables = { Pretendard: '--font-pretendard' };
      },
      /cssVariables at font\.body/,
    ],
  ];

  // An auto scheme: one selector takes a third context's values, and the dark values under a media
  // query. The media block also writes the paths the plain block set, so none keeps the third value.
  it('resets under a media query the paths an earlier context set for the same selector', () => {
    const css = buildEditedCopy((files) => {
      const palette = child(files, 'knu.resolver.json', 'modifiers', 'palette');
      // The plain block comes first, so the warm context is declared before dark.
      const { light, dark } = palette.contexts as JsonObject;
      palette.contexts = { light, warm: [{ $ref: 'palette-warm.tokens.json' }], dark };
      const cssContexts = child(palette, '$extensions', 'knu-roommate', 'cssContexts');
      cssContexts.warm = { selector: "[data-palette='auto']" };
      cssContexts.dark = [
        cssContexts.dark,
        { media: '(prefers-color-scheme: dark)', selector: "[data-palette='auto']" },
      ];
      files['palette-warm.tokens.json'] = {
        color: { 'annotation-marker': { $value: '{primitive.color.ink.950}' } },
      };
    });
    const darkAuto = css.split(
      "@media (prefers-color-scheme: dark) {\n  [data-palette='auto'] {",
    )[1];

    expect(css).toMatch(/\[data-palette='auto'\] \{\n[^}]*--color-annotation-marker: #10131f;/);
    expect(darkAuto?.split('}')[0]).toContain('--color-annotation-marker: #fcd34d;');
  });

  // A light card inside the dark page and the night hero inside the light page: both selectors are
  // nestable and write every role the dark context changes, the light one with the default values.
  it('writes every palette role for the nestable light and dark selectors', () => {
    const css = buildTokenCss(tokensDir);
    const rolesIn = (selector: string) => {
      const body = css.split(`${selector} {`)[1]?.split('}')[0] ?? '';
      return [...body.matchAll(/--(color-[\w-]+):/g)].map((match) => match[1]);
    };
    const dark = rolesIn("[data-palette='dark']");

    expect(dark.length).toBeGreaterThan(0);
    expect(rolesIn("[data-palette='light']")).toEqual(dark);
    expect(css).toMatch(/\[data-palette='light'\] \{\n[^}]*--color-layer-default: #ffffff;/);
    expect(css).toMatch(/\[data-palette='light'\] \{\n[^}]*--color-fg-brand: #4353ff;/);
    expect(css).not.toMatch(/\[data-palette='light'\] \{\n[^}]*--duration-/);
  });

  it('builds an unedited copy like the source directory', () => {
    expect(buildEditedCopy(() => {})).toBe(buildTokenCss(tokensDir));
  });

  it.each(invalidEdits)('rejects %s', (_label, edit, message) => {
    expect(() => buildEditedCopy(edit)).toThrow(message);
  });
});

describe('token format validation', () => {
  const invalidSources: Array<[string, unknown, RegExp]> = [
    ['unknown $type', { a: { $type: 'shadow', $value: {} } }, /unsupported \$type "shadow"/],
    [
      'non-srgb color',
      { a: { $type: 'color', $value: { colorSpace: 'display-p3', components: [1, 0, 0] } } },
      /colorSpace "srgb"/,
    ],
    ['translucent color', { a: srgb('#ff0000', [1, 0, 0], 0.5) }, /alpha 1/],
    ['hex that disagrees with components', { a: srgb('#00ff00', [1, 0, 0]) }, /hex/],
    ['em dimension', { a: { $type: 'dimension', $value: { value: 1, unit: 'em' } } }, /unit/],
    ['seconds duration', { a: { $type: 'duration', $value: { value: 1, unit: 's' } } }, /unit/],
    ['cubicBezier x outside 0..1', { a: { $type: 'cubicBezier', $value: [0.2, 0, 1.5, 1] } }, /x/],
    ['fontWeight above 1000', { a: { $type: 'fontWeight', $value: 1200 } }, /fontWeight/],
    ['token without a type', { a: { $value: 1 } }, /no \$type/],
    ['alias to a missing token', { a: { $type: 'number', $value: '{b}' } }, /unknown token "b"/],
    ['circular alias', { a: { $value: '{b}' }, b: { $value: '{a}' } }, /circular alias/],
    [
      'alias to a group',
      { a: { $value: '{g}' }, g: { b: { $type: 'number', $value: 1 } } },
      /group/,
    ],
    ['period in a name', { 'a.b': { $type: 'number', $value: 1 } }, /name/],
    ['unsupported group property', { g: { $extends: '{h}' } }, /unsupported property "\$extends"/],
  ];

  it.each(invalidSources)('rejects %s', (_label, source, message) => {
    expect(() => resolveTokenSources([source])).toThrow(message);
  });

  it('resolves aliases across sets and group type inheritance', () => {
    const tokens = resolveTokenSources([
      { primitive: { $type: 'number', one: { $value: 1 } } },
      { scale: { base: { $value: '{primitive.one}' } } },
    ]);

    expect(tokens.get('scale.base')).toMatchObject({ type: 'number', value: 1 });
  });

  const resolver = {
    version: '2025.10',
    sets: { base: { sources: [{ $ref: 'base.json' }] } },
    modifiers: {
      motion: {
        contexts: { preferred: [], reduced: [{ $ref: 'reduced.json' }] },
        default: 'preferred',
      },
    },
    resolutionOrder: [{ $ref: '#/sets/base' }, { $ref: '#/modifiers/motion' }],
  };
  const files: Record<string, unknown> = { 'base.json': { a: 1 }, 'reduced.json': { a: 2 } };
  const readRef = (ref: string) => files[ref];

  it('orders resolver sources by resolutionOrder and the selected context', () => {
    expect(collectResolverSources(resolver, {}, readRef)).toEqual([{ a: 1 }]);
    expect(collectResolverSources(resolver, { motion: 'reduced' }, readRef)).toEqual([
      { a: 1 },
      { a: 2 },
    ]);
  });

  const invalidResolvers: Array<[string, unknown, Record<string, string>, RegExp]> = [
    ['another version', { ...resolver, version: '2024.1' }, {}, /version/],
    [
      'a modifier with one context',
      { ...resolver, modifiers: { motion: { contexts: { preferred: [] }, default: 'preferred' } } },
      {},
      /two or more contexts/,
    ],
    [
      'a default outside the contexts',
      {
        ...resolver,
        modifiers: { motion: { ...resolver.modifiers.motion, default: 'none' } },
      },
      {},
      /default/,
    ],
    ['an unknown input context', resolver, { motion: 'fast' }, /context "fast"/],
    [
      'a reference to an unknown set',
      { ...resolver, resolutionOrder: [{ $ref: '#/sets/missing' }] },
      {},
      /#\/sets\/missing/,
    ],
  ];

  it.each(invalidResolvers)('rejects a resolver with %s', (_label, document, input, message) => {
    expect(() => collectResolverSources(document, input, readRef)).toThrow(message);
  });
});

describe('contrast pairs', () => {
  // Both palette contexts must pass the same pairs; light is the default set.
  const palettes = ['light', 'dark'] as const;
  const layers = ['layer-basement', 'layer-default', 'layer-floating'];
  const pairs: Array<[string, string, number]> = [
    ...['fg-neutral', 'fg-muted', 'fg-brand'].flatMap((fg) =>
      layers.map((layer): [string, string, number] => [fg, layer, 4.5]),
    ),
    ['fg-on-brand', 'brand-solid', 4.5],
    ['fg-neutral', 'brand-weak', 4.5],
    ['fg-on-annotation', 'annotation-marker', 4.5],
    ...layers.map((layer): [string, string, number] => ['stroke-focus', layer, 3]),
    // A primary action keeps a 3:1 edge (brand-stroke) against the page in both contexts.
    ...['stroke-neutral', 'brand-stroke'].flatMap((stroke) =>
      ['layer-default', 'layer-basement'].map((layer): [string, string, number] => [
        stroke,
        layer,
        3,
      ]),
    ),
    // Inverse bands, the scrim over pictures and the capture placeholders.
    ['fg-muted', 'brand-weak', 4.5],
    ['fg-brand', 'brand-weak', 4.5],
    ['fg-on-inverse', 'layer-inverse', 4.5],
    ['fg-on-inverse-muted', 'layer-inverse', 4.5],
    ['fg-on-media', 'media-scrim', 4.5],
    ['fg-placeholder', 'placeholder-fill', 4.5],
  ];
  const cases = palettes.flatMap((palette) =>
    pairs.map(([foreground, background, minimum]): [string, string, string, number] => [
      palette,
      foreground,
      background,
      minimum,
    ]),
  );

  it('covers every pair the plan defines', () => {
    expect(pairs).toHaveLength(25);
  });

  it('computes the WCAG contrast ratio', () => {
    const black = srgb('#000000', [0, 0, 0]).$value as ColorValue;
    const white = srgb('#ffffff', [1, 1, 1]).$value as ColorValue;
    const gray = srgb('#767676', [118 / 255, 118 / 255, 118 / 255]).$value as ColorValue;

    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBe(1);
    expect(contrastRatio(gray, white)).toBeCloseTo(4.54, 2);
  });

  it.each(cases)(
    'palette %s: %s on %s reaches %d:1',
    (palette, foreground, background, minimum) => {
      const tokens = loadTokens(tokensDir, { palette });

      expect(
        contrastRatio(colorOf(tokens, foreground), colorOf(tokens, background)),
      ).toBeGreaterThanOrEqual(minimum);
    },
  );

  it.each(palettes)('keeps every color opaque in palette %s', (palette) => {
    const colors = [...loadTokens(tokensDir, { palette }).values()].filter(
      (token) => token.type === 'color',
    );

    expect(colors.length).toBeGreaterThan(0);
    expect(colors.every((token) => (token.value as ColorValue).alpha === 1)).toBe(true);
  });
});
