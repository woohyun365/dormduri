import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { StepSection } from '../../components/sections/StepSection';
import { frameArgTypes, inLandingFrame, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Sections/Step',
  component: StepSection,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '세 단계(01 찾기 · 02 대화 · 03 매칭): 단계 글과 휴대폰 캡처 자리 두 개. 넓은 화면에서는 글이 옆에 붙어 있습니다.',
      },
    },
  },
  decorators: [inLandingFrame],
  args: { scheme: 'dark', step: 'search' },
  argTypes: {
    ...frameArgTypes,
    step: { control: 'inline-radio', options: ['search', 'chat', 'match'] },
  },
} satisfies Meta<ComponentProps<typeof StepSection> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Search: Story = { name: '01 찾기' };
export const Chat: Story = { name: '02 대화', args: { step: 'chat' } };
export const Match: Story = { name: '03 매칭', args: { step: 'match' } };
