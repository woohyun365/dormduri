import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { FaqSection } from '../../components/sections/FaqSection';
import { frameArgTypes, inLandingFrame, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Sections/Faq',
  component: FaqSection,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '자주 묻는 질문 다섯 개. 정적 문구이고 고객센터 FAQ API를 부르지 않습니다.',
      },
    },
  },
  decorators: [inLandingFrame],
  args: { scheme: 'dark' },
  argTypes: {
    ...frameArgTypes,
  },
} satisfies Meta<ComponentProps<typeof FaqSection> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
