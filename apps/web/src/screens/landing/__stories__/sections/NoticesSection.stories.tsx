import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { NoticesSection } from '../../components/sections/NoticesSection';
import { frameArgTypes, inLandingFrame, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Sections/Notices',
  component: NoticesSection,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '알아두세요: 고지 다섯 줄(학교 시스템·기숙사 배정·생활패턴 설문·개인정보·신고·문의). 문장은 정책 고지 원본 그대로입니다.',
      },
    },
  },
  decorators: [inLandingFrame],
  args: { scheme: 'dark' },
  argTypes: {
    ...frameArgTypes,
  },
} satisfies Meta<ComponentProps<typeof NoticesSection> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
