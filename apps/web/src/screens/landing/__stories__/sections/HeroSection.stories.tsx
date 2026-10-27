import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { HeroSection } from '../../components/sections/HeroSection';
import { frameArgTypes, inLandingFrame, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Sections/Hero',
  component: HeroSection,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '첫 화면: 밤 그림 위 제목·본문, 질문 상자, 가입 버튼과 그 결과 문장, 고지 두 줄(학교 공식 서비스 아님·호실 미보장). 그림 때문에 늘 어두운 문맥입니다.',
      },
    },
  },
  decorators: [inLandingFrame],
  args: { scheme: 'dark' },
  argTypes: { ...frameArgTypes },
} satisfies Meta<ComponentProps<typeof HeroSection> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
