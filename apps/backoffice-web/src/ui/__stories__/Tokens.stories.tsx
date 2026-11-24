import type { Meta, StoryObj } from '@storybook/nextjs-vite';

// Samples of the semantic tokens in src/app/globals.css (design guide ②). The class names are literal so Tailwind
// generates them; swatches carry no text, and each name is written next to its swatch.

const COLOR_GROUPS: readonly {
  title: string;
  swatches: readonly { name: string; className: string }[];
}[] = [
  {
    title: '층',
    swatches: [
      { name: 'layer-basement', className: 'bg-layer-basement' },
      { name: 'layer-default', className: 'bg-layer-default' },
      { name: 'layer-muted', className: 'bg-layer-muted' },
    ],
  },
  {
    title: '글자',
    swatches: [
      { name: 'fg-neutral', className: 'bg-fg-neutral' },
      { name: 'fg-label', className: 'bg-fg-label' },
      { name: 'fg-description', className: 'bg-fg-description' },
      { name: 'fg-muted', className: 'bg-fg-muted' },
      { name: 'fg-disabled', className: 'bg-fg-disabled' },
      { name: 'fg-on-brand', className: 'bg-fg-on-brand' },
    ],
  },
  {
    title: '선',
    swatches: [
      { name: 'stroke-neutral', className: 'bg-stroke-neutral' },
      { name: 'stroke-subtle', className: 'bg-stroke-subtle' },
      { name: 'stroke-row', className: 'bg-stroke-row' },
    ],
  },
  {
    title: '브랜드(주 행동)',
    swatches: [
      { name: 'brand-solid', className: 'bg-brand-solid' },
      { name: 'brand-solid-hover', className: 'bg-brand-solid-hover' },
      { name: 'brand-solid-disabled', className: 'bg-brand-solid-disabled' },
    ],
  },
  {
    title: '상태',
    swatches: [
      { name: 'success-weak', className: 'bg-success-weak' },
      { name: 'fg-success', className: 'bg-fg-success' },
      { name: 'fg-success-strong', className: 'bg-fg-success-strong' },
      { name: 'warning-weak', className: 'bg-warning-weak' },
      { name: 'fg-warning', className: 'bg-fg-warning' },
      { name: 'danger-weak', className: 'bg-danger-weak' },
      { name: 'fg-danger', className: 'bg-fg-danger' },
    ],
  },
];

const TYPE_SCALE: readonly { name: string; className: string }[] = [
  { name: 'text-title-1', className: 'text-title-1 font-semibold' },
  { name: 'text-title-2', className: 'text-title-2 font-semibold' },
  { name: 'text-title-3', className: 'text-title-3 font-semibold' },
  { name: 'text-body', className: 'text-body' },
  { name: 'text-caption', className: 'text-caption' },
];

const RADII: readonly { name: string; className: string }[] = [
  { name: 'rounded-control', className: 'rounded-control' },
  { name: 'rounded-box', className: 'rounded-box' },
  { name: 'rounded-card', className: 'rounded-card' },
];

function TokenSamples() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <h1 className="text-title-1 font-semibold">백오피스 token</h1>
      {COLOR_GROUPS.map((group) => (
        <section key={group.title} aria-label={group.title} className="flex flex-col gap-3">
          <h2 className="text-title-3 font-semibold">{group.title}</h2>
          <ul className="flex flex-wrap gap-4">
            {group.swatches.map((swatch) => (
              <li key={swatch.name} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`h-8 w-12 rounded-box border border-stroke-subtle ${swatch.className}`}
                />
                <code className="font-code text-body">{swatch.name}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section aria-label="글자 단계" className="flex flex-col gap-3">
        <h2 className="text-title-3 font-semibold">글자 단계</h2>
        {TYPE_SCALE.map((step) => (
          <p key={step.name} className={step.className}>
            {step.name} · 운영자 계정 12건
          </p>
        ))}
      </section>
      <section aria-label="radius" className="flex flex-col gap-3">
        <h2 className="text-title-3 font-semibold">radius</h2>
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
        </ul>
      </section>
      <section aria-label="폭" className="flex flex-col gap-3">
        <h2 className="text-title-3 font-semibold">폭</h2>
        <p className="text-body">
          <code className="font-code">max-w-page</code>: console 화면 ·{' '}
          <code className="font-code">max-w-narrow</code>: 로그인·안내 화면
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
