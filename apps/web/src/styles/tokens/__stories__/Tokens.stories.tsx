import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

// Token samples for review and screenshot comparison. Each sample shows the token name and the
// value the browser computed from the generated CSS, so the story never repeats a literal value.
// Text pairs are the contrast pairs that tokens/__tests__/build-tokens.test.ts checks.

type Sample = {
  token: string;
  className: string;
  content?: ReactNode;
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
  { token: 'color-fg-subtle', className: `${swatch} bg-fg-subtle` },
  { token: 'color-fg-inverted', className: `${swatch} bg-fg-inverted` },
  { token: 'color-fg-brand', className: `${swatch} bg-fg-brand` },
  { token: 'color-fg-critical', className: `${swatch} bg-fg-critical` },
  { token: 'color-fg-warning', className: `${swatch} bg-fg-warning` },
  { token: 'color-fg-positive', className: `${swatch} bg-fg-positive` },
  { token: 'color-fg-informative', className: `${swatch} bg-fg-informative` },
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
  { token: 'color-critical-solid', className: `${swatch} bg-critical-solid` },
  { token: 'color-critical-weak', className: `${swatch} bg-critical-weak` },
  { token: 'color-warning-solid', className: `${swatch} bg-warning-solid` },
  { token: 'color-warning-weak', className: `${swatch} bg-warning-weak` },
  { token: 'color-positive-solid', className: `${swatch} bg-positive-solid` },
  { token: 'color-positive-weak', className: `${swatch} bg-positive-weak` },
  { token: 'color-informative-solid', className: `${swatch} bg-informative-solid` },
  { token: 'color-informative-weak', className: `${swatch} bg-informative-weak` },
];

const pairSamples: Sample[] = [
  {
    token: 'fg-inverted / brand-solid',
    className: 'rounded-control bg-brand-solid p-3 text-body text-fg-inverted',
    content: '주 행동',
  },
  {
    token: 'fg-critical / critical-weak',
    className: 'rounded-control bg-critical-weak p-3 text-body text-fg-critical',
    content: '차단됨: 신고가 접수되었습니다',
  },
  {
    token: 'fg-warning / warning-weak',
    className: 'rounded-control bg-warning-weak p-3 text-body text-fg-warning',
    content: '주의: 마감이 가까워요',
  },
  {
    token: 'fg-positive / positive-weak',
    className: 'rounded-control bg-positive-weak p-3 text-body text-fg-positive',
    content: '확인: 매칭이 성사됐어요',
  },
  {
    token: 'fg-informative / informative-weak',
    className: 'rounded-control bg-informative-weak p-3 text-body text-fg-informative',
    content: '안내: 다음 단계로 진행하세요',
  },
  {
    token: 'fg-inverted / critical-solid',
    className: 'rounded-control bg-critical-solid p-3 text-body text-fg-inverted',
    content: '차단',
  },
  {
    token: 'fg-inverted / warning-solid',
    className: 'rounded-control bg-warning-solid p-3 text-body text-fg-inverted',
    content: '주의',
  },
  {
    token: 'fg-inverted / positive-solid',
    className: 'rounded-control bg-positive-solid p-3 text-body text-fg-inverted',
    content: '확인',
  },
  {
    token: 'fg-inverted / informative-solid',
    className: 'rounded-control bg-informative-solid p-3 text-body text-fg-inverted',
    content: '안내',
  },
];

const textSamples: Sample[] = [
  { token: 'text-caption', className: 'text-caption' },
  { token: 'text-label', className: 'text-label' },
  { token: 'text-body-sm', className: 'text-body-sm' },
  { token: 'text-body', className: 'text-body' },
  { token: 'text-body-long', className: 'text-body-long' },
  { token: 'text-body-lg', className: 'text-body-lg' },
  { token: 'text-title-3', className: 'text-title-3 font-bold' },
  { token: 'text-title-2', className: 'text-title-2 font-bold' },
  { token: 'text-title-1', className: 'text-title-1 font-bold' },
  { token: 'text-display-3 · font-display', className: 'font-display text-display-3' },
  { token: 'text-display-2 · font-display', className: 'font-display text-display-2' },
  { token: 'text-display-1 · font-display', className: 'font-display text-display-1' },
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
  { token: 'fg-subtle', className: 'text-body text-fg-subtle', content: '가장 약한 글자' },
  { token: 'fg-brand', className: 'text-body text-fg-brand', content: '강조 링크' },
];

const spacingSamples: Sample[] = [
  { token: 'spacing (배수 기준) · w-4', className: 'h-4 w-4 bg-brand-solid' },
  { token: 'spacing-gutter', className: 'h-4 w-gutter bg-brand-solid' },
  { token: 'spacing-gutter-wide', className: 'h-4 w-gutter-wide bg-brand-solid' },
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
  { token: 'radius-card', className: 'size-16 rounded-card border-2 border-stroke-neutral' },
  { token: 'radius-panel', className: 'size-16 rounded-panel border-2 border-stroke-neutral' },
  { token: 'radius-sheet', className: 'size-16 rounded-sheet border-2 border-stroke-neutral' },
];

const targetSamples: Sample[] = [
  { token: 'spacing-target-min', className: 'size-target-min bg-brand-weak' },
  { token: 'spacing-target-primary', className: 'size-target-primary bg-brand-weak' },
];

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
    output.textContent = properties.map((property) => style.getPropertyValue(property)).join(' / ');
  }, [properties]);

  return (
    <li className="flex min-w-0 flex-col gap-2">
      <div ref={sampleRef} className={sample.className}>
        {sample.content}
      </div>
      <p className="text-label text-fg-neutral">{sample.token}</p>
      <code ref={valueRef} className="font-body text-caption text-fg-muted wrap-anywhere" />
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
    <section className="flex flex-col gap-4 rounded-panel bg-layer-default p-gutter">
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
    <main className="mx-auto flex max-w-page flex-col gap-6 p-gutter lg:p-section">
      <h1 className="font-display text-display-3 text-balance">{title}</h1>
      {children}
    </main>
  );
}

const meta = {
  title: 'Tokens/KNU',
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
        columns="grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      />
      <SampleGroup
        title="선"
        samples={strokeSamples}
        properties={BORDER_PROPERTIES}
        columns="grid-cols-1 md:grid-cols-3"
      />
      <SampleGroup
        title="브랜드·상태 면"
        samples={fillSamples}
        properties={COLOR_PROPERTIES}
        columns="grid-cols-2 md:grid-cols-4 lg:grid-cols-5"
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
        columns="grid-cols-2 md:grid-cols-4"
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
        columns="grid-cols-2 md:grid-cols-5"
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
