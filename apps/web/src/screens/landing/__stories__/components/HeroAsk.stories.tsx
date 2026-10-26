import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { fn } from 'storybook/test';
import { HeroAsk } from '../../components/HeroAsk';
import { frameArgTypes, inLandingPanel, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Components/HeroAsk',
  component: HeroAsk,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '첫 화면 질문 상자: 질문을 차례로 보여 주고, 누르면 그 질문에 답하는 영역으로 이동합니다(onGo). 검색 창이 아닙니다. 아래 버튼으로 자동 넘김을 멈춥니다. motion 줄이기에서는 넘기지 않습니다.',
      },
    },
  },
  decorators: [inLandingPanel],
  args: { scheme: 'dark', onGo: fn() },
  argTypes: { ...frameArgTypes },
} satisfies Meta<ComponentProps<typeof HeroAsk> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
