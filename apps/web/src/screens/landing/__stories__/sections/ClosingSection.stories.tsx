import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { ClosingSection } from '../../components/sections/ClosingSection';
import { frameArgTypes, inLandingFrame, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Sections/Closing',
  component: ClosingSection,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '마지막: 새벽 그림 위 제목과 가입 버튼. 그림 때문에 늘 어두운 문맥입니다.',
      },
    },
  },
  decorators: [inLandingFrame],
  args: { scheme: 'dark' },
  argTypes: { ...frameArgTypes },
} satisfies Meta<ComponentProps<typeof ClosingSection> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
