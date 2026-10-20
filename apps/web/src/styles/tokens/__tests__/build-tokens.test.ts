import { readFileSync } from 'node:fs';
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
        '    --duration-fast: 0ms;',
        '    --duration-normal: 0ms;',
        '    --duration-slow: 0ms;',
        '  }',
        '}',
      ].join('\n'),
    );
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
  const tokens = loadTokens(tokensDir);
  const layers = ['layer-basement', 'layer-default', 'layer-floating'];
  const statuses = ['critical', 'warning', 'positive', 'informative'];
  const pairs: Array<[string, string, number]> = [
    ...['fg-neutral', 'fg-muted', 'fg-subtle', 'fg-brand'].flatMap((fg) =>
      layers.map((layer): [string, string, number] => [fg, layer, 4.5]),
    ),
    ...['brand-solid', ...statuses.map((status) => `${status}-solid`)].map(
      (solid): [string, string, number] => ['fg-inverted', solid, 4.5],
    ),
    ...statuses.flatMap((status): Array<[string, string, number]> => [
      [`fg-${status}`, `${status}-weak`, 4.5],
      [`fg-${status}`, 'layer-default', 4.5],
    ]),
    ...layers.map((layer): [string, string, number] => ['stroke-focus', layer, 3]),
    ...['stroke-neutral', 'brand-solid'].flatMap((stroke) =>
      ['layer-default', 'layer-basement'].map((layer): [string, string, number] => [
        stroke,
        layer,
        3,
      ]),
    ),
  ];

  it('covers every pair the plan defines', () => {
    expect(pairs).toHaveLength(32);
  });

  it('computes the WCAG contrast ratio', () => {
    const black = srgb('#000000', [0, 0, 0]).$value as ColorValue;
    const white = srgb('#ffffff', [1, 1, 1]).$value as ColorValue;
    const gray = srgb('#767676', [118 / 255, 118 / 255, 118 / 255]).$value as ColorValue;

    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBe(1);
    expect(contrastRatio(gray, white)).toBeCloseTo(4.54, 2);
  });

  it.each(pairs)('%s on %s reaches %d:1', (foreground, background, minimum) => {
    expect(
      contrastRatio(colorOf(tokens, foreground), colorOf(tokens, background)),
    ).toBeGreaterThanOrEqual(minimum);
  });

  it('keeps every color opaque', () => {
    const colors = [...tokens.values()].filter((token) => token.type === 'color');

    expect(colors.length).toBeGreaterThan(0);
    expect(colors.every((token) => (token.value as ColorValue).alpha === 1)).toBe(true);
  });
});
