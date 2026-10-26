import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { SeasonLanes } from '../../components/SeasonLanes';
import { frameArgTypes, inLandingPanel, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Components/SeasonLanes',
  component: SeasonLanes,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '시즌 그림: 한 해(1~12월) 위에 시즌 등록 기간 두 개(1학기 1·2월, 2학기 7·8월). 휴대폰에서는 홀수 달 이름만 보입니다.',
      },
    },
  },
  decorators: [inLandingPanel],
  args: { scheme: 'dark' },
  argTypes: { ...frameArgTypes },
} satisfies Meta<ComponentProps<typeof SeasonLanes> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
