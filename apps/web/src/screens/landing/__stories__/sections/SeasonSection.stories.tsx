import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { SeasonSection } from '../../components/sections/SeasonSection';
import { frameArgTypes, inLandingFrame, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Sections/Season',
  component: SeasonSection,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '시즌: 시즌이 무엇인지 한 줄, 한 해 위 시즌 등록 기간(1·2월, 7·8월), 시즌 기능 고지. 지금 시즌 상태는 보이지 않습니다(시즌 API를 부르지 않음).',
      },
    },
  },
  decorators: [inLandingFrame],
  args: { scheme: 'dark' },
  argTypes: {
    ...frameArgTypes,
  },
} satisfies Meta<ComponentProps<typeof SeasonSection> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
