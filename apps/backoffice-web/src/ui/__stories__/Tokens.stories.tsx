import type { Meta, StoryObj } from '@storybook/nextjs-vite';

// Samples of the semantic tokens in src/app/globals.css (design guide ②). The class names are literal so Tailwind
// generates them; swatches carry no text, and each name is written next to its swatch.

const COLOR_GROUPS: readonly {
  title: string;
  swatches: readonly { name: string; className: string }[];
}[] = [
  {
    title: '셸',
    swatches: [
      { name: 'shell', className: 'bg-shell' },
      { name: 'shell-fg', className: 'bg-shell-fg' },
      { name: 'shell-muted', className: 'bg-shell-muted' },
      { name: 'shell-active', className: 'bg-shell-active' },
      { name: 'shell-active-fg', className: 'bg-shell-active-fg' },
      { name: 'shell-indicator', className: 'bg-shell-indicator' },
      { name: 'shell-hover', className: 'bg-shell-hover' },
      { name: 'shell-stroke', className: 'bg-shell-stroke' },
    ],
  },
  {
    title: '층',
    swatches: [
      { name: 'layer-basement', className: 'bg-layer-basement' },
      { name: 'layer-default', className: 'bg-layer-default' },
      { name: 'layer-muted', className: 'bg-layer-muted' },
      { name: 'layer-selected', className: 'bg-layer-selected' },
    ],
  },
  {
    title: '글자',
    swatches: [
      { name: 'fg-neutral', className: 'bg-fg-neutral' },
      { name: 'fg-label', className: 'bg-fg-label' },
      { name: 'fg-description', className: 'bg-fg-description' },
      { name: 'fg-muted', className: 'bg-fg-muted' },
      { name: 'fg-on-brand', className: 'bg-fg-on-brand' },
      { name: 'fg-brand', className: 'bg-fg-brand' },
    ],
  },
  {
    title: '선',
    swatches: [
      { name: 'stroke-neutral', className: 'bg-stroke-neutral' },
      { name: 'stroke-subtle', className: 'bg-stroke-subtle' },
      { name: 'stroke-row', className: 'bg-stroke-row' },
      { name: 'stroke-control', className: 'bg-stroke-control' },
      { name: 'stroke-focus', className: 'bg-stroke-focus' },
      { name: 'stroke-selected', className: 'bg-stroke-selected' },
    ],
  },
  {
    title: '브랜드(주 행동)·로고',
    swatches: [
      { name: 'brand-solid', className: 'bg-brand-solid' },
      { name: 'brand-solid-hover', className: 'bg-brand-solid-hover' },
      { name: 'logo-brand', className: 'bg-logo-brand' },
      { name: 'logo-ink', className: 'bg-logo-ink' },
    ],
  },
  {
    title: '상태',
    swatches: [
      { name: 'fg-pending', className: 'bg-fg-pending' },
      { name: 'info-weak', className: 'bg-info-weak' },
      { name: 'fg-info', className: 'bg-fg-info' },
      { name: 'stroke-info', className: 'bg-stroke-info' },
      { name: 'success-weak', className: 'bg-success-weak' },
      { name: 'fg-success', className: 'bg-fg-success' },
      { name: 'stroke-success', className: 'bg-stroke-success' },
      { name: 'warning-weak', className: 'bg-warning-weak' },
      { name: 'fg-warning', className: 'bg-fg-warning' },
      { name: 'stroke-warning', className: 'bg-stroke-warning' },
      { name: 'danger-weak', className: 'bg-danger-weak' },
      { name: 'fg-danger', className: 'bg-fg-danger' },
      { name: 'stroke-danger', className: 'bg-stroke-danger' },
      { name: 'danger-solid', className: 'bg-danger-solid' },
      { name: 'danger-solid-hover', className: 'bg-danger-solid-hover' },
    ],
  },
  {
    title: '면 채움(보조·위험 단추)·overlay',
    swatches: [
      { name: 'tint-neutral', className: 'bg-tint-neutral' },
      { name: 'tint-neutral-hover', className: 'bg-tint-neutral-hover' },
      { name: 'tint-danger-hover', className: 'bg-tint-danger-hover' },
      { name: 'scrim', className: 'bg-scrim' },
    ],
  },
];

const TYPE_SCALE: readonly { name: string; className: string }[] = [
  { name: 'text-title-1', className: 'text-title-1 font-bold' },
  { name: 'text-title-2', className: 'text-title-2 font-semibold' },
  { name: 'text-body', className: 'text-body' },
  { name: 'text-table', className: 'text-table' },
  { name: 'text-label', className: 'text-label font-semibold' },
  { name: 'text-caption', className: 'text-caption' },
];

const RADII: readonly { name: string; className: string }[] = [
  { name: 'rounded-control', className: 'rounded-control' },
  { name: 'rounded-card', className: 'rounded-card' },
];

function TokenSamples() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <h1 className="text-title-1 font-bold">백오피스 token</h1>
      {COLOR_GROUPS.map((group) => (
        <section key={group.title} aria-label={group.title} className="flex flex-col gap-3">
          <h2 className="text-title-2 font-semibold">{group.title}</h2>
          <ul className="flex flex-wrap gap-4">
            {group.swatches.map((swatch) => (
              <li key={swatch.name} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`h-8 w-12 rounded-control border border-stroke-subtle ${swatch.className}`}
                />
                <code className="font-code text-body">{swatch.name}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section aria-label="글자 단계" className="flex flex-col gap-3">
        <h2 className="text-title-2 font-semibold">글자 단계</h2>
        {TYPE_SCALE.map((step) => (
          <p key={step.name} className={step.className}>
            {step.name} · 운영자 계정 12건
          </p>
        ))}
      </section>
      <section aria-label="radius·그림자" className="flex flex-col gap-3">
        <h2 className="text-title-2 font-semibold">radius·그림자</h2>
        <ul className="flex flex-wrap gap-4">
          {RADII.map((radius) => (
            <li key={radius.name} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-10 w-16 border border-stroke-neutral bg-layer-default ${radius.className}`}
              />
              <code className="font-code text-body">{radius.name}</code>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-10 w-16 rounded-card bg-layer-default shadow-overlay"
            />
            <code className="font-code text-body">shadow-overlay</code>
          </li>
        </ul>
      </section>
      <section aria-label="간격·크기·폭" className="flex flex-col gap-3">
        <h2 className="text-title-2 font-semibold">간격·크기·폭</h2>
        <p className="text-body">
          <code className="font-code">p-page</code>·<code className="font-code">p-card</code>·
          <code className="font-code">gap-stack</code>: page·카드·카드 사이 ·{' '}
          <code className="font-code">w-sidebar</code>·<code className="font-code">h-header</code>:
          셸 · <code className="font-code">grid-cols-master-detail</code>: 권한 요청 목록·상세 ·{' '}
          <code className="font-code">max-w-narrow</code>: 로그인·안내 카드
        </p>
      </section>
    </div>
  );
}

const meta = {
  title: 'Foundations/Tokens',
  component: TokenSamples,
} satisfies Meta<typeof TokenSamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Samples: Story = {};
