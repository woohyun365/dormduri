import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useLayoutEffect, useRef, useState } from 'react';

// The light and dark palette contexts side by side. Swatches and contrast ratios are read from the colors
// the browser computed for each data-palette scope, so the story repeats no literal value. The pairs
// match tokens/__tests__/build-tokens.test.ts, which is the gate. Foundations/Color shows this sample.

type Palette = 'light' | 'dark';

// The landing's palette, D ultramarine (the Owner chose it among four blue directions), in its
// light (default) and dark contexts.
const palettes: Array<{ id: Palette; name: string; note: string }> = [
  { id: 'light', name: '라이트(기본)', note: '차가운 흰 바탕, 먹색 글자, 울트라마린 버튼' },
  { id: 'dark', name: '다크', note: '남색 기운 검정 바탕, 밝은 글자, 같은 울트라마린 버튼' },
];

const roleGroups: Array<{ title: string; roles: string[] }> = [
  { title: '층', roles: ['layer-basement', 'layer-default', 'layer-floating'] },
  { title: '글자', roles: ['fg-neutral', 'fg-muted', 'fg-brand'] },
  { title: '선', roles: ['stroke-neutral', 'stroke-subtle', 'stroke-focus'] },
  { title: '주 행동', roles: ['brand-solid', 'brand-weak', 'brand-stroke', 'fg-on-brand'] },
  { title: '형광펜 표시', roles: ['annotation-marker', 'fg-on-annotation'] },
  { title: '반전 띠', roles: ['layer-inverse', 'fg-on-inverse', 'fg-on-inverse-muted'] },
  {
    title: '사진·빈 자리',
    roles: ['media-scrim', 'fg-on-media', 'placeholder-fill', 'fg-placeholder'],
  },
  { title: '창 단추', roles: ['window-close', 'window-minimize', 'window-zoom'] },
];

// Static class names per role so Tailwind generates them.
const swatchClassName: Record<string, string> = {
  'layer-basement': 'bg-layer-basement',
  'layer-default': 'bg-layer-default',
  'layer-floating': 'bg-layer-floating',
  'fg-neutral': 'bg-fg-neutral',
  'fg-muted': 'bg-fg-muted',
  'fg-brand': 'bg-fg-brand',
  'stroke-neutral': 'bg-stroke-neutral',
  'stroke-subtle': 'bg-stroke-subtle',
  'stroke-focus': 'bg-stroke-focus',
  'brand-solid': 'bg-brand-solid',
  'brand-weak': 'bg-brand-weak',
  'brand-stroke': 'bg-brand-stroke',
  'fg-on-brand': 'bg-fg-on-brand',
  'annotation-marker': 'bg-annotation-marker',
  'fg-on-annotation': 'bg-fg-on-annotation',
  'layer-inverse': 'bg-layer-inverse',
  'fg-on-inverse': 'bg-fg-on-inverse',
  'fg-on-inverse-muted': 'bg-fg-on-inverse-muted',
  'media-scrim': 'bg-media-scrim',
  'fg-on-media': 'bg-fg-on-media',
  'placeholder-fill': 'bg-placeholder-fill',
  'fg-placeholder': 'bg-fg-placeholder',
  'window-close': 'bg-window-close',
  'window-minimize': 'bg-window-minimize',
  'window-zoom': 'bg-window-zoom',
};

const layers = ['layer-basement', 'layer-default', 'layer-floating'];
const contrastPairs: Array<[string, string, number]> = [
  ...['fg-neutral', 'fg-muted', 'fg-brand'].flatMap((fg) =>
    layers.map((layer): [string, string, number] => [fg, layer, 4.5]),
  ),
  ['fg-on-brand', 'brand-solid', 4.5],
  ['fg-neutral', 'brand-weak', 4.5],
  ['fg-on-annotation', 'annotation-marker', 4.5],
  ...layers.map((layer): [string, string, number] => ['stroke-focus', layer, 3]),
  ...['stroke-neutral', 'brand-stroke'].flatMap((stroke) =>
    ['layer-default', 'layer-basement'].map((layer): [string, string, number] => [
      stroke,
      layer,
      3,
    ]),
  ),
  ['fg-muted', 'brand-weak', 4.5],
  ['fg-brand', 'brand-weak', 4.5],
  ['fg-on-inverse', 'layer-inverse', 4.5],
  ['fg-on-inverse-muted', 'layer-inverse', 4.5],
  ['fg-on-media', 'media-scrim', 4.5],
  ['fg-placeholder', 'placeholder-fill', 4.5],
];

type Rgb = [number, number, number];

function parseRgb(value: string): Rgb {
  const [red = 0, green = 0, blue = 0] = (value.match(/[\d.]+/g) ?? []).map(Number);
  return [red, green, blue];
}

function toHex(rgb: Rgb) {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

function linear(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]: Rgb) {
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrast(first: Rgb, second: Rgb) {
  const one = luminance(first);
  const two = luminance(second);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

// Renders hidden probes for every role inside the palette scope and reads their computed colors.
function usePaletteColors() {
  const probesRef = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<Record<string, Rgb>>({});

  useLayoutEffect(() => {
    const probes = probesRef.current;
    if (!probes) return;
    const next: Record<string, Rgb> = {};
    for (const element of probes.querySelectorAll<HTMLElement>('[data-role]')) {
      next[element.dataset.role ?? ''] = parseRgb(getComputedStyle(element).backgroundColor);
    }
    setColors(next);
  }, []);

  const probes = (
    <div ref={probesRef} aria-hidden="true" className="hidden">
      {Object.entries(swatchClassName).map(([role, className]) => (
        <span key={role} data-role={role} className={className} />
      ))}
    </div>
  );
  return { colors, probes };
}

function PaletteColumn({ id, name, note }: { id: Palette; name: string; note: string }) {
  const { colors, probes } = usePaletteColors();

  return (
    <section
      data-palette={id}
      aria-label={name}
      className="flex min-w-0 flex-col gap-5 rounded-panel border border-stroke-subtle bg-layer-basement p-4 text-fg-neutral"
    >
      {probes}
      <div className="flex flex-col gap-1">
        <h2 className="text-title-3 font-bold">{name}</h2>
        <p className="text-label text-fg-muted break-keep">{note}</p>
      </div>
      {roleGroups.map((group) => (
        <div key={group.title} className="flex flex-col gap-2">
          <h3 className="text-label font-bold text-fg-muted">{group.title}</h3>
          <ul className="grid grid-cols-2 gap-2">
            {group.roles.map((role) => (
              <li key={role} className="flex min-w-0 items-center gap-2">
                <span
                  className={`size-8 shrink-0 rounded-input border border-stroke-subtle ${swatchClassName[role]}`}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-label wrap-anywhere">{role}</span>
                  <code className="text-label text-fg-muted">
                    {colors[role] ? toHex(colors[role]) : ''}
                  </code>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <h3 className="text-label font-bold text-fg-muted">견본</h3>
        <div className="flex flex-wrap items-center gap-2 rounded-panel bg-layer-default p-3">
          <span className="inline-flex min-h-target-primary items-center rounded-control border border-brand-stroke bg-brand-solid px-4 text-body font-bold text-fg-on-brand">
            학교 이메일로 시작하기
          </span>
          <span className="text-body font-bold">
            <span className="bg-annotation-marker px-0.5 text-fg-on-annotation">생활패턴</span>부터
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-label font-bold text-fg-muted">대비({contrastPairs.length}쌍)</h3>
        <table className="w-full text-left text-label tabular-nums">
          <thead>
            <tr className="border-b border-stroke-neutral text-fg-muted">
              <th scope="col" className="py-1 pr-2 font-medium">
                앞 / 뒤
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                비
              </th>
              <th scope="col" className="py-1 font-medium">
                기준
              </th>
            </tr>
          </thead>
          <tbody>
            {contrastPairs.map(([foreground, background, minimum]) => {
              const first = colors[foreground];
              const second = colors[background];
              const ratio = first && second ? contrast(first, second) : undefined;
              return (
                <tr key={`${foreground}/${background}`} className="border-b border-stroke-subtle">
                  <td className="py-1 pr-2 wrap-anywhere">
                    {foreground} / {background}
                  </td>
                  <td className="py-1 pr-2">{ratio ? ratio.toFixed(2) : ''}</td>
                  <td className="py-1">
                    {ratio === undefined
                      ? ''
                      : ratio >= minimum
                        ? `통과 ${minimum}`
                        : `미달 ${minimum}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const meta = {
  title: 'Foundations/Samples/Palettes',
  tags: ['knu-layer'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

export const Contexts: Story = {
  name: 'D 울트라마린 · 라이트·다크',
  render: () => (
    <main className="mx-auto flex max-w-page flex-col gap-6 p-4 lg:p-section">
      <h1 className="text-title-1 font-bold">색 · D 울트라마린</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {palettes.map((palette) => (
          <PaletteColumn key={palette.id} {...palette} />
        ))}
      </div>
    </main>
  ),
};
