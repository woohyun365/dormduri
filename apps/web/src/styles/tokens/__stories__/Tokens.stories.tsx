import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

// Token samples for review and screenshot comparison. Each sample shows the token name and the
// value the browser computed from the generated CSS, so the story never repeats a literal value.
// Text pairs are the contrast pairs that tokens/__tests__/build-tokens.test.ts checks. The Foundations
// docs pages (*.mdx beside this file) explain each group and show these samples.

type Sample = {
  token: string;
  className: string;
  content?: ReactNode;
  // Read these instead of the group's properties (a custom property per sample).
  properties?: readonly string[];
};

const COLOR_PROPERTIES = ['background-color'];
const TEXT_COLOR_PROPERTIES = ['color'];
const BORDER_PROPERTIES = ['border-top-color'];
const TEXT_PROPERTIES = ['font-size', 'line-height', 'font-weight'];
const WIDTH_PROPERTIES = ['width'];
const MAX_WIDTH_PROPERTIES = ['max-width'];
const RADIUS_PROPERTIES = ['border-top-left-radius'];
const SIZE_PROPERTIES = ['width', 'height'];
const FOCUS_PROPERTIES = ['outline-width', 'outline-offset', 'outline-color'];
const PAIR_PROPERTIES = ['color', 'background-color'];

const swatch = 'h-12 w-full rounded-control border border-stroke-subtle';
const typeSample = '기숙사 룸메이트를 찾아요 Aa 0123';

const layerSamples: Sample[] = [
  { token: 'color-layer-basement', className: `${swatch} bg-layer-basement` },
  { token: 'color-layer-default', className: `${swatch} bg-layer-default` },
  { token: 'color-layer-floating', className: `${swatch} bg-layer-floating` },
];

const foregroundSamples: Sample[] = [
  { token: 'color-fg-neutral', className: `${swatch} bg-fg-neutral` },
  { token: 'color-fg-muted', className: `${swatch} bg-fg-muted` },
  { token: 'color-fg-brand', className: `${swatch} bg-fg-brand` },
  { token: 'color-fg-on-brand', className: `${swatch} bg-fg-on-brand` },
];

const strokeSamples: Sample[] = [
  {
    token: 'color-stroke-neutral',
    className: 'h-12 w-full rounded-control border-2 border-stroke-neutral',
  },
  {
    token: 'color-stroke-subtle',
    className: 'h-12 w-full rounded-control border-2 border-stroke-subtle',
  },
  {
    token: 'color-stroke-focus',
    className: 'h-12 w-full rounded-control border-2 border-stroke-focus',
  },
];

const fillSamples: Sample[] = [
  { token: 'color-brand-solid', className: `${swatch} bg-brand-solid` },
  { token: 'color-brand-weak', className: `${swatch} bg-brand-weak` },
  { token: 'color-window-close', className: `${swatch} bg-window-close` },
  { token: 'color-window-minimize', className: `${swatch} bg-window-minimize` },
  { token: 'color-window-zoom', className: `${swatch} bg-window-zoom` },
];

const pairSamples: Sample[] = [
  {
    token: 'fg-on-brand / brand-solid',
    className: 'rounded-control bg-brand-solid p-3 text-body text-fg-on-brand',
    content: '주 행동',
  },
  {
    token: 'fg-brand / brand-weak',
    className: 'rounded-control bg-brand-weak p-3 text-body text-fg-brand',
    content: '강조 면',
  },
  {
    token: 'fg-on-inverse / layer-inverse',
    className: 'rounded-control bg-layer-inverse p-3 text-body text-fg-on-inverse',
    content: '반전 띠',
  },
  {
    token: 'fg-on-annotation / annotation-marker',
    className: 'rounded-control bg-annotation-marker p-3 text-body text-fg-on-annotation',
    content: '형광펜 표시',
  },
];

const textSamples: Sample[] = [
  { token: 'text-label', className: 'text-label' },
  { token: 'text-body-sm', className: 'text-body-sm' },
  { token: 'text-body', className: 'text-body' },
  { token: 'text-title-3', className: 'text-title-3 font-bold' },
  { token: 'text-title-2', className: 'text-title-2 font-bold' },
  { token: 'text-title-1', className: 'text-title-1 font-bold' },
  { token: 'text-display-3', className: 'text-display-3' },
  { token: 'text-display-2', className: 'text-display-2' },
  { token: 'text-display-1', className: 'text-display-1' },
].map((sample) => ({
  ...sample,
  className: `${sample.className} break-keep wrap-anywhere text-balance text-fg-neutral`,
  content: typeSample,
}));

const weightSamples: Sample[] = [
  { token: 'font-body · font-normal', className: 'text-body font-normal', content: typeSample },
  { token: 'font-body · font-medium', className: 'text-body font-medium', content: typeSample },
  { token: 'font-body · font-bold', className: 'text-body font-bold', content: typeSample },
];

const textColorSamples: Sample[] = [
  { token: 'fg-neutral', className: 'text-body text-fg-neutral', content: '본문 글자' },
  { token: 'fg-muted', className: 'text-body text-fg-muted', content: '보조 글자' },
  { token: 'fg-brand', className: 'text-body text-fg-brand', content: '강조 링크' },
];

const spacingSamples: Sample[] = [
  { token: 'spacing (배수 기준) · w-4', className: 'h-4 w-4 bg-brand-solid' },
  { token: 'spacing-gutter', className: 'h-4 w-gutter bg-brand-solid' },
  { token: 'spacing-section', className: 'h-4 w-section bg-brand-solid' },
  { token: 'spacing-section-desktop', className: 'h-4 w-section-desktop bg-brand-solid' },
];

const containerSamples: Sample[] = [
  { token: 'container-page', className: 'h-4 max-w-page bg-brand-weak' },
  { token: 'container-reading', className: 'h-4 max-w-reading bg-brand-weak' },
];

const radiusSamples: Sample[] = [
  { token: 'radius-input', className: 'size-16 rounded-input border-2 border-stroke-neutral' },
  { token: 'radius-control', className: 'size-16 rounded-control border-2 border-stroke-neutral' },
  { token: 'radius-panel', className: 'size-16 rounded-panel border-2 border-stroke-neutral' },
  { token: 'radius-sheet', className: 'size-16 rounded-sheet border-2 border-stroke-neutral' },
];

const targetSamples: Sample[] = [
  { token: 'spacing-target-min', className: 'size-target-min bg-brand-weak' },
  { token: 'spacing-target-primary', className: 'size-target-primary bg-brand-weak' },
];

// Durations and easings are :root custom properties without utilities; each sample reads its own.
const durationSamples: Sample[] = ['slow', 'reveal', 'stagger', 'settle', 'band'].map((name) => ({
  token: `duration-${name}`,
  className: 'h-2 w-full rounded-full bg-brand-weak',
  properties: [`--duration-${name}`],
}));

const easeSamples: Sample[] = ['standard', 'emphasized'].map((name) => ({
  token: `ease-${name}`,
  className: 'h-2 w-full rounded-full bg-brand-weak',
  properties: [`--ease-${name}`],
}));

const focusSamples: Sample[] = [
  {
    token: 'focus-ring (stroke-focus · focus-ring-width · focus-ring-offset)',
    className:
      'flex size-target-primary items-center justify-center rounded-control bg-layer-default text-label focus-ring',
    content: 'focus',
  },
];

function TokenSample({ sample, properties }: { sample: Sample; properties: readonly string[] }) {
  const sampleRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const element = sampleRef.current;
    const output = valueRef.current;
    if (!element || !output) return;
    const style = getComputedStyle(element);
    output.textContent = (sample.properties ?? properties)
      .map((property) => style.getPropertyValue(property).trim())
      .join(' / ');
  }, [properties, sample.properties]);

  return (
    <li className="flex min-w-0 flex-col gap-2">
      <div ref={sampleRef} className={sample.className}>
        {sample.content}
      </div>
      <p className="text-label text-fg-neutral">{sample.token}</p>
      <code ref={valueRef} className="font-body text-label text-fg-muted wrap-anywhere" />
    </li>
  );
}

function SampleGroup({
  title,
  samples,
  properties,
  columns,
}: {
  title: string;
  samples: Sample[];
  properties: readonly string[];
  columns: string;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-panel bg-layer-default p-4">
      <h2 className="text-title-3 font-bold">{title}</h2>
      <ul className={`grid gap-4 ${columns}`}>
        {samples.map((sample) => (
          <TokenSample key={sample.token} sample={sample} properties={properties} />
        ))}
      </ul>
    </section>
  );
}

function SampleSheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-page flex-col gap-6 p-4 lg:p-section">
      <h1 className="text-display-3 text-balance">{title}</h1>
      {children}
    </main>
  );
}

const meta = {
  title: 'Foundations/Samples/Tokens',
  tags: ['visual', 'knu-layer'],
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

export const Colors: Story = {
  render: () => (
    <SampleSheet title="색">
      <SampleGroup
        title="층"
        samples={layerSamples}
        properties={COLOR_PROPERTIES}
        columns="grid-cols-1 md:grid-cols-3"
      />
      <SampleGroup
        title="글자 색"
        samples={foregroundSamples}
        properties={COLOR_PROPERTIES}
        columns="grid-cols-2 md:grid-cols-4"
      />
      <SampleGroup
        title="선"
        samples={strokeSamples}
        properties={BORDER_PROPERTIES}
        columns="grid-cols-1 md:grid-cols-3"
      />
      <SampleGroup
        title="브랜드 면·창 단추"
        samples={fillSamples}
        properties={COLOR_PROPERTIES}
        columns="grid-cols-2 md:grid-cols-5"
      />
      <SampleGroup
        title="글자와 면의 짝"
        samples={pairSamples}
        properties={PAIR_PROPERTIES}
        columns="grid-cols-1 md:grid-cols-2"
      />
    </SampleSheet>
  ),
};

export const Typography: Story = {
  render: () => (
    <SampleSheet title="글자">
      <SampleGroup
        title="type scale"
        samples={textSamples}
        properties={TEXT_PROPERTIES}
        columns="grid-cols-1"
      />
      <SampleGroup
        title="weight"
        samples={weightSamples}
        properties={TEXT_PROPERTIES}
        columns="grid-cols-1 md:grid-cols-3"
      />
      <SampleGroup
        title="글자 색"
        samples={textColorSamples}
        properties={TEXT_COLOR_PROPERTIES}
        columns="grid-cols-1 md:grid-cols-3"
      />
    </SampleSheet>
  ),
};

export const SpacingAndRadius: Story = {
  render: () => (
    <SampleSheet title="간격·폭·radius">
      <SampleGroup
        title="간격"
        samples={spacingSamples}
        properties={WIDTH_PROPERTIES}
        columns="grid-cols-1"
      />
      <SampleGroup
        title="폭"
        samples={containerSamples}
        properties={MAX_WIDTH_PROPERTIES}
        columns="grid-cols-1"
      />
      <SampleGroup
        title="radius"
        samples={radiusSamples}
        properties={RADIUS_PROPERTIES}
        columns="grid-cols-2 md:grid-cols-4"
      />
    </SampleSheet>
  ),
};

export const TargetAndFocus: Story = {
  render: () => (
    <SampleSheet title="타깃·focus">
      <SampleGroup
        title="터치 타깃"
        samples={targetSamples}
        properties={SIZE_PROPERTIES}
        columns="grid-cols-2"
      />
      <SampleGroup
        title="focus 표시"
        samples={focusSamples}
        properties={FOCUS_PROPERTIES}
        columns="grid-cols-1"
      />
    </SampleSheet>
  ),
};

// Not visual-tagged: no Linux baseline yet. The motion reduced context shows every duration as 0ms.
export const Motion: Story = {
  tags: ['!visual'],
  render: () => (
    <SampleSheet title="motion">
      <SampleGroup
        title="duration"
        samples={durationSamples}
        properties={[]}
        columns="grid-cols-2 md:grid-cols-5"
      />
      <SampleGroup
        title="easing"
        samples={easeSamples}
        properties={[]}
        columns="grid-cols-1 md:grid-cols-2"
      />
    </SampleSheet>
  ),
};
