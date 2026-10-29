import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { ItemsSection } from '../../components/sections/ItemsSection';
import { frameArgTypes, inLandingFrame, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Sections/Items',
  component: ItemsSection,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '생활패턴 항목: 운에 맡기던 방식을 지우는 문장과, 나·상대 두 생활패턴 카드를 끌어(휴대폰은 버튼으로) 겹쳐 보는 비교.',
      },
    },
  },
  decorators: [inLandingFrame],
  args: { scheme: 'dark' },
  argTypes: {
    ...frameArgTypes,
  },
} satisfies Meta<ComponentProps<typeof ItemsSection> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
