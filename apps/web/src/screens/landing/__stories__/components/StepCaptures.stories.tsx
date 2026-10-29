import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { StepCaptures } from '../../components/StepCaptures';
import { stepCaptures } from '../../model/landingCopy';
import { frameArgTypes, inLandingPanel, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Components/StepCaptures',
  component: StepCaptures,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '단계마다 휴대폰 화면 두 개의 캡처 자리(390×844). 메인 탭 화면이 정해지면 캡처로 바꿉니다.',
      },
    },
  },
  decorators: [inLandingPanel],
  args: { scheme: 'dark', screens: stepCaptures.search },
  argTypes: { ...frameArgTypes, screens: { control: false } },
} satisfies Meta<ComponentProps<typeof StepCaptures> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Search: Story = { name: '01 찾기' };
export const Chat: Story = { name: '02 대화', args: { screens: stepCaptures.chat } };
export const Match: Story = { name: '03 매칭', args: { screens: stepCaptures.match } };
