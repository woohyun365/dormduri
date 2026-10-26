import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { NoticeLines } from '../../components/NoticeLines';
import { frameArgTypes, inLandingPanel, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Components/NoticeLines',
  component: NoticeLines,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '첫 화면 고지 두 줄: 학교 공식 서비스 아님, 기숙사 배정·호실 선택 보장 안 함. 문장은 정책 고지 원본 그대로입니다.',
      },
    },
  },
  decorators: [inLandingPanel],
  args: { scheme: 'dark' },
  argTypes: { ...frameArgTypes },
} satisfies Meta<ComponentProps<typeof NoticeLines> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
