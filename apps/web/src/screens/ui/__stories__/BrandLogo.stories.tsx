import type { Decorator, Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { BrandLogo } from '../brand';

// A shared part has no feature frame to borrow, so the decorator gives the same palette attribute and
// layer classes the product frames do. `none` leaves the attribute off on the white layer: the root
// values and the white background the existing page headers get.
type PaletteArgs = { palette: 'dark' | 'light' | 'none' };
type StoryArgs = ComponentProps<typeof BrandLogo> & PaletteArgs;

const inPalette: Decorator = (Story, { args }) => {
  const palette = (args as Partial<PaletteArgs>).palette ?? 'dark';
  return (
    <div
      data-palette={palette === 'none' ? undefined : palette}
      className={`${palette === 'none' ? 'bg-layer-default' : 'bg-layer-basement'} p-gutter font-body text-fg-neutral`}
    >
      <Story />
    </div>
  );
};

const meta = {
  title: 'UI/BrandLogo',
  component: BrandLogo,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '서비스 로고: 곰 집 마크와 손으로 그린 돔두리·dormduri 글자. 마크는 꾸밈이라 읽지 않고, 글자가 이름 "돔두리" 하나를 읽힙니다. 돔과 영문 줄은 brand 색, 두리는 감싼 글자색을 받습니다. 흰 마크는 어두운 면에서 고를 수 있고, lg는 footer 크기입니다.',
      },
    },
  },
  decorators: [inPalette],
  args: { palette: 'dark', tone: 'color', size: 'md' },
  argTypes: {
    palette: {
      control: 'inline-radio',
      options: ['dark', 'light', 'none'],
      description: 'palette 문맥(어두운 판 dark · 밝은 판 light · 판 없음 none = 기존 화면 header)',
    },
    tone: { control: 'inline-radio', options: ['color', 'white'] },
    size: { control: 'inline-radio', options: ['md', 'lg'] },
  },
} satisfies Meta<StoryArgs>;
export default meta;

type Story = StoryObj<StoryArgs>;

export const Dark: Story = { name: '어두운 판' };
export const DarkWhite: Story = { name: '어두운 판 · 흰 마크', args: { tone: 'white' } };
export const Light: Story = { name: '밝은 판', args: { palette: 'light' } };
export const NoPalette: Story = { name: '판 없음(기존 화면 header)', args: { palette: 'none' } };
export const Footer: Story = { name: '큰 크기(footer)', args: { size: 'lg' } };
